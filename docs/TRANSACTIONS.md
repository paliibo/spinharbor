# Transaction lifecycle

## Accounts

| Account | Type | Meaning |
| --- | --- | --- |
| Player cash | `PLAYER_CASH` (per user) | Withdrawable-equivalent demo credits (nothing is actually withdrawable). |
| Player bonus | `PLAYER_BONUS` (per user) | Bonus funds subject to wagering. |
| House funding | `HOUSE_FUNDING` | Source of initial credits, demo resets and manual adjustments. |
| House gaming | `HOUSE_GAMING` | Counterparty of every stake, payout and refund. Its balance is the gross gaming revenue. |
| House bonus | `HOUSE_BONUS` | Counterparty of bonus awards, releases and forfeits. |

Every `JournalEntry` has ≥ 2 lines whose signed amounts sum to **zero**; the sum of all lines in the database is therefore zero at all times (`GET /admin/ledger/health`). Player lines store `balanceAfterMinor`, which is what the transaction history displays.

## Example: one winning dice round

| Step | Entry | Player cash | House gaming | Balance after |
| --- | --- | --- | --- | --- |
| Start | – | | | 10,000.00 |
| Stake 100 | `STAKE` (`stake:<roundId>`) | −100.00 | +100.00 | 9,900.00 |
| Payout 250 | `PAYOUT` (`payout:<roundId>`) | +250.00 | −250.00 | 10,150.00 |

Both entries reference `game_round/<roundId>` and are linked from `GameRoundTransaction` (one entry per transaction; `journalEntryId` is unique, so a payout can only ever be booked once). The round row stores `stakeMinor = 10000`, `payoutMinor = 25000`, the engine result JSON and the RNG seed hash.

## Entry types

`INITIAL_FUNDING`, `STAKE`, `PAYOUT`, `REFUND` (voided crash bets), `BONUS_AWARD`, `BONUS_RELEASE` (wagering complete → bonus balance moves to cash), `BONUS_FORFEIT` (expiry / demo reset), `LOYALTY_REWARD`, `ADJUSTMENT` (staff, audited), `DEMO_RESET`, `REVERSAL`.

## Safety properties

- **Atomicity** – stake, round creation, outcome, payout and side effects share one Prisma interactive transaction.
- **No double spend** – the wallet row is locked with `SELECT … FOR UPDATE`; concurrent stakes serialise and the balance can never go negative (tested with 15 concurrent debits against a 10-debit balance).
- **Idempotency** – journal `idempotencyKey`, round `idempotencyKey`, bonus `claimKey` and stored `IdempotencyRecord` responses make retries safe; mismatched bodies are rejected.
- **No duplicate payout** – settling a round twice throws `ROUND_ALREADY_SETTLED`; the one-to-one link between round transactions and journal entries makes a second payout structurally impossible.
- **Immutability** – entries are never updated or deleted. Corrections are new `REVERSAL` entries (only `ADJUSTMENT`, `BONUS_AWARD`, `LOYALTY_REWARD` are reversible, each at most once) or `ADJUSTMENT` entries, both audited with actor, reason and target.
- **Reconciliation** – `WalletService` updates the cached balance in the same transaction as the lines; `LedgerService.reconcileUser` compares cache and journal; a scheduled job flags mismatches as `LEDGER_MISMATCH` risk flags (none expected).

## Bonus funds

Stakes consume cash first, then bonus funds (`GameRound.bonusStakeMinor` records the split). Winnings from bonus-funded stakes return to the bonus balance pro rata. Wagering progress counts every stake; when the last active wagering bonus completes, the entire bonus balance is released to cash with a `BONUS_RELEASE` entry. Expired bonuses forfeit remaining bonus funds (`BONUS_FORFEIT`). Daily rewards and demo resets count against the daily top-up limit.
