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
import VerifyOtpScreen from '../screens/VerifyOtpScreen';
import AnalyticsScreen from '../screens/AnalyticsScreen';
import SettingsScreen from '../screens/SettingsScreen';
import SupportScreen from '../screens/SupportScreen';
import CreateTicketScreen from '../screens/CreateTicketScreen';
import TicketDetailScreen from '../screens/TicketDetailScreen';
import AdminNotificationsScreen from '../screens/AdminNotificationsScreen';
import ConceptsScreen from '../screens/ConceptsScreen';
import PrivacySecurityScreen from '../screens/PrivacySecurityScreen';
import ReportesExportScreen from '../screens/ReportesExportScreen';
import MetasScreen from '../screens/MetasScreen';
import CreateMetaScreen from '../screens/CreateMetaScreen';
import MetaDetailScreen from '../screens/MetaDetailScreen';
import BlocCuentasScreen from '../screens/BlocCuentasScreen';
import BlocDetailScreen from '../screens/BlocDetailScreen';
import SharedSpacesScreen from '../screens/SharedSpacesScreen';
import SpaceDetailScreen from '../screens/SpaceDetailScreen';
import SharedNotificationsScreen from '../screens/SharedNotificationsScreen';
import SharedMovementDetailScreen from '../screens/SharedMovementDetailScreen';
import QRScannerScreen from '../screens/QRScannerScreen';
import TicketScanScreen from '../screens/TicketScanScreen';
import TicketReviewScreen from '../screens/TicketReviewScreen';
import TicketManualScreen from '../screens/TicketManualScreen';
import TicketScanHistoryScreen from '../screens/TicketScanHistoryScreen';
import TicketScanDetailScreen from '../screens/TicketScanDetailScreen';

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
  // Campos de conversión multi-moneda
  montoConvertido?: number;
  tasaConversion?: number;
  fechaConversion?: string;
};

export type RootStackParamList = {
  Splash: undefined;
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
  VerifyOtp: { email: string };
  Dashboard: { updated?: boolean } | undefined;
  SubaccountDetail: { subcuenta: Subcuenta; onGlobalRefresh?: () => void };
  RecurrenteDetail: {
    recurrente: {
      recurrenteId: string;
      nombre: string;
      monto: number;
      moneda?: string;
      frecuenciaTipo: 'dia_semana' | 'dia_mes' | 'fecha_anual';
      frecuenciaValor: string;
      proximaEjecucion: string;
      plataforma?: { color: string; nombre: string; categoria: string };
      afectaCuentaPrincipal: boolean;
      afectaSubcuenta: boolean;
      subcuentaId?: string;
      recordatorios?: number[];
      pausado: boolean;
      // Campos de conversión multi-moneda
      montoConvertido?: number;
      tasaConversion?: number;
      fechaConversion?: string;
    };
  };
  MainAccount: undefined;
  ResetPassword: { resetToken: string };
  Analytics: undefined;
  Settings: undefined;
  PrivacySecurity: undefined;
  Support: undefined;
  CreateTicket: undefined;
  TicketDetail: { ticketId: string };
  AdminNotifications: undefined;
  Concepts: undefined;
  ReportesExport: undefined;
  Metas:
    | {
        initialFilter?: 'activa' | 'pausada' | 'cumplida' | 'todas';
        refreshKey?: number;
      }
    | undefined;
  CreateMeta: undefined;
  MetaDetail: { metaId: string };
  BlocCuentas: undefined;
  BlocDetail: { blocId: string };
  SharedSpaces: undefined;
  SpaceDetail: { spaceId: string };
  SharedMovementDetail: { movementId: string; spaceId: string };
  SharedNotifications: undefined;
  QRScanner: undefined;
  TicketScan: { source?: 'camera' | 'gallery' };
  TicketReview: { ticket: any };
  TicketManual: undefined;
  TicketScanHistory: undefined;
  TicketScanDetail: { ticketId: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName="Splash">
      <Stack.Screen name="Splash" component={SplashScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <Stack.Screen name="VerifyOtp" component={VerifyOtpScreen} />
      <Stack.Screen name="Dashboard" component={DashboardScreen} />
      <Stack.Screen name="SubaccountDetail" component={SubaccountDetail} />
      <Stack.Screen name="RecurrenteDetail" component={RecurrenteDetail} />
      <Stack.Screen name="MainAccount" component={MainAccountScreen} />
      <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
      <Stack.Screen name="Analytics" component={AnalyticsScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="PrivacySecurity" component={PrivacySecurityScreen} />
      <Stack.Screen name="Support" component={SupportScreen} />
      <Stack.Screen name="CreateTicket" component={CreateTicketScreen} />
      <Stack.Screen name="TicketDetail" component={TicketDetailScreen} />
      <Stack.Screen name="AdminNotifications" component={AdminNotificationsScreen} />
      <Stack.Screen name="Concepts" component={ConceptsScreen} />
      <Stack.Screen name="ReportesExport" component={ReportesExportScreen} />
      <Stack.Screen name="Metas" component={MetasScreen} />
      <Stack.Screen name="CreateMeta" component={CreateMetaScreen} />
      <Stack.Screen name="MetaDetail" component={MetaDetailScreen} />
      <Stack.Screen name="BlocCuentas" component={BlocCuentasScreen} />
      <Stack.Screen name="BlocDetail" component={BlocDetailScreen} />
      <Stack.Screen name="SharedSpaces" component={SharedSpacesScreen} />
      <Stack.Screen name="SpaceDetail" component={SpaceDetailScreen} />
      <Stack.Screen name="SharedMovementDetail" component={SharedMovementDetailScreen} />
      <Stack.Screen name="SharedNotifications" component={SharedNotificationsScreen} />
      <Stack.Screen name="QRScanner" component={QRScannerScreen} />
      <Stack.Screen name="TicketScan" component={TicketScanScreen} />
      <Stack.Screen name="TicketReview" component={TicketReviewScreen} />
      <Stack.Screen name="TicketManual" component={TicketManualScreen} />
      <Stack.Screen name="TicketScanHistory" component={TicketScanHistoryScreen} />
      <Stack.Screen name="TicketScanDetail" component={TicketScanDetailScreen} />
    </Stack.Navigator>
  );
}
