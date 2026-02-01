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

export function latin1BytesToUtf8(str: string): string {
  const bytes = new Uint8Array(Array.from(str, (c) => c.charCodeAt(0)));

  const TextDecoderCtor = (globalThis as any)?.TextDecoder;
  if (typeof TextDecoderCtor !== 'function') return str;

  try {
    const dec = new TextDecoderCtor('utf-8', { fatal: false });
    const out = dec.decode(bytes);
    return out;
  } catch {
    return str;
  }
}

export function looksLikeMojibake(s: string): boolean {
  return /ð|Ã|â|Â|�/.test(s);
}

export function hasEmojiLike(s: string): boolean {
  try {
    // eslint-disable-next-line no-misleading-character-class
    return /\p{Extended_Pictographic}/u.test(s);
  } catch {
    // fallback viejo (menos preciso)
    return /[\u2190-\u21FF\u2600-\u27BF\uD83C-\uDBFF\uDC00-\uDFFF]/.test(s);
  }
}

export function normalizeEmojiStrict(raw: any, fallback = '📌'): string {
  const original = typeof raw === 'string' ? raw : '';
  const s = original.trim();
  if (!s) return fallback;

  // 1) intento con fixMojibake existente
  let a = s;
  try {
    a = fixMojibake(s);
  } catch {
    a = s;
  }

  // 2) si aún huele a mojibake, intenta Latin1->UTF8 sobre original y sobre a
  let b = a;
  if (looksLikeMojibake(a) || looksLikeMojibake(s)) {
    const b1 = latin1BytesToUtf8(s);
    const b2 = latin1BytesToUtf8(a);

    const candidates = [a, b1, b2].filter((v) => typeof v === 'string' && v.length > 0) as string[];
    candidates.sort((x, y) => {
      const score = (v: string) => {
        let sc = 0;
        if (hasEmojiLike(v)) sc += 5;
        if (!looksLikeMojibake(v)) sc += 3;
        if (/[^\u0000-\u007F]/.test(v)) sc += 1;
        return sc;
      };
      return score(y) - score(x);
    });

    b = candidates[0] || a;
  }

  // 3) primer grapheme
  let first = '';
  try {
    first = takeFirstGrapheme(b);
  } catch {
    first = Array.from(b)[0] ?? b;
  }

  const out = (first || '').trim();

  // 4) si sigue siendo basura, JAMÁS la muestres
  if (!out) return fallback;
  if (looksLikeMojibake(out)) return fallback;
  if (out === '�') return fallback;

  return out;
}

// Emoji font hint for React Native components — export so components can reuse.
import { Platform } from 'react-native';
export const emojiFontFix = Platform.select({
  ios: { fontFamily: 'System' },
  android: { fontFamily: 'sans-serif' },
  default: {},
});
