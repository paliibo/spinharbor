# Architecture overview

SpinHarbor is a **modular monolith**: one NestJS process hosts cleanly separated domain modules that talk through injected services and an in-process domain event bus, one Next.js app serves both the player experience and the operator area, and shared packages hold the contracts and the pure game math.

```
┌──────────────── apps/web (Next.js 16) ────────────────┐      ┌────────────── apps/api (NestJS 11) ──────────────┐
│ (player) routes · /admin routes · proxy.ts            │ REST │ auth  users  casino  games  providers  wallet     │
│ TanStack Query · Zustand · Socket.IO client           │◄────►│ ledger bonuses loyalty risk notifications admin   │
│ components/ui (Radix) · components/games · features/  │  WS  │ audit realtime jobs(BullMQ)  common(prisma,zod…)  │
└───────────────────────────────────────────────────────┘      └──────────┬───────────────────────┬────────────────┘
                     ▲ types/schemas                                       │ Prisma                │ ioredis / BullMQ
            packages/contracts (Zod)                                  PostgreSQL 16            Redis 7
            packages/engines (pure game math + RNG)              (+ spinharbor_test DB)
```

## Backend modules (`apps/api/src`)

| Module | Responsibility |
| --- | --- |
| `auth` | Registration, login, refresh-token rotation, logout; JWT access tokens (15 min) + opaque refresh tokens stored hashed in `UserSession`; httpOnly cookies and Bearer support. |
| `users` | Profile, password change, **`assertCanPlay`** – the authoritative gameplay gate that reads the current account status from the database (never from the token) and lifts expired restrictions. |
| `casino` | Catalogue queries (search, category, provider, sort, pagination), home sections, favourites, recently played. |
| `providers` | `CasinoGameProvider` contract, `DemoCasinoProvider` (runs the engines), `ExternalStubProvider`, `ProviderRegistry` (status checks + error log). See [PROVIDERS.md](PROVIDERS.md). |
| `games` | `SessionsService`, `GameplayService` (the transactional round pipeline), `RoundsService`, `crash/CrashService` (round loop + FSM). See [GAMEPLAY.md](GAMEPLAY.md). |
| `wallet` | Single write path for balances: row lock → balance validation → journal entry → cached balance update. Demo reset, admin adjustments, reversals. |
| `ledger` | Double-entry journal, house accounts, reconciliation, player transaction history. See [TRANSACTIONS.md](TRANSACTIONS.md). |
| `bonuses` | Definitions, eligibility, duplicate-safe claims, wagering progress and release, expiry job, promotions. |
| `loyalty` | Points per wager (idempotent per round), tier ladder, milestone eligibility. |
| `risk` | Player limits (`LimitsService`), responsible-gaming actions, behavioural risk flags. |
| `realtime` | Socket.IO gateway: cookie/Bearer auth, `user:<id>` / `crash` / `ops` rooms, session reminders, forced disconnect of restricted accounts. |
| `admin` | Staff API: metrics, players, sessions, rounds, transactions, catalogue, bonuses, promotions, risk, audit, settings. |
| `audit` | Append-only `AuditLog` writer used by every privileged action. |
| `jobs` | BullMQ `maintenance` queue: expire bonuses, expire idle sessions, clean idempotency records, reconcile wallets. |
| `common` | Prisma, Redis, Zod validation pipe + Swagger helpers, global exception filter, BigInt serializer, idempotency interceptor, guards, RNG provider, domain event bus. |

### Cross-cutting conventions

- **Validation once.** Request bodies/queries are parsed with the Zod schemas from `@spinharbor/contracts` (`ZodBody`, `ZodQuery`); the same schemas type the web client and generate Swagger via `z.toJSONSchema`.
- **Errors.** Domain errors carry a stable `code` (`INSUFFICIENT_BALANCE`, `ACCOUNT_RESTRICTED`, `LIMIT_EXCEEDED`, `ROUND_CLOSED`, …) mapped to HTTP statuses by one global filter; the client reacts to codes, not messages.
- **Money.** `BigInt` minor units in the database and services; the `BigIntSerializerInterceptor` emits plain integers on the wire and refuses values outside the safe range.
- **Idempotency.** Financial mutations accept an idempotency key (body or `Idempotency-Key` header). The interceptor replays stored responses; the round/bonus unique keys in the database are the hard guarantee under concurrency.
- **Authorization.** `JwtAuthGuard` + `RolesGuard` with a role hierarchy (PLAYER < SUPPORT < OPERATOR < ADMIN). Roles come from the verified token; privileged actions are audited; staff cannot modify accounts of equal or higher rank.
- **Events.** Services publish domain events (`wallet.updated`, `round.settled`, `account.status`, `crash.*`) after their transaction commits; the gateway and the risk service subscribe. No module imports another "upwards".
- **Logging.** nestjs-pino structured JSON logs (pretty in development), cookies/authorization redacted.
- **Rate limiting.** Global throttler (300 req/min) with stricter limits on auth, play and claim endpoints.

## Frontend (`apps/web`)

- **Routing.** `app/(player)` (lobby, games, account) wrapped in `AppShell`; `app/admin` wrapped in a separate `AdminShell` with `<RequireAuth staff>`; `app/(auth)` for login/register. `proxy.ts` redirects unauthenticated visitors early (UX only – the API is the authority).
- **Data.** `lib/api.ts` wraps `fetch` with cookie credentials and a single-flight refresh on 401; TanStack Query caches per domain (`lib/query-keys.ts`); Zustand mirrors the authenticated user.
- **Realtime.** One Socket.IO singleton (`lib/socket.ts`). `useWallet` applies `wallet:updated` pushes (version-checked, stale updates ignored); `useCrash` subscribes to the crash feed, re-syncs from the ack snapshot on every (re)connect and interpolates the multiplier from server time.
- **Games.** `components/games/game-player.tsx` switches on the engine; each game only animates server results (reels snap to the returned grid, the wheel lands on the returned pocket).
- **Design system.** Tailwind v4 theme tokens in `globals.css`, Radix-based primitives in `components/ui`, procedural SVG artwork for every game and promotion (no third-party assets).

## Realtime & background work

- Socket connections authenticate with the same JWT as HTTP. Players join `user:<id>`; anyone may watch `crash`; staff may join `ops`.
- Restricted accounts (`SUSPENDED`, `CLOSED`, `SELF_EXCLUDED`, `COOLING_OFF`) are disconnected on status change, and every round re-checks status in the database, so an existing socket cannot keep playing.
- The crash loop runs in-process with server timestamps; ticks are informational (`volatile`), every state transition is persisted and broadcast as a full snapshot, so reconnecting clients always converge.
- BullMQ schedulers run non-critical housekeeping; nothing financial depends on a job having run.

## Environment & configuration

`apps/api/src/config/env.ts` validates the environment with Zod at boot (secrets ≥ 32 chars, ports, feature flags such as `ENABLE_DEMO_RESET` and `CRASH_LOOP_ENABLED`). `.env.example` documents every variable; the root `.env` is shared by Docker Compose, Prisma and both apps.
