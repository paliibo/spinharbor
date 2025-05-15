import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuditModule } from '../audit/audit.module';
import { UsersModule } from '../users/users.module';
import { WalletModule } from '../wallet/wallet.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { TokenService } from './token.service';

@Global()
@Module({
  imports: [JwtModule.register({}), UsersModule, WalletModule, AuditModule],
  controllers: [AuthController],
  providers: [AuthService, TokenService],
  exports: [TokenService, AuthService],
})
export class AuthModule {}
