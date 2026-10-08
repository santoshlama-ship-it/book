import { ensureDatabaseTables, getDatabase } from '@/lib/db';
import {
  isGoogleSheetSyncConfigured,
  readGoogleSheetState,
  writeGoogleSheetState,
  type SyncedState,
} from '@/lib/google-sheet-sync';
import { hasAccess, sameOrigin } from '@/lib/access';
import { notify, recordOperation } from '@/lib/operations';

export const runtime = 'nodejs';

type Approval = { designer?: string; client: string; date: string };
type Cover = {
  id?: string;
  archived?: boolean;
  grade: string;
  subject: string;
  status: string;
  version: string;
  image: string;
  palette?: unknown[];
  concept?: string;
  inspiration?: string;
  details?: Record<string, unknown>;
  approval?: Approval;
};
type Comment = {
  id: number;
  name: string;
  text: string;
  time: string;
  done?: boolean;
  pin?: { x: number; y: number };
};

function normaliseStatus(value: string) {
  const statuses: Record<string, string> = {
    approved: 'Approved',
    'ready for review': 'Ready for Review',
    'client review': 'Ready for Review',
    'changes needed': 'Changes Needed',
    'needs changes': 'Changes Needed',
    'working on': 'Working On',
    'in design': 'Working On',
    'not started': 'Not Started',
    'brief ready': 'Not Started',
    redo: 'Redo',
    'on hold': 'On Hold',
  };
  return statuses[value.trim().toLowerCase()] || 'Not Started';
}

async function replaceDesigns(designs: Cover[], recordHistory = true) {
  const sql = getDatabase();
  const previousRows =
    (await sql`SELECT cover_id, status, approval_client, approval_date FROM coverdesk_covers ORDER BY position`) as unknown as Array<{
      cover_id: string;
      status: string;
      approval_client: string | null;
      approval_date: string | null;
    }>;
  const previous = new Map(previousRows.map((row) => [row.cover_id, row]));

  if (recordHistory) {
    for (const [position, cover] of designs.entries()) {
      const coverId = cover.id || `legacy-${position}`;
      const before = previous.get(coverId);
      const after = cover.approval;
      const changed =
        before?.approval_client !== (after?.client || null) ||
        String(before?.approval_date || '').slice(0, 10) !==
          (after?.date || '');
      if (!changed) continue;
      const action =
        !before?.approval_client && after?.client
          ? 'approved'
          : before?.approval_client && !after?.client
            ? 'approval_removed'
            : 'approval_updated';
      await sql`INSERT INTO coverdesk_approval_history (cover_position, cover_id, grade, subject, action, client_name, approval_date) VALUES (${position}, ${coverId}, ${cover.grade}, ${cover.subject}, ${action}, ${after?.client || before?.approval_client || null}, ${after?.date || null})`;
    }
  }

  await sql`DELETE FROM coverdesk_covers`;
  for (const [position, cover] of designs.entries()) {
    const coverId = cover.id || `legacy-${position}`;
    await sql`
      INSERT INTO coverdesk_covers (position, cover_id, grade, subject, status, version, image_url, palette, concept, inspiration, details, approval_client, approval_date, archived)
      VALUES (${position}, ${coverId}, ${cover.grade}, ${cover.subject}, ${normaliseStatus(cover.status)}, ${cover.version}, ${cover.image || ''}, ${JSON.stringify(cover.palette || [])}::jsonb, ${cover.concept || ''}, ${cover.inspiration || ''}, ${JSON.stringify(cover.details || {})}::jsonb, ${cover.approval?.client || null}, ${cover.approval?.date || null}, ${Boolean(cover.archived)})
    `;
  }
  for (const cover of designs) {
    const coverId = cover.id || '';
    const before = previous.get(coverId);
    if (
      before &&
      before.status !== 'Approved' &&
      normaliseStatus(cover.status) === 'Approved'
    ) {
      await notify(
        'books',
        'cover_approved',
        'Cover approved',
        `${cover.subject} · Grade ${cover.grade} · ${cover.version}`,
        coverId,
      );
      await notify(
        'super',
        'cover_approved',
        'Cover approved',
        `${cover.subject} · Grade ${cover.grade} · ${cover.version}`,
        coverId,
      );
    }
  }
}

