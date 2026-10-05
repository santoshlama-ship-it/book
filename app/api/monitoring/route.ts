import { ensureDatabaseTables, getDatabase } from '@/lib/db';
import { hasAccess } from '@/lib/access';

export const runtime = 'nodejs';

export async function GET() {
  if (!(await hasAccess('super')))
    return Response.json(
      { error: 'Executive access required' },
      { status: 401 },
    );
  await ensureDatabaseTables();
  const sql = getDatabase();
  const events =
    await sql`SELECT area, level, event_type, message, duration_ms, created_at FROM coverdesk_ops_events ORDER BY created_at DESC LIMIT 50`;
  const summary =
    await sql`SELECT level, COUNT(*)::int AS count FROM coverdesk_ops_events WHERE created_at > NOW() - INTERVAL '24 hours' GROUP BY level`;
  return Response.json({
    status: 'operational',
    checkedAt: new Date().toISOString(),
    summary,
    events,
  });
}
