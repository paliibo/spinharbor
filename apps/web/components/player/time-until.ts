/** Human-readable countdown for a future ISO timestamp ("in 3h", "in 2d"); past dates return "now". */
export function timeUntil(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return 'now';
  const m = Math.ceil(diff / 60_000);
  if (m < 60) return `in ${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `in ${h}h`;
  const d = Math.round(h / 24);
  return `in ${d}d`;
}
