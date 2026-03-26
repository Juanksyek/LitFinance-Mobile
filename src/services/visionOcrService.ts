/**
 * visionOcrService.ts
 *
 * Multi-provider OCR service + local receipt text parser.
 *
 * Providers (checked in order):
 *   1. Google Cloud Vision API  — GOOGLE_VISION_API_KEY (paid)
 *   2. OCR.space API            — OCR_SPACE_API_KEY     (FREE tier: 25k req/month)
 *
 * If no key is set, extractText() throws and TicketScanScreen
 * falls back to backend-only mode automatically.
 *
 * Getting a FREE OCR.space key:
 *   1. Go to https://ocr.space/ocrapi/freekey
 *   2. Enter your e-mail → key arrives instantly, no card needed
 *   3. Add to .env:  OCR_SPACE_API_KEY=K88...
 */

import Constants from 'expo-constants';
import type { TicketItem, TicketCategoria } from './ticketScanService';

const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, string>;

const VISION_API_KEY: string  = extra.GOOGLE_VISION_API_KEY ?? '';
const OCR_SPACE_KEY: string   = extra.OCR_SPACE_API_KEY ?? '';

const VISION_ENDPOINT    = 'https://vision.googleapis.com/v1/images:annotate';
const OCR_SPACE_ENDPOINT = 'https://api.ocr.space/parse/image';

// ─── Public types ─────────────────────────────────────────────────────────────

export interface ParsedTicketOcr {
  tienda: string;
  fechaCompra: string;
  items: TicketItem[];
  subtotal: number;
  impuestos: number;
  descuentos: number;
  propina: number;
  total: number;
  moneda: string;
  rawText: string;
}

// ─── Provider checks ─────────────────────────────────────────────────────────

/** True if Google Cloud Vision API key is set. */
export function isVisionConfigured(): boolean {
  return Boolean(VISION_API_KEY);
}

/** True if OCR.space API key is set. */
export function isOcrSpaceConfigured(): boolean {
  return Boolean(OCR_SPACE_KEY);
}

/** True if ANY OCR provider is configured. */
export function isAnyOcrConfigured(): boolean {
  return isVisionConfigured() || isOcrSpaceConfigured();
}

/**
 * Sends a base64 image to Google Cloud Vision DOCUMENT_TEXT_DETECTION.
 * Returns the full extracted text with newlines preserved.
 */
