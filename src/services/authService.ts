import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../constants/api';

type LogoutHandler = () => void;

class AuthService {
  private ACCESS_KEY = 'authToken';
  private REFRESH_KEY = 'refreshToken';
  private DEVICE_ID_KEY = 'deviceId';
  private logoutHandlers: Set<LogoutHandler> = new Set();
  private accessTokenInMemory: string | null = null;
  private refreshTimer: any = null;

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
    // Prefer in-memory token for performance
    if (this.accessTokenInMemory) return this.accessTokenInMemory;
    try {
      const secure = await this.secureGet(this.ACCESS_KEY);
      if (secure) {
        this.accessTokenInMemory = secure;
        return secure;
      }
      const stored = await AsyncStorage.getItem(this.ACCESS_KEY);
      if (stored) this.accessTokenInMemory = stored;
      return stored;
    } catch {
      return null;
    }
  }

  async setAccessToken(token: string): Promise<void> {
    // Save to memory and secure storage
    this.accessTokenInMemory = token;
    await this.secureSet(this.ACCESS_KEY, token);
    // Schedule proactive refresh before expiry
    this.scheduleRefreshForToken(token);
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
    // clear memory and storage
    this.accessTokenInMemory = null;
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
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
      throw new Error('No refresh token available');
    }

    // Ensure we have a deviceId for sliding refresh
    const deviceId = await this.getOrCreateDeviceId();

    const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken, deviceId }),
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

  /**
   * Generates or returns existing deviceId for this installation
   */
  async getOrCreateDeviceId(): Promise<string> {
    try {
      const existing = await AsyncStorage.getItem(this.DEVICE_ID_KEY);
      if (existing) return existing;
    } catch {}
    const id = this.uuidv4();
    try {
      await AsyncStorage.setItem(this.DEVICE_ID_KEY, id);
    } catch {}
    return id;
  }

  async getDeviceId(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(this.DEVICE_ID_KEY);
    } catch {
      return null;
    }
  }

  /**
   * Logout a specific device session (requires Authorization header)
   */
  async logoutDevice(deviceId?: string): Promise<void> {
    try {
      const access = await this.getAccessToken();
      if (!access) {
        // nothing to do locally
        await this.clearRefreshToken();
        return;
      }
      const payload = { deviceId: deviceId || (await this.getDeviceId()) };
      await fetch(`${API_BASE_URL}/auth/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${access}`,
        },
        body: JSON.stringify(payload),
      });
    } catch (e) {
      console.warn('⚠️ [AuthService] logoutDevice failed', e);
    } finally {
      // Always remove local refresh token for this device
      await this.clearRefreshToken();
    }
  }

  private uuidv4(): string {
    // RFC4122 version 4 compliant UUID (simple impl)
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  /**
   * Schedule a proactive refresh before the access token expires
   */
  private scheduleRefreshForToken(token: string) {
    try {
      // Cancel existing
      if (this.refreshTimer) {
        clearTimeout(this.refreshTimer);
        this.refreshTimer = null;
      }

      const ms = this.msUntilExp(token);
      if (!ms || ms <= 0) return;
      // Refresh 60s before expiry, but at least after 5s
      const refreshIn = Math.max(5000, ms - 60000);
      this.refreshTimer = setTimeout(async () => {
        try {
          await this.refreshTokens();
        } catch (e) {
          // if refresh fails, force logout
          await this.triggerLogout();
        }
      }, refreshIn);
    } catch (e) {
      // ignore scheduling errors
    }
  }

  private msUntilExp(jwt: string): number | null {
    try {
      const parts = jwt.split('.');
      if (parts.length < 2) return null;
      const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const decoded = decodeURIComponent(
        atob(payload)
          .split('')
          .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      const obj = JSON.parse(decoded);
      if (!obj.exp) return null;
      return obj.exp * 1000 - Date.now();
    } catch {
      return null;
    }
  }
}

export const authService = new AuthService();
export default authService;
