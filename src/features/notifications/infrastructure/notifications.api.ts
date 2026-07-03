import { httpClient } from '../../../shared/api/api-client';
import type {
  PushTokenPayload,
  PushTokenResponse,
} from '../domain/notifications.types';

export const notificationsApi = {
  register(payload: PushTokenPayload): Promise<PushTokenResponse> {
    return httpClient.post(
      '/notificaciones/expo/registrar',
      payload,
      { authenticated: true },
    );
  },

  unregister(payload: PushTokenPayload): Promise<PushTokenResponse> {
    return httpClient.request(
      '/notificaciones/expo/eliminar',
      {
        method: 'DELETE',
        authenticated: true,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      },
    );
  },
};
