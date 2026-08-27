import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/proxyClient', () => ({
  callLLM: vi.fn(),
}));

import { callLLM } from '@/lib/proxyClient';
import { sendDevExecMessage } from './devExecService';

describe('sendDevExecMessage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses the approved browser text route after the Anthropic migration', async () => {
    vi.mocked(callLLM).mockResolvedValue({
      text: 'Read the draft again after the rewrite.',
      usage: {
        input_tokens: 10,
        output_tokens: 8,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 0,
        actual_cost_microusd: 50,
        actual_cost_usd: 0.00005,
      },
      provenance: {
        responseId: 'msg_dev_exec',
        requestedModel: 'claude-haiku-4-5-20251001',
        returnedModel: 'claude-haiku-4-5-20251001',
        stopReason: 'end_turn',
      },
    });

    await expect(sendDevExecMessage('What should I do?', [], [])).resolves.toBe(
      'Read the draft again after the rewrite.',
    );
    expect(callLLM).toHaveBeenCalledWith(expect.objectContaining({
      model: 'claude-haiku-4-5-20251001',
    }));
  });
});
