const BUSINESS_TIME_ZONE = "Asia/Karachi";

export function getBusinessDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: string) => parts.find((item) => item.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function getPreviousBusinessDateKey(date = new Date()) {
  const previous = toSheetDate(getBusinessDateKey(date));
  previous.setUTCDate(previous.getUTCDate() - 1);
  if (previous.getUTCDay() === 0) previous.setUTCDate(previous.getUTCDate() - 1);
  return previous.toISOString().slice(0, 10);
}

export function isTodayOrPreviousStockDay(dateKey: string, date = new Date()) {
  return dateKey === getBusinessDateKey(date) || dateKey === getPreviousBusinessDateKey(date);
}

export function toSheetDate(dateKey: string) {
  return new Date(`${dateKey}T00:00:00.000Z`);
}

export function formatSheetDate(
  date: Date,
  options: Intl.DateTimeFormatOptions = {},
) {
  return new Intl.DateTimeFormat("en-PK", {
    timeZone: BUSINESS_TIME_ZONE,
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...options,
  }).format(date);
}
