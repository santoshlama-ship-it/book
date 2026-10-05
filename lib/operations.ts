import { getDatabase } from '@/lib/db';

export async function recordOperation(
  area: string,
  eventType: string,
  message: string,
  level: 'info' | 'warning' | 'error' = 'info',
  durationMs?: number,
) {
  try {
    const sql = getDatabase();
    await sql`INSERT INTO coverdesk_ops_events (area, level, event_type, message, duration_ms) VALUES (${area}, ${level}, ${eventType}, ${message.slice(0, 1000)}, ${durationMs ?? null})`;
  } catch (error) {
    console.error('[operations] unable to record event', error);
  }
}

export async function notify(
  audience: 'covers' | 'books' | 'super',
  eventType: string,
  title: string,
  body = '',
  bookId?: string,
) {
  try {
    const sql = getDatabase();
    await sql`INSERT INTO coverdesk_notifications (audience, event_type, title, body, book_id) VALUES (${audience}, ${eventType}, ${title}, ${body}, ${bookId || null})`;
  } catch (error) {
    console.error('[notifications] unable to create notification', error);
  }
}
