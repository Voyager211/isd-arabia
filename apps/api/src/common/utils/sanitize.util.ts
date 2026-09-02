import sanitizeHtml from 'sanitize-html';

/**
 * Allowlist for admin-authored rich text (product descriptions, industry
 * content). Applied on the server before persisting — PROJECT_PLAN.md §12.3.
 *
 * Sanitising on write rather than on read means the database only ever holds
 * safe markup, so a future consumer that forgets to sanitise cannot be the
 * hole. Deliberately narrow: TipTap produces exactly this subset.
 */
const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    'p',
    'br',
    'strong',
    'em',
    'u',
    's',
    'blockquote',
    'ul',
    'ol',
    'li',
    'h2',
    'h3',
    'h4',
    'a',
    'table',
    'thead',
    'tbody',
    'tr',
    'th',
    'td',
    'sub',
    'sup',
    'hr',
  ],
  allowedAttributes: {
    a: ['href', 'title', 'target', 'rel'],
    th: ['colspan', 'rowspan'],
    td: ['colspan', 'rowspan'],
  },
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  transformTags: {
    // External links leaving our tab keep the opener isolated.
    a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer' }),
  },
  disallowedTagsMode: 'discard',
};

export function sanitizeRichText(html: string | undefined | null): string {
  if (!html) return '';
  return sanitizeHtml(html, OPTIONS).trim();
}

/** Strips all markup — used for meta descriptions and card fallbacks. */
export function toPlainText(html: string | undefined | null, maxLength?: number): string {
  if (!html) return '';
  const text = sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} })
    .replace(/\s+/g, ' ')
    .trim();
  if (!maxLength || text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1).trimEnd()}\u2026`;
}
