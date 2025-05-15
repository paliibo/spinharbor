# Gameplay flow and game rules

## The round pipeline (slots, dice, roulette)

`GameplayService.playInstant` runs everything in **one database transaction**:

1. **Replay check** – if a round with the same `userId:idempotencyKey` exists, its stored result is returned (no new stake).
2. **Account gate** – `UsersService.assertCanPlay` reads the live status; `SUSPENDED`, `COOLING_OFF`, `SELF_EXCLUDED`, `CLOSED` → `403 ACCOUNT_RESTRICTED`.
3. **Session & game checks** – session must belong to the player and be `ACTIVE`; game must be `ACTIVE`, its provider `OPERATIONAL`, engine must match; stake must be within the game range and the global `maxBetMinor` setting.
4. **Limits** – `LimitsService.assertWagerAllowed` (daily/weekly wager, daily loss, session minutes).
5. **Lock & stake** – `SELECT … FOR UPDATE` on the wallet; `GameRound` created `OPEN`; `STAKE` journal entry (cash first, then bonus funds) + `GameRoundTransaction`; wagering progress on active bonuses.
6. **Outcome** – the provider adapter computes the result with the injected RNG (`SecureRng` in production). The RNG seed hash is stored on the round.
7. **Settle** – `PAYOUT` entry if the payout is positive (bonus-funded share goes back to the bonus balance pro rata), round → `SETTLED`, session counters, play count, recently played, loyalty points (idempotent per round).
8. **Commit, then publish** – `wallet.updated` and `round.settled` events drive Socket.IO pushes and risk heuristics.

A failure anywhere rolls back the stake, the round and every side effect. Two concurrent requests with the same key race on the unique constraint; the loser returns the winner's result.

## Harbor Reels (slots)

- 5 reels × 3 rows, 10 fixed paylines (`SLOTS_PAYLINES`), total bet split evenly per line (`lineBet = bet / 10`, bets are multiples of 10 minor units).
- Each reel is a weighted strip; one stop per reel shows 3 consecutive symbols.
- A line pays the longest run of identical symbols from reel 1. `ANCHOR` is wild (substitutes everything except the scatter); a run of only wilds pays as `ANCHOR`. Only the best run per line pays.
- `STAR` scatters pay anywhere: 3 / 4 / 5 → 2× / 10× / 50× the **total** bet.

| Symbol | ×3 | ×4 | ×5 |
| --- | --- | --- | --- |
| ANCHOR (wild) | 50 | 200 | 1000 |
| GEM | 30 | 120 | 500 |
| CROWN | 20 | 80 | 300 |
| BELL | 15 | 50 | 150 |
| SEVEN | 10 | 30 | 100 |
| CHERRY | 5 | 18 | 60 |
| LEMON | 4 | 10 | 40 |

Multipliers apply to the line bet. Monte Carlo estimate (`pnpm --filter @spinharbor/engines simulate`): **≈95.7 % return, ≈41 % hit rate** – a simulation figure, not a certified RTP.

## Harbor Dice

- Roll `r` is a uniform integer in `[0, 9999]`, displayed as `0.00–99.99`; target `t` in `[100, 9900]`.
- `OVER` wins when `r > t` (winning outcomes `9999 − t`); `UNDER` wins when `r < t` (winning outcomes `t`).
- `winChanceBp = winningOutcomes` (out of 10 000); `multiplierBp = floor((10000 − 100) × 10000 / winChanceBp)`; payout = `stake × multiplierBp / 10000` floored. Expected return 99 % for every target.
- The client shows a preview of these numbers; the server recomputes them for every roll and never accepts a client-supplied multiplier.

## Harbor Roulette

- European wheel, single zero, standard pocket order.
- Supported wagers: straight-up (35:1), red/black, odd/even, low (1–18)/high (19–36) (1:1), dozens and columns (2:1). Zero loses every outside bet.
- A spin takes up to 40 bets; the stake is the sum of all bets and is debited atomically; the payout returns stake + odds for each winning bet.

## Harbor Crash (multiplayer)

State machine, driven by server timers and persisted at every transition:

```
WAITING (3 s) → BETTING_OPEN (8 s) → RUNNING → CRASHED → SETTLED (3 s) → next round
```

- Before betting opens the server generates a secret seed and publishes `sha256(seed)`. `crashPoint = (1 − houseEdge) / (1 − r)` where `r` is the first 52 bits of `sha256(seed)` as a number in `[0, 1)`; ≈1 % of rounds crash at 1.00×. The seed is revealed after the crash so anyone can recompute the point.
- Multiplier `m(t) = 2^(t / 10 s)`; cash-out at server time `t` pays `stake × m(t)` only if `m(t) < crashPoint`. Clients interpolate between ticks for display only.
- Bets are accepted only while `BETTING_OPEN` and before `startsAt` (server clock). One bet per player per round. Auto cash-out thresholds are stored with the bet and frozen when the round starts; the server executes them at exactly that multiplier.
- Cash-out is an atomic `PLACED → CASHED_OUT` update, so duplicate requests get `NO_OPEN_BET`; requests after the crash point get `ROUND_CRASHED`. Losing bets are settled with zero payout at crash time.
- Reconnection: `crash:subscribe` returns the full snapshot (status, timestamps, bets, `serverTime`); every phase change is broadcast as a snapshot; rounds interrupted by a restart are voided and refunded on boot.
- The loop assumes a single API instance (see [TRADEOFFS.md](TRADEOFFS.md)).

## Demo previews

Catalogue games with engine `DEMO_PREVIEW` have no gameplay engine. They appear in the lobby with a "Preview" badge, their detail page explains the situation, and the API refuses to open sessions for them (`409 GAME_UNAVAILABLE`).
