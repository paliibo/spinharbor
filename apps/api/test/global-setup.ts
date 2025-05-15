import { execSync } from 'node:child_process';
import path from 'node:path';
import { config } from 'dotenv';

/** Applies migrations to the dedicated test database before the suite runs. */
export default function globalSetup() {
  config({ path: path.resolve(__dirname, '../../../.env') });
  const url = (process.env.DATABASE_URL ?? 'postgresql://spinharbor:spinharbor@localhost:5441/spinharbor?schema=public').replace('/spinharbor?', '/spinharbor_test?');
  execSync('pnpm exec prisma migrate deploy --schema ../../packages/database/prisma/schema.prisma', { cwd: __dirname + '/..', env: { ...process.env, DATABASE_URL: url }, stdio: 'pipe' });
}