async function replaceComments(comments: Record<string, Comment[]>) {
  const sql = getDatabase();
  const covers =
    (await sql`SELECT position, cover_id FROM coverdesk_covers`) as unknown as Array<{
      position: number;
      cover_id: string;
    }>;
  const coverIds = new Map(
    covers.map((cover) => [cover.position, cover.cover_id]),
  );
  await sql`DELETE FROM coverdesk_comments`;
  for (const [coverPosition, items] of Object.entries(comments)) {
    for (const comment of items) {
      await sql`INSERT INTO coverdesk_comments (cover_position, cover_id, id, name, body, display_time, done, pin_x, pin_y) VALUES (${Number(coverPosition)}, ${coverIds.get(Number(coverPosition)) || null}, ${comment.id}, ${comment.name || 'Reviewer'}, ${comment.text}, ${comment.time}, ${Boolean(comment.done)}, ${comment.pin?.x ?? null}, ${comment.pin?.y ?? null})`;
    }
    if (items.length)
      await sql`UPDATE coverdesk_covers SET status = 'Changes Needed', updated_at = NOW() WHERE position = ${Number(coverPosition)}`;
  }
}

function applyCommentStatuses(state: SyncedState): SyncedState {
  const comments = Object.fromEntries(
    Object.entries(state.comments).map(([position, items]) => [
      position,
      [...items],
    ]),
  );
  const noteId = (key: string, text: string) => {
    let hash = 0;
    for (const character of `${key}|${text}`)
      hash = ((hash << 5) - hash + character.charCodeAt(0)) | 0;
    return Math.abs(hash) || 1;
  };
  state.designs.forEach((cover, position) => {
    const note =
      typeof cover.details?.approval === 'string' ? cover.details.approval : '';
    const items = (comments[String(position)] ||= []);
    note
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .forEach((text) => {
        if (
          items.some(
            (comment) =>
              comment.text.trim().toLowerCase() === text.toLowerCase(),
          )
        )
          return;
        items.push({
          id: noteId(`${cover.grade}|${cover.subject}|${cover.version}`, text),
          name: 'Sheet note',
          text,
          time: 'From Google Sheets',
          done: false,
        });
      });
  });
  return {
    ...state,
    comments,
    designs: state.designs.map((cover, position) =>
      (comments[String(position)] || []).length
        ? { ...cover, status: 'Changes Needed' }
        : cover,
    ),
  };
}

