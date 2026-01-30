// Heuristic text encoding fixer for common mojibake (Latin1-decoded UTF-8)
export function fixEncoding(input?: string | null): string {
  if (!input) return input || '';
  // Only attempt repair when typical mojibake markers are present
  // Common mojibake sequences include characters like 'Ã', 'Â' or 'â'
  if (!/[ÃÂâ]/.test(input)) return input;
  try {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore escape is deprecated but available at runtime in RN
    return decodeURIComponent(escape(input));
  } catch (e) {
    try {
      const bytes = new Uint8Array(Array.from(input).map((c) => c.charCodeAt(0)));
      // @ts-ignore TextDecoder may not exist in some RN runtimes
      if (typeof TextDecoder !== 'undefined') {
        // @ts-ignore
        return new TextDecoder('utf-8').decode(bytes);
      }
    } catch (e2) {
      // ignore
    }
  }
  return input;
}

export default fixEncoding;
