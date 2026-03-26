/**
 * scanMetadata.ts
 *
 * Builds the rich metadata payload that accompanies ticket images.
 * SCANN_TICKET.md §5 — "Sube más que la imagen".
 *
 * Fields:
 *   - imagen original / recortada
 *   - ancho/alto
 *   - orientación
 *   - plataforma (ios / android)
 *   - si vino de scanner nativo o cámara libre
 *   - versión de app
 *   - si hubo multi-shot
 *   - score de calidad del front
 */

import { Platform } from 'react-native';
import Constants from 'expo-constants';
import type { QualityCheck } from './imageQuality';

// ─── Types ──────────────────────────────────────────────────

export type ScanSource = 'document_scanner' | 'camera' | 'gallery';

export interface ScanImageCapture {
  base64: string;
  mimeType: string;
  width: number;
  height: number;
  /** 'global' = full ticket, 'header' | 'body' | 'footer' = multi-shot section */
  section: 'global' | 'header' | 'body' | 'footer';
}

export interface ScanMetadata {
  /** Device platform */
  plataforma: 'ios' | 'android' | 'web';
  /** How the image was captured */
  fuenteCaptura: ScanSource;
  /** App version string */
  appVersion: string;
  /** Image dimensions (main capture) */
  ancho: number;
  alto: number;
  /** Portrait / landscape / square */
  orientacion: 'portrait' | 'landscape' | 'square';
  /** Whether multi-shot was used */
  multiShot: boolean;
  /** Number of captures taken */
  capturas: number;
  /** Quality score from front-end validation (0–1) */
  scoreCalidad: number;
  /** Quality issues detected */
  problemas: string[];
  /** Local OCR preview text (if available) */
  ocrPreviewTexto?: string;
  /** Whether document scanner detected edges / bounding box */
  bordesDetectados: boolean;
}

// ─── Builder ────────────────────────────────────────────────

export function buildScanMetadata(opts: {
  source: ScanSource;
  quality: QualityCheck;
  captures: ScanImageCapture[];
  ocrPreview?: string;
  edgesDetected?: boolean;
}): ScanMetadata {
  const mainCapture = opts.captures[0];

  const orientation: ScanMetadata['orientacion'] =
    mainCapture.width === mainCapture.height
      ? 'square'
      : mainCapture.width > mainCapture.height
        ? 'landscape'
        : 'portrait';

  return {
    plataforma: Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web',
    fuenteCaptura: opts.source,
    appVersion: Constants.expoConfig?.version ?? '1.0.0',
    ancho: mainCapture.width,
    alto: mainCapture.height,
    orientacion: orientation,
    multiShot: opts.captures.length > 1,
    capturas: opts.captures.length,
    scoreCalidad: opts.quality.score,
    problemas: opts.quality.issues,
    ocrPreviewTexto: opts.ocrPreview,
    bordesDetectados: opts.edgesDetected ?? opts.source === 'document_scanner',
  };
}
