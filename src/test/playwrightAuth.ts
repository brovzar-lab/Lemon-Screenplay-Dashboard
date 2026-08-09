import { signInWithCustomToken } from 'firebase/auth';
import { auth } from '@/lib/firebase';

/**
 * Local Playwright bootstrap only. This module is never imported by the app,
 * and Vite serves it only from the development server used by browser tests.
 */
export async function signInForPlaywright(customToken: string): Promise<void> {
  if (!import.meta.env.DEV) {
    throw new Error('Playwright authentication is available only in local development.');
  }

  await signInWithCustomToken(auth, customToken);
}
