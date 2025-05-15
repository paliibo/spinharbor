import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import type { Env } from './config/env';

/** Shared between the real bootstrap and the integration test harness. */
export function configureApp(app: NestExpressApplication) {
  const config = app.get(ConfigService<Env, true>);
  app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cookieParser());
  app.set('trust proxy', 1);
  app.enableCors({ origin: config.get('WEB_ORIGIN'), credentials: true });
  app.enableShutdownHooks();
  return config;
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  const config = configureApp(app);

  const doc = new DocumentBuilder()
    .setTitle('SpinHarbor API')
    .setDescription('Demo-credit online casino platform & game aggregation. All balances are virtual; nothing here moves real money.')
    .setVersion('0.1.0')
    .addCookieAuth('sh_access')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, doc), { jsonDocumentUrl: 'api/docs-json' });

  const port = config.get('API_PORT');
  await app.listen(port);
  app.get(Logger).log(`SpinHarbor API listening on http://localhost:${port} (docs at /api/docs)`);
}
if (require.main === module) void bootstrap();
