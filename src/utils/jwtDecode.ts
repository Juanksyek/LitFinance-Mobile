// Utilidad simple para decodificar JWT (sin validación de firma)
export function jwtDecode(token: string): any {
  try {
    const payloadPart = token.split('.')[1];
    if (!payloadPart) return {};

    // base64url -> base64 + padding
    let payload = payloadPart.replace(/-/g, '+').replace(/_/g, '/');
    const padLen = payload.length % 4;
    if (padLen) payload += '='.repeat(4 - padLen);

    if (typeof Buffer === 'undefined') return {};
    const decoded = Buffer.from(payload, 'base64').toString('utf8');
    return JSON.parse(decoded);
  } catch {
    return {};
  }
}
