export const QC_LEVELS = ['Content review', 'Design review', 'Final approval'] as const;
export type QcReview = { status: 'pending' | 'approved' | 'changes-needed'; reviewer: string; note: string; reviewedAt: string };
export const emptyQc = (): QcReview[] => QC_LEVELS.map(() => ({ status: 'pending', reviewer: '', note: '', reviewedAt: '' }));
export function getQc(qc?: QcReview[]): QcReview[] { return qc?.length === 3 ? qc : emptyQc(); }
export function reviewQc(qc: QcReview[] | undefined, level: number, approved: boolean, reviewer: string, note: string): QcReview[] {
  const next = getQc(qc).map(item => ({ ...item }));
  if (level < 0 || level > 2 || next.slice(0, level).some(item => item.status !== 'approved')) throw new Error('Complete the earlier QC levels first.');
  if (!reviewer.trim()) throw new Error('Enter the reviewer name.');
  if (!approved && !note.trim()) throw new Error('Describe the changes needed.');
  next[level] = { status: approved ? 'approved' : 'changes-needed', reviewer: reviewer.trim(), note: note.trim(), reviewedAt: new Date().toISOString() };
  for (let index = level + 1; index < 3; index++) next[index] = emptyQc()[index];
  return next;
}
export function validQc(qc: QcReview[]): boolean {
  return Array.isArray(qc) && qc.length === 3 && qc.every((item, index) => item
    && ['pending', 'approved', 'changes-needed'].includes(item.status)
    && typeof item.reviewer === 'string' && typeof item.note === 'string'
    && (item.status === 'pending' || (Boolean(item.reviewer.trim()) && Number.isFinite(Date.parse(item.reviewedAt))
      && qc.slice(0, index).every(previous => previous.status === 'approved')))
    && (item.status !== 'changes-needed' || Boolean(item.note.trim())));
}
