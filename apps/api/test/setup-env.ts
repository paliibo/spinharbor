import { config } from 'dotenv';
import path from 'node:path';

config({ path: path.resolve(__dirname, '../../../.env'), quiet: true });
process.env.NODE_ENV = 'test';
// Integration tests run against a dedicated database so they never touch demo data.
process.env.DATABASE_URL = (process.env.DATABASE_URL ?? 'postgresql://spinharbor:spinharbor@localhost:5441/spinharbor?schema=public').replace(
  '/spinharbor?',
  '/spinharbor_test?',
) + '&connection_limit=20';
process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET ?? 'test-access-secret-test-access-secret-123456';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET ?? 'test-refresh-secret-test-refresh-secret-1234';
process.env.LOG_LEVEL = 'silent';
process.env.ENABLE_DEMO_RESET = 'true';
process.env.CRASH_LOOP_ENABLED = 'false';
