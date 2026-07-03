import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../../shared/constants/storageKeys';

function generateDeviceId(): string {
  return `device_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export async function getOrCreateDeviceId(): Promise<string> {
  try {
    const existing = await AsyncStorage.getItem(STORAGE_KEYS.DEVICE_ID);
    if (existing) return existing;
  } catch {
    // ignore storage failures and create a best-effort id
  }

  const nextId = generateDeviceId();
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.DEVICE_ID, nextId);
  } catch {
    // ignore write failures
  }

  return nextId;
}

export async function getDeviceId(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(STORAGE_KEYS.DEVICE_ID);
  } catch {
    return null;
  }
}
