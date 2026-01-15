// Small helper to attempt to fix common mojibake issues where Latin-1 bytes
// were interpreted as UTF-8 or were double-encoded. Returns the original
// value when it cannot confidently improve it.
export function fixMojibake(input?: any): any {
  if (input === null || input === undefined) return input;
  if (typeof input !== 'string') return input;

  // Quick normalization: decode numeric/hex HTML entities if present (eg. &#128522; or &#x1F60A;)
  try {
    const hasEntity = /&#\d+;|&#x[0-9A-Fa-f]+;/.test(input);
    if (hasEntity) {
      input = input.replace(/&#(\d+);/g, (_m, dec) => String.fromCodePoint(Number(dec))).replace(/&#x([0-9A-Fa-f]+);/g, (_m, hex) => String.fromCodePoint(parseInt(hex, 16)));
    }
  } catch {}

  // Fast path: if it looks fine, return early
  if (!/[ÂÃÃ¡Ã©ÃíÃ³ÃºÃ±Ã¿Ã–Ã–]/.test(input) && !/Ã/.test(input)) {
    return input;
  }

  try {
    // Try classic latin1 -> utf8 fix via decodeURIComponent(escape(...))
    // eslint-disable-next-line no-undef
    const decoded = decodeURIComponent(escape(input));
    if (decoded && decoded !== input) return decoded;
  } catch (e) {
    // ignore
  }

  // As a fallback, attempt to replace common mojibake sequences
  try {
    return input
      .replace(/Ã¡/g, 'á')
      .replace(/Ã©/g, 'é')
      .replace(/Ã­/g, 'í')
      .replace(/Ã³/g, 'ó')
      .replace(/Ãº/g, 'ú')
      .replace(/Ã±/g, 'ñ')
      .replace(/Ã‰/g, 'É')
      .replace(/â/g, '–')
      .replace(/â/g, "’")
      .replace(/â¦/g, '…')
      .replace(/Â¿/g, '¿')
      .replace(/Â¡/g, '¡');
  } catch (e) {
    return input;
  }
}

export function sanitizeObjectStrings<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'string') return fixMojibake(obj) as unknown as T;
  if (Array.isArray(obj)) return obj.map((v) => sanitizeObjectStrings(v)) as unknown as T;
  if (typeof obj === 'object') {
    const out: any = {};
    for (const [k, v] of Object.entries(obj as any)) {
      out[k] = sanitizeObjectStrings(v);
    }
    return out;
  }
  return obj;
}

// Return the first grapheme (visual character) from a string — safe for emoji.
export function takeFirstGrapheme(s?: string) {
  const trimmed = (s ?? '').trim();
  if (!trimmed) return '';
  return Array.from(trimmed)[0] ?? trimmed;
}

// Emoji font hint for React Native components — export so components can reuse.
import { Platform } from 'react-native';
export const emojiFontFix = Platform.select({
  ios: { fontFamily: 'System' },
  android: { fontFamily: 'sans-serif' },
  default: {},
});
