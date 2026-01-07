import { NativeModules, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type AppIconVariant = 'light' | 'dark';

const STORAGE_KEY = 'appIconVariant';

type NativeAppIcon = {
  setIcon: (variant: string) => Promise<boolean>;
  getSupported: () => Promise<boolean>;
};

const NativeAppIconModule: NativeAppIcon | undefined = (NativeModules as any)?.AppIcon;

export async function isDynamicAppIconSupported(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  if (!NativeAppIconModule?.getSupported) return false;
  try {
    return await NativeAppIconModule.getSupported();
  } catch {
    return false;
  }
}

export async function getStoredAppIconVariant(): Promise<AppIconVariant> {
  const v = await AsyncStorage.getItem(STORAGE_KEY);
  return v === 'dark' ? 'dark' : 'light';
}

export async function setStoredAppIconVariant(variant: AppIconVariant): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, variant);
}

export async function applyAppIconVariant(variant: AppIconVariant): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  if (!NativeAppIconModule?.setIcon) return false;
  return await NativeAppIconModule.setIcon(variant);
}

export async function applyStoredAppIconVariant(): Promise<void> {
  const variant = await getStoredAppIconVariant();
  await applyAppIconVariant(variant);
}
