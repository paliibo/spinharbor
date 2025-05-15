import { expect, test } from '@playwright/test';
import { login, logout, readBalanceMinor } from './helpers';

/**
 * Scenario 1: player signs in → lobby → filters catalogue → plays Dice → wallet updates →
 * transaction history → operator signs in → finds the round → inspects its transaction.
 * Outcomes are random, so the assertions are invariants: balance_after = balance_before − stake + payout
 * where stake/payout come from the server response.
 */
test.describe.serial('player plays Dice, operator audits the round', () => {
  let roundId = '';
  let stakeMinor = 0;
  let payoutMinor = 0;

  test('player signs in, filters the lobby and opens Harbor Dice', async ({ page }) => {
    await login(page, 'player');
    await page.goto('/casino');
    await expect(page.getByTestId('game-tile').first()).toBeVisible();
    await page.getByTestId('category-filter-instant').click();
    await expect(page).toHaveURL(/category=instant/);
    await page.getByTestId('lobby-search').fill('dice');
    await expect(page).toHaveURL(/search=dice/);
    const tiles = page.getByTestId('game-tile');
    await expect(tiles).toHaveCount(1);
    await expect(tiles.first()).toHaveAttribute('data-slug', 'harbor-dice');
    await tiles.first().click();
    await expect(page).toHaveURL(/\/casino\/games\/harbor-dice/);
    await expect(page.getByTestId('dice-roll')).toBeEnabled();
  });

  test('player rolls the dice and the wallet reflects stake and payout', async ({ page }) => {
    await login(page, 'player');
    await page.goto('/casino/games/harbor-dice');
    await expect(page.getByTestId('dice-roll')).toBeEnabled();
    const before = await readBalanceMinor(page);

    const [response] = await Promise.all([page.waitForResponse((r) => r.url().includes('/games/dice/play') && r.request().method() === 'POST'), page.getByTestId('dice-roll').click()]);
    expect(response.status()).toBe(201);
    const body = await response.json();
    roundId = body.round.id;
    stakeMinor = body.round.stakeMinor;
    payoutMinor = body.round.payoutMinor;
    expect(body.round.status).toBe('SETTLED');
    expect(body.round.engine).toBe('DICE');
    expect(typeof body.round.result.roll).toBe('number');

    await expect(page.getByTestId('dice-result')).toBeVisible();
    await expect(page.getByTestId('dice-result')).toHaveAttribute('data-outcome', body.round.result.won ? 'WIN' : 'LOSS');
    await expect.poll(() => readBalanceMinor(page)).toBe(before - stakeMinor + payoutMinor);
    expect(body.wallet.balanceMinor).toBe(before - stakeMinor + payoutMinor);
  });

  test('transaction history shows the stake (and payout) for the round', async ({ page }) => {
    await login(page, 'player');
    await page.goto('/wallet/transactions');
    await expect(page.getByTestId('transactions-table')).toBeVisible();
    const rows = page.getByTestId('transaction-row');
    await expect(rows.first()).toBeVisible();
    const topRows = (await rows.allTextContents()).slice(0, 3).join(' ');
    expect(topRows).toContain('Harbor Dice');
    expect(topRows).toMatch(/STAKE/i);
    if (payoutMinor > 0) expect(topRows).toMatch(/PAYOUT/i);
    await logout(page);
  });

  test('operator signs in, finds the completed round and inspects its ledger transaction', async ({ page }) => {
    await login(page, 'operator');
    await page.goto('/admin/rounds?engine=DICE');
    await expect(page.getByTestId('admin-rounds-table')).toBeVisible();
    const row = page.locator(`[data-testid="round-row"][data-round-id="${roundId}"]`);
    await expect(row).toBeVisible();
    await expect(row).toContainText('SETTLED');
    await row.getByTestId('round-expand').click();
    const expanded = page.getByTestId('round-expanded');
    await expect(expanded).toBeVisible();
    const txLink = expanded.getByTestId('transaction-link').first();
    await expect(txLink).toBeVisible();
    await txLink.click();
    await expect(page).toHaveURL(/\/admin\/transactions\//);
    const detail = page.getByTestId('admin-transaction-detail');
    await expect(detail).toBeVisible();
    await expect(detail).toContainText('STAKE');
    await expect(page.getByTestId('transaction-lines')).toBeVisible();
    // The double-entry lines must sum to zero.
    await expect(page.getByTestId('transaction-sum')).toContainText('0.00');
    await expect(detail).toContainText(roundId.slice(0, 8));
  });
});
