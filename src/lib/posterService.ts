/** Generate and persist screenplay posters without loading the PDF analysis pipeline. */

import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { authReady, storage } from './firebase';
import { generatePosterImage } from './googleProxyClient';
import { buildSimplePosterPrompt as buildPosterPrompt } from './Prompt Enhancements/posterPrompt';

async function getExistingPoster(screenplayId: string): Promise<string | null> {
  try {
    await authReady;
    return await getDownloadURL(ref(storage, `Posters/${screenplayId}.png`));
  } catch {
    return null;
  }
}

async function uploadPosterToStorage(
  screenplayId: string,
  base64Data: string,
  mimeType: string,
): Promise<string> {
  await authReady;

  const byteCharacters = atob(base64Data);
  const byteArray = new Uint8Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteArray[i] = byteCharacters.charCodeAt(i);
  }

  const posterRef = ref(storage, `Posters/${screenplayId}.png`);
  await uploadBytes(posterRef, byteArray, {
    contentType: mimeType,
    customMetadata: {
      generatedAt: new Date().toISOString(),
      screenplayId,
    },
  });

  return getDownloadURL(posterRef);
}

export async function generatePoster(
  title: string,
  logline: string,
  genre: string,
  screenplayId?: string,
): Promise<string> {
  if (screenplayId) {
    const existingUrl = await getExistingPoster(screenplayId);
    if (existingUrl) {
      console.log('[Poster] Found cached poster in Storage for', title);
      return existingUrl;
    }
  }

  const prompt = buildPosterPrompt(title, logline, genre);
  const { data: base64Data, mimeType, model } = await generatePosterImage(prompt);
  console.log(`[Poster] Generated with ${model} for "${title}"`);

  if (screenplayId) {
    try {
      const storageUrl = await uploadPosterToStorage(screenplayId, base64Data, mimeType);
      console.log('[Poster] Uploaded to Storage ->', storageUrl);
      return storageUrl;
    } catch (uploadError) {
      console.warn('[Poster] Storage upload failed, using data URL:', uploadError);
    }
  }

  return `data:${mimeType};base64,${base64Data}`;
}
