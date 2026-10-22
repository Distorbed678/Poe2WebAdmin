/** The limits of `POST /admin/server/stop|restart` (poe-web-api `lifecycle`). */
export const MAX_DELAY_SECS = 3600;
export const MAX_MESSAGE_CHARS = 200;

/**
 * The countdown field: a whole number of seconds from 0 to 3600. A number input binds a string
 * until the user types and a number (or null when emptied) afterwards, so all of them are read.
 */
export function parseDelay(value: string | number | null | undefined): number | null {
  const text = String(value ?? '').trim();
  if (!/^\d{1,6}$/.test(text)) return null;
  const n = Number(text);
  return n <= MAX_DELAY_SECS ? n : null;
}
