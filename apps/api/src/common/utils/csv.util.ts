/**
 * CSV generation for the admin exports (PROJECT_PLAN.md §8.2, §11.6).
 *
 * Written out rather than pulled in as a dependency, because the only tricky
 * part is escaping and that has to be right regardless of the library.
 */

/**
 * Escapes one field.
 *
 * The leading-character guard is the important one: Excel and Sheets evaluate
 * a cell starting with =, +, - or @ as a formula, so a customer whose company
 * name begins with '=' turns an exported quotation into a CSV injection
 * against whoever opens it. Prefixing with a tab neutralises that while still
 * displaying the original text.
 */
export function escapeCsvField(value: unknown): string {
  if (value === null || value === undefined) return '';

  let text = stringify(value);

  if (/^[=+\-@\t\r]/.test(text)) {
    text = `\t${text}`;
  }

  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

/**
 * Renders a cell value.
 *
 * Explicit per type rather than a bare `String()`: an object would otherwise
 * land in the sheet as "[object Object]", and a Date would render in whatever
 * locale the server happens to run in.
 */
function stringify(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value instanceof Date) return value.toISOString();
  return JSON.stringify(value) ?? '';
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [
    headers.map(escapeCsvField).join(','),
    ...rows.map((row) => row.map(escapeCsvField).join(',')),
  ];

  /**
   * CRLF and a UTF-8 BOM: Excel on Windows opens a BOM-less UTF-8 CSV as the
   * system codepage, which mangles any non-ASCII character in a company name
   * or address.
   */
  return `\uFEFF${lines.join('\r\n')}\r\n`;
}

/** `quotations-2026-09-02.csv` */
export function timestampedFilename(prefix: string): string {
  return `${prefix}-${new Date().toISOString().slice(0, 10)}.csv`;
}
