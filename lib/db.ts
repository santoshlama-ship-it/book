import { neon } from '@neondatabase/serverless';

let client: ReturnType<typeof neon> | null = null;

export function getDatabase() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is not configured');
  if (!client) client = neon(connectionString);
  return client;
}

export async function ensureStateTable() {
  const sql = getDatabase();
  await sql`
    CREATE TABLE IF NOT EXISTS coverdesk_state (
      id TEXT PRIMARY KEY,
      designs JSONB NOT NULL DEFAULT '[]'::jsonb,
      comments JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
}
