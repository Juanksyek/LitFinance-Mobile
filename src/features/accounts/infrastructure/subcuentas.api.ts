import { httpClient } from '../../../shared/api/api-client';
import type {
  DeleteSubcuentaRequest,
  DeleteSubcuentaResponse,
} from '../domain/subcuentas.types';

export const subcuentasApi = {
  eliminar(
    subCuentaId: string,
    body: DeleteSubcuentaRequest,
  ): Promise<DeleteSubcuentaResponse> {
    return httpClient.post(
      `/subcuenta/${encodeURIComponent(subCuentaId)}/eliminar`,
      body,
      { authenticated: true },
    );
  },
};
