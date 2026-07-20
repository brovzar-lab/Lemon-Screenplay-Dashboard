import { getProxyAuthHeaders } from './proxyClient';

const GOOGLE_PROXY_URL = import.meta.env.DEV
  ? 'http://127.0.0.1:5001/lemon-screenplay-dashboard/us-central1/googleProxy'
  : '/api/google';

interface GoogleProxyError {
  error?: string;
}

async function callGoogleProxy<T>(body: Record<string, unknown>): Promise<T> {
  let response: Response;
  try {
    response = await fetch(GOOGLE_PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await getProxyAuthHeaders()) },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error('Network error connecting to Google AI proxy.');
  }

  if (!response.ok) {
    let detail: GoogleProxyError = {};
    try {
      detail = await response.json() as GoogleProxyError;
    } catch {
      // The status fallback below is sufficient for non-JSON responses.
    }
    throw new Error(detail.error || `Google AI proxy error (${response.status})`);
  }
  return response.json() as Promise<T>;
}

export function generatePosterImage(prompt: string): Promise<{
  data: string;
  mimeType: string;
  model: string;
}> {
  return callGoogleProxy({ action: 'generate-poster', prompt });
}

export function createLiveToken(): Promise<{ token: string; model: string }> {
  return callGoogleProxy({ action: 'live-token' });
}
