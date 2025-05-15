import { expect, test } from '@playwright/test';
import { login } from './helpers';

const PLAYER_ROUTES = ['/', '/casino', '/casino/slots', '/casino/roulette', '/casino/dice', '/casino/crash', '/casino/providers', '/favorites', '/recent', '/promotions', '/bonuses', '/loyalty', '/wallet', '/wallet/transactions', '/profile', '/settings', '/responsible-gaming'];
const ADMIN_ROUTES = ['/admin', '/admin/players', '/admin/games', '/admin/providers', '/admin/sessions', '/admin/rounds', '/admin/transactions', '/admin/bonuses', '/admin/promotions', '/admin/risk', '/admin/audit', '/admin/settings'];

test('unauthenticated visitors are redirected from protected routes and can see the lobby', async ({ page }) => {
  await page.goto('/wallet');
  await expect(page).toHaveURL(/\/login\?next=/);
  await page.goto('/casino');
  await expect(page.getByTestId('game-tile').first()).toBeVisible();
});

test('every player route renders for a signed-in player without client errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await login(page, 'player');
  for (const route of PLAYER_ROUTES) {
    await page.goto(route);
    await expect(page.locator('main')).toBeVisible();
    await expect(page.locator('h1').first()).toBeVisible();
  }
  expect(errors).toEqual([]);
});

test('players cannot open the admin area; staff can open every admin route', async ({ page }) => {
  await login(page, 'player');
  await page.goto('/admin');
  await expect(page).not.toHaveURL(/\/admin$/);
  await page.getByTestId('user-menu').click();
  await page.getByTestId('logout').click();
  await login(page, 'admin');
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  for (const route of ADMIN_ROUTES) {
    await page.goto(route);
    await expect(page.getByTestId('admin-page-title')).toBeVisible();
  }
  expect(errors).toEqual([]);
});

test('bonus claim is duplicate-safe from the UI', async ({ page }) => {
  await login(page, 'player');
  await page.goto('/bonuses');
  const claim = page.getByTestId('claim-DAILY_500');
  await expect(claim).toBeVisible();
  if (await claim.isEnabled()) {
    await claim.click();
    await expect(page.getByText(/claimed|cooldown|already/i).first()).toBeVisible();
  }
  await page.reload();
  await expect(page.getByTestId('claim-DAILY_500')).toBeDisabled();
});
