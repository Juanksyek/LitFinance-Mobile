/**
 * localTicketOcr.ts
 *
 * On-device OCR using @react-native-ml-kit/text-recognition (ML Kit Text Recognition v2).
 * Falls back to cloud OCR (visionOcrService) if the native module is not linked.
 *
 * ML Kit returns: text (full string), blocks (array of TextBlock), each block
 * has lines (array of TextLine), each line has text.
 *
 * What callers get:
 *   - rawText   → full OCR string, line-separated
 *   - blocks    → structured blocks/lines matching ML Kit's response shape
 *   - score     → 0–1 confidence estimate based on text density
 */

// ─── Types ───────────────────────────────────────────────────

export interface LocalOcrLine {
  text: string;
}

export interface LocalOcrBlock {
  text: string;
  lines: LocalOcrLine[];
}

export interface LocalOcrResult {
  rawText: string;
  blocks: LocalOcrBlock[];
  /** 0–1 confidence estimate — used as hint by backend */
  score: number;
}

// ─── ML Kit native module (optional) ─────────────────────────

// Loaded lazily via try/catch so the app does not crash if the native module
// is not present (e.g. Expo Go without a custom dev build).
let MlKit: { recognize: (imagePath: string) => Promise<any> } | null = null;
try {
  // @react-native-ml-kit/text-recognition default export is the TextRecognition instance
  MlKit = require('@react-native-ml-kit/text-recognition').default;
} catch {
  // Native module not linked — will fall back to cloud OCR
}

/** Returns true when ML Kit native module is available on-device. */
export function isLocalOcrAvailable(): boolean {
  return MlKit !== null;
}

// ─── Score heuristic ─────────────────────────────────────────

function estimateScore(rawText: string, blocks: LocalOcrBlock[]): number {
  const len = rawText.trim().length;
  if (len === 0) return 0;
  if (len < 30) return 0.3;
  // More blocks + longer text = higher confidence
  const blockBonus = Math.min(0.2, blocks.length * 0.02);
  return Math.min(1, 0.55 + blockBonus + (len > 200 ? 0.1 : 0));
}

// ─── Main function ────────────────────────────────────────────

/**
 * Runs on-device OCR on a local image path (file:// URI or plain path).
 * If ML Kit is not available, falls back to the cloud OCR provider configured
 * in visionOcrService (Google Vision or OCR.space).
 *
 * @param imagePath  Local file path / file:// URI of the captured image.
 * @param base64     Optional base64 string used only for cloud fallback.
 */
export async function runLocalTicketOcr(
  imagePath: string,
  base64?: string,
): Promise<LocalOcrResult> {
  if (MlKit) {
    // ── ML Kit on-device path ────────────────────────────────
    const result = await MlKit.recognize(imagePath);

    const rawText: string = result?.text ?? '';
    const blocks: LocalOcrBlock[] = ((result?.blocks as any[]) ?? []).map((b: any) => ({
      text: b.text ?? '',
      lines: ((b.lines as any[]) ?? []).map((l: any) => ({ text: l.text ?? '' })),
    }));

    return {
      rawText,
      blocks,
      score: estimateScore(rawText, blocks),
    };
  }

  // ── Cloud OCR fallback ────────────────────────────────────
  const { extractText } = await import('./visionOcrService');
  const imageData = base64 ?? imagePath; // visionOcrService accepts base64
  const rawText = await extractText(imageData);

  // Synthesize blocks from double-newline paragraph breaks
  const blocks: LocalOcrBlock[] = rawText
    .split(/\n{2,}/)
    .filter(Boolean)
    .map((chunk) => ({
      text: chunk,
      lines: chunk
        .split('\n')
        .filter(Boolean)
        .map((l) => ({ text: l })),
    }));

  return {
    rawText,
    blocks,
    score: estimateScore(rawText, blocks),
  };
}
