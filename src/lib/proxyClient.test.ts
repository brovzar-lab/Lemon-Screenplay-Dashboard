import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildProxyRequest, callLLM, ProxyCallError } from './proxyClient';

vi.mock('./firebase', () => ({
  authReady: Promise.resolve(),
  auth: { currentUser: null },
}));

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('buildProxyRequest', () => {
  it('uses Haiku 4.5 sampling without thinking by default', () => {
    expect(buildProxyRequest({
      model: 'claude-haiku-4-5-20251001',
      prompt: 'read',
      maxTokens: 2_000,
    })).toMatchObject({
      model: 'claude-haiku-4-5-20251001',
      temperature: 0.1,
      max_tokens: 2_000,
    });
  });

  it('uses adaptive thinking and effort for Opus 4.7 without sampling', () => {
    const request = buildProxyRequest({
      model: 'claude-opus-4-7',
      prompt: 'read',
    });
    expect(request).toMatchObject({
      thinking: { type: 'adaptive' },
      output_config: { effort: 'high' },
    });
    expect(request).not.toHaveProperty('temperature');
  });

  it('keeps benchmark candidates out of browser analysis calls', () => {
    expect(() => buildProxyRequest({ model: 'claude-sonnet-5', prompt: 'read' }))
      .toThrow(ProxyCallError);
  });

  it('preserves paid usage and exact provenance on model mismatch', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => ({
        error: 'model mismatch',
        code: 'MODEL_PROVENANCE_MISMATCH',
        isRetryable: false,
        requested_model: 'claude-sonnet-4-6',
        returned_model: 'claude-opus-4-7',
        response_id: 'msg_mismatch',
        stop_reason: 'end_turn',
        usage: {
          input_tokens: 100,
          output_tokens: 20,
          cache_creation_input_tokens: 0,
          cache_read_input_tokens: 0,
          actual_cost_microusd: 725,
          actual_cost_usd: 0.000725,
        },
      }),
    }));

    let failure: unknown;
    try {
      await callLLM({
        model: 'claude-sonnet-4-6',
        prompt: 'read',
      });
    } catch (error) {
      failure = error;
    }

    expect(failure).toBeInstanceOf(ProxyCallError);
    expect((failure as ProxyCallError).usage?.actual_cost_microusd).toBe(725);
    expect((failure as ProxyCallError).provenance).toEqual([expect.objectContaining({
      responseId: 'msg_mismatch',
      requestedModel: 'claude-sonnet-4-6',
      returnedModel: 'claude-opus-4-7',
      disposition: 'discarded_unusable',
    })]);
  });

  it('rejects a successful response without exact settled usage and cost', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        text: 'done',
        response_id: 'msg_no_usage',
        model: 'claude-sonnet-4-6',
        stop_reason: 'end_turn',
      }),
    }));

    await expect(callLLM({
      model: 'claude-sonnet-4-6',
      prompt: 'read',
    })).rejects.toThrow(/settled usage/i);
  });
});
