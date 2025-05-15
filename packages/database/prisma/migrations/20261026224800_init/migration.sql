-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('PLAYER', 'SUPPORT', 'OPERATOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'COOLING_OFF', 'SELF_EXCLUDED', 'CLOSED');

-- CreateEnum
CREATE TYPE "LedgerAccountType" AS ENUM ('PLAYER_CASH', 'PLAYER_BONUS', 'HOUSE_FUNDING', 'HOUSE_GAMING', 'HOUSE_BONUS');

-- CreateEnum
CREATE TYPE "JournalEntryType" AS ENUM ('INITIAL_FUNDING', 'STAKE', 'PAYOUT', 'REFUND', 'BONUS_AWARD', 'BONUS_RELEASE', 'BONUS_FORFEIT', 'LOYALTY_REWARD', 'ADJUSTMENT', 'DEMO_RESET', 'REVERSAL');

-- CreateEnum
CREATE TYPE "ProviderIntegrationType" AS ENUM ('INTERNAL', 'SEAMLESS_WALLET', 'TRANSFER_WALLET');

-- CreateEnum
CREATE TYPE "ProviderStatus" AS ENUM ('OPERATIONAL', 'DISABLED', 'ERROR', 'NOT_CONFIGURED');

-- CreateEnum
CREATE TYPE "GameEngine" AS ENUM ('SLOTS', 'DICE', 'ROULETTE', 'CRASH', 'DEMO_PREVIEW');

-- CreateEnum
CREATE TYPE "GameStatus" AS ENUM ('ACTIVE', 'DISABLED', 'MAINTENANCE', 'COMING_SOON');

-- CreateEnum
CREATE TYPE "Volatility" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "GameSessionStatus" AS ENUM ('ACTIVE', 'CLOSED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "GameRoundStatus" AS ENUM ('OPEN', 'SETTLED', 'VOIDED');

-- CreateEnum
CREATE TYPE "RoundTransactionType" AS ENUM ('STAKE', 'PAYOUT', 'REFUND');

-- CreateEnum
CREATE TYPE "CrashRoundStatus" AS ENUM ('WAITING', 'BETTING_OPEN', 'RUNNING', 'CRASHED', 'SETTLED');

-- CreateEnum
CREATE TYPE "CrashBetStatus" AS ENUM ('PLACED', 'CASHED_OUT', 'LOST', 'REFUNDED');

-- CreateEnum
CREATE TYPE "BonusType" AS ENUM ('WELCOME', 'DAILY_REWARD', 'CASHBACK', 'LOYALTY_MILESTONE');

-- CreateEnum
CREATE TYPE "PlayerBonusStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'EXPIRED', 'FORFEITED');

-- CreateEnum
CREATE TYPE "LoyaltyTier" AS ENUM ('BRONZE', 'SILVER', 'GOLD', 'PLATINUM');

-- CreateEnum
CREATE TYPE "PlayerLimitType" AS ENUM ('DAILY_WAGER', 'WEEKLY_WAGER', 'DAILY_LOSS', 'DAILY_TOPUP', 'SESSION_MINUTES');

-- CreateEnum
CREATE TYPE "RiskSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "RiskFlagStatus" AS ENUM ('OPEN', 'REVIEWED', 'DISMISSED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'PLAYER',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "statusReason" TEXT,
    "statusUntil" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "refreshTokenHash" TEXT NOT NULL,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "UserSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerProfile" (
    "userId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "avatarSeed" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'XX',
    "soundEnabled" BOOLEAN NOT NULL DEFAULT true,
    "sessionReminderMinutes" INTEGER NOT NULL DEFAULT 60,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlayerProfile_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "LedgerAccount" (
    "id" TEXT NOT NULL,
    "type" "LedgerAccountType" NOT NULL,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LedgerAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Wallet" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'DMC',
    "balanceMinor" BIGINT NOT NULL DEFAULT 0,
    "bonusBalanceMinor" BIGINT NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 0,
    "cashAccountId" TEXT NOT NULL,
    "bonusAccountId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Wallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalEntry" (
    "id" TEXT NOT NULL,
    "type" "JournalEntryType" NOT NULL,
    "description" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "referenceType" TEXT,
    "referenceId" TEXT,
    "reversalOfId" TEXT,
    "createdById" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JournalEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalLine" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "amountMinor" BIGINT NOT NULL,
    "balanceAfterMinor" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JournalLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CasinoProvider" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "integrationType" "ProviderIntegrationType" NOT NULL,
    "status" "ProviderStatus" NOT NULL DEFAULT 'NOT_CONFIGURED',
    "description" TEXT,
    "config" JSONB NOT NULL DEFAULT '{}',
    "lastSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CasinoProvider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProviderErrorLog" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "context" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderErrorLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameCategory" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "GameCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CasinoGame" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tagline" TEXT,
    "description" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "engine" "GameEngine" NOT NULL,
    "status" "GameStatus" NOT NULL DEFAULT 'ACTIVE',
    "volatility" "Volatility" NOT NULL DEFAULT 'MEDIUM',
    "rtpLabel" TEXT,
    "minBetMinor" BIGINT NOT NULL DEFAULT 10,
    "maxBetMinor" BIGINT NOT NULL DEFAULT 100000,
    "artwork" JSONB NOT NULL,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "isNew" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "releasedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "playCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CasinoGame_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CasinoGameCategory" (
    "gameId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,

    CONSTRAINT "CasinoGameCategory_pkey" PRIMARY KEY ("gameId","categoryId")
);

-- CreateTable
CREATE TABLE "PlayerFavorite" (
    "userId" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlayerFavorite_pkey" PRIMARY KEY ("userId","gameId")
);

-- CreateTable
CREATE TABLE "PlayerRecentGame" (
    "userId" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "lastPlayedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlayerRecentGame_pkey" PRIMARY KEY ("userId","gameId")
);

-- CreateTable
CREATE TABLE "GameSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "status" "GameSessionStatus" NOT NULL DEFAULT 'ACTIVE',
    "token" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "roundsCount" INTEGER NOT NULL DEFAULT 0,
    "totalStakedMinor" BIGINT NOT NULL DEFAULT 0,
    "totalPaidMinor" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "GameSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameRound" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "engine" "GameEngine" NOT NULL,
    "status" "GameRoundStatus" NOT NULL DEFAULT 'OPEN',
    "stakeMinor" BIGINT NOT NULL,
    "payoutMinor" BIGINT NOT NULL DEFAULT 0,
    "bonusStakeMinor" BIGINT NOT NULL DEFAULT 0,
    "input" JSONB NOT NULL,
    "result" JSONB,
    "rngSeedHash" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "settledAt" TIMESTAMP(3),

    CONSTRAINT "GameRound_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameRoundTransaction" (
    "id" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "type" "RoundTransactionType" NOT NULL,
    "amountMinor" BIGINT NOT NULL,
    "journalEntryId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GameRoundTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrashRound" (
    "id" TEXT NOT NULL,
    "seq" SERIAL NOT NULL,
    "status" "CrashRoundStatus" NOT NULL DEFAULT 'WAITING',
    "crashMultiplierBp" INTEGER NOT NULL,
    "serverSeedHash" TEXT NOT NULL,
    "serverSeed" TEXT,
    "bettingOpensAt" TIMESTAMP(3) NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "crashedAt" TIMESTAMP(3),
    "settledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CrashRound_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrashBet" (
    "id" TEXT NOT NULL,
    "crashRoundId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gameRoundId" TEXT NOT NULL,
    "stakeMinor" BIGINT NOT NULL,
    "autoCashoutBp" INTEGER,
    "status" "CrashBetStatus" NOT NULL DEFAULT 'PLACED',
    "cashoutMultiplierBp" INTEGER,
    "cashedOutAt" TIMESTAMP(3),
    "payoutMinor" BIGINT NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CrashBet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BonusDefinition" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "BonusType" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amountMinor" BIGINT NOT NULL DEFAULT 0,
    "percentBp" INTEGER,
    "maxAmountMinor" BIGINT,
    "wageringMultiplier" INTEGER NOT NULL DEFAULT 0,
    "claimCooldownHours" INTEGER,
    "maxClaimsPerUser" INTEGER,
    "validForHours" INTEGER NOT NULL DEFAULT 168,
    "requiredTier" "LoyaltyTier",
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "config" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BonusDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerBonus" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "definitionId" TEXT NOT NULL,
    "status" "PlayerBonusStatus" NOT NULL DEFAULT 'ACTIVE',
    "amountMinor" BIGINT NOT NULL,
    "wageringRequiredMinor" BIGINT NOT NULL DEFAULT 0,
    "wageringProgressMinor" BIGINT NOT NULL DEFAULT 0,
    "claimKey" TEXT NOT NULL,
    "claimedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "journalEntryId" TEXT,

    CONSTRAINT "PlayerBonus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Promotion" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "description" TEXT NOT NULL,
    "artwork" JSONB NOT NULL,
    "ctaLabel" TEXT NOT NULL DEFAULT 'Learn more',
    "bonusDefinitionId" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Promotion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoyaltyAccount" (
    "userId" TEXT NOT NULL,
    "points" BIGINT NOT NULL DEFAULT 0,
    "lifetimePoints" BIGINT NOT NULL DEFAULT 0,
    "tier" "LoyaltyTier" NOT NULL DEFAULT 'BRONZE',
    "tierUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoyaltyAccount_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "LoyaltyEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roundId" TEXT,
    "points" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoyaltyEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerLimit" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "PlayerLimitType" NOT NULL,
    "value" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlayerLimit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiskFlag" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "severity" "RiskSeverity" NOT NULL,
    "status" "RiskFlagStatus" NOT NULL DEFAULT 'OPEN',
    "description" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "resolution" TEXT,

    CONSTRAINT "RiskFlag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "actorRole" "UserRole",
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdempotencyRecord" (
    "key" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "statusCode" INTEGER NOT NULL,
    "responseBody" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IdempotencyRecord_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemSetting" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "description" TEXT,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE INDEX "User_status_idx" ON "User"("status");

-- CreateIndex
CREATE INDEX "User_createdAt_idx" ON "User"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserSession_refreshTokenHash_key" ON "UserSession"("refreshTokenHash");

-- CreateIndex
CREATE INDEX "UserSession_userId_expiresAt_idx" ON "UserSession"("userId", "expiresAt");

-- CreateIndex
CREATE INDEX "LedgerAccount_type_idx" ON "LedgerAccount"("type");

-- CreateIndex
CREATE UNIQUE INDEX "LedgerAccount_userId_type_key" ON "LedgerAccount"("userId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "Wallet_userId_key" ON "Wallet"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Wallet_cashAccountId_key" ON "Wallet"("cashAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Wallet_bonusAccountId_key" ON "Wallet"("bonusAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "JournalEntry_idempotencyKey_key" ON "JournalEntry"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "JournalEntry_reversalOfId_key" ON "JournalEntry"("reversalOfId");

-- CreateIndex
CREATE INDEX "JournalEntry_referenceType_referenceId_idx" ON "JournalEntry"("referenceType", "referenceId");

-- CreateIndex
CREATE INDEX "JournalEntry_createdAt_idx" ON "JournalEntry"("createdAt");

-- CreateIndex
CREATE INDEX "JournalEntry_type_createdAt_idx" ON "JournalEntry"("type", "createdAt");

-- CreateIndex
CREATE INDEX "JournalLine_accountId_createdAt_idx" ON "JournalLine"("accountId", "createdAt");

-- CreateIndex
CREATE INDEX "JournalLine_entryId_idx" ON "JournalLine"("entryId");

-- CreateIndex
CREATE UNIQUE INDEX "CasinoProvider_code_key" ON "CasinoProvider"("code");

-- CreateIndex
CREATE INDEX "ProviderErrorLog_providerId_createdAt_idx" ON "ProviderErrorLog"("providerId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "GameCategory_slug_key" ON "GameCategory"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "CasinoGame_slug_key" ON "CasinoGame"("slug");

-- CreateIndex
CREATE INDEX "CasinoGame_status_sortOrder_idx" ON "CasinoGame"("status", "sortOrder");

-- CreateIndex
CREATE INDEX "CasinoGame_providerId_idx" ON "CasinoGame"("providerId");

-- CreateIndex
CREATE INDEX "CasinoGame_engine_idx" ON "CasinoGame"("engine");

-- CreateIndex
CREATE INDEX "CasinoGameCategory_categoryId_idx" ON "CasinoGameCategory"("categoryId");

-- CreateIndex
CREATE INDEX "PlayerRecentGame_userId_lastPlayedAt_idx" ON "PlayerRecentGame"("userId", "lastPlayedAt");

-- CreateIndex
CREATE UNIQUE INDEX "GameSession_token_key" ON "GameSession"("token");

-- CreateIndex
CREATE INDEX "GameSession_userId_status_idx" ON "GameSession"("userId", "status");

-- CreateIndex
CREATE INDEX "GameSession_gameId_startedAt_idx" ON "GameSession"("gameId", "startedAt");

-- CreateIndex
CREATE INDEX "GameSession_status_lastActivityAt_idx" ON "GameSession"("status", "lastActivityAt");

-- CreateIndex
CREATE UNIQUE INDEX "GameRound_idempotencyKey_key" ON "GameRound"("idempotencyKey");

-- CreateIndex
CREATE INDEX "GameRound_userId_createdAt_idx" ON "GameRound"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "GameRound_gameId_createdAt_idx" ON "GameRound"("gameId", "createdAt");

-- CreateIndex
CREATE INDEX "GameRound_createdAt_idx" ON "GameRound"("createdAt");

-- CreateIndex
CREATE INDEX "GameRound_sessionId_idx" ON "GameRound"("sessionId");

-- CreateIndex
CREATE INDEX "GameRound_status_idx" ON "GameRound"("status");

-- CreateIndex
CREATE UNIQUE INDEX "GameRoundTransaction_journalEntryId_key" ON "GameRoundTransaction"("journalEntryId");

-- CreateIndex
CREATE INDEX "GameRoundTransaction_roundId_idx" ON "GameRoundTransaction"("roundId");

-- CreateIndex
CREATE UNIQUE INDEX "CrashRound_seq_key" ON "CrashRound"("seq");

-- CreateIndex
CREATE INDEX "CrashRound_status_idx" ON "CrashRound"("status");

-- CreateIndex
CREATE INDEX "CrashRound_createdAt_idx" ON "CrashRound"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CrashBet_gameRoundId_key" ON "CrashBet"("gameRoundId");

-- CreateIndex
CREATE INDEX "CrashBet_userId_createdAt_idx" ON "CrashBet"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CrashBet_crashRoundId_userId_key" ON "CrashBet"("crashRoundId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "BonusDefinition_code_key" ON "BonusDefinition"("code");

-- CreateIndex
CREATE UNIQUE INDEX "PlayerBonus_claimKey_key" ON "PlayerBonus"("claimKey");

-- CreateIndex
CREATE UNIQUE INDEX "PlayerBonus_journalEntryId_key" ON "PlayerBonus"("journalEntryId");

-- CreateIndex
CREATE INDEX "PlayerBonus_userId_status_idx" ON "PlayerBonus"("userId", "status");

-- CreateIndex
CREATE INDEX "PlayerBonus_definitionId_idx" ON "PlayerBonus"("definitionId");

-- CreateIndex
CREATE INDEX "PlayerBonus_status_expiresAt_idx" ON "PlayerBonus"("status", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Promotion_slug_key" ON "Promotion"("slug");

-- CreateIndex
CREATE INDEX "Promotion_isActive_sortOrder_idx" ON "Promotion"("isActive", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "LoyaltyEvent_roundId_key" ON "LoyaltyEvent"("roundId");

-- CreateIndex
CREATE INDEX "LoyaltyEvent_userId_createdAt_idx" ON "LoyaltyEvent"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PlayerLimit_userId_type_key" ON "PlayerLimit"("userId", "type");

-- CreateIndex
CREATE INDEX "RiskFlag_userId_status_idx" ON "RiskFlag"("userId", "status");

-- CreateIndex
CREATE INDEX "RiskFlag_status_severity_createdAt_idx" ON "RiskFlag"("status", "severity", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_targetType_targetId_idx" ON "AuditLog"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_createdAt_idx" ON "AuditLog"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "IdempotencyRecord_expiresAt_idx" ON "IdempotencyRecord"("expiresAt");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "UserSession" ADD CONSTRAINT "UserSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerProfile" ADD CONSTRAINT "PlayerProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerAccount" ADD CONSTRAINT "LedgerAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_cashAccountId_fkey" FOREIGN KEY ("cashAccountId") REFERENCES "LedgerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_bonusAccountId_fkey" FOREIGN KEY ("bonusAccountId") REFERENCES "LedgerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_reversalOfId_fkey" FOREIGN KEY ("reversalOfId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "JournalEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "LedgerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderErrorLog" ADD CONSTRAINT "ProviderErrorLog_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "CasinoProvider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CasinoGame" ADD CONSTRAINT "CasinoGame_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "CasinoProvider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CasinoGameCategory" ADD CONSTRAINT "CasinoGameCategory_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "CasinoGame"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CasinoGameCategory" ADD CONSTRAINT "CasinoGameCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "GameCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerFavorite" ADD CONSTRAINT "PlayerFavorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerFavorite" ADD CONSTRAINT "PlayerFavorite_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "CasinoGame"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerRecentGame" ADD CONSTRAINT "PlayerRecentGame_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerRecentGame" ADD CONSTRAINT "PlayerRecentGame_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "CasinoGame"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameSession" ADD CONSTRAINT "GameSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameSession" ADD CONSTRAINT "GameSession_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "CasinoGame"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameSession" ADD CONSTRAINT "GameSession_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "CasinoProvider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameRound" ADD CONSTRAINT "GameRound_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "GameSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameRound" ADD CONSTRAINT "GameRound_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameRound" ADD CONSTRAINT "GameRound_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "CasinoGame"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameRoundTransaction" ADD CONSTRAINT "GameRoundTransaction_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "GameRound"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameRoundTransaction" ADD CONSTRAINT "GameRoundTransaction_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrashBet" ADD CONSTRAINT "CrashBet_crashRoundId_fkey" FOREIGN KEY ("crashRoundId") REFERENCES "CrashRound"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrashBet" ADD CONSTRAINT "CrashBet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrashBet" ADD CONSTRAINT "CrashBet_gameRoundId_fkey" FOREIGN KEY ("gameRoundId") REFERENCES "GameRound"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerBonus" ADD CONSTRAINT "PlayerBonus_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerBonus" ADD CONSTRAINT "PlayerBonus_definitionId_fkey" FOREIGN KEY ("definitionId") REFERENCES "BonusDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerBonus" ADD CONSTRAINT "PlayerBonus_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Promotion" ADD CONSTRAINT "Promotion_bonusDefinitionId_fkey" FOREIGN KEY ("bonusDefinitionId") REFERENCES "BonusDefinition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyAccount" ADD CONSTRAINT "LoyaltyAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyEvent" ADD CONSTRAINT "LoyaltyEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyEvent" ADD CONSTRAINT "LoyaltyEvent_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "GameRound"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerLimit" ADD CONSTRAINT "PlayerLimit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskFlag" ADD CONSTRAINT "RiskFlag_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskFlag" ADD CONSTRAINT "RiskFlag_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
