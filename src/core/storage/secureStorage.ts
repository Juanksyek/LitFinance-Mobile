import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

export interface KeyValueStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  deleteItem(key: string): Promise<void>;
}

export const secureStorage: KeyValueStorage = {
  async getItem(key: string): Promise<string | null> {
    try {
      const secureValue = await SecureStore.getItemAsync(key);
      if (secureValue) return secureValue;
    } catch {
      // Fall through to legacy storage for compatibility with existing installs.
    }

    return AsyncStorage.getItem(key);
  },

  async setItem(key: string, value: string): Promise<void> {
    try {
      await SecureStore.setItemAsync(key, value);
      return;
    } catch {
      await AsyncStorage.setItem(key, value);
    }
  },

  async deleteItem(key: string): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch {
      // Keep cleanup best-effort and still clear the legacy fallback.
    }

    await AsyncStorage.removeItem(key);
  },
};

