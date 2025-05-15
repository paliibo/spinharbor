import { Global, Module } from '@nestjs/common';
import { SecureRng } from '@spinharbor/engines';

export const RNG = Symbol('RNG');

/** Provides the production CSPRNG; tests override this provider with a SeededRng/FixedRng. */
@Global()
@Module({ providers: [{ provide: RNG, useFactory: () => new SecureRng() }], exports: [RNG] })
export class RngModule {}
