export function formatCommentTime(value: string) {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime()))
    return value || 'Time unavailable';

  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}
