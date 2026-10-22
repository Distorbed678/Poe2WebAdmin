/** The message of the day: the server's limits (`poe_config::check_motd`). */
export const MOTD_MAX = 280;

/** What is wrong with the text, or `null` (the server checks again). */
export function motdProblem(text: string): string | null {
  if ([...text.trim()].length > MOTD_MAX) return `The message is at most ${MOTD_MAX} characters.`;
  // Line breaks are fine; other control characters are not.
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u0009\u000b-\u001f\u007f]/.test(text.replace(/\r\n/g, '\n'))) return 'The message is plain text without control characters.';
  return null;
}
