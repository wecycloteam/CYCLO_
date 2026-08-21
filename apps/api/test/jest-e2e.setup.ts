import path from 'node:path';
import { config as loadEnv } from 'dotenv';

// Load apps/api/.env, then pin DATABASE_URL to an absolute path — Prisma's
// relative sqlite path resolution is inconsistent across how the process was
// launched (npm workspace script vs. jest's own cwd), so relative paths are
// unreliable here even though they work fine for `npm run start:dev`.
loadEnv({ path: path.resolve(__dirname, '../.env') });
process.env.DATABASE_URL = `file:${path.resolve(__dirname, '../../../prisma/dev.db').replace(/\\/g, '/')}`;
