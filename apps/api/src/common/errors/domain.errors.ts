import { HttpStatus } from '@nestjs/common';

/**
 * Domain errors carry a stable machine-readable code so the client can react (e.g. show
 * "insufficient balance") without parsing messages. The HTTP filter maps them to responses.
 */
export class DomainError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: HttpStatus = HttpStatus.BAD_REQUEST,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'DomainError';
  }
}

export const Errors = {
  insufficientBalance: (needed: bigint, available: bigint) =>
    new DomainError('INSUFFICIENT_BALANCE', `Insufficient balance: need ${needed}, have ${available}`, HttpStatus.UNPROCESSABLE_ENTITY, {
      neededMinor: Number(needed),
      availableMinor: Number(available),
    }),
  accountRestricted: (status: string, until: Date | null) =>
    new DomainError('ACCOUNT_RESTRICTED', restrictedMessage(status, until), HttpStatus.FORBIDDEN, { status, until }),
  limitExceeded: (type: string, limit: bigint, used: bigint) =>
    new DomainError('LIMIT_EXCEEDED', `${limitLabel(type)} limit reached`, HttpStatus.FORBIDDEN, {
      type,
      limitMinor: Number(limit),
      usedMinor: Number(used),
    }),
  betOutOfRange: (min: bigint, max: bigint) =>
    new DomainError('BET_OUT_OF_RANGE', `Bet must be between ${min} and ${max} minor units`, HttpStatus.BAD_REQUEST, {
      minMinor: Number(min),
      maxMinor: Number(max),
    }),
  gameUnavailable: (slug: string) => new DomainError('GAME_UNAVAILABLE', `Game ${slug} is not available`, HttpStatus.CONFLICT),
  sessionInvalid: () => new DomainError('SESSION_INVALID', 'Game session is not active', HttpStatus.CONFLICT),
  roundClosed: () => new DomainError('ROUND_CLOSED', 'The round is closed for this action', HttpStatus.CONFLICT),
  notFound: (what: string) => new DomainError('NOT_FOUND', `${what} not found`, HttpStatus.NOT_FOUND),
  conflict: (code: string, message: string) => new DomainError(code, message, HttpStatus.CONFLICT),
  forbidden: (message = 'Forbidden') => new DomainError('FORBIDDEN', message, HttpStatus.FORBIDDEN),
  badRequest: (code: string, message: string) => new DomainError(code, message, HttpStatus.BAD_REQUEST),
};

function restrictedMessage(status: string, until: Date | null) {
  const untilText = until ? ` until ${until.toISOString()}` : '';
  switch (status) {
    case 'SUSPENDED':
      return 'Your account is suspended. Contact support.';
    case 'COOLING_OFF':
      return `You are in a cooling-off period${untilText}.`;
    case 'SELF_EXCLUDED':
      return `You are self-excluded${untilText}.`;
    case 'CLOSED':
      return 'This account is closed.';
    default:
      return 'Account restricted';
  }
}

function limitLabel(type: string) {
  return (
    {
      DAILY_WAGER: 'Daily wager',
      WEEKLY_WAGER: 'Weekly wager',
      DAILY_LOSS: 'Daily loss',
      DAILY_TOPUP: 'Daily top-up',
      SESSION_MINUTES: 'Session time',
    }[type] ?? type
  );
}
