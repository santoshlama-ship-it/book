import { getQc, validQc, type QcReview } from '@/lib/book-qc';
import { ensureDatabaseTables, getDatabase } from '@/lib/db';
import { hasAccess, sameOrigin } from '@/lib/access';
import { notify, recordOperation } from '@/lib/operations';

export const runtime = 'nodejs';

type Point = { x: number; y: number };
type Book = {
  id: string;
  title: string;
  grade: string;
  subject: string;
  version: string;
  status: string;
  pdf: string;
  coverId?: string;
  uploader?: string;
  pageCount: number;
  qc?: QcReview[];
  annotations?: Record<string, unknown[]>;
};
type BookComment = {
  id: number;
  page: number;
  text: string;
  time: string;
  done?: boolean;
  pin?: Point;
};

async function readState() {
  const sql = getDatabase();
  const rows =
    (await sql`SELECT position, book_id, title, grade, subject, version, status, pdf_url, page_count, annotations, cover_id, uploader, qc FROM bookdesk_books ORDER BY position`) as unknown as Array<
      Record<string, unknown>
    >;
  const commentRows =
    (await sql`SELECT book_id, id, page_number, body, display_time, done, pin_x, pin_y, created_at FROM bookdesk_comments ORDER BY created_at, id`) as unknown as Array<
      Record<string, unknown>
    >;
  const coverRows =
    (await sql`SELECT cover_id, grade, subject, version, image_url FROM coverdesk_covers WHERE status = 'Approved' AND archived = FALSE ORDER BY position`) as unknown as Array<
      Record<string, unknown>
    >;
  const books = rows.map((row) => ({
    id: String(row.book_id),
    title: String(row.title),
    grade: String(row.grade),
    subject: String(row.subject),
    version: String(row.version),
    status:
      row.status === 'Approved' &&
      !getQc(row.qc as QcReview[]).every((item) => item.status === 'approved')
        ? 'Ready for Review'
        : String(row.status),
    qc: getQc(row.qc as QcReview[]),
    pdf: String(row.pdf_url),
    coverId: typeof row.cover_id === 'string' ? row.cover_id : '',
    uploader: typeof row.uploader === 'string' ? row.uploader : '',
    pageCount: Number(row.page_count) || 1,
    annotations: (row.annotations || {}) as Record<string, unknown[]>,
  }));
  const comments = commentRows.reduce<Record<string, BookComment[]>>(
    (result, row) => {
      const pin =
        row.pin_x !== null && row.pin_y !== null
          ? { pin: { x: Number(row.pin_x), y: Number(row.pin_y) } }
          : {};
      (result[String(row.book_id)] ||= []).push({
        id: Number(row.id),
        page: Number(row.page_number) || 1,
        text: String(row.body),
        time: Number.isFinite(Date.parse(String(row.display_time)))
          ? String(row.display_time)
          : String(row.created_at),
        done: Boolean(row.done),
        ...pin,
      });
      return result;
    },
    {},
  );
  const approvedCovers = coverRows.map((row) => ({
    id: String(row.cover_id),
    grade: String(row.grade),
    subject: String(row.subject),
    version: String(row.version),
    image: String(row.image_url),
  }));
  return { books, comments, approvedCovers };
}

