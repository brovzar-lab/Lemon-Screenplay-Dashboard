import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test as setup, expect } from '@playwright/test';
import {
  cert,
  deleteApp,
  getApps,
  initializeApp,
  type ServiceAccount,
} from '../functions/node_modules/firebase-admin/lib/app/index.js';
import { getAuth } from '../functions/node_modules/firebase-admin/lib/auth/index.js';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const authFile = path.join(repositoryRoot, 'playwright/.auth/lemon-user.json');
const credentialFile = process.env.GOOGLE_APPLICATION_CREDENTIALS
  ?? path.join(repositoryRoot, 'service-account.json');
const testEmail = process.env.LEMON_E2E_EMAIL ?? 'billy@lemonfilms.com';

setup('create a real local Lemon session', async ({ page }) => {
  const serviceAccount = JSON.parse(readFileSync(credentialFile, 'utf8')) as ServiceAccount;
  const existing = getApps().find((app) => app.name === 'playwright-auth');
  const adminApp = existing ?? initializeApp({ credential: cert(serviceAccount) }, 'playwright-auth');

  try {
    const adminAuth = getAuth(adminApp);
    const user = await adminAuth.getUserByEmail(testEmail);
    if (!user.emailVerified) {
      throw new Error(`${testEmail} must be a verified Lemon account before browser tests run.`);
    }

    const customToken = await adminAuth.createCustomToken(user.uid);
    await page.goto('/discover?ui=screenplay');
    await page.evaluate(async (token) => {
      const authModule = await import('/src/test/playwrightAuth.ts');
      await authModule.signInForPlaywright(token);
    }, customToken);

    await expect(page.getByRole('link', { name: 'Discovery home' })).toBeVisible({ timeout: 30_000 });
    await page.context().storageState({ path: authFile, indexedDB: true });
  } finally {
    if (!existing) await deleteApp(adminApp);
  }
});
