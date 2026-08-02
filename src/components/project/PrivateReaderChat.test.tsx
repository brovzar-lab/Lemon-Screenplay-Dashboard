import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { PrivateReaderChat } from '@/components/project/PrivateReaderChat';

vi.mock('@/lib/privateReaderChat', () => ({
  privateReaderChatMode: () => 'live',
  loadPrivateReaderConversation: vi.fn(async () => ({
    threadId: 'thread-1',
    exists: true,
    provenance: {
      charterVersion: 'reader-charters-v1',
      modelId: 'claude-fable-5',
      sealedProjectId: 'atlas',
      sealedVersionId: 'sealed-v1',
    },
    messages: [{
      id: 'message-1',
      role: 'reader',
      text: 'I underweighted the comic escalation.',
      citations: [{ page: 35, note: 'The joke compounds through the reversal.' }],
      position: 'reconsidered',
      reconsideredPosition: {
        summary: 'The protagonist is more active than my sealed report allowed.',
        suggestedScore: 6.4,
      },
      createdAt: '2026-08-02T12:00:00.000Z',
    }],
  })),
  sendPrivateReaderMessage: vi.fn(),
}));

const report = {
  reader: 'structure',
  label: 'Structure',
  pillarScore: 5.2,
  oneSentenceVerdict: 'The ending arrives late.',
  redFlags: [],
  subScores: [],
};

describe('PrivateReaderChat', () => {
  it('shows citations and a reconsidered view without replacing the sealed score', async () => {
    render(
      <PrivateReaderChat
        open
        onClose={vi.fn()}
        projectId="atlas"
        versionId="sealed-v1"
        reader="structure"
        readerName="Lena Park"
        readerRole="Structure Reader"
        readerImage="/reader-personas/structure.jpg"
        report={report}
      />,
    );

    expect(await screen.findByText('I underweighted the comic escalation.')).toBeInTheDocument();
    expect(screen.getByText('p. 35')).toBeInTheDocument();
    expect(screen.getByText('Position reconsidered')).toBeInTheDocument();
    expect(screen.getByText('New private view: 6.4')).toBeInTheDocument();
    expect(screen.getByText('The sealed score above has not changed.')).toBeInTheDocument();
  });

  it('closes the private conversation with Escape', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <PrivateReaderChat
        open
        onClose={onClose}
        projectId="atlas"
        versionId="sealed-v1"
        reader="structure"
        readerName="Lena Park"
        readerRole="Structure Reader"
        readerImage="/reader-personas/structure.jpg"
        report={report}
      />,
    );

    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledOnce();
  });
});
