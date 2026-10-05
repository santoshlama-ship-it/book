import { ensureDatabaseTables, getDatabase } from '@/lib/db';
import { hasAccess, sameOrigin } from '@/lib/access';
import { getQc, type QcReview } from '@/lib/book-qc';
import { notify, recordOperation } from '@/lib/operations';

export const runtime = 'nodejs';

export async function GET() {
  if (!(await hasAccess('super')))
    return Response.json(
      { error: 'Executive access required' },
      { status: 401 },
    );
  try {
    await ensureDatabaseTables();
    const sql = getDatabase();
    const books = (await sql`
      SELECT b.book_id, b.title, b.grade, b.subject, b.version, b.status, b.page_count,
             b.cover_id, b.updated_at, b.qc,
             COALESCE(SUM(CASE WHEN c.done = FALSE THEN 1 ELSE 0 END), 0)::int AS open_feedback
      FROM bookdesk_books b
      LEFT JOIN bookdesk_comments c ON c.book_id = b.book_id
      GROUP BY b.position, b.book_id, b.title, b.grade, b.subject, b.version, b.status,
               b.page_count, b.cover_id, b.updated_at, b.qc
      ORDER BY b.position
    `) as unknown as Array<Record<string, unknown>>;
    const covers =
      (await sql`SELECT cover_id, grade, subject, version, image_url, status FROM coverdesk_covers ORDER BY position`) as unknown as Array<
        Record<string, unknown>
      >;
    const coverById = new Map(
      covers.map((cover) => [String(cover.cover_id), cover]),
    );
    const products = books.map((book) => {
      const cover =
        coverById.get(String(book.cover_id || '')) ||
        covers.find(
          (item) =>
            item.grade === book.grade &&
            item.subject === book.subject &&
            item.version === book.version,
        );
      const qcPassed = getQc(book.qc as QcReview[]).filter(
        (item) => item.status === 'approved',
      ).length;
      const openFeedback = Number(book.open_feedback) || 0;
      const status = String(book.status || 'Ready for Review');
      const completion =
        status === 'Approved'
          ? 100
          : Math.min(95, 35 + qcPassed * 18 + (openFeedback === 0 ? 6 : 0));
      return {
        id: String(book.book_id),
        title: String(book.title),
        grade: String(book.grade),
        subject: String(book.subject),
        version: String(book.version),
        status,
        pageCount: Number(book.page_count) || 1,
        coverImage: cover ? String(cover.image_url || '') : '',
        coverStatus: cover ? String(cover.status || '') : 'Missing',
        completion,
        qcPassed,
        attention:
          openFeedback > 0 || status === 'Changes Needed' || status === 'Redo',
        updatedAt: new Date(String(book.updated_at)).toISOString(),
        pdf: `/api/executive/pdf?book=${encodeURIComponent(String(book.book_id))}`,
      };
    });
    const history =
      await sql`SELECT id, book_id, action, note, created_at FROM bookdesk_executive_history ORDER BY created_at DESC LIMIT 50`;
    return Response.json({ products, history });
  } catch (error) {
    console.error('[api/executive] read failed', error);
    await recordOperation(
      'executive',
      'dashboard_read_failed',
      error instanceof Error ? error.message : 'Unknown dashboard error',
      'error',
    );
    return Response.json(
      { error: 'Unable to load the executive dashboard' },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  if (!sameOrigin(request))
    return Response.json({ error: 'Invalid request' }, { status: 403 });
  if (!(await hasAccess('super')))
    return Response.json(
      { error: 'Executive access required' },
      { status: 401 },
    );
  const started = Date.now();
  try {
    const body = (await request.json()) as {
      bookId?: string;
      action?: 'approved' | 'returned';
      note?: string;
    };
    if (!body.bookId || !['approved', 'returned'].includes(String(body.action)))
      return Response.json(
        { error: 'Invalid executive decision' },
        { status: 400 },
      );
    if (body.action === 'returned' && !body.note?.trim())
      return Response.json(
        { error: 'Add a short note explaining what should change' },
        { status: 400 },
      );
    await ensureDatabaseTables();
    const sql = getDatabase();
    const rows =
      (await sql`SELECT title FROM bookdesk_books WHERE book_id = ${body.bookId} LIMIT 1`) as unknown as Array<{
        title: string;
      }>;
    if (!rows[0])
      return Response.json({ error: 'Book not found' }, { status: 404 });
    const status = body.action === 'approved' ? 'Approved' : 'Changes Needed';
    await sql.transaction([
      sql`UPDATE bookdesk_books SET status = ${status}, updated_at = NOW() WHERE book_id = ${body.bookId}`,
      sql`INSERT INTO bookdesk_executive_history (book_id, action, note) VALUES (${body.bookId}, ${body.action}, ${body.note?.trim() || ''})`,
    ]);
    await notify(
      'books',
      body.action === 'approved' ? 'print_ready' : 'boss_returned',
      body.action === 'approved'
        ? `${rows[0].title} is approved and print-ready`
        : `${rows[0].title} was returned by the executive reviewer`,
      body.note?.trim() || '',
      body.bookId,
    );
    await recordOperation(
      'executive',
      'decision_saved',
      `${body.action}: ${rows[0].title}`,
      'info',
      Date.now() - started,
    );
    return Response.json({ ok: true, status });
  } catch (error) {
    await recordOperation(
      'executive',
      'decision_failed',
      error instanceof Error ? error.message : 'Unknown decision error',
      'error',
      Date.now() - started,
    );
    return Response.json(
      { error: 'Unable to save the executive decision' },
      { status: 500 },
    );
  }
}
