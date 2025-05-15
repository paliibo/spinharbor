# API documentation

Interactive Swagger/OpenAPI: **http://localhost:4000/api/docs** (JSON at `/api/docs-json`). 77 paths. Authentication is a `sh_access` httpOnly cookie (set by `/auth/login|register|refresh`) or `Authorization: Bearer <accessToken>`.

## Conventions

- **Amounts** are integers in minor units (`100` = 1.00 credit). Multipliers and percentages are basis points (`19800` = 1.98×, `1000` = 10 %).
- **Errors** share one envelope: `{ statusCode, error, code, message, details?, path, timestamp }`. Important codes: `VALIDATION_ERROR`, `UNAUTHENTICATED`, `TOKEN_INVALID`, `FORBIDDEN`, `INSUFFICIENT_BALANCE` (422), `ACCOUNT_RESTRICTED` (403), `LIMIT_EXCEEDED` (403), `BET_OUT_OF_RANGE`, `SESSION_INVALID`, `GAME_UNAVAILABLE`, `PROVIDER_UNAVAILABLE`, `ROUND_CLOSED`, `ROUND_CRASHED`, `DUPLICATE_BET`, `NO_OPEN_BET`, `DUPLICATE_CLAIM`, `BONUS_NOT_ELIGIBLE`, `IDEMPOTENCY_MISMATCH`, `RATE_LIMITED`.
- **Idempotency.** `POST /games/*/play`, `/games/crash/bet`, `/bonuses/claim` and `/wallet/reset` accept an idempotency key (`idempotencyKey` in the body or `Idempotency-Key` header). A retry returns the original response with `Idempotent-Replayed: true`; the same key with a different body returns `409 IDEMPOTENCY_MISMATCH`.
- **Pagination.** `page` / `pageSize` query → `{ items, page, pageSize, total, totalPages }`.
- **Rate limits.** 300 req/min globally; 10/min register, 15/min login, 120/min slots & dice, 60/min roulette, 30/min crash bets, 10/min bonus claims.

## Endpoint overview

| Area | Endpoints |
| --- | --- |
| Health | `GET /health` |
| Auth | `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `GET /auth/me` |
| Users | `GET /users/me`, `PATCH /users/me/profile`, `POST /users/me/password` |
| Casino | `GET /casino/games` (search, category, provider, engine, sort, page), `GET /casino/games/:slug`, `GET /casino/categories`, `GET /casino/providers`, `GET /casino/home`, `GET /casino/favorites`, `POST /casino/favorites/:slug/toggle`, `GET /casino/recent` |
| Games | `GET /games/config/:engine`, `POST /games/sessions`, `GET /games/sessions/:id`, `GET /games/sessions/:id/stats`, `POST /games/sessions/:id/close`, `POST /games/slots/play`, `POST /games/dice/play`, `POST /games/roulette/play`, `GET /games/rounds`, `GET /games/rounds/:id` |
| Crash | `GET /games/crash/state`, `GET /games/crash/history`, `GET /games/crash/my-bets`, `POST /games/crash/bet`, `POST /games/crash/cashout` |
| Wallet | `GET /wallet`, `GET /wallet/summary`, `GET /wallet/transactions`, `GET /wallet/reconcile`, `POST /wallet/reset` (demo only) |
| Bonuses & loyalty | `GET /promotions`, `GET /bonuses`, `GET /bonuses/history`, `POST /bonuses/claim`, `GET /loyalty` |
| Responsible gaming | `GET /responsible-gaming`, `PUT /responsible-gaming/limits`, `POST /responsible-gaming/cooling-off`, `POST /responsible-gaming/self-exclude` |
| Notifications | `GET /notifications`, `POST /notifications/read`, `POST /notifications/:id/read` |
| Admin (SUPPORT+) | `GET /admin/dashboard?range=`, `GET /admin/players`, `GET /admin/players/:id`, `GET /admin/players/:id/reconcile`, `GET /admin/sessions`, `GET /admin/rounds`, `GET /admin/transactions`, `GET /admin/transactions/:id`, `GET /admin/ledger/health`, `GET /admin/games`, `GET /admin/categories`, `GET /admin/providers`, `GET /admin/bonuses`, `GET /admin/bonuses/claims`, `GET /admin/promotions`, `GET /admin/risk/flags`, `GET /admin/audit`, `GET /admin/settings` |
| Admin (OPERATOR+) | `PATCH /admin/players/:id/status`, `PATCH /admin/games/:id`, `PUT /admin/categories`, `DELETE /admin/categories/:slug`, `PATCH /admin/providers/:id`, `PATCH /admin/bonuses/:id`, `PATCH /admin/promotions/:id`, `PATCH /admin/risk/flags/:id` |
| Admin (ADMIN) | `POST /admin/players/:id/wallet/adjust`, `POST /admin/transactions/:id/reverse`, `PATCH /admin/settings` |

## Socket.IO

Connect to the API origin with cookies (`withCredentials: true`) or `auth: { token }`.

| Direction | Event | Payload |
| --- | --- | --- |
| client → server | `crash:subscribe` (ack: `CrashRoundDto`) / `crash:unsubscribe` / `ops:subscribe` (staff; ack `{ ok }`) | – |
| server → client | `wallet:updated` | `{ balanceMinor, bonusBalanceMinor, version, reason }` |
| | `account:status` | `{ status, statusUntil, reason }` (restricted accounts are then disconnected) |
| | `round:settled` | `{ roundId, engine, gameSlug, stakeMinor, payoutMinor }` |
| | `crash:state`, `crash:tick`, `crash:bet_placed`, `crash:cashed_out`, `crash:crashed` | see `packages/contracts/src/realtime.ts` |
| | `ops:activity` | `{ kind, summary, at, data? }` (staff room) |
| | `session:reminder` | `{ minutesPlayed }` |

Example (dice round):

```bash
curl -c jar -X POST localhost:4000/auth/login -H 'content-type: application/json' \
  -d '{"identifier":"player@spinharbor.demo","password":"Player123!"}'
SID=$(curl -s -b jar -X POST localhost:4000/games/sessions -H 'content-type: application/json' -d '{"gameSlug":"harbor-dice"}' | jq -r .id)
curl -s -b jar -X POST localhost:4000/games/dice/play -H 'content-type: application/json' \
  -d "{\"sessionId\":\"$SID\",\"betMinor\":1000,\"direction\":\"OVER\",\"target\":5000,\"idempotencyKey\":\"demo-roll-0001\"}"
```
