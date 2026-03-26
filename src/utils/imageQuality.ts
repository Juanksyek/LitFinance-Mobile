/**
 * imageQuality.ts
 *
 * Pre-upload image quality validation for ticket scanning.
 * Checks resolution, aspect ratio, file size, and provides
 * a quality score the backend can use for confidence weighting.
 *
 * Recommendations from SCANN_TICKET.md §2:
 *   - ticket completo visible
 *   - bordes detectados
 *   - sin corte en top/bottom
 *   - sin brillo fuerte
 *   - sin blur fuerte
 *   - resolución mínima aceptable
 */

import { Image as RNImage, Platform } from 'react-native';

// ─── Thresholds ─────────────────────────────────────────────
const MIN_WIDTH = 600;
const MIN_HEIGHT = 800;
const MAX_ASPECT_RATIO = 8; // tickets taller than 8:1 likely need multi-shot
const MIN_ASPECT_RATIO = 0.3; // too wide = probably landscape / cropped wrong
const LONG_TICKET_RATIO = 3.5; // aspect ratio above which we suggest multi-shot
const MIN_BASE64_KB = 15; // less than 15 KB = probably blank or corrupt
const MAX_BASE64_MB = 12; // more than 12 MB = too heavy for upload
// Blur heuristic: a sharp JPEG (quality ~0.82) produces roughly 30–80 KB per
// megapixel. Very low bytes-per-pixel ratios indicate blur or heavy compression.
const BLUR_KB_PER_MP_THRESHOLD = 25; // below this → likely blurry

// ─── Types ──────────────────────────────────────────────────

export type QualityIssue =
  | 'resolution_too_low'
  | 'image_too_small'
  | 'image_too_large'
  | 'aspect_ratio_invalid'
  | 'long_ticket_detected'
  | 'possibly_blank'
  | 'possibly_blurry'
  | 'low_contrast';

export interface QualityCheck {
  passed: boolean;
  score: number; // 0.0 – 1.0
  issues: QualityIssue[];
  suggestions: string[];
  isLongTicket: boolean;
  width: number;
  height: number;
  fileSizeKB: number;
}

// ─── Get image dimensions from URI ──────────────────────────

export function getImageDimensions(uri: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    RNImage.getSize(
      uri,
      (width, height) => resolve({ width, height }),
      (err) => reject(err),
    );
  });
}

// ─── Main quality check ─────────────────────────────────────

export async function checkImageQuality(
  uri: string,
  base64Length: number,
): Promise<QualityCheck> {
  const issues: QualityIssue[] = [];
  const suggestions: string[] = [];
  let score = 1.0;

  // 1. Get dimensions
  let width = 0;
  let height = 0;
  try {
    const dims = await getImageDimensions(uri);
    width = dims.width;
    height = dims.height;
  } catch {
    // Can't determine dimensions — penalise but don't block
    score -= 0.15;
  }

  // 2. Resolution check
  if (width > 0 && height > 0) {
    if (width < MIN_WIDTH || height < MIN_HEIGHT) {
      issues.push('resolution_too_low');
      suggestions.push('La resolución es muy baja. Intenta acercar la cámara o usar mejor iluminación.');
      score -= 0.3;
    }
  }

  // 3. Aspect ratio check
  if (width > 0 && height > 0) {
    const ratio = Math.max(width, height) / Math.min(width, height);

    if (ratio > MAX_ASPECT_RATIO) {
      issues.push('aspect_ratio_invalid');
      suggestions.push('La imagen es demasiado alargada. Asegúrate de capturar el ticket completo.');
      score -= 0.2;
    } else if (ratio < MIN_ASPECT_RATIO) {
      issues.push('aspect_ratio_invalid');
      suggestions.push('La imagen parece estar en formato horizontal. Rota la cámara para modo vertical.');
      score -= 0.2;
    }
  }

  // 4. Long ticket detection
  const isLongTicket =
    width > 0 && height > 0 && height / width > LONG_TICKET_RATIO;

  if (isLongTicket) {
    issues.push('long_ticket_detected');
    suggestions.push('Ticket largo detectado. Se tomarán fotos adicionales de detalle.');
    score -= 0.05; // minor penalty — handled by multi-shot
  }

  // 5. File size checks
  const fileSizeKB = Math.round(base64Length / 1024);
  const fileSizeMB = fileSizeKB / 1024;

  if (fileSizeKB < MIN_BASE64_KB) {
    issues.push('possibly_blank');
    suggestions.push('La imagen parece estar vacía o corrupta. Vuelve a capturar.');
    score -= 0.5;
  }

  if (fileSizeMB > MAX_BASE64_MB) {
    issues.push('image_too_large');
    suggestions.push('La imagen es demasiado pesada. Se comprimirá automáticamente.');
    score -= 0.1;
  }

  if (fileSizeKB < 50 && width > 0 && height > 0 && width * height > 500_000) {
    // Large dimensions but tiny file — suspicious over-compression
    issues.push('image_too_small');
    suggestions.push('La imagen parece estar muy comprimida. Intenta capturar con mejor calidad.');
    score -= 0.2;
  }

  // 6. Blur heuristic
  // Sharp in-focus images produce higher JPEG file sizes at the same quality setting.
  // A very low KB-per-megapixel ratio for large images is a reliable blur indicator.
  if (width > 0 && height > 0 && fileSizeKB >= MIN_BASE64_KB) {
    const megapixels = (width * height) / 1_000_000;
    if (megapixels >= 0.5) {
      const kbPerMp = fileSizeKB / megapixels;
      if (kbPerMp < BLUR_KB_PER_MP_THRESHOLD) {
        issues.push('possibly_blurry');
        suggestions.push('La imagen puede estar desenfocada. Mantén el teléfono firme y bien iluminado.');
        score -= 0.2;
      }
    }
  }

  // 7. Low contrast / brightness heuristic
  // Very small files relative to dimensions (below the blur threshold AND
  // non-zero) can also indicate a very dark or washed-out image.
  if (
    width > 0 && height > 0 &&
    fileSizeKB >= MIN_BASE64_KB &&
    fileSizeKB < 20 &&
    (width * height) / 1_000_000 >= 1
  ) {
    issues.push('low_contrast');
    suggestions.push('El ticket puede estar muy oscuro o muy brillante. Ajusta la iluminación.');
    score -= 0.15;
  }

  // Clamp score
  score = Math.max(0, Math.min(1, score));

  const passed = score >= 0.5 && !issues.includes('possibly_blank');

  return {
    passed,
    score: parseFloat(score.toFixed(2)),
    issues,
    suggestions,
    isLongTicket,
    width,
    height,
    fileSizeKB,
  };
}

// ─── Human-readable quality label ───────────────────────────

export function qualityLabel(score: number): { text: string; color: string } {
  if (score >= 0.85) return { text: 'Excelente', color: '#10B981' };
  if (score >= 0.65) return { text: 'Buena', color: '#3B82F6' };
  if (score >= 0.5) return { text: 'Aceptable', color: '#F59E0B' };
  return { text: 'Baja calidad', color: '#EF4444' };
}
