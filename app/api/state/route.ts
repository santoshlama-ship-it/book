import { ensureDatabaseTables, getDatabase } from '@/lib/db';

export const runtime = 'nodejs';

type Approval = { designer?: string; client: string; date: string };
type Cover = {
  id?: string;
  grade: string; subject: string; status: string; version: string; image: string;
  palette?: unknown[]; concept?: string; inspiration?: string;
  details?: Record<string, unknown>; approval?: Approval;
};
type Comment = { id: number; name: string; text: string; time: string; done?: boolean };

async function replaceDesigns(designs: Cover[], recordHistory = true) {
  const sql = getDatabase();
  const previousRows = await sql`SELECT cover_id, approval_client, approval_date FROM coverdesk_covers ORDER BY position` as unknown as Array<{ cover_id: string; approval_client: string | null; approval_date: string | null }>;
  const previous = new Map(previousRows.map((row) => [row.cover_id, row]));

  if (recordHistory) {
    for (const [position, cover] of designs.entries()) {
      const coverId = cover.id || `legacy-${position}`;
      const before = previous.get(coverId);
      const after = cover.approval;
      const changed = before?.approval_client !== (after?.client || null) || String(before?.approval_date || '').slice(0, 10) !== (after?.date || '');
      if (!changed) continue;
      const action = !before?.approval_client && after?.client ? 'approved' : before?.approval_client && !after?.client ? 'approval_removed' : 'approval_updated';
      await sql`INSERT INTO coverdesk_approval_history (cover_position, cover_id, grade, subject, action, client_name, approval_date) VALUES (${position}, ${coverId}, ${cover.grade}, ${cover.subject}, ${action}, ${after?.client || before?.approval_client || null}, ${after?.date || null})`;
    }
  }

  await sql`DELETE FROM coverdesk_covers`;
  for (const [position, cover] of designs.entries()) {
    const coverId = cover.id || `legacy-${position}`;
    await sql`
      INSERT INTO coverdesk_covers (position, cover_id, grade, subject, status, version, image_url, palette, concept, inspiration, details, approval_client, approval_date)
      VALUES (${position}, ${coverId}, ${cover.grade}, ${cover.subject}, ${cover.status}, ${cover.version}, ${cover.image || ''}, ${JSON.stringify(cover.palette || [])}::jsonb, ${cover.concept || ''}, ${cover.inspiration || ''}, ${JSON.stringify(cover.details || {})}::jsonb, ${cover.approval?.client || null}, ${cover.approval?.date || null})
    `;
  }
}

async function replaceComments(comments: Record<string, Comment[]>) {
  const sql = getDatabase();
  const covers = await sql`SELECT position, cover_id FROM coverdesk_covers` as unknown as Array<{ position: number; cover_id: string }>;
  const coverIds = new Map(covers.map((cover) => [cover.position, cover.cover_id]));
  await sql`DELETE FROM coverdesk_comments`;
  for (const [coverPosition, items] of Object.entries(comments)) {
    for (const comment of items) {
      await sql`INSERT INTO coverdesk_comments (cover_position, cover_id, id, name, body, display_time, done) VALUES (${Number(coverPosition)}, ${coverIds.get(Number(coverPosition)) || null}, ${comment.id}, ${comment.name}, ${comment.text}, ${comment.time}, ${Boolean(comment.done)})`;
    }
  }
}

async function migrateLegacyStateOnce() {
  const sql = getDatabase();
  const marker = await sql`SELECT value FROM coverdesk_meta WHERE key = 'structured_migration_v1'` as unknown as Array<{ value: string }>;
  if (marker.length) return;

  const legacy = await sql`SELECT designs, comments FROM coverdesk_state WHERE id = 'main'` as unknown as Array<{ designs: Cover[]; comments: Record<string, Comment[]> }>;
  if (legacy[0]) {
    const legacyDesigns = Array.isArray(legacy[0].designs) ? legacy[0].designs : [];
    await replaceDesigns(legacyDesigns, false);
    await replaceComments(legacy[0].comments || {});
    for (const [position, cover] of legacyDesigns.entries()) {
      if (!cover.approval?.client) continue;
      await sql`INSERT INTO coverdesk_approval_history (cover_position, cover_id, grade, subject, action, client_name, approval_date) VALUES (${position}, ${cover.id || `legacy-${position}`}, ${cover.grade}, ${cover.subject}, 'approved', ${cover.approval.client}, ${cover.approval.date || null})`;
    }
  }
  await sql`INSERT INTO coverdesk_meta (key, value) VALUES ('structured_migration_v1', 'complete') ON CONFLICT (key) DO NOTHING`;
}

async function prepareDatabase() {
  await ensureDatabaseTables();
  await migrateLegacyStateOnce();
}

export async function GET() {
  try {
    await prepareDatabase();
    const sql = getDatabase();
    const coverRows = await sql`SELECT position, cover_id, grade, subject, status, version, image_url, palette, concept, inspiration, details, approval_client, approval_date FROM coverdesk_covers ORDER BY position` as unknown as Array<Record<string, unknown>>;
    const commentRows = await sql`SELECT cover_position, id, name, body, display_time, done FROM coverdesk_comments ORDER BY cover_position, created_at, id` as unknown as Array<{ cover_position: number; id: string | number; name: string; body: string; display_time: string; done: boolean }>;
    const designs = coverRows.map((row) => ({
      id: row.cover_id, grade: row.grade, subject: row.subject, status: row.status, version: row.version, image: row.image_url,
      palette: row.palette, concept: row.concept, inspiration: row.inspiration, details: row.details,
      ...(row.approval_client ? { approval: { designer: '', client: row.approval_client, date: String(row.approval_date || '').slice(0, 10) } } : {}),
    }));
    const comments = commentRows.reduce<Record<string, Comment[]>>((result, row) => {
      const key = String(row.cover_position);
      (result[key] ||= []).push({ id: Number(row.id), name: row.name, text: row.body, time: row.display_time, done: row.done });
      return result;
    }, {});
    return Response.json({ designs, comments });
  } catch (error) {
    console.error('[api/state] read failed', error);
    return Response.json({ error: 'Unable to load saved data' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json() as { designs?: Cover[]; comments?: Record<string, Comment[]> };
    await prepareDatabase();
    if (body.designs !== undefined) await replaceDesigns(body.designs);
    if (body.comments !== undefined) await replaceComments(body.comments);
    return Response.json({ ok: true });
  } catch (error) {
    console.error('[api/state] write failed', error);
    return Response.json({ error: 'Unable to save data' }, { status: 500 });
  }
}
