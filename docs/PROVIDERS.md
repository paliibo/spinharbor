# Provider integration architecture

SpinHarbor models game content the way an aggregator does: the platform owns the player, the wallet and the round ledger; a **provider adapter** owns outcome generation and its own session bookkeeping.

```ts
export interface CasinoGameProvider {
  readonly code: string;
  createSession(input: CreateSessionInput): Promise<ProviderSession>;
  validateSession(token: string): Promise<boolean>;
  playRound(input: PlayRoundInput): Promise<RoundResult>;   // outcome only – no money moves here
  getRound(roundId: string): Promise<RoundResult | null>;
  closeSession(token: string): Promise<void>;
}
```

This is the "seamless wallet" shape: the aggregator debits the stake *before* asking the provider for an outcome and credits the payout *after*, inside the same transaction, so a misbehaving adapter can never move money by itself. The original contract from the brief was adjusted so that `playRound` receives the platform round id, the validated stake and the RNG, and returns only `{ payoutMinor, result }`.

## Adapters

| Provider (seed) | Integration type | Status | Adapter |
| --- | --- | --- | --- |
| SpinHarbor Studios | `INTERNAL` | `OPERATIONAL` | `DemoCasinoProvider` – runs the slots, dice and roulette engines from `@spinharbor/engines`; crash rounds are orchestrated by `CrashService` using the same wallet primitives. |
| Northwind Gaming (fictional) | `SEAMLESS_WALLET` | `NOT_CONFIGURED` | `ExternalStubProvider` – documents the surface, rejects every call with `PROVIDER_UNAVAILABLE`, records an error log entry. |
| Tidal Labs (fictional) | `TRANSFER_WALLET` | `DISABLED` | `ExternalStubProvider`. |

`ProviderRegistry` resolves adapters by catalogue code and checks the persisted provider status before every session; non-operational providers cannot be used, and operators cannot flip a stub to `OPERATIONAL` (`409 PROVIDER_STUB`) because there is nothing to connect to. No commercial provider integration is claimed.

## Operator view

`/admin/providers` shows name, code, integration type, status, whether an adapter is loaded, game and session counts, last sync, the JSON configuration and the error history, with enable/disable actions that are audited.

## Adding a real adapter

1. Implement `CasinoGameProvider` (HTTP client, signature verification, callback mapping).
2. Register it in `ProvidersModule` and `ProviderRegistry.onModuleInit`.
3. Map the provider's round identifiers onto `GameRound` (the platform remains the system of record for money).
4. For callback-based ("seamless") providers, expose `debit`/`credit`/`rollback` endpoints that call `WalletService.debitStake` / `creditPayout` / `GameplayService.voidRound` under the provider's idempotency keys.
