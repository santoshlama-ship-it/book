import { ensureStateTable, getDatabase } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET() {
  try {
    await ensureStateTable();
    const sql = getDatabase();
    const rows = await sql`SELECT designs, comments FROM coverdesk_state WHERE id = 'main'` as unknown as Array<{ designs: unknown[]; comments: Record<string, unknown> }>;
    return Response.json(rows[0] ?? { designs: [], comments: {} });
  } catch (error) {
    console.error('[api/state] read failed', error);
    return Response.json({ error: 'Unable to load saved data' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json() as { designs?: unknown; comments?: unknown };
    await ensureStateTable();
    const sql = getDatabase();
    const designs = JSON.stringify(body.designs ?? []);
    const comments = JSON.stringify(body.comments ?? {});
    const updateDesigns = body.designs !== undefined;
    const updateComments = body.comments !== undefined;

    await sql`
      INSERT INTO coverdesk_state (id, designs, comments)
      VALUES ('main', ${designs}::jsonb, ${comments}::jsonb)
      ON CONFLICT (id) DO UPDATE SET
        designs = CASE WHEN ${updateDesigns} THEN EXCLUDED.designs ELSE coverdesk_state.designs END,
        comments = CASE WHEN ${updateComments} THEN EXCLUDED.comments ELSE coverdesk_state.comments END,
        updated_at = NOW()
    `;
    return Response.json({ ok: true });
  } catch (error) {
    console.error('[api/state] write failed', error);
    return Response.json({ error: 'Unable to save data' }, { status: 500 });
  }
}
