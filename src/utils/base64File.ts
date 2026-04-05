import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

function safeFilename(name: string): string {
  const trimmed = (name || 'archivo').trim();
  // :) Remove path separators and other problematic chars
  const sanitized = trimmed.replace(/[\\/\0<>:"|?*]+/g, '_');
  return sanitized.length > 0 ? sanitized : 'archivo';
}

export async function writeBase64ToCacheFile(opts: {
  base64: string;
  filename: string;
}): Promise<string> {
  const filename = safeFilename(opts.filename);

  const dir = Paths.cache;
  if (!dir?.uri) {
    throw new Error('No se pudo acceder al sistema de archivos del dispositivo.');
  }

  const file = new File(dir, filename);
  // Note: Expo FileSystem v19+ uses synchronous methods.
  file.write(opts.base64, { encoding: 'base64' });
  return file.uri;
}

export async function shareBase64AsFile(opts: {
  base64: string;
  filename: string;
  mimeType: string;
}): Promise<void> {
  const available = await Sharing.isAvailableAsync();
  if (!available) {
    throw new Error('Compartir no est\u00E1 disponible en este dispositivo.');
  }

  const uri = await writeBase64ToCacheFile({ base64: opts.base64, filename: opts.filename });

  await Sharing.shareAsync(uri, {
    mimeType: opts.mimeType,
    dialogTitle: 'Exportar reporte',
    UTI: opts.mimeType, // iOS hint; safe to pass through
  });
}
