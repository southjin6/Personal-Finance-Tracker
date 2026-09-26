// Excel, Sheets and LibreOffice evaluate a cell whose first non-whitespace
// character is one of these, so they strip leading whitespace before parsing:
// " =1+1", "\t=1+1" and "\n=1+1" are all formulas, not just "=1+1". Quoting
// does not stop it; an apostrophe prefix is what makes the cell literal.
//
// Whitespace followed by a formula lead, rather than "begins with whitespace or
// with a lead": a value like "  hello" is not a formula, and prefixing it would
// corrupt the exported text for every reader that is not a spreadsheet.
const FORMULA_LEAD = /^\s*[=+\-@]/;

export const CSV_BOM = "\uFEFF";

// Order matters: guard the formula first, then quote the result, because the
// apostrophe may itself introduce a character that needs quoting.
export function escapeCsvField(value: string): string {
  const guarded = FORMULA_LEAD.test(value) ? `'${value}` : value;

  // RFC 4180 requires quotes around the delimiter, a quote or a line break
  // (notes legitimately contain newlines). Leading and trailing whitespace is
  // quoted too, because Excel silently drops it otherwise.
  const needsQuotes = /[",\r\n]/.test(guarded) || guarded !== guarded.trim();
  if (!needsQuotes) return guarded;

  return `"${guarded.replace(/"/g, '""')}"`;
}

// CRLF per RFC 4180. The BOM is what makes Excel read the file as UTF-8 rather
// than the system codepage, without which "₱" and accented category names come
// out as mojibake.
export function toCsv(rows: string[][]): string {
  const lines = rows.map((row) => row.map(escapeCsvField).join(","));
  return `${CSV_BOM}${lines.join("\r\n")}\r\n`;
}
