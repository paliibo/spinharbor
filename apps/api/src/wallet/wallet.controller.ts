import { Controller, Get, Headers, Post, UseInterceptors } from '@nestjs/common';
import { ApiCookieAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TransactionListQuerySchema, type TransactionListQuery } from '@spinharbor/contracts';
import { AuthPrincipal, CurrentUser } from '../common/decorators/auth.decorators';
import { Idempotent, IdempotencyInterceptor } from '../common/interceptors/idempotency.interceptor';
import { ApiZodQuery, ZodQuery } from '../common/zod/zod.decorators';
import { LedgerService } from '../ledger/ledger.service';
import { WalletService } from './wallet.service';

@ApiTags('wallet')
@ApiCookieAuth()
@Controller('wallet')
export class WalletController {
  constructor(
    private readonly wallet: WalletService,
    private readonly ledger: LedgerService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Current virtual wallet balances' })
  get(@CurrentUser() user: AuthPrincipal) {
    return this.wallet.getWallet(user.id);
  }

  @Get('summary')
  @ApiOperation({ summary: 'Wallet with today/lifetime activity totals' })
  summary(@CurrentUser() user: AuthPrincipal) {
    return this.wallet.getSummary(user.id);
  }

  @Get('transactions')
  @ApiOperation({ summary: 'Paginated journal lines of the player accounts' })
  @ApiZodQuery(TransactionListQuerySchema)
  transactions(@CurrentUser() user: AuthPrincipal, @ZodQuery(TransactionListQuerySchema) q: TransactionListQuery) {
    return this.ledger.listPlayerTransactions(user.id, q);
  }

  @Get('reconcile')
  @ApiOperation({ summary: 'Compare cached balance with the journal (transparency endpoint)' })
  reconcile(@CurrentUser() user: AuthPrincipal) {
    return this.ledger.reconcileUser(user.id);
  }

  @Post('reset')
  @UseInterceptors(IdempotencyInterceptor)
  @Idempotent('wallet.reset')
  @ApiHeader({ name: 'Idempotency-Key', required: false })
  @ApiOperation({ summary: 'Demo only: restore the initial demo balance (forfeits bonus funds)' })
  reset(@CurrentUser() user: AuthPrincipal, @Headers('idempotency-key') key?: string) {
    return this.wallet.resetDemo(user, key);
  }
}
