import { STORAGE_KEYS } from '../../shared/constants/storageKeys';
import { secureStorage } from '../storage/secureStorage';

export const tokenManager = {
  getAccessToken(): Promise<string | null> {
    return secureStorage.getItem(STORAGE_KEYS.AUTH_ACCESS_TOKEN);
  },

  getRefreshToken(): Promise<string | null> {
    return secureStorage.getItem(STORAGE_KEYS.AUTH_REFRESH_TOKEN);
  },

  setAccessToken(token: string): Promise<void> {
    return secureStorage.setItem(STORAGE_KEYS.AUTH_ACCESS_TOKEN, token);
  },

  setRefreshToken(token: string): Promise<void> {
    return secureStorage.setItem(STORAGE_KEYS.AUTH_REFRESH_TOKEN, token);
  },

  async setTokens(tokens: { accessToken: string; refreshToken?: string | null }): Promise<void> {
    await this.setAccessToken(tokens.accessToken);
    if (tokens.refreshToken) {
      await this.setRefreshToken(tokens.refreshToken);
    }
  },

  clearAccessToken(): Promise<void> {
    return secureStorage.deleteItem(STORAGE_KEYS.AUTH_ACCESS_TOKEN);
  },

  clearRefreshToken(): Promise<void> {
    return secureStorage.deleteItem(STORAGE_KEYS.AUTH_REFRESH_TOKEN);
  },

  async clearTokens(): Promise<void> {
    await Promise.all([
      this.clearAccessToken(),
      this.clearRefreshToken(),
    ]);
  },
};

