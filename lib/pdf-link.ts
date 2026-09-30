/** Validate and normalize a shared PDF URL before saving or loading it. */
export function parsePdfLink(value: string) {
  let url: URL;
  try { url = new URL(value.trim()); }
  catch { throw new Error('Paste a complete PDF file link starting with https://.'); }
  if (!['https:', 'http:'].includes(url.protocol)) throw new Error('Use an HTTP or HTTPS PDF link.');
  const isDrive = ['drive.google.com', 'www.drive.google.com', 'drive.usercontent.google.com'].includes(url.hostname);
  if (!isDrive) return { url: url.href, driveId: null, resourceKey: null };
  const id = url.pathname.match(/^\/file\/(?:u\/\d+\/)?d\/([\w-]+)(?:\/|$)/)?.[1]
    || (['/open', '/uc', '/download'].includes(url.pathname) ? url.searchParams.get('id') : null);
  if (!id || !/^[\w-]+$/.test(id)) {
    throw new Error('This is a Google Drive folder or search link, not a PDF file link. Open the PDF itself, choose Share → Copy link, and paste that link here.');
  }
  const resourceKey = url.searchParams.get('resourcekey');
  const normalized = new URL(`https://drive.google.com/file/d/${id}/view`);
  if (resourceKey) normalized.searchParams.set('resourcekey', resourceKey);
  return { url: normalized.href, driveId: id, resourceKey };
}
