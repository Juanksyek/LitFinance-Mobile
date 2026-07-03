import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { getOrCreateDeviceId } from './deviceId';

export type MobileHeaderOptions = {
  requestId?: string;
};

export function getAppVersion(): string {
  return Constants.expoConfig?.version ?? '1.0.0';
}

export function getAppBuild(): string {
  const androidVersionCode = Constants.expoConfig?.android?.versionCode;
  const iosBuildNumber = Constants.expoConfig?.ios?.buildNumber;
  if (androidVersionCode !== undefined) return String(androidVersionCode);
  if (iosBuildNumber !== undefined) return String(iosBuildNumber);
  return '1';
}

export function getAppPlatform(): 'ios' | 'android' | 'web' {
  if (Platform.OS === 'ios') return 'ios';
  if (Platform.OS === 'android') return 'android';
  return 'web';
}

export function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export async function buildMobileHeaders(
  options: MobileHeaderOptions = {},
): Promise<Record<string, string>> {
  const deviceId = await getOrCreateDeviceId();

  return {
    'X-Device-ID': deviceId,
    'X-App-Version': getAppVersion(),
    'X-App-Build': getAppBuild(),
    'X-Platform': getAppPlatform(),
    'X-Request-ID': options.requestId ?? generateRequestId(),
  };
}