export async function GET() {
  if (!(await hasAccess('books')))
    return Response.json(
      { error: 'Book review password required' },
      { status: 401 },
    );
  try {
    await ensureDatabaseTables();
    return Response.json(await readState());
  } catch (error) {
    console.error('[api/books] read failed', error);
    await recordOperation(
      'books',
      'database_read_failed',
      String(error),
      'error',
    );
    return Response.json({ error: 'Unable to load books' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  if (!sameOrigin(request))
    return Response.json({ error: 'Invalid request' }, { status: 403 });
  if (!(await hasAccess('books')))
    return Response.json(
      { error: 'Book review password required' },
      { status: 401 },
    );
  try {
    const body = (await request.json()) as {
      books?: Book[];
      comments?: Record<string, BookComment[]>;
    };
    if (body.books?.some((book) => !/^https?:\/\//i.test(book.pdf)))
      return Response.json(
        { error: 'A valid HTTP or HTTPS PDF link is required' },
        { status: 400 },
      );
    await ensureDatabaseTables();
    const sql = getDatabase();
    const writes = [sql`SELECT 1`];
    let existing: Array<{
      book_id: string;
      qc: QcReview[];
      pdf_url: string;
      status: string;
    }> = [];
    if (body.books) {
      existing =
        (await sql`SELECT book_id, qc, pdf_url, status FROM bookdesk_books`) as unknown as Array<{
          book_id: string;
          qc: QcReview[];
          pdf_url: string;
          status: string;
        }>;
      for (const book of body.books) {
        const qc = getQc(book.qc);
        if (!validQc(qc))
          return Response.json(
            {
              error:
                'Invalid QC review. Complete levels in order and record the reviewer.',
            },
            { status: 400 },
          );
        const previous = getQc(
          existing.find((item) => item.book_id === book.id)?.qc,
        );
        const gained = qc.filter(
          (item, index) =>
            item.status === 'approved' && previous[index].status !== 'approved',
        );
        if (gained.length > 1)
          return Response.json(
            { error: 'Approve one QC level at a time.' },
            { status: 400 },
          );
        if (
          gained.length &&
          (body.comments?.[book.id] || []).some((item) => !item.done)
        )
          return Response.json(
            { error: 'Resolve open feedback before approving QC.' },
            { status: 400 },
          );
        if (
          book.status === 'Approved' &&
          !qc.every((item) => item.status === 'approved')
        )
          return Response.json(
            { error: 'All three QC levels must pass before final approval.' },
            { status: 400 },
          );
      }
      writes.push(sql`DELETE FROM bookdesk_books`);
      for (const [position, book] of body.books.entries())
        writes.push(
          sql`INSERT INTO bookdesk_books (position, book_id, title, grade, subject, version, status, pdf_url, page_count, annotations, cover_id, uploader, qc) VALUES (${position}, ${book.id}, ${book.title}, ${book.grade}, ${book.subject}, ${book.version}, ${book.status}, ${book.pdf}, ${Math.max(1, Number(book.pageCount) || 1)}, ${JSON.stringify(book.annotations || {})}::jsonb, ${book.coverId || ''}, ${book.uploader || ''}, ${JSON.stringify(getQc(book.qc))}::jsonb)`,
        );
    }
    const previousComments = body.comments
      ? ((await sql`SELECT book_id, id, done FROM bookdesk_comments`) as unknown as Array<{
          book_id: string;
          id: number;
          done: boolean;
        }>)
      : [];
    if (body.comments) {
      writes.push(sql`DELETE FROM bookdesk_comments`);
      for (const [bookId, items] of Object.entries(body.comments))
        for (const comment of items)
          writes.push(
            sql`INSERT INTO bookdesk_comments (book_id, id, page_number, body, display_time, done, pin_x, pin_y) VALUES (${bookId}, ${comment.id}, ${comment.page}, ${comment.text}, ${comment.time}, ${Boolean(comment.done)}, ${comment.pin?.x ?? null}, ${comment.pin?.y ?? null})`,
          );
    }
    await sql.transaction(writes);
    if (body.books) {
      const before = new Map(existing.map((item) => [item.book_id, item]));
      for (const book of body.books) {
        const prior = before.get(book.id);
        if (!prior || prior.pdf_url !== book.pdf)
          await notify(
            'super',
            'pdf_uploaded',
            'PDF uploaded',
            `${book.title} · Grade ${book.grade}`,
            book.id,
          );
        if (prior?.status !== 'Approved' && book.status === 'Approved')
          await notify(
            'super',
            'print_ready',
            'Book is print-ready',
            `${book.title} · Grade ${book.grade}`,
            book.id,
          );
      }
    }
    if (body.comments) {
      const before = new Map(
        previousComments.map((item) => [
          `${item.book_id}:${item.id}`,
          item.done,
        ]),
      );
      for (const [bookId, items] of Object.entries(body.comments))
        for (const comment of items) {
          const prior = before.get(`${bookId}:${comment.id}`);
          if (prior === undefined)
            await notify(
              'super',
              'feedback_added',
              'Feedback added',
              `Page ${comment.page}: ${comment.text.slice(0, 140)}`,
              bookId,
            );
          else if (!prior && comment.done)
            await notify(
              'super',
              'feedback_resolved',
              'Feedback resolved',
              `Page ${comment.page}: ${comment.text.slice(0, 140)}`,
              bookId,
            );
        }
    }
    return Response.json({ ok: true });
  } catch (error) {
    console.error('[api/books] write failed', error);
    await recordOperation(
      'books',
      'database_write_failed',
      String(error),
      'error',
    );
    return Response.json({ error: 'Unable to save books' }, { status: 500 });
  }
}
