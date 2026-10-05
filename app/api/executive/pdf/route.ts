import { hasAccess } from '@/lib/access';
import { ensureDatabaseTables, getDatabase } from '@/lib/db';
import { parsePdfLink } from '@/lib/pdf-link';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  if (!(await hasAccess('super')))
    return new Response('Executive access required', { status: 401 });
  const bookId = new URL(request.url).searchParams.get('book');
  if (!bookId) return new Response('Book is required', { status: 400 });
  try {
    await ensureDatabaseTables();
    const sql = getDatabase();
    const rows =
      (await sql`SELECT pdf_url FROM bookdesk_books WHERE book_id = ${bookId} LIMIT 1`) as unknown as Array<{
        pdf_url: string;
      }>;
    if (!rows[0]?.pdf_url)
      return new Response('Final PDF is not available', { status: 404 });
    const parsed = parsePdfLink(rows[0].pdf_url);
    let source = parsed.url;
    if (parsed.driveId) {
      const params = new URLSearchParams({
        export: 'download',
        id: parsed.driveId,
      });
      if (parsed.resourceKey) params.set('resourcekey', parsed.resourceKey);
      source = `https://drive.google.com/uc?${params}`;
    }
    const response = await fetch(source, {
      signal: AbortSignal.timeout(30000),
      cache: 'no-store',
    });
    if (!response.ok)
      return new Response('The final PDF could not be opened', { status: 422 });
    const data = await response.arrayBuffer();
    if (!new TextDecoder().decode(data.slice(0, 1024)).includes('%PDF-'))
      return new Response('The saved file is not a readable PDF', {
        status: 422,
      });
    return new Response(data, {
      headers: {
        'Content-Type': 'application/pdf',
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    console.error('[api/executive/pdf] failed', error);
    return new Response('Unable to load the final PDF', { status: 502 });
  }
}
