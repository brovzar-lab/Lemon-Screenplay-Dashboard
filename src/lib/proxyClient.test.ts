import { describe, expect, it } from 'vitest';
import { buildProxyRequest, ProxyCallError } from './proxyClient';

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
});
