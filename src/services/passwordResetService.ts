import { API_BASE_URL } from '../constants/api';

export const passwordResetService = {
  async requestOtp(email: string) {
    const res = await fetch(`${API_BASE_URL}/auth/forgot-password-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });

    // backend responde siempre ok (aunque no exista email)
    if (!res.ok) throw new Error('No se pudo enviar el código');
    return res.json();
  },

  async verifyOtp(email: string, otp: string): Promise<{ resetToken: string }> {
    const res = await fetch(`${API_BASE_URL}/auth/verify-reset-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, otp }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Código inválido o expirado');
    }
    return res.json();
  },

  async resetPassword(resetToken: string, newPassword: string) {
    const res = await fetch(`${API_BASE_URL}/auth/reset-password-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resetToken, newPassword }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'No se pudo actualizar la contraseña');
    }
    return res.json();
  },
};
