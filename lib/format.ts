const peso = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
});

const monthLabel = new Intl.DateTimeFormat("en-PH", {
  month: "long",
  year: "numeric",
});

export function formatPHP(amount: number) {
  return peso.format(amount);
}

// Cents in, currency out. The division is display-only, which is the one place
// lib/money.ts allows a float: the formatter rounds it back to two decimals.
export function formatPHPFromCents(cents: number) {
  return peso.format(cents / 100);
}

// "2026-09" -> "September 2026". Built from parts for the same reason formatDate
// is: a string like "2026-09" parsed as a Date would be UTC midnight and could
// shift a day (and a month) in a negative-offset timezone.
export function formatMonthLabel(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);

  const date = new Date(year, monthNumber - 1, 1);
  // The constructor maps years 0-99 to 1900+year; assign the real one back.
  date.setFullYear(year);

  return monthLabel.format(date);
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
