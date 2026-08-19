const MONTHS = [
  "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
  "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
];

/** Parse "YYYY-MM-DD" without timezone drift. */
function parts(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return { y, m, d };
}

/** "2025-11-20" → "20 NOV 2025" */
export function formatFull(iso: string): string {
  const { y, m, d } = parts(iso);
  return `${String(d).padStart(2, "0")} ${MONTHS[m - 1]} ${y}`;
}

/** "2025-11-20" → "NOV 2025" */
export function formatMonth(iso: string): string {
  const { y, m } = parts(iso);
  return `${MONTHS[m - 1]} ${y}`;
}

/** "2025-11-20" → "2025" */
export function formatYear(iso: string): string {
  return String(parts(iso).y);
}

/** Today as "YYYY-MM-DD" in local time — for new entries from 056 onward. */
export function today(): string {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
}
