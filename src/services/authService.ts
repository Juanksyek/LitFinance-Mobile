import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../constants/api';

type LogoutHandler = () => void;

class AuthService {
  private ACCESS_KEY = 'authToken';
  private REFRESH_KEY = 'refreshToken';
  private logoutHandlers: Set<LogoutHandler> = new Set();

  /**
   * Register a callback to be called when session expires and user needs to logout.
   * Typically used by navigation to redirect to login screen.
   */
  onLogout(handler: LogoutHandler): () => void {
    this.logoutHandlers.add(handler);
    return () => this.logoutHandlers.delete(handler);
  }

  /**
   * Trigger logout: clear tokens and notify all listeners.
   */
  async triggerLogout(): Promise<void> {
    await this.clearAll();
    this.logoutHandlers.forEach((h) => h());
  }

  // Use secure store for refresh tokens in production; access token may remain in AsyncStorage
  private async secureGet(key: string): Promise<string | null> {
    try {
      // dynamic require to avoid compile-time error when package not installed
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const SecureStore = require('expo-secure-store');
      if (SecureStore && SecureStore.getItemAsync) {
        return await SecureStore.getItemAsync(key);
      }
      return null;
    } catch {
      return null;
    }
  }

  private async secureSet(key: string, value: string): Promise<void> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const SecureStore = require('expo-secure-store');
      if (SecureStore && SecureStore.setItemAsync) {
        await SecureStore.setItemAsync(key, value);
        return;
      }
    } catch {
      // ignore and fallback
    }
    await AsyncStorage.setItem(key, value);
  }

  private async secureDelete(key: string): Promise<void> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const SecureStore = require('expo-secure-store');
      if (SecureStore && SecureStore.deleteItemAsync) {
        await SecureStore.deleteItemAsync(key);
        return;
      }
    } catch {
      // ignore and fallback
    }
    await AsyncStorage.removeItem(key);
  }

  async getAccessToken(): Promise<string | null> {
    try {
      // try secure store first
      const secure = await this.secureGet(this.ACCESS_KEY);
      if (secure) return secure;
      return await AsyncStorage.getItem(this.ACCESS_KEY);
    } catch {
      return null;
    }
  }

  async setAccessToken(token: string): Promise<void> {
    // prefer secure storage
    await this.secureSet(this.ACCESS_KEY, token);
  }

  async clearAccessToken(): Promise<void> {
    await this.secureDelete(this.ACCESS_KEY);
  }

  async getRefreshToken(): Promise<string | null> {
    try {
      // try secure store first
      const secure = await this.secureGet(this.REFRESH_KEY);
      if (secure) return secure;
      return await AsyncStorage.getItem(this.REFRESH_KEY);
    } catch {
      return null;
    }
  }

  async setRefreshToken(token: string): Promise<void> {
    // store in secure storage with fallback
    await this.secureSet(this.REFRESH_KEY, token);
  }

  async clearRefreshToken(): Promise<void> {
    await this.secureDelete(this.REFRESH_KEY);
  }

  async clearAll(): Promise<void> {
    await Promise.all([this.clearAccessToken(), this.clearRefreshToken()]);
  }

  /**
   * Attempts to refresh tokens using the refresh token stored in storage.
   * On success, saves new tokens and returns the new access token.
   * On failure, clears tokens, triggers logout handlers, and throws.
   */
  async refreshTokens(): Promise<string> {
    const refreshToken = await this.getRefreshToken();
    if (!refreshToken) {
      // No refresh token: do not auto-logout here to allow callers to decide behavior.
      throw new Error('No refresh token available');
    }

    const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (!res.ok) {
      // Clear tokens and trigger logout to force re-login
      await this.triggerLogout();
      throw new Error(`Refresh failed: ${res.status}`);
    }

    const data = await res.json();
    const newAccess = data?.accessToken || data?.token || null;
    const newRefresh = data?.refreshToken || null;

    if (!newAccess) {
      await this.triggerLogout();
      throw new Error('Refresh response missing access token');
    }

    await this.setAccessToken(newAccess);
    if (newRefresh) await this.setRefreshToken(newRefresh);

    return newAccess;
  }
}

export const authService = new AuthService();
export default authService;
