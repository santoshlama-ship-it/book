type Approval = { designer?: string; client: string; date: string };

export type SyncedCover = {
  id?: string;
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

export type SyncedComment = {
  id: number;
  name: string;
  text: string;
  time: string;
  done?: boolean;
  pin?: { x: number; y: number };
};

export type SyncedState = {
  designs: SyncedCover[];
  comments: Record<string, SyncedComment[]>;
};

const bridgeUrl = () => process.env.GOOGLE_SHEETS_WEB_APP_URL?.trim();
const bridgeSecret = () => process.env.GOOGLE_SHEETS_SYNC_SECRET?.trim();

export function isGoogleSheetSyncConfigured() {
  return Boolean(bridgeUrl() && bridgeSecret());
}

export async function readGoogleSheetState(): Promise<SyncedState | null> {
  const url = bridgeUrl();
  const secret = bridgeSecret();
  if (!url || !secret) return null;

  const endpoint = new URL(url);
  endpoint.searchParams.set('secret', secret);
  const response = await fetch(endpoint, { cache: 'no-store', signal: AbortSignal.timeout(12_000) });
  if (!response.ok) throw new Error(`Google Sheets bridge returned ${response.status}`);
  const data = await response.json() as Partial<SyncedState> & { ok?: boolean; error?: string };
  if (data.ok === false) throw new Error(data.error || 'Google Sheets bridge rejected the request');
  if (!Array.isArray(data.designs) || !data.comments || typeof data.comments !== 'object') {
    throw new Error('Google Sheets bridge returned an invalid data shape');
  }
  return { designs: data.designs, comments: data.comments };
}

export async function writeGoogleSheetState(state: SyncedState) {
  const url = bridgeUrl();
  const secret = bridgeSecret();
  if (!url || !secret) return false;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ secret, ...state }),
    cache: 'no-store',
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`Google Sheets bridge returned ${response.status}`);
  const data = await response.json() as { ok?: boolean; error?: string };
  if (!data.ok) throw new Error(data.error || 'Google Sheets bridge could not save the data');
  return true;
}
