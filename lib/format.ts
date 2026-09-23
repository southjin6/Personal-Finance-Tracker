const peso = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
});

export function formatPHP(amount: number) {
  return peso.format(amount);
}

export function formatDate(isoDate: string) {
  // occurred_on is a plain YYYY-MM-DD date with no timezone. Build the Date
  // from parts so it isn't shifted by a UTC conversion.
  const [year, month, day] = isoDate.split("-").map(Number);

  const date = new Date(year, month - 1, day);
  // The constructor maps years 0-99 to 1900+year, so assign the real one back
  // (otherwise 0001-01-01 renders as 1901).
  date.setFullYear(year);

  return date.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function todayISO() {
  // Local calendar date, not the UTC one, so the default isn't off by a day.
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}
