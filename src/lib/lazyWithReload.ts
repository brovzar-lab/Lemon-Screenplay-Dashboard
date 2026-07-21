const RETRY_PREFIX = 'lemon-lazy-retry:';

export function isChunkLoadError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes('failed to fetch dynamically imported module') ||
    message.includes('error loading dynamically imported module') ||
    message.includes('chunkloaderror') ||
    message.includes('loading chunk')
  );
}

export async function importWithReload<T>(key: string, importer: () => Promise<T>): Promise<T> {
  const retryKey = `${RETRY_PREFIX}${key}`;
  try {
    const loaded = await importer();
    sessionStorage.removeItem(retryKey);
    return loaded;
  } catch (error) {
    if (isChunkLoadError(error) && !sessionStorage.getItem(retryKey)) {
      sessionStorage.setItem(retryKey, '1');
      window.location.reload();
      return new Promise<T>(() => undefined);
    }
    sessionStorage.removeItem(retryKey);
    throw error;
  }
}
