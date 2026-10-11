import { test as setup, expect } from '@playwright/test';

const USER_EMAIL    = 'rahulshetty1@gmail.com';
const USER_PASSWORD = 'Magiclife1!';
export const AUTH_FILE = 'playwright/.auth/user.json';

// Logs in once through the UI and saves the session (eventhub_token in localStorage)
// so the spec files can start already authenticated.
setup('authenticate via login page', async ({ page }) => {
  await page.goto('/login');
  await page.getByPlaceholder('you@email.com').fill(USER_EMAIL);
  await page.getByLabel('Password').fill(USER_PASSWORD);
  await page.locator('#login-btn').click();

  // Home page loads after login — "Browse Events →" link confirms successful auth
  await expect(page.getByRole('link', { name: /Browse Events/i }).first()).toBeVisible();

  await page.context().storageState({ path: AUTH_FILE });
});
