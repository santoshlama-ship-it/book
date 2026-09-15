import { neon } from '@neondatabase/serverless';

let client: ReturnType<typeof neon> | null = null;

export function getDatabase() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is not configured');
  if (!client) client = neon(connectionString);
  return client;
}

export async function ensureDatabaseTables() {
  const sql = getDatabase();
  await sql`
    CREATE TABLE IF NOT EXISTS coverdesk_state (
      id TEXT PRIMARY KEY,
      designs JSONB NOT NULL DEFAULT '[]'::jsonb,
      comments JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE TABLE IF NOT EXISTS coverdesk_covers (position INTEGER PRIMARY KEY, grade TEXT NOT NULL, subject TEXT NOT NULL, status TEXT NOT NULL, version TEXT NOT NULL, image_url TEXT NOT NULL DEFAULT '', palette JSONB NOT NULL DEFAULT '[]'::jsonb, concept TEXT NOT NULL DEFAULT '', inspiration TEXT NOT NULL DEFAULT '', details JSONB NOT NULL DEFAULT '{}'::jsonb, approval_client TEXT, approval_date DATE, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
  await sql`CREATE TABLE IF NOT EXISTS coverdesk_comments (cover_position INTEGER NOT NULL, id BIGINT NOT NULL, name TEXT NOT NULL, body TEXT NOT NULL, display_time TEXT NOT NULL, done BOOLEAN NOT NULL DEFAULT FALSE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY (cover_position, id))`;
  await sql`CREATE TABLE IF NOT EXISTS coverdesk_approval_history (id BIGSERIAL PRIMARY KEY, cover_position INTEGER NOT NULL, grade TEXT NOT NULL, subject TEXT NOT NULL, action TEXT NOT NULL, client_name TEXT, approval_date DATE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
  await sql`CREATE TABLE IF NOT EXISTS coverdesk_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
  await sql`ALTER TABLE coverdesk_covers ADD COLUMN IF NOT EXISTS cover_id TEXT`;
  await sql`UPDATE coverdesk_covers SET cover_id = 'legacy-' || position WHERE cover_id IS NULL`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS coverdesk_covers_cover_id_idx ON coverdesk_covers (cover_id)`;
  await sql`ALTER TABLE coverdesk_comments ADD COLUMN IF NOT EXISTS cover_id TEXT`;
  await sql`ALTER TABLE coverdesk_comments ADD COLUMN IF NOT EXISTS pin_x DOUBLE PRECISION`;
  await sql`ALTER TABLE coverdesk_comments ADD COLUMN IF NOT EXISTS pin_y DOUBLE PRECISION`;
  await sql`UPDATE coverdesk_comments AS comments SET cover_id = covers.cover_id FROM coverdesk_covers AS covers WHERE comments.cover_id IS NULL AND comments.cover_position = covers.position`;
  await sql`ALTER TABLE coverdesk_approval_history ADD COLUMN IF NOT EXISTS cover_id TEXT`;
  await sql`UPDATE coverdesk_approval_history AS history SET cover_id = covers.cover_id FROM coverdesk_covers AS covers WHERE history.cover_id IS NULL AND history.cover_position = covers.position`;
}
