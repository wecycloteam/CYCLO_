import path from 'node:path';
import { config as loadEnv } from 'dotenv';

// Load apps/api/.env — DATABASE_URL now comes straight from there (Postgres, as of
// 2026-08-22's Supabase migration). Previously this pinned DATABASE_URL to an absolute
// SQLite file path (relative sqlite paths resolved inconsistently depending on how the
// process was launched); that hack is gone now that the datasource is a real network URL.
loadEnv({ path: path.resolve(__dirname, '../.env') });
