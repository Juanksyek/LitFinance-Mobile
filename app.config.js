import 'dotenv/config';

export default ({ config }) => ({
  ...config,
  name: 'LitFinance',
  slug: 'LitFinance-Mobile',
  orientation: 'portrait',
  icon: './assets/litfinance-app-icon-white-1024.png',
  userInterfaceStyle: 'automatic',
  android: {
    ...(config.android ?? {}),
    package: 'com.litfinance.app',
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#ffffff',
    },
    edgeToEdgeEnabled: true,
    useNextNotificationsApi: true,
    label: 'LitFinance',
  },
  plugins: [
    ...(config.plugins ?? []),
    'expo-asset',
    [
      'expo-notifications',
      {
        icon: './assets/litfinance-app-icon-white-1024.png',
        color: '#ffffff',
      },
    ],
    './plugins/withAndroidAlternateLauncherIcons',
  ],
  extra: {
    API_BASE_URL: process.env.API_BASE_URL ?? config.extra?.API_BASE_URL,
    eas: {
      projectId: "0fb5f630-9735-4a95-8227-f88e26be48a4"
    }
  },
});
