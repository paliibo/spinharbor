import { expect, test } from '@playwright/test';
import { login, logout, readBalanceMinor } from './helpers';

/** Scenario 2: the same flow for Slots, including the operator view of the round. */
test.describe.serial('player spins Slots, operator sees the round', () => {
  let roundId = '';

  test('player spins Harbor Reels and the balance reconciles with the server result', async ({ page }) => {
    await login(page, 'player');
    await page.goto('/casino/slots');
    await page.getByTestId('play-now').click();
    await expect(page).toHaveURL(/harbor-reels/);
    await expect(page.getByTestId('slots-spin')).toBeEnabled();
    const before = await readBalanceMinor(page);

    const [response] = await Promise.all([page.waitForResponse((r) => r.url().includes('/games/slots/play') && r.request().method() === 'POST'), page.getByTestId('slots-spin').click()]);
    expect(response.status()).toBe(201);
    const body = await response.json();
    roundId = body.round.id;
    expect(body.round.result.grid).toHaveLength(5);

    // The reels only ever show the server's grid once they stop.
    const result = page.getByTestId('slots-result');
    await expect(result).toHaveAttribute('data-spinning', 'false', { timeout: 15_000 });
    const expectedGrid = body.round.result.grid.map((reel: string[]) => reel.join(',')).join('|');
    await expect(result).toHaveAttribute('data-grid', expectedGrid);
    await expect(page.getByTestId('slots-win')).toHaveAttribute('data-win', String(body.round.payoutMinor));
    await expect.poll(() => readBalanceMinor(page)).toBe(before - body.round.stakeMinor + body.round.payoutMinor);
    await logout(page);
  });

  test('operator inspects the slots round and its stake transaction', async ({ page }) => {
    await login(page, 'operator');
    await page.goto('/admin/rounds?engine=SLOTS');
    const row = page.locator(`[data-testid="round-row"][data-round-id="${roundId}"]`);
    await expect(row).toBeVisible();
    await row.getByTestId('round-expand').click();
    await page.getByTestId('round-expanded').getByTestId('transaction-link').first().click();
    await expect(page.getByTestId('admin-transaction-detail')).toBeVisible();
    await expect(page.getByTestId('transaction-sum')).toContainText('0.00');
  });
});
