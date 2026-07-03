import { useCallback, useEffect, useState } from 'react';
import { authService } from '../../../services/authService';
import { sessionManager } from '../../../core/auth/sessionManager';

export function useSession() {
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  const bootstrap = useCallback(async () => {
    setIsBootstrapping(true);
    try {
      const token = await sessionManager.bootstrapSession();
      setAccessToken(token);
      return token;
    } finally {
      setIsBootstrapping(false);
    }
  }, []);

  const logout = useCallback(() => sessionManager.logout(), []);

  useEffect(() => {
    bootstrap();

    return authService.onLogout(() => {
      setAccessToken(null);
    });
  }, [bootstrap]);

  return {
    accessToken,
    bootstrap,
    isAuthenticated: Boolean(accessToken),
    isBootstrapping,
    logout,
  };
}

