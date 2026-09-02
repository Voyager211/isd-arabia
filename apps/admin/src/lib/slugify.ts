/**
 * Client-side slug preview.
 *
 * The server generates the authoritative slug and handles de-duplication; this
 * only fills the field as the admin types so they can see and adjust the URL
 * before saving.
 */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 160);
}
