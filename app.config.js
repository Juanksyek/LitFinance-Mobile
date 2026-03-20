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
    // Google Cloud Vision API key (paid). Optional — OCR.space is the free alternative.
    GOOGLE_VISION_API_KEY: process.env.GOOGLE_VISION_API_KEY ?? '',
    // OCR.space free API key (25 000 req/month, no credit card).
    // Get yours instantly at https://ocr.space/ocrapi/freekey
    // Set in your .env file: OCR_SPACE_API_KEY=K88...
    OCR_SPACE_API_KEY: process.env.OCR_SPACE_API_KEY ?? '',
    eas: {
      projectId: "0fb5f630-9735-4a95-8227-f88e26be48a4"
    }
  },
});
