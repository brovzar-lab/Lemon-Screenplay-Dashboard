import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  loadPrivateReaderConversation,
  privateReaderChatMode,
  sendPrivateReaderMessage,
} from '@/lib/privateReaderChat';
import type { ReaderReportEvidence } from '@/types';

const report: ReaderReportEvidence = {
  reader: 'structure',
  label: 'Structure',
  pillarScore: 7.8,
  oneSentenceVerdict: 'The midpoint works, but the ending arrives late.',
  redFlags: [],
  subScores: [{
    key: 'turns',
    label: 'Turns',
    score: 8.1,
    justification: 'The midpoint reverses the plan.',
    pageCitations: [48, 51],
  }],
};

describe('privateReaderChat local review contract', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it('defaults to a no-cost local review without reaching the network', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    expect(privateReaderChatMode()).toBe('local_review');

    const conversation = await sendPrivateReaderMessage({
      projectId: 'atlas',
      versionId: 'sealed-v1',
      reader: 'structure',
      message: 'What made the ending feel late?',
      sealedReport: report,
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(conversation.messages).toHaveLength(2);
    expect(conversation.messages[1]).toEqual(expect.objectContaining({
      role: 'reader',
      position: 'unchanged',
      citations: expect.arrayContaining([expect.objectContaining({ page: 48 })]),
    }));
  });

  it('restores the exact saved conversation for that project version and reader', async () => {
    await sendPrivateReaderMessage({
      projectId: 'atlas',
      versionId: 'sealed-v1',
      reader: 'structure',
      message: 'What made the ending feel late?',
      sealedReport: report,
    });

    const restored = await loadPrivateReaderConversation({
      projectId: 'atlas',
      versionId: 'sealed-v1',
      reader: 'structure',
    });
    const otherReader = await loadPrivateReaderConversation({
      projectId: 'atlas',
      versionId: 'sealed-v1',
      reader: 'character',
    });

    expect(restored.messages[0].text).toBe('What made the ending feel late?');
    expect(otherReader.messages).toEqual([]);
  });
});
