import { ensureDatabaseTables, getDatabase } from '@/lib/db';
import { getAccessMode, sameOrigin } from '@/lib/access';

export const runtime = 'nodejs';

export async function GET() {
  const mode = await getAccessMode();
  if (!mode)
    return Response.json({ error: 'Access required' }, { status: 401 });
  await ensureDatabaseTables();
  const sql = getDatabase();
  const rows =
    await sql`SELECT id, event_type, title, body, book_id, is_read, created_at FROM coverdesk_notifications WHERE audience = ${mode} ORDER BY created_at DESC LIMIT 30`;
  return Response.json({ notifications: rows });
}

export async function PATCH(request: Request) {
  if (!sameOrigin(request))
    return Response.json({ error: 'Invalid request' }, { status: 403 });
  const mode = await getAccessMode();
  if (!mode)
    return Response.json({ error: 'Access required' }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as {
    id?: number;
    all?: boolean;
  };
  await ensureDatabaseTables();
  const sql = getDatabase();
  if (body.all)
    await sql`UPDATE coverdesk_notifications SET is_read = TRUE WHERE audience = ${mode}`;
  else if (body.id)
    await sql`UPDATE coverdesk_notifications SET is_read = TRUE WHERE audience = ${mode} AND id = ${body.id}`;
  return Response.json({ ok: true });
}
