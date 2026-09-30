import { hasAccess } from '@/lib/access';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  if (!await hasAccess('books')) return new Response('Book access required', { status: 401 });
  const id = new URL(request.url).searchParams.get('id');
  if (!id || !/^[\w-]+$/.test(id)) return new Response('Invalid Drive file ID', { status: 400 });
  const resourceKey = new URL(request.url).searchParams.get('resourcekey');
  if (resourceKey && !/^[\w-]+$/.test(resourceKey)) return new Response('Invalid resource key', { status: 400 });
  try {
    const params = new URLSearchParams({ export: 'download', id });
    if (resourceKey) params.set('resourcekey', resourceKey);
    const response = await fetch(`https://drive.google.com/uc?${params}`, {
      signal: AbortSignal.timeout(30000), cache: 'no-store',
    });
    if (!response.ok || !response.body) {
      return new Response('Google Drive refused the download. Open the original file and check that viewers can download it.', { status: 422 });
    }
    // Drive may serve PDFs as application/octet-stream. Inspect the file bytes
    // rather than rejecting valid PDFs based on Google's Content-Type header.
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let length = 0;
    while (length < 1024) {
      const { value, done } = await reader.read();
      if (done) break;
      chunks.push(value);
      length += value.length;
    }
    const prefix = new Uint8Array(Math.min(length, 1024));
    let offset = 0;
    for (const chunk of chunks) {
      const part = chunk.subarray(0, prefix.length - offset);
      prefix.set(part, offset);
      offset += part.length;
      if (offset === prefix.length) break;
    }
    if (!new TextDecoder().decode(prefix).includes('%PDF-')) {
      await reader.cancel();
      return new Response('Google Drive returned a web page instead of the PDF. Open the original file to check access or download confirmation, or choose the downloaded PDF below.', { status: 422 });
    }
    const body = new ReadableStream<Uint8Array>({
      start(controller) { for (const chunk of chunks) controller.enqueue(chunk); },
      async pull(controller) {
        try {
          const { value, done } = await reader.read();
          if (done) controller.close();
          else controller.enqueue(value);
        } catch (error) { controller.error(error); }
      },
      cancel(reason) { return reader.cancel(reason); },
    });
    return new Response(body, { headers: {
      'Content-Type': 'application/pdf', 'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    } });
  } catch {
    return new Response('Unable to download the Drive PDF.', { status: 502 });
  }
}