export async function extractTextVision(base64Image: string): Promise<string> {
  if (!VISION_API_KEY) throw new Error('GOOGLE_VISION_API_KEY no configurada');

  const payload = {
    requests: [
      {
        image: { content: base64Image },
        features: [{ type: 'DOCUMENT_TEXT_DETECTION', maxResults: 1 }],
        imageContext: { languageHints: ['es', 'en'] },
      },
    ],
  };

  const res = await fetch(`${VISION_ENDPOINT}?key=${VISION_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new Error(`Vision API HTTP ${res.status}: ${err.slice(0, 300)}`);
  }

  const json = await res.json();
  if (json.responses?.[0]?.error) {
    throw new Error(`Vision API: ${json.responses[0].error.message}`);
  }

  const text: string = json.responses?.[0]?.fullTextAnnotation?.text ?? '';
  if (!text.trim()) throw new Error('No se detectó texto en la imagen');
  return text;
}

// ─── OCR.space API (FREE: 25 000 req/month) ──────────────────────────────────

/**
 * Sends a base64 JPEG to OCR.space API and returns the extracted text.
 *
 * Free API key: https://ocr.space/ocrapi/freekey  (no credit card, instant)
 * Limits: 25 000 requests/month, max 1 MB per image, 3 req/second.
 *
 * OCREngine=2 performs best on printed text (receipts, invoices).
 * scale=true helps with small-font receipts.
 */
export async function extractTextOcrSpace(base64Image: string): Promise<string> {
  if (!OCR_SPACE_KEY) throw new Error('OCR_SPACE_API_KEY no configurada');

  // OCR.space requires the data-URI prefix unlike Vision API
  const dataUri = base64Image.startsWith('data:')
    ? base64Image
    : `data:image/jpeg;base64,${base64Image}`;

  const body = new URLSearchParams({
    apikey: OCR_SPACE_KEY,
    base64Image: dataUri,
    language: 'spa',          // Spanish; also detects English automatically
    OCREngine: '2',           // Better for printed/receipt text
    isOverlayRequired: 'false',
    detectOrientation: 'true',
    scale: 'true',
    isTable: 'false',
  });

  const res = await fetch(OCR_SPACE_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new Error(`OCR.space HTTP ${res.status}: ${err.slice(0, 300)}`);
  }

  const json = await res.json();

  if (json.IsErroredOnProcessing) {
    const msg = json.ParsedResults?.[0]?.ErrorMessage
      || json.ErrorMessage?.join?.(' ')
      || 'OCR.space error desconocido';
    throw new Error(`OCR.space: ${msg}`);
  }

  // Concatenate all parsed pages
  const text: string = (json.ParsedResults as any[])
    ?.map((r: any) => r.ParsedText ?? '')
    .join('\n')
    .trim() ?? '';

  if (!text) throw new Error('OCR.space: no se detectó texto en la imagen');
  return text;
}

// ─── Unified extractor ────────────────────────────────────────────────────────

/**
 * Extracts text from a base64 JPEG using whichever OCR provider is configured.
 * Priority: Google Cloud Vision → OCR.space
 * Throws if neither key is set.
 */
export async function extractText(base64Image: string): Promise<string> {
  if (VISION_API_KEY) {
    return extractTextVision(base64Image);
  }
  if (OCR_SPACE_KEY) {
    return extractTextOcrSpace(base64Image);
  }
  throw new Error('No hay proveedor OCR configurado (GOOGLE_VISION_API_KEY o OCR_SPACE_API_KEY)');
}

// ─── Price utilities ──────────────────────────────────────────────────────────

// ─── Price regex ─────────────────────────────────────────────────────────────
// Handles ALL common Mexican/Latin-American receipt price formats:
//   • $18          → dollar sign, no decimals
//   • $18.50       → dollar sign + dot decimal
//   • $18,50       → dollar sign + comma decimal
//   • $1,234.56    → dollar sign + thousands comma + dot decimal
//   • 18.50        → dot decimal without $ (2 places)
//   • 18,50        → comma decimal without $ (2 places)
//   • 1,234.56     → thousands + dot decimal
//   • 1.234,56     → European thousands + comma decimal
// Does NOT match bare integers (18, 150) to avoid confusing quantities with prices.
const PRICE_RE_G = /(\.\d{2}(?!\d)|(\$\s*\d{1,3}(?:,\d{3})*(?:[.,]\d{1,2})?(?!\d))|\b(\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?)\b|\b(\d{1,3}(?:\.\d{3})+,\d{2})\b|\b(\d+\.\d{2})\b|\b(\d+,\d{2})\b)/g;
const PRICE_RE_S  = /(\$\s*\d{1,3}(?:,\d{3})*(?:[.,]\d{1,2})?(?!\d))|\b(\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?)\b|\b(\d{1,3}(?:\.\d{3})+,\d{2})\b|\b(\d+\.\d{2})\b|\b(\d+,\d{2})\b/;

function parseMoney(raw: string): number {
  // Strip leading $ and whitespace
  const cleaned = raw.replace(/^\$\s*/, '').replace(/\s/g, '');
  const dotIdx   = cleaned.lastIndexOf('.');
  const commaIdx = cleaned.lastIndexOf(',');
  if (dotIdx > commaIdx) {
    // "1,234.56" or "18.50" → dot is decimal
    return parseFloat(cleaned.replace(/,/g, ''));
  } else if (commaIdx > dotIdx) {
    // "1.234,56" or "18,50" → comma is decimal
    return parseFloat(cleaned.replace(/\./g, '').replace(',', '.'));
  }
  // No separator at all (e.g. "18" from "$18")
  return parseFloat(cleaned);
}

function allPricesInLine(line: string): number[] {
  const result: number[] = [];
  const re = new RegExp(PRICE_RE_G.source, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(line)) !== null) {
    // m[0] = full match (may include $)
    const raw = m[0].trim();
    if (!raw || raw === '.') continue;
    const v = parseMoney(raw);
    if (!isNaN(v) && v > 0 && v < 1_000_000) result.push(v);
  }
  return result;
}

// ─── Keyword patterns ─────────────────────────────────────────────────────────

// Full totals keywords — used in extractAmounts and findTotalsSectionStart
const TOTALS_KW =
  /\b(subtotal|sub[\s\-]?total|iva|i\.?v\.?a\.?|impuesto|descuento|dscto?|d[eé]sc(?:uento)?|propina|gratuidad|tip|total|importe\s*total|pago|efectivo|cambio|vuelto|tarjeta|cr[eé]dito|d[eé]bito|puntos)\b/i;
// Strict version — used inside extractItems loop to skip totals lines without
// discarding actual item lines that mention e.g. "tarjeta" or "credito"
const TOTALS_KW_ITEMS =
  /^\s*(subtotal|sub[\s\-]?total|iva|i\.v\.a|impuesto|descuento|propina|gratuidad|tip|total|importe\s*total)\b/i;

const IGNORE_KW =
  /^\s*(fecha|date|hora|time|rfc\s*:|r\.f\.c|folio|no\.\s*ticket|ticket\s*[:#]|transacci[oó]n|cajero|caja|sucursal|direcci[oó]n|domicilio|tel[eé]f|p[aá]gina|gracias|vuelva|bienvenid|www\.|http|aut[oó]|serie|clave|cd|art[íi]culo|descripci[oó]n|cant|precio|importe)/i;

const HEADER_SKIP =
  /^\s*(rfc\s*:|r\.f\.c|folio|ticket|no\s*\.|fecha\s*:|hora\s*:|cajero|caja\s*\d|sucursal|mesa\s*\d|mesero)/i;

const SEP_LINE = /^[-=*#+_\s]{3,}$/;

// ─── Store name ───────────────────────────────────────────────────────────────

function extractStoreName(lines: string[]): string {
  for (const line of lines.slice(0, 8)) {
    const t = line.trim();
    if (!t || t.length < 2) continue;
    if (SEP_LINE.test(t)) continue;
    if (HEADER_SKIP.test(t)) continue;
    if (/^\d{1,4}$/.test(t)) continue;       // Only short digits
    if (/^\d{4}[\/\-]\d{2}/.test(t)) continue;  // Date
    if (PRICE_RE_S.test(t)) continue;           // Has a price
    // If it looks like a store name (letters, relatively short)
    if (t.length <= 60 && /[a-záéíóúñüA-ZÁÉÍÓÚÑÜ]/.test(t)) {
      return t.replace(/[_=\-*]+$/, '').trim();
    }
  }
  return lines[0]?.trim() ?? '';
}

// ─── Date ─────────────────────────────────────────────────────────────────────

function extractDate(text: string): string {
  // YYYY-MM-DD
  let m = text.match(/(\d{4})[\/\-](\d{2})[\/\-](\d{2})/);
  if (m) {
    const d = new Date(+m[1], +m[2] - 1, +m[3]);
    if (!isNaN(d.getTime()) && +m[1] >= 2000) return d.toISOString();
  }
  // DD/MM/YYYY or DD-MM-YYYY
  m = text.match(/(\d{2})[\/\-](\d{2})[\/\-](\d{4})/);
  if (m) {
    const d = new Date(+m[3], +m[2] - 1, +m[1]);
    if (!isNaN(d.getTime()) && +m[3] >= 2000) return d.toISOString();
  }
  // DD/MM/YY
  m = text.match(/(\d{2})[\/\-](\d{2})[\/\-](\d{2})(?!\d)/);
  if (m) {
    const year = 2000 + +m[3];
    const d = new Date(year, +m[2] - 1, +m[1]);
    if (!isNaN(d.getTime())) return d.toISOString();
  }
  return new Date().toISOString();
}

// ─── Category guesser ─────────────────────────────────────────────────────────

function guessCategory(name: string): TicketCategoria {
  const n = name.toLowerCase();
  if (/leche|queso|yogur|crema|mantequilla|jocoque/.test(n)) return 'alimentos';
  if (/pan|tortilla|cereal|harina|arroz|pasta|sopa|frijol|maiz/.test(n)) return 'alimentos';
  if (/refresco|agua\s*embotellada|jugo|bebida|coca|pepsi|cerveza|modelo|corona/.test(n)) return 'alimentos';
  if (/carne|pollo|res|puerco|salchicha|jam[oó]n|chorizo|bistec|filete/.test(n)) return 'alimentos';
  if (/fruta|verdura|manzana|naranja|platano|jitomate|tomate|papa|aguacate/.test(n)) return 'alimentos';
  if (/aceite|azucar|sal\b|vinagre|mayonesa|ketchup|salsa/.test(n)) return 'alimentos';
  if (/jab[oó]n|shampoo|champú|desodorante|pasta\s*dental|papel\s*higi|toalla|pañal|cepillo/.test(n)) return 'higiene';
  if (/detergente|suavizante|blanqueador|cloro|escoba|trapeador|esponja/.test(n)) return 'hogar';
  if (/pastilla|vitamina|medicamento|aspirina|ibuprofeno|omeprazol|paracetamol/.test(n)) return 'farmacia';
  if (/camisa|pantalon|ropa|blusa|calceta|zapatilla|tenis|vestido/.test(n)) return 'ropa';
  if (/cable|pila|foco|bombillo|cargador|audifonos|usb|adaptador/.test(n)) return 'tecnologia';
  if (/taco|hamburguesa|pizza|burrito|torta|antojito|orden|plato|bebida/.test(n)) return 'restaurante';
  if (/gasolina|gas\b|combustible|aceite\s*motor|lubricante/.test(n)) return 'transporte';
  if (/libro|cuaderno|pluma|marcador|lapiz|color|folder/.test(n)) return 'educacion';
  if (/comida\s*perro|comida\s*gato|pet|mascotas/.test(n)) return 'mascotas';
  return 'otros';
}

// ─── Find where totals section starts ────────────────────────────────────────

function findTotalsSectionStart(lines: string[]): number {
  // First pass: look for SUBTOTAL keyword (most reliable separator)
  for (let i = 0; i < lines.length; i++) {
    if (/\b(subtotal|sub[\s\-]?total|s\s*\/\s*total)\b/i.test(lines[i])) {
      return i;
    }
  }
  // Second pass: find last line with TOTAL keyword + price
  for (let i = lines.length - 1; i >= 0; i--) {
    if (/\btotal\b/i.test(lines[i]) && PRICE_RE_S.test(lines[i])) {
      // Walk backwards as long as we see totals-like lines
      let start = i;
      while (
        start > 0 &&
        (TOTALS_KW.test(lines[start - 1]) ||
          SEP_LINE.test(lines[start - 1]) ||
          (!PRICE_RE_S.test(lines[start - 1]) && /\b(efectivo|cambio|pago|propina)\b/i.test(lines[start - 1])))
      ) {
        start--;
      }
      return start;
    }
  }
  // Fallback: last 30% of lines
  return Math.max(0, Math.floor(lines.length * 0.7));
}

// ─── Item extraction ──────────────────────────────────────────────────────────

interface RawItem {
  nombre: string;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
}

/** Find the line index where items start (skip store header, RFC, dates, etc.) */
function findItemsStart(lines: string[], endIndex: number): number {
  for (let i = 0; i < Math.min(endIndex, 12); i++) {
    const line = lines[i].trim();
    if (!line || SEP_LINE.test(line) || HEADER_SKIP.test(line) || /^\d{0,4}$/.test(line)) {
      continue;
    }
    // Once we see a line with a price that isn't a totals line, items start
    if (PRICE_RE_S.test(line) && !TOTALS_KW.test(line)) {
      return i;
    }
  }
  return 0;
}

function tryParseItemLine(line: string): RawItem | null {
  const prices = allPricesInLine(line);
  if (prices.length === 0) return null;

  // The last price on an item line is almost always the line total/subtotal
  const subtotal = prices[prices.length - 1];
  if (subtotal <= 0) return null;

  // Find where the first price starts so we can extract the name before it
  const firstPriceIdx = line.search(PRICE_RE_S);
  if (firstPriceIdx <= 0) return null;  // Price at very start = skip

  const beforePrice = line.substring(0, firstPriceIdx).trim();
  if (beforePrice.length === 0) return null;

  let nombre = beforePrice;
  let cantidad = 1;
  let precioUnitario = subtotal;

  // Pattern: leading quantity "2 ITEM_NAME ..."
  const qtyMatch = nombre.match(/^(\d{1,3})\s+(.*)/);
  if (qtyMatch && parseInt(qtyMatch[1]) < 500 && parseInt(qtyMatch[1]) > 0) {
    const qtyCandidate = parseInt(qtyMatch[1]);
    const restName = qtyMatch[2].trim();
    if (restName.length > 0) {
      cantidad = qtyCandidate;
      nombre = restName;
      if (prices.length >= 2) {
        // unit price should be prices[0], total is prices[-1]
        precioUnitario = prices[0];
      } else {
        precioUnitario = parseFloat((subtotal / cantidad).toFixed(2));
      }
    }
  } else if (prices.length >= 2) {
    // Two prices but no leading qty: first = unit price, last = total
    precioUnitario = prices[0];
    // infer qty
    const inferredQty = Math.round(subtotal / precioUnitario);
    if (inferredQty > 1 && inferredQty <= 100) {
      cantidad = inferredQty;
    }
  }

  // Clean up name: remove trailing dots/dashes/pipes, collapse whitespace
  nombre = nombre
    .replace(/[|*.]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/[\s.\-_]+$/, '')
    .trim();

  if (nombre.length < 2) return null;
  // Name shouldn't be only digits or only special chars
  if (/^[\d\W]+$/.test(nombre)) return null;

  return {
    nombre: nombre.substring(0, 64),
    cantidad,
    precioUnitario: parseFloat(precioUnitario.toFixed(2)),
    subtotal: parseFloat(subtotal.toFixed(2)),
  };
}

function extractItems(lines: string[], endIndex: number): TicketItem[] {
  const items: TicketItem[] = [];
  const startIndex = findItemsStart(lines, endIndex);

  for (let i = startIndex; i < endIndex; i++) {
    const line = lines[i].trim();
    if (!line || SEP_LINE.test(line)) continue;
    if (IGNORE_KW.test(line)) continue;
    if (TOTALS_KW_ITEMS.test(line)) continue;

    const prices = allPricesInLine(line);

    if (prices.length === 0) {
      // Check for multi-line item: name line followed by qty/price line
      if (
        i + 1 < endIndex &&
        line.length > 2 &&
        /[a-záéíóúñüA-Z]/.test(line) &&
        !IGNORE_KW.test(lines[i + 1]) &&
        !TOTALS_KW.test(lines[i + 1])
      ) {
        const nextLine = lines[i + 1].trim();
        const nextPrices = allPricesInLine(nextLine);
        if (nextPrices.length > 0) {
          const subtotal = nextPrices[nextPrices.length - 1];
          if (subtotal > 0) {
            let cantidad = 1;
            let precioUnitario = subtotal;

            // Look for "2 @ 10.00" or "2 x 10.00" on next line
            const multiQty = nextLine.match(/^(\d+)\s*[@xX×]\s*([\d.,]+)/);
            if (multiQty) {
              cantidad = parseInt(multiQty[1]);
              precioUnitario = parseMoney(multiQty[2]);
            } else if (nextPrices.length >= 2) {
              precioUnitario = nextPrices[0];
              const inferredQty = Math.round(subtotal / precioUnitario);
              if (inferredQty > 1 && inferredQty <= 100) cantidad = inferredQty;
            }

            const nombre = line.replace(/\s{2,}/g, ' ').replace(/[\s.\-_]+$/, '').trim();
            if (nombre.length > 1 && !/^[\d\W]+$/.test(nombre)) {
              items.push({
                nombre: nombre.substring(0, 64),
                cantidad,
                precioUnitario: parseFloat(precioUnitario.toFixed(2)),
                subtotal: parseFloat(subtotal.toFixed(2)),
                categoria: guessCategory(nombre),
                confianza: 0.75,
              });
              i++; // consume next line too
            }
          }
        }
      }
      continue;
    }

    const raw = tryParseItemLine(line);
    if (raw) {
      items.push({
        nombre: raw.nombre,
        cantidad: raw.cantidad,
        precioUnitario: raw.precioUnitario,
        subtotal: raw.subtotal,
        categoria: guessCategory(raw.nombre),
        confianza: 0.8,
      });
    }
  }

  return items;
}

// ─── Totals extraction ────────────────────────────────────────────────────────

interface ExtractedAmounts {
  subtotal: number;
  impuestos: number;
  descuentos: number;
  propina: number;
  total: number;
}

function extractAmounts(lines: string[], startIndex: number): ExtractedAmounts {
  let subtotal = 0;
  let impuestos = 0;
  let descuentos = 0;
  let propina = 0;
  let total = 0;

  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i].trim();
    const prices = allPricesInLine(line);
    if (prices.length === 0) continue;

    const lc = line.toLowerCase();
    const last = prices[prices.length - 1];

    if (/\btotal\b/i.test(lc) && !/sub/.test(lc) && !/descuento/.test(lc)) {
      if (last > total) total = last; // keep the highest "total" value seen
    } else if (/subtotal|sub[\s\-]?total|s\s*\/\s*total/i.test(lc)) {
      if (last > subtotal) subtotal = last;
    } else if (/\b(iva|i\.v\.a|impuesto)\b/i.test(lc)) {
      impuestos += last;
    } else if (/\b(desc|dcto|dscto|descuento)\b/i.test(lc)) {
      descuentos += last;
    } else if (/\b(propina|gratuidad|tip)\b/i.test(lc)) {
      propina += last;
    }
  }

  return {
    subtotal: parseFloat(subtotal.toFixed(2)),
    impuestos: parseFloat(impuestos.toFixed(2)),
    descuentos: parseFloat(descuentos.toFixed(2)),
    propina: parseFloat(propina.toFixed(2)),
    total: parseFloat(total.toFixed(2)),
  };
}

// ─── Main parse function ──────────────────────────────────────────────────────

/**
 * Parses OCR-extracted receipt text into structured ticket data.
 * Handles common Mexican receipt formats (convenience stores, supermarkets, restaurants).
 */
export function parseReceiptText(rawText: string): ParsedTicketOcr {
  const lines = rawText.split('\n').map((l) => l.trim()).filter(Boolean);

  // ── Debug: dump raw lines so dev can inspect in Expo logs ──────────────────
  console.log('[Parser] === INICIO PARSEO ===');
  console.log('[Parser] Total líneas OCR:', lines.length);
  console.log('[Parser] Líneas completas:\n' + lines.map((l, i) => `  ${i}: ${l}`).join('\n'));

  const tienda = extractStoreName(lines);
  const fechaCompra = extractDate(rawText);
  const totalsSectionStart = findTotalsSectionStart(lines);

  console.log('[Parser] tienda detectada:', JSON.stringify(tienda));
  console.log('[Parser] inicio sección totales → línea', totalsSectionStart,
    '→', JSON.stringify(lines[totalsSectionStart]));
  console.log('[Parser] líneas de ARTÍCULOS (0 →', totalsSectionStart, '):');
  lines.slice(0, totalsSectionStart).forEach((l, i) => {
    const prices = allPricesInLine(l);
    console.log(`  [${i}] prices=${JSON.stringify(prices)} | "${l}"`);
  });

  const items = extractItems(lines, totalsSectionStart);
  const amounts = extractAmounts(lines, totalsSectionStart);

  console.log('[Parser] artículos extraídos:', items.length);
  items.forEach((it, i) => console.log(`  [${i}] ${it.nombre} x${it.cantidad} = $${it.subtotal}`));
  console.log('[Parser] montos → subtotal:', amounts.subtotal, 'iva:', amounts.impuestos,
    'desc:', amounts.descuentos, 'total:', amounts.total);

  // If no total found but we have items, derive from items
  if (amounts.total === 0 && items.length > 0) {
    amounts.total = parseFloat(
      items.reduce((s, it) => s + it.subtotal, 0).toFixed(2),
    );
  }
  // If no subtotal but we have total + taxes
  if (amounts.subtotal === 0 && amounts.total > 0) {
    amounts.subtotal = parseFloat(
      Math.max(0, amounts.total - amounts.impuestos).toFixed(2),
    );
  }
  // If neither subtotal nor total but items present
  if (amounts.subtotal === 0 && items.length > 0) {
    amounts.subtotal = parseFloat(
      items.reduce((s, it) => s + it.subtotal, 0).toFixed(2),
    );
  }

  const moneda = /\busd\b|\bdollars?\b|\$\s*usd/i.test(rawText) ? 'USD' : 'MXN';

  console.log(
    `[VisionOcr] parseReceiptText: tienda="${tienda}" items=${items.length} total=${amounts.total} moneda=${moneda}`,
  );

  return {
    tienda,
    fechaCompra,
    items,
    subtotal: amounts.subtotal,
    impuestos: amounts.impuestos,
    descuentos: amounts.descuentos,
    propina: amounts.propina,
    total: amounts.total,
    moneda,
    rawText,
  };
}

/**
 * Full OCR pipeline:
 * 1. Calls the best available OCR provider (Vision API or OCR.space).
 * 2. Parses the resulting text into a structured ParsedTicketOcr object.
 */
export async function ocrAndParse(base64Image: string): Promise<ParsedTicketOcr> {
  const rawText = await extractText(base64Image);
  console.log('[OcrService] Texto extraído (primeros 400 chars):\n', rawText.slice(0, 400));
  return parseReceiptText(rawText);
}
