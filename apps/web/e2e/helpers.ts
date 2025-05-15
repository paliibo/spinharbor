import { expect, type Page } from '@playwright/test';

export const DEMO = {
  player: { identifier: 'player@spinharbor.demo', password: 'Player123!' },
  operator: { identifier: 'operator@spinharbor.demo', password: 'Operator123!' },
  admin: { identifier: 'admin@spinharbor.demo', password: 'Admin123!' },
};

export async function login(page: Page, who: keyof typeof DEMO) {
  await page.goto('/login');
  await page.getByTestId('login-identifier').fill(DEMO[who].identifier);
  await page.getByTestId('login-password').fill(DEMO[who].password);
  await page.getByTestId('login-submit').click();
  await expect(page.getByTestId('user-menu')).toBeVisible();
}

export async function logout(page: Page) {
  await page.getByTestId('user-menu').click();
  await page.getByTestId('logout').click();
  await expect(page).toHaveURL(/\/login/);
}

/** Reads the sticky balance pill as integer minor units. */
export async function readBalanceMinor(page: Page): Promise<number> {
  const text = (await page.getByTestId('balance-value').first().textContent()) ?? '';
  return Math.round(parseFloat(text.replace(/,/g, '')) * 100);
}
