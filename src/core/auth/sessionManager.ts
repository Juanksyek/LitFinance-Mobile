import { authService } from '../../services/authService';

export const sessionManager = {
  bootstrapSession(): Promise<string | null> {
    return authService.getAccessToken({ allowRefresh: false });
  },

  refreshSession(): Promise<string> {
    return authService.refreshTokens();
  },

  logout(): Promise<void> {
    return authService.triggerLogout();
  },
};
