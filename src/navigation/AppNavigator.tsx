import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import SplashScreen from '../screens/SplashScreen';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen';
import DashboardScreen from '../screens/DashboardScreen';
import SubaccountDetail from '../screens/SubaccountDetail';
import RecurrenteDetail from '../screens/RecurrentDetail';
import MainAccountScreen from '../screens/MainAccountScreen';
import ResetPasswordScreen from '../screens/ResetPasswordScreen';
import AnalyticsScreen from '../screens/AnalyticsScreen';

export type Subcuenta = {
  _id: string;
  nombre: string;
  cantidad: number;
  moneda: string;
  simbolo: string;
  color: string;
  afectaCuenta: boolean;
  subCuentaId: string;
  updatedAt: string;
};

export type RootStackParamList = {
  Splash: undefined;
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
  Dashboard: { updated?: boolean } | undefined;
  SubaccountDetail: { subcuenta: Subcuenta; onGlobalRefresh?: () => void };
  RecurrenteDetail: {
    recurrente: {
      recurrenteId: string;
      nombre: string;
      monto: number;
      frecuenciaTipo: 'dia_semana' | 'dia_mes' | 'fecha_anual';
      frecuenciaValor: string;
      proximaEjecucion: string;
      plataforma?: { color: string; nombre: string; categoria: string };
      afectaCuentaPrincipal: boolean;
      afectaSubcuenta: boolean;
      subcuentaId?: string;
      recordatorios?: number[];
      pausado: boolean;
    };
  };
  MainAccount: undefined;
  ResetPassword: { email: string };
  Analytics: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName="Splash">
      <Stack.Screen name="Splash" component={SplashScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <Stack.Screen name="Dashboard" component={DashboardScreen} />
      <Stack.Screen name="SubaccountDetail" component={SubaccountDetail} />
      <Stack.Screen name="RecurrenteDetail" component={RecurrenteDetail} />
      <Stack.Screen name="MainAccount" component={MainAccountScreen} />
      <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
      <Stack.Screen name="Analytics" component={AnalyticsScreen} />
    </Stack.Navigator>
  );
}
