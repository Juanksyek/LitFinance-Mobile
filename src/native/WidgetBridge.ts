import { NativeModules, Platform } from 'react-native';

interface WidgetBridgeInterface {
  updateMonthlySummary(
    income: number,
    expenses: number,
    incomeDisplay: string,
    expensesDisplay: string,
    currency: string,
  ): Promise<boolean>;
}

const NativeWidgetBridge = NativeModules.WidgetBridge as WidgetBridgeInterface | undefined;

const noopBridge: WidgetBridgeInterface = {
  updateMonthlySummary: async () => true,
};

/** Native bridge to update Android home screen widgets. No-op on iOS. */
const WidgetBridge: WidgetBridgeInterface =
  Platform.OS === 'android' && NativeWidgetBridge ? NativeWidgetBridge : noopBridge;

export default WidgetBridge;
