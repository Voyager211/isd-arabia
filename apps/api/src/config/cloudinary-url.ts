/**
 * Expands `CLOUDINARY_URL` into the three variables the app validates.
 *
 * The Cloudinary console gives you a single string:
 *
 *     CLOUDINARY_URL=cloudinary://<api_key>:<api_secret>@<cloud_name>
 *
 * and that is what anyone setting this up will paste. Requiring them to split
 * it by hand is a step that adds nothing and gets it wrong — the secret can
 * contain characters that look like delimiters.
 *
 * Explicitly-set variables always win, so a deployment can override one part
 * without abandoning the URL form.
 */
export function expandCloudinaryUrl(raw: Record<string, unknown>): Record<string, unknown> {
  const url = typeof raw.CLOUDINARY_URL === 'string' ? raw.CLOUDINARY_URL.trim() : '';
  if (!url) return raw;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    // Left for the schema to reject with the rest of the environment, rather
    // than throwing a different error from a different place.
    return raw;
  }

  if (parsed.protocol !== 'cloudinary:') return raw;

  const expanded = { ...raw };

  // decodeURIComponent because a secret containing reserved characters is
  // percent-encoded in the URL form.
  const apiKey = decodeURIComponent(parsed.username);
  const apiSecret = decodeURIComponent(parsed.password);
  const cloudName = parsed.hostname;

  if (!expanded.CLOUDINARY_API_KEY && apiKey) expanded.CLOUDINARY_API_KEY = apiKey;
  if (!expanded.CLOUDINARY_API_SECRET && apiSecret) expanded.CLOUDINARY_API_SECRET = apiSecret;
  if (!expanded.CLOUDINARY_CLOUD_NAME && cloudName) expanded.CLOUDINARY_CLOUD_NAME = cloudName;

  return expanded;
}
