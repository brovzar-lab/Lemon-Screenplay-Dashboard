import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createLiveToken, requestPoster } from './googleProxyClient';

vi.mock('./proxyClient', () => ({
  getProxyAuthHeaders: vi.fn().mockResolvedValue({ Authorization: 'Bearer test-token' }),
}));

describe('googleProxyClient', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('requests a one-use live session token through the authenticated proxy', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response(JSON.stringify({ token: 'ephemeral-token', model: 'gemini-live' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

    await expect(createLiveToken()).resolves.toEqual({
      token: 'ephemeral-token',
      model: 'gemini-live',
    });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('googleProxy'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer test-token' }),
        body: JSON.stringify({ action: 'live-token' }),
      }),
    );
  });

  it('requests a poster by screenplay and approved model without any API key or prompt', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            status: 'ready',
            url: 'https://example.com/poster.png',
            model: 'gemini-image',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );

    await requestPoster('project-1', 'economy');
    const request = fetchMock.mock.calls[0]?.[1];
    expect(request?.body).toBe(
      JSON.stringify({
        action: 'generate-poster',
        screenplayId: 'project-1',
        model: 'economy',
      }),
    );
    expect(String(request?.body)).not.toMatch(/AIza|apiKey/i);
    expect(String(request?.body)).not.toMatch(/prompt|base64/i);
  });

  it('surfaces the server error without exposing credentials', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: 'Admin access is required for poster generation.' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await expect(requestPoster('project-1', 'premium')).rejects.toThrow(
      'Admin access is required for poster generation.',
    );
  });
});
