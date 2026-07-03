import Constants from 'expo-constants';

export type AppEnvironment = 'development' | 'qa' | 'production';

const DEFAULT_API_BASE_URL = 'https://litfinance-api-production.up.railway.app';

function getExtraString(key: string): string | undefined {
  const value = Constants.expoConfig?.extra?.[key];
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

function getExtraBoolean(key: string, fallback: boolean): boolean {
  const value = Constants.expoConfig?.extra?.[key];
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return fallback;
}

function getAppEnvironment(): AppEnvironment {
  const value = getExtraString('APP_ENV');
  if (value === 'development' || value === 'qa' || value === 'production') {
    return value;
  }

  return __DEV__ ? 'development' : 'production';
}

export const env = {
  API_BASE_URL: getExtraString('API_BASE_URL') ?? DEFAULT_API_BASE_URL,
  APP_ENV: getAppEnvironment(),
  ENABLE_LOGGER: getExtraBoolean('ENABLE_LOGGER', __DEV__),
};

export function assertValidEnvironment(): void {
  if (!env.API_BASE_URL.startsWith('https://') && env.APP_ENV !== 'development') {
    throw new Error('Invalid API_BASE_URL: non-development builds must use HTTPS.');
  }
}
