// Utilidad simple para decodificar JWT (sin validación de firma)
export function jwtDecode(token: string): any {
  try {
    const payload = token.split('.')[1];
    const decoded = Buffer.from(payload, 'base64').toString('utf8');
    return JSON.parse(decoded);
  } catch {
    return {};
  }
}
