/** Dates typed by staff are day-month-year; database dates remain UTC calendar days. */
export function parseEntryDate(value: string): Date | null {
  const input = value.trim();
  const typed = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})$/.exec(input);
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input);
  if (!typed && !iso) return null;

  const day = Number(typed?.[1] ?? iso?.[3]);
  const month = Number(typed?.[2] ?? iso?.[2]);
  const yearText = typed?.[3] ?? iso?.[1] ?? "";
  const year = yearText.length === 2 ? 2000 + Number(yearText) : Number(yearText);
  if (year < 1900 || year > 2099 || month < 1 || month > 12 || day < 1 || day > 31) return null;

  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() + 1 === month && date.getUTCDate() === day ? date : null;
}

export function formatEntryDate(date: Date): string {
  const year = date.getUTCFullYear();
  return `${date.getUTCDate()}-${date.getUTCMonth() + 1}-${year >= 2000 ? String(year).slice(-2) : year}`;
}
