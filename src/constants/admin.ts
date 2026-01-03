export const ADMIN_EMAILS = ['elgalleto12393@gmail.com'];

export function isAdminEmail(email?: string | null) {
  if (!email) return false;
  return ADMIN_EMAILS.includes(String(email).trim().toLowerCase());
}
