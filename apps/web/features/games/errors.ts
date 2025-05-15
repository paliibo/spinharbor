import { ApiRequestError, errorMessage } from '@/lib/api';

/** Friendly copy for the error codes the game endpoints return. Falls back to the server message. */
const FRIENDLY: Record<string, string> = {
  INSUFFICIENT_BALANCE: 'Not enough credits for this bet. Top up from the wallet page (demo credits are free).',
  ACCOUNT_RESTRICTED: 'Your account is currently restricted from playing. See Responsible gaming for details.',
  LIMIT_EXCEEDED: 'This bet would exceed one of your responsible-gaming limits.',
  BET_OUT_OF_RANGE: 'That bet is outside the allowed range for this game.',
  SESSION_INVALID: 'Your game session is no longer valid. Reload the page to start a new one.',
  ROUND_CLOSED: 'Betting for this round is closed. Wait for the next one.',
  ROUND_CRASHED: 'Too late — the round already crashed.',
  DUPLICATE_BET: 'You already have a bet in this round.',
  NO_OPEN_BET: 'You have no open bet to cash out.',
  RATE_LIMITED: 'Slow down — too many requests. Try again in a moment.',
  GAME_UNAVAILABLE: 'This game is currently unavailable.',
  VALIDATION_ERROR: 'The request was rejected by the server. Check your bet and try again.',
};

export function gameErrorMessage(e: unknown): string {
  if (e instanceof ApiRequestError) {
    const code = e.code;
    if (code && FRIENDLY[code]) return FRIENDLY[code];
    const details = e.body?.details;
    if (Array.isArray(details) && details.length > 0) {
      const first = details[0] as { message?: string };
      if (first?.message) return `${e.message}: ${first.message}`;
    }
  }
  return errorMessage(e);
}

export function errorCode(e: unknown): string | undefined {
  return e instanceof ApiRequestError ? e.code : undefined;
}
