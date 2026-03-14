import { API_BASE_URL } from '../constants/api';
import { apiRateLimiter } from './apiRateLimiter';
import type { DeleteSubcuentaRequest, DeleteSubcuentaResponse } from '../types/subcuentas';

export const subcuentasService = {
  async eliminarSubcuenta(subCuentaId: string, body: DeleteSubcuentaRequest): Promise<DeleteSubcuentaResponse> {
    const res = await apiRateLimiter.fetch(`${API_BASE_URL}/subcuenta/${subCuentaId}/eliminar`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const json = (await res.json().catch(() => ({}))) as any;
    if (!res.ok) {
      throw new Error(json?.message || 'Error al eliminar la subcuenta');
    }

    return json as DeleteSubcuentaResponse;
  },
};
