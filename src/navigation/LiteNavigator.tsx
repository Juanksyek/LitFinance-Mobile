import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import SplashScreen from '../screens/SplashScreen';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen';
import VerifyOtpScreen from '../screens/VerifyOtpScreen';
import ResetPasswordScreen from '../screens/ResetPasswordScreen';
import PrivacySecurityScreen from '../screens/PrivacySecurityScreen';
import OnboardingLiteScreen from '../screens/onboarding/OnboardingLiteScreen';
import DashboardLiteScreen from '../screens/dashboard/DashboardLiteScreen';
import AddMovementScreen from '../screens/transactions/AddMovementScreen';
import MovementsHistoryScreen from '../screens/transactions/MovementsHistoryScreen';
import MovementDetailScreen from '../screens/transactions/MovementDetailScreen';
import CategoriesScreen from '../screens/transactions/CategoriesScreen';
import BudgetCurrentScreen from '../screens/budgets/BudgetCurrentScreen';
import SyncStatusScreen from '../screens/sync/SyncStatusScreen';
import SettingsLiteScreen from '../screens/settings/SettingsLiteScreen';
import GoalsLiteScreen from '../screens/goals/GoalsLiteScreen';
import CreateGoalLiteScreen from '../screens/goals/CreateGoalLiteScreen';
import GoalDetailLiteScreen from '../screens/goals/GoalDetailLiteScreen';
import SubaccountsLiteScreen from '../screens/accounts/SubaccountsLiteScreen';

export type LiteStackParamList = {
  Splash: undefined;
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
  VerifyOtp: { email: string };
  ResetPassword: { resetToken: string };
  OnboardingLite: undefined;
  Dashboard: undefined;
  DashboardLite: undefined;
  AddMovement: undefined;
  MovementDetail: { movementId: string };
  MovementsHistory: undefined;
  Categories: undefined;
  BudgetCurrent: undefined;
  Goals: undefined;
  CreateGoal: undefined;
  GoalDetail: { metaId: string };
  Subaccounts: undefined;
  SubaccountDetail: { subcuenta: any; onGlobalRefresh?: () => void };
  Settings: undefined;
  PrivacySecurity: undefined;
  SyncStatus: undefined;
};

const Stack = createNativeStackNavigator<LiteStackParamList>();

export default function LiteNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName="Splash">
      <Stack.Screen name="Splash" component={SplashScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <Stack.Screen name="VerifyOtp" component={VerifyOtpScreen as any} />
      <Stack.Screen name="ResetPassword" component={ResetPasswordScreen as any} />
      <Stack.Screen name="OnboardingLite" component={OnboardingLiteScreen} />
      <Stack.Screen name="Dashboard" component={DashboardLiteScreen} />
      <Stack.Screen name="DashboardLite" component={DashboardLiteScreen} />
      <Stack.Screen name="AddMovement" component={AddMovementScreen} />
      <Stack.Screen name="MovementDetail" component={MovementDetailScreen} />
      <Stack.Screen name="MovementsHistory" component={MovementsHistoryScreen} />
      <Stack.Screen name="Categories" component={CategoriesScreen} />
      <Stack.Screen name="BudgetCurrent" component={BudgetCurrentScreen} />
      <Stack.Screen name="Goals" component={GoalsLiteScreen} />
      <Stack.Screen name="CreateGoal" component={CreateGoalLiteScreen} />
      <Stack.Screen name="GoalDetail" component={GoalDetailLiteScreen} />
      <Stack.Screen name="Subaccounts" component={SubaccountsLiteScreen} />
      <Stack.Screen name="Settings" component={SettingsLiteScreen} />
      <Stack.Screen name="PrivacySecurity" component={PrivacySecurityScreen} />
      <Stack.Screen name="SyncStatus" component={SyncStatusScreen} />
    </Stack.Navigator>
  );
}