async function migrateLegacyStateOnce() {
  const sql = getDatabase();
  const marker =
    (await sql`SELECT value FROM coverdesk_meta WHERE key = 'structured_migration_v1'`) as unknown as Array<{
      value: string;
    }>;
  if (marker.length) return;

  const legacy =
    (await sql`SELECT designs, comments FROM coverdesk_state WHERE id = 'main'`) as unknown as Array<{
      designs: Cover[];
      comments: Record<string, Comment[]>;
    }>;
  if (legacy[0]) {
    const legacyDesigns = Array.isArray(legacy[0].designs)
      ? legacy[0].designs
      : [];
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

async function readDatabaseState(): Promise<SyncedState> {
  const sql = getDatabase();
  const coverRows =
    (await sql`SELECT position, cover_id, grade, subject, status, version, image_url, palette, concept, inspiration, details, approval_client, approval_date, archived FROM coverdesk_covers ORDER BY position`) as unknown as Array<
      Record<string, unknown>
    >;
  const commentRows =
    (await sql`SELECT cover_position, id, name, body, display_time, done, pin_x, pin_y, created_at FROM coverdesk_comments ORDER BY cover_position, created_at, id`) as unknown as Array<{
      cover_position: number;
      id: string | number;
      name: string;
      body: string;
      display_time: string;
      created_at: string;
      done: boolean;
      pin_x: number | null;
      pin_y: number | null;
    }>;
  const designs = coverRows.map((row) => ({
    id: String(row.cover_id || ''),
    grade: String(row.grade || ''),
    subject: String(row.subject || ''),
    status: normaliseStatus(String(row.status || '')),
    version: String(row.version || ''),
    image: String(row.image_url || ''),
    archived: Boolean(row.archived),
    palette: Array.isArray(row.palette) ? row.palette : [],
    concept: String(row.concept || ''),
    inspiration: String(row.inspiration || ''),
    details: (row.details || {}) as Record<string, unknown>,
    ...(row.approval_client
      ? {
          approval: {
            designer: '',
            client: String(row.approval_client),
            date: String(row.approval_date || '').slice(0, 10),
          },
        }
      : {}),
  }));
  const comments = commentRows.reduce<Record<string, Comment[]>>(
    (result, row) => {
      const key = String(row.cover_position);
      (result[key] ||= []).push({
        id: Number(row.id),
        name: row.name,
        text: row.body,
        time: Number.isFinite(Date.parse(row.display_time))
          ? row.display_time
          : String(row.created_at),
        done: row.done,
        ...(row.pin_x !== null && row.pin_y !== null
          ? { pin: { x: Number(row.pin_x), y: Number(row.pin_y) } }
          : {}),
      });
      return result;
    },
    {},
  );
  return { designs, comments };
}

export async function GET() {
  if (!(await hasAccess('covers')))
    return Response.json(
      { error: 'Cover review password required' },
      { status: 401 },
    );
  try {
    await prepareDatabase();
    let sheetSync: 'connected' | 'not-configured' | 'unavailable' =
      isGoogleSheetSyncConfigured() ? 'connected' : 'not-configured';
    if (isGoogleSheetSyncConfigured()) {
      try {
        const sheetState = await readGoogleSheetState();
        if (sheetState) {
          const syncedState = applyCommentStatuses(sheetState);
          const databaseState = await readDatabaseState();
          const archivedIds = new Set(
            databaseState.designs
              .filter((cover) => cover.archived)
              .map((cover) => cover.id),
          );
          syncedState.designs = syncedState.designs.map((cover) => ({
            ...cover,
            archived: archivedIds.has(cover.id),
          }));
          await replaceDesigns(syncedState.designs, false);
          await replaceComments(syncedState.comments);
        }
      } catch (error) {
        sheetSync = 'unavailable';
        console.error(
          '[api/state] Google Sheets read failed; using Neon data',
          error,
        );
      }
    }
    const state = await readDatabaseState();
    return Response.json({ ...state, sheetSync });
  } catch (error) {
    console.error('[api/state] read failed', error);
    await recordOperation(
      'covers',
      'database_read_failed',
      String(error),
      'error',
    );
    return Response.json(
      { error: 'Unable to load saved data' },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  if (!sameOrigin(request))
    return Response.json({ error: 'Invalid request' }, { status: 403 });
  if (!(await hasAccess('covers')))
    return Response.json(
      { error: 'Cover review password required' },
      { status: 401 },
    );
  try {
    const body = (await request.json()) as {
      designs?: Cover[];
      comments?: Record<string, Comment[]>;
    };
    await prepareDatabase();
    if (body.designs !== undefined) await replaceDesigns(body.designs);
    if (body.comments !== undefined) await replaceComments(body.comments);
    let sheetSync: 'connected' | 'not-configured' | 'unavailable' =
      isGoogleSheetSyncConfigured() ? 'connected' : 'not-configured';
    if (isGoogleSheetSyncConfigured()) {
      try {
        await writeGoogleSheetState(await readDatabaseState());
      } catch (error) {
        sheetSync = 'unavailable';
        console.error(
          '[api/state] Google Sheets write failed; Neon save completed',
          error,
        );
      }
    }
    return Response.json({ ok: true, sheetSync });
  } catch (error) {
    console.error('[api/state] write failed', error);
    await recordOperation(
      'covers',
      'database_write_failed',
      String(error),
      'error',
    );
    return Response.json({ error: 'Unable to save data' }, { status: 500 });
  }
}
