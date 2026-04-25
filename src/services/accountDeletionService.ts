import { API_BASE_URL } from '../constants/api';
import { authService } from './authService';

const authHeaders = async () => {
  const token = await authService.getAccessToken();
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
};

/** Paso 1: Solicita OTP al email del usuario */
export async function requestAccountDeletion(): Promise<{ ok: boolean; message: string }> {
  const res = await fetch(`${API_BASE_URL}/auth/request-account-deletion`, {
    method: 'POST',
    headers: await authHeaders(),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.message || 'Error al solicitar eliminación');
  return body;
}

/** Paso 2: Verifica OTP → devuelve deletionToken */
export async function verifyDeletionOtp(email: string, otp: string): Promise<{ deletionToken: string }> {
  const res = await fetch(`${API_BASE_URL}/auth/verify-deletion-otp`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ email, otp }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.message || 'Código inválido');
  return body;
}

/** Paso 3: Confirma eliminación permanente */
export async function confirmAccountDeletion(deletionToken: string): Promise<{ ok: boolean; message: string }> {
  const res = await fetch(`${API_BASE_URL}/auth/confirm-account-deletion`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ deletionToken }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.message || 'Error al eliminar cuenta');
  return body;
}
