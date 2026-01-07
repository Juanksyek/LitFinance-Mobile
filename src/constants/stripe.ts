export const STRIPE_PRICES = {
  premiumMonthly: 'price_1SWLgf7qt4C6UN1zwL7rZsaK',
  premiumYearly: 'price_1Sg8zY7qt4C6UN1zRxMDb95U',
};

// Usa react-native-dotenv para la clave pública de Stripe
import { STRIPE_PUBLISHABLE_KEY as ENV_STRIPE_PUBLISHABLE_KEY } from '@env';
export const STRIPE_PUBLISHABLE_KEY = ENV_STRIPE_PUBLISHABLE_KEY || '';

export const TIP_JAR_AMOUNTS = {
  small: { amount: 20, days: 7, label: '$20 MXN - 7 días Premium' },
  medium: { amount: 50, days: 15, label: '$50 MXN - 15 días Premium' },
  large: { amount: 100, days: 30, label: '$100 MXN - 30 días Premium' },
  xlarge: { amount: 200, days: 90, label: '$200 MXN - 90 días Premium' },
};
