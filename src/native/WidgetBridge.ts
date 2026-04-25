import { NativeModules, Platform } from 'react-native';

interface WidgetTransaction {
  icon: string;
  concept: string;
  date: string;
  amount: string;
  isIncome: boolean;
}

interface WidgetBridgeInterface {
  updateBalance(balance: string, currency: string): Promise<boolean>;
  updateTransactions(transactions: WidgetTransaction[]): Promise<boolean>;
}

const NativeWidgetBridge = NativeModules.WidgetBridge as WidgetBridgeInterface | undefined;

const noopBridge: WidgetBridgeInterface = {
  updateBalance: async () => true,
  updateTransactions: async () => true,
};

/** Native bridge to update Android home screen widgets. No-op on iOS. */
const WidgetBridge: WidgetBridgeInterface =
  Platform.OS === 'android' && NativeWidgetBridge ? NativeWidgetBridge : noopBridge;

export default WidgetBridge;
export type { WidgetTransaction };
