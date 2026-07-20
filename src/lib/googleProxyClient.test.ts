import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createLiveToken, generatePosterImage } from './googleProxyClient';

vi.mock('./proxyClient', () => ({
  getProxyAuthHeaders: vi.fn().mockResolvedValue({ Authorization: 'Bearer test-token' }),
}));

describe('googleProxyClient', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('requests a one-use live session token through the authenticated proxy', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(
      JSON.stringify({ token: 'ephemeral-token', model: 'gemini-live' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    ));

    await expect(createLiveToken()).resolves.toEqual({
      token: 'ephemeral-token',
      model: 'gemini-live',
    });
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('googleProxy'), expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ Authorization: 'Bearer test-token' }),
      body: JSON.stringify({ action: 'live-token' }),
    }));
  });

  it('sends poster prompts without any API key', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(
      JSON.stringify({ data: 'base64-image', mimeType: 'image/png', model: 'gemini-image' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    ));

    await generatePosterImage('A theatrical poster for Lemon Studios');
    const request = fetchMock.mock.calls[0]?.[1];
    expect(request?.body).toBe(JSON.stringify({
      action: 'generate-poster',
      prompt: 'A theatrical poster for Lemon Studios',
    }));
    expect(String(request?.body)).not.toMatch(/AIza|apiKey/i);
  });

  it('surfaces the server error without exposing credentials', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(
      JSON.stringify({ error: 'Admin access is required for poster generation.' }),
      { status: 403, headers: { 'Content-Type': 'application/json' } },
    ));

    await expect(generatePosterImage('A valid poster prompt')).rejects.toThrow(
      'Admin access is required for poster generation.',
    );
  });
});
