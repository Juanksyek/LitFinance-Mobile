import 'dotenv/config';

export default ({ config }) => ({
  ...config,
  name: 'LitFinance',
  slug: 'LitFinance-Mobile',
  scheme: 'litfinance',
  orientation: 'portrait',
  icon: './assets/litfinance-app-icon-white-1024.png',
  userInterfaceStyle: 'automatic',
  // Baseline navigation bar styling (Android). This helps avoid a white nav bar
  // on some devices in edge-to-edge mode; runtime theming still applies where supported.
  androidNavigationBar: {
    backgroundColor: '#000000',
    barStyle: 'light-content',
  },
  android: {
    ...(config.android ?? {}),
    package: 'com.litfinance.app',
    intentFilters: [
      // Needed for Stripe PaymentSheet returnURL (e.g. litfinance://payment-success)
      {
        action: 'VIEW',
        category: ['BROWSABLE', 'DEFAULT'],
        data: [{ scheme: 'litfinance' }],
      },
    ],
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
    'expo-secure-store',
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
