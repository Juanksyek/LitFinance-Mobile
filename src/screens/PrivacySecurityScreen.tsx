import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Modal,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuth from 'expo-local-authentication';
import Toast from 'react-native-toast-message';
import { useNavigation } from '@react-navigation/native';

import { useTheme } from '../theme/ThemeContext';
import { useThemeColors } from '../theme/useThemeColors';
import { authService } from '../services/authService';
import EventBus from '../utils/eventBus';

type AutoLockValue = 'off' | 'immediate' | '30s' | '1m' | '5m' | '10m';

const PS_KEYS = {
  useBiometrics: 'ps_useBiometrics',
  hideAppSwitcher: 'ps_hideAppSwitcher',
  securityLoginAlerts: 'ps_securityLoginAlerts',
  shareCrashReports: 'ps_shareCrashReports',
  discreetMode: 'ps_discreetMode',
  autoLock: 'ps_autoLock',
} as const;

const PIN_KEY = 'ps_pin_v1';

const autoLockOptions: { value: AutoLockValue; label: string; subtitle: string }[] = [
  { value: 'off', label: 'No bloquear', subtitle: 'No se bloquea automáticamente' },
  { value: 'immediate', label: 'Inmediato', subtitle: 'Se bloquea al salir de la app' },
  { value: '30s', label: '30 s', subtitle: 'Tras 30 segundos en segundo plano' },
  { value: '1m', label: '1 min', subtitle: 'Tras 1 minuto en segundo plano' },
  { value: '5m', label: '5 min', subtitle: 'Tras 5 minutos en segundo plano' },
  { value: '10m', label: '10 min', subtitle: 'Tras 10 minutos en segundo plano' },
];

function formatAutoLock(value: AutoLockValue | null | undefined) {
  const opt = autoLockOptions.find((o) => o.value === value);
  return opt?.label ?? 'No bloquear';
}

function isValidPin(pin: string) {
  return /^\d{4,6}$/.test(pin);
}

export default function PrivacySecurityScreen() {
  const navigation = useNavigation();
  const { isDark } = useTheme();
  const colors = useThemeColors();

  // Entrance animations
  const headerOpacity = useRef(new Animated.Value(0)).current;
  const sectionAnims = useRef(
    Array.from({ length: 6 }, () => ({
      opacity: new Animated.Value(0),
      translateY: new Animated.Value(18),
    }))
  ).current;

  const [useBiometrics, setUseBiometrics] = useState(false);
  const [hideAppSwitcher, setHideAppSwitcher] = useState(false);

  const [securityLoginAlerts, setSecurityLoginAlerts] = useState(true);

  const [shareCrashReports, setShareCrashReports] = useState(true);

  const [discreetMode, setDiscreetMode] = useState(false);

  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [loggingOutAll, setLoggingOutAll] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  const [autoLock, setAutoLock] = useState<AutoLockValue>('off');
  const [autoLockModalVisible, setAutoLockModalVisible] = useState(false);

  const [pinConfigured, setPinConfigured] = useState(false);
  const [pinModalVisible, setPinModalVisible] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinConfirmInput, setPinConfirmInput] = useState('');
  const [pinStep, setPinStep] = useState<'set' | 'confirm'>('set');

  const headerTitle = 'Privacidad y seguridad';

  const notifyPrivacySecurityChanged = useCallback(() => {
    EventBus.emit('privacySecurity:changed');
  }, []);

  const loadSettings = useCallback(async () => {
    try {
      const entries = await AsyncStorage.multiGet([
        PS_KEYS.useBiometrics,
        PS_KEYS.hideAppSwitcher,
        PS_KEYS.securityLoginAlerts,
        PS_KEYS.shareCrashReports,
        PS_KEYS.discreetMode,
        PS_KEYS.autoLock,
      ]);

      const map = new Map(entries);
      setUseBiometrics(map.get(PS_KEYS.useBiometrics) === '1');
      setHideAppSwitcher(map.get(PS_KEYS.hideAppSwitcher) === '1');

      setSecurityLoginAlerts(map.get(PS_KEYS.securityLoginAlerts) !== '0');

      setShareCrashReports(map.get(PS_KEYS.shareCrashReports) !== '0');

      setDiscreetMode(map.get(PS_KEYS.discreetMode) === '1');

      const storedAutoLock = (map.get(PS_KEYS.autoLock) as AutoLockValue | null) ?? 'off';
      setAutoLock(autoLockOptions.some((o) => o.value === storedAutoLock) ? storedAutoLock : 'off');
    } catch (e) {
      console.warn('[PrivacySecurity] loadSettings error', e);
    }

    try {
      const storedPin = await SecureStore.getItemAsync(PIN_KEY);
      setPinConfigured(!!storedPin);
    } catch (e) {
      setPinConfigured(false);
    }

    try {
      const userData = await AsyncStorage.getItem('userData');
      if (userData) {
        const parsed = JSON.parse(userData);
        setUserEmail(parsed.email || parsed.correo || null);
      }
    } catch {}
  }, []);

  useEffect(() => {
    loadSettings();

    // Entrance animations
    Animated.timing(headerOpacity, { toValue: 1, duration: 350, useNativeDriver: true }).start();
    const sectionSequence = sectionAnims.map((anim, i) =>
      Animated.parallel([
        Animated.timing(anim.opacity, { toValue: 1, duration: 380, delay: 80 + i * 60, useNativeDriver: true }),
        Animated.timing(anim.translateY, { toValue: 0, duration: 380, delay: 80 + i * 60, useNativeDriver: true }),
      ])
    );
    Animated.parallel(sectionSequence).start();
  }, [loadSettings]);

  const persistBool = useCallback(async (key: string, next: boolean) => {
    try {
      await AsyncStorage.setItem(key, next ? '1' : '0');
    } catch (e) {
      console.warn('[PrivacySecurity] persistBool error', key, e);
    }
  }, []);

  const persistAutoLock = useCallback(async (next: AutoLockValue) => {
    try {
      await AsyncStorage.setItem(PS_KEYS.autoLock, next);
    } catch (e) {
      console.warn('[PrivacySecurity] persistAutoLock error', e);
    }
  }, []);

  const onToggleBiometrics = useCallback(async (next: boolean) => {
    if (!next) {
      setUseBiometrics(false);
      await persistBool(PS_KEYS.useBiometrics, false);
      notifyPrivacySecurityChanged();
      return;
    }

    // Habilitar biometría si el dispositivo lo soporta.
    try {
      const hasHardware = await LocalAuth.hasHardwareAsync();
      const isEnrolled = await LocalAuth.isEnrolledAsync();

      if (!hasHardware || !isEnrolled) {
        Alert.alert(
          'No disponible',
          'Tu dispositivo no tiene biometría configurada. Configura FaceID/TouchID y vuelve a intentar.'
        );
        setUseBiometrics(false);
        await persistBool(PS_KEYS.useBiometrics, false);
        notifyPrivacySecurityChanged();
        return;
      }

      const result = await LocalAuth.authenticateAsync({
        promptMessage: 'Confirmar biometría',
        cancelLabel: 'Cancelar',
        fallbackLabel: 'Usar código',
      });

      if (!result.success) {
        setUseBiometrics(false);
        await persistBool(PS_KEYS.useBiometrics, false);
        notifyPrivacySecurityChanged();
        return;
      }

      setUseBiometrics(true);
      await persistBool(PS_KEYS.useBiometrics, true);
      notifyPrivacySecurityChanged();
      Toast.show({ type: 'success', text1: 'Biometría activada' });
    } catch (e) {
      Alert.alert(
        'No disponible',
        'No se pudo inicializar biometría en este build. (Requiere expo-local-authentication)'
      );
      setUseBiometrics(false);
      await persistBool(PS_KEYS.useBiometrics, false);
      notifyPrivacySecurityChanged();
    }
  }, [notifyPrivacySecurityChanged, persistBool]);

  const openAutoLockPicker = useCallback(() => {
    setAutoLockModalVisible(true);
  }, []);

  const closeAutoLockModal = useCallback(() => {
    setAutoLockModalVisible(false);
  }, []);

  const selectAutoLock = useCallback(
    async (value: AutoLockValue) => {
      setAutoLock(value);
      await persistAutoLock(value);
      notifyPrivacySecurityChanged();
      Toast.show({ type: 'success', text1: 'Auto-bloqueo actualizado', text2: formatAutoLock(value) });
      setAutoLockModalVisible(false);
    },
    [notifyPrivacySecurityChanged, persistAutoLock]
  );

  const openPinModal = useCallback(() => {
    setPinInput('');
    setPinConfirmInput('');
    setPinStep('set');
    setPinModalVisible(true);
  }, []);

  const closePinModal = useCallback(() => {
    setPinModalVisible(false);
  }, []);

  const savePinStep = useCallback(async () => {
    if (pinStep === 'set') {
      if (!isValidPin(pinInput)) {
        Toast.show({
          type: 'error',
          text1: 'PIN inválido',
          text2: 'Usa 4 a 6 dígitos.',
        });
        return;
      }
      setPinStep('confirm');
      return;
    }

    // confirm
    if (pinConfirmInput !== pinInput) {
      Toast.show({ type: 'error', text1: 'No coincide', text2: 'Confirma el mismo PIN.' });
      return;
    }

    try {
      await SecureStore.setItemAsync(PIN_KEY, pinInput, {
        keychainAccessible: SecureStore.WHEN_UNLOCKED,
      });
      setPinConfigured(true);
      closePinModal();
      notifyPrivacySecurityChanged();
      Toast.show({ type: 'success', text1: 'PIN configurado' });
    } catch (e) {
      console.warn('[PrivacySecurity] save pin error', e);
      Toast.show({ type: 'error', text1: 'Error', text2: 'No se pudo guardar el PIN.' });
    }
  }, [closePinModal, notifyPrivacySecurityChanged, pinConfirmInput, pinInput, pinStep]);

  const disablePin = useCallback(() => {
    Alert.alert('Desactivar PIN', '¿Seguro que deseas desactivar el PIN?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Desactivar',
        style: 'destructive',
        onPress: async () => {
          try {
            await SecureStore.deleteItemAsync(PIN_KEY);
            setPinConfigured(false);
            notifyPrivacySecurityChanged();
            Toast.show({ type: 'success', text1: 'PIN desactivado' });
          } catch (e) {
            Toast.show({ type: 'error', text1: 'Error', text2: 'No se pudo desactivar el PIN.' });
          }
        },
      },
    ]);
  }, [notifyPrivacySecurityChanged]);

  const logoutThisDevice = useCallback(() => {
    Alert.alert('Cerrar sesión', '¿Deseas cerrar sesión en este dispositivo?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Cerrar sesión',
        style: 'destructive',
        onPress: async () => {
          try {
            await authService.clearAll();
            await AsyncStorage.removeItem('userData');
            Toast.show({ type: 'success', text1: 'Sesión cerrada' });
            (navigation as any).reset({ index: 0, routes: [{ name: 'Login' }] });
          } catch {
            Toast.show({ type: 'error', text1: 'Error', text2: 'No se pudo cerrar sesión.' });
          }
        },
      },
    ]);
  }, [navigation]);

  const logoutAllDevices = useCallback(() => {
    Alert.alert(
      'Cerrar sesión en todos los dispositivos',
      'Se cerrará tu sesión en este y todos los demás dispositivos. Tendrás que volver a iniciar sesión.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cerrar todas',
          style: 'destructive',
          onPress: async () => {
            setLoggingOutAll(true);
            try {
              await authService.logoutDevice();
              await authService.clearAll();
              await AsyncStorage.removeItem('userData');
              Toast.show({ type: 'success', text1: 'Sesiones cerradas', text2: 'Se cerró la sesión en todos los dispositivos.' });
              (navigation as any).reset({ index: 0, routes: [{ name: 'Login' }] });
            } catch {
              Toast.show({ type: 'error', text1: 'Error', text2: 'No se pudo cerrar las sesiones.' });
            } finally {
              setLoggingOutAll(false);
            }
          },
        },
      ]
    );
  }, [navigation]);

  const navigateDeleteAccount = useCallback(() => {
    (navigation as any).navigate('DeleteAccount');
  }, [navigation]);

  const handleChangePassword = useCallback(async () => {
    if (!userEmail) {
      Toast.show({ type: 'error', text1: 'Error', text2: 'No se encontró tu correo electrónico.' });
      return;
    }
    Alert.alert(
      'Cambiar contraseña',
      `Se enviará un código de verificación a ${userEmail} para iniciar el cambio de contraseña.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Enviar código',
          onPress: async () => {
            setChangingPassword(true);
            try {
              const { passwordResetService } = await import('../services/passwordResetService');
              await passwordResetService.requestOtp(userEmail);
              Toast.show({ type: 'success', text1: 'Código enviado', text2: `Revisa tu correo ${userEmail}` });
              (navigation as any).navigate('VerifyOtp', { email: userEmail });
            } catch {
              Toast.show({ type: 'error', text1: 'Error', text2: 'No se pudo enviar el código.' });
            } finally {
              setChangingPassword(false);
            }
          },
        },
      ]
    );
  }, [navigation, userEmail]);

  const openSystemSettings = useCallback(async () => {
    try {
      await Linking.openSettings();
    } catch {
      Toast.show({ type: 'error', text1: 'No disponible' });
    }
  }, []);

  const SectionTitle = ({ children }: { children: string }) => (
    <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{children}</Text>
  );

  const Card = ({ children }: { children: React.ReactNode }) => (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.shadow }]}>
      {children}
    </View>
  );

  const Row = useMemo(() => {
    return function RowInner({
      icon,
      title,
      description,
      right,
      onPress,
      danger,
    }: {
      icon: React.ComponentProps<typeof Ionicons>['name'];
      title: string;
      description?: string;
      right?: React.ReactNode;
      onPress?: () => void;
      danger?: boolean;
    }) {
      return (
        <TouchableOpacity
          activeOpacity={onPress ? 0.7 : 1}
          onPress={onPress}
          disabled={!onPress}
          style={[styles.row, { borderColor: colors.border }, danger && { borderColor: 'rgba(244,67,54,0.25)' }]}
        >
          <View style={styles.rowLeft}>
            <Ionicons name={icon} size={20} color={danger ? colors.error : colors.textSecondary} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowTitle, { color: danger ? colors.error : colors.text }]}>{title}</Text>
              {!!description && <Text style={[styles.rowDesc, { color: colors.textTertiary }]}>{description}</Text>}
            </View>
          </View>
          <View style={styles.rowRight}>{right}</View>
        </TouchableOpacity>
      );
    };
  }, [colors.border, colors.error, colors.shadow, colors.text, colors.textSecondary, colors.textTertiary]);

  const Toggle = ({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) => (
    <TouchableOpacity
      onPress={() => onChange(!value)}
      activeOpacity={0.8}
      style={[
        styles.togglePill,
        {
          backgroundColor: value ? colors.success : colors.cardSecondary,
          borderColor: value ? colors.success : colors.border,
        },
      ]}
    >
      <Text style={[styles.toggleText, { color: value ? '#fff' : colors.textSecondary }]}>
        {value ? 'Activo' : 'Inactivo'}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      <Animated.View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border, opacity: headerOpacity }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
          {headerTitle}
        </Text>
        <View style={styles.placeholder} />
      </Animated.View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <Animated.View style={[styles.section, { opacity: sectionAnims[0].opacity, transform: [{ translateY: sectionAnims[0].translateY }] }]}>
          <SectionTitle>Bloqueo</SectionTitle>

          <Card>
            <Row
              icon="finger-print"
              title="Bloqueo con biometría"
              description="Usar FaceID/TouchID para abrir la app"
              right={<Toggle value={useBiometrics} onChange={onToggleBiometrics} />}
            />

            <Row
              icon="keypad"
              title="PIN / Código de acceso"
              description={pinConfigured ? 'Activo' : 'No configurado'}
              onPress={openPinModal}
              right={
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  {pinConfigured && (
                    <TouchableOpacity onPress={disablePin} activeOpacity={0.8} style={[styles.smallPill, { borderColor: colors.border }]}>
                      <Text style={[styles.smallPillText, { color: colors.textSecondary }]}>Desactivar</Text>
                    </TouchableOpacity>
                  )}
                  <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
                </View>
              }
            />

            <Row
              icon="time-outline"
              title="Auto-bloqueo"
              description="Cuánto tiempo esperar antes de bloquear"
              onPress={openAutoLockPicker}
              right={
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>{formatAutoLock(autoLock)}</Text>
                  <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
                </View>
              }
            />

            <Row
              icon="apps"
              title="Ocultar contenido en el app switcher"
              description="Muestra una pantalla difuminada al cambiar de app"
              right={
                <Toggle
                  value={hideAppSwitcher}
                  onChange={async (v) => {
                    setHideAppSwitcher(v);
                    await persistBool(PS_KEYS.hideAppSwitcher, v);
                    notifyPrivacySecurityChanged();
                  }}
                />
              }
            />
          </Card>
        </Animated.View>

        <Animated.View style={[styles.section, { opacity: sectionAnims[1].opacity, transform: [{ translateY: sectionAnims[1].translateY }] }]}>
          <SectionTitle>Sesiones</SectionTitle>
          <Card>
            <Row
              icon="log-out-outline"
              title="Cerrar sesión en este dispositivo"
              description="Cierra tu sesión actual"
              onPress={logoutThisDevice}
              right={<Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />}
              danger
            />

            <Row
              icon="alert-circle-outline"
              title="Cerrar sesión en todos los dispositivos"
              description="Cierra sesión en todos tus dispositivos vinculados"
              onPress={loggingOutAll ? undefined : logoutAllDevices}
              right={<Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />}
              danger
            />

            <Row
              icon="notifications-outline"
              title="Notificaciones de inicio de sesión"
              description="Avisarme si hay un nuevo inicio de sesión en otro dispositivo"
              right={
                <Toggle
                  value={securityLoginAlerts}
                  onChange={async (v) => {
                    setSecurityLoginAlerts(v);
                    await persistBool(PS_KEYS.securityLoginAlerts, v);
                    notifyPrivacySecurityChanged();
                    Toast.show({ type: 'success', text1: v ? 'Notificaciones activadas' : 'Notificaciones desactivadas' });
                  }}
                />
              }
            />
          </Card>
        </Animated.View>

        <Animated.View style={[styles.section, { opacity: sectionAnims[2].opacity, transform: [{ translateY: sectionAnims[2].translateY }] }]}>
          <SectionTitle>Contraseña y recuperación</SectionTitle>
          <Card>
            <Row
              icon="lock-closed-outline"
              title="Cambiar contraseña"
              description="Actualiza tu contraseña de acceso vía código OTP"
              onPress={changingPassword ? undefined : handleChangePassword}
              right={<Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />}
            />

            <Row
              icon="mail-outline"
              title="Método de recuperación"
              description={userEmail ? `Correo vinculado: ${userEmail}` : 'Correo electrónico vinculado a tu cuenta'}
              right={<Ionicons name="checkmark-circle" size={20} color={colors.success} />}
            />

            <Row
              icon="shield-outline"
              title="Verificación en 2 pasos (2FA)"
              description="Próximamente — seguridad adicional con authenticator"
              right={
                <View style={[styles.smallPill, { borderColor: colors.border }]}>
                  <Text style={[styles.smallPillText, { color: colors.textSecondary }]}>Próximo</Text>
                </View>
              }
            />
          </Card>
        </Animated.View>

        <Animated.View style={[styles.section, { opacity: sectionAnims[3].opacity, transform: [{ translateY: sectionAnims[3].translateY }] }]}>
          <SectionTitle>Cuenta</SectionTitle>
          <Card>
            <Row
              icon="trash-outline"
              title="Eliminar mi cuenta"
              description="Se elimina tu perfil y datos asociados"
              onPress={navigateDeleteAccount}
              right={<Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />}
              danger
            />
          </Card>
        </Animated.View>

        <Animated.View style={[styles.section, { opacity: sectionAnims[4].opacity, transform: [{ translateY: sectionAnims[4].translateY }] }]}>
          <SectionTitle>Analítica y permisos</SectionTitle>
          <Card>
            <Row
              icon="bug-outline"
              title="Enviar reportes de fallos"
              description="Ayuda a mejorar la estabilidad"
              right={
                <Toggle
                  value={shareCrashReports}
                  onChange={async (v) => {
                    setShareCrashReports(v);
                    await persistBool(PS_KEYS.shareCrashReports, v);
                  }}
                />
              }
            />

            <Row
              icon="settings-outline"
              title="Abrir ajustes del sistema"
              description={Platform.OS === 'ios' ? 'Ajustes de iOS' : 'Ajustes de Android'}
              onPress={openSystemSettings}
              right={<Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />}
            />
          </Card>
        </Animated.View>

        <Animated.View style={[styles.section, { opacity: sectionAnims[5].opacity, transform: [{ translateY: sectionAnims[5].translateY }] }]}>
          <SectionTitle>Seguridad extra</SectionTitle>
          <Card>
            <Row
              icon="eye-off-outline"
              title="Modo discreto / ocultar montos"
              description="Ocultar montos por defecto (tap para revelar)"
              right={
                <Toggle
                  value={discreetMode}
                  onChange={async (v) => {
                    setDiscreetMode(v);
                    await persistBool(PS_KEYS.discreetMode, v);
                    notifyPrivacySecurityChanged();
                    Toast.show({ type: 'success', text1: v ? 'Modo discreto activado' : 'Modo discreto desactivado', text2: v ? 'Los montos se ocultarán por defecto' : 'Los montos se mostrarán normalmente' });
                  }}
                />
              }
            />
          </Card>
        </Animated.View>

        <View style={{ height: 28 }} />
      </ScrollView>

      <Modal visible={pinModalVisible} transparent animationType="fade" onRequestClose={closePinModal}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { backgroundColor: colors.modalBackground, shadowColor: colors.shadow }]}
          >
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              {pinConfigured ? 'Cambiar PIN' : 'Configurar PIN'}
            </Text>

            <Text style={[styles.modalDesc, { color: colors.textSecondary }]}>
              {pinStep === 'set'
                ? 'Ingresa un PIN de 4 a 6 dígitos.'
                : 'Confirma el PIN.'}
            </Text>

            <TextInput
              value={pinStep === 'set' ? pinInput : pinConfirmInput}
              onChangeText={(t) => {
                const clean = t.replace(/[^0-9]/g, '').slice(0, 6);
                if (pinStep === 'set') setPinInput(clean);
                else setPinConfirmInput(clean);
              }}
              placeholder={pinStep === 'set' ? 'PIN' : 'Confirmar PIN'}
              placeholderTextColor={colors.placeholder}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={6}
              style={[styles.pinInput, { borderColor: colors.border, color: colors.text, backgroundColor: colors.inputBackground }]}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                onPress={closePinModal}
                activeOpacity={0.8}
                style={[styles.modalBtn, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}
              >
                <Text style={[styles.modalBtnText, { color: colors.textSecondary }]}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={savePinStep}
                activeOpacity={0.85}
                style={[styles.modalBtn, { backgroundColor: colors.button, borderColor: colors.button }]}
              >
                <Text style={[styles.modalBtnText, { color: '#fff' }]}>
                  {pinStep === 'set' ? 'Continuar' : 'Guardar'}
                </Text>
              </TouchableOpacity>
            </View>

            {!!pinConfigured && (
              <TouchableOpacity onPress={disablePin} activeOpacity={0.85} style={{ marginTop: 10 }}>
                <Text style={{ color: colors.error, fontWeight: '700', textAlign: 'center' }}>Desactivar PIN</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>
      
      <Modal visible={autoLockModalVisible} transparent animationType="slide" onRequestClose={closeAutoLockModal}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { backgroundColor: colors.modalBackground, shadowColor: colors.shadow }]}> 
            <Text style={[styles.modalTitle, { color: colors.text }]}>Auto-bloqueo</Text>
            <Text style={[styles.modalDesc, { color: colors.textSecondary, marginBottom: 8 }]}>Selecciona cuánto tiempo esperar antes de bloquear la app.</Text>

            {autoLockOptions.map((o) => (
              <TouchableOpacity
                key={o.value}
                activeOpacity={0.75}
                onPress={() => selectAutoLock(o.value)}
                style={[
                  styles.autoLockOption,
                  { backgroundColor: colors.card, borderColor: colors.border },
                  autoLock === o.value && { borderColor: colors.button, backgroundColor: colors.cardSecondary },
                ]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.autoLockOptionLabel, { color: colors.text }]}>{o.label}</Text>
                  <Text style={[styles.autoLockOptionSub, { color: colors.textSecondary }]}>{o.subtitle}</Text>
                </View>
                {autoLock === o.value && <Ionicons name="checkmark" size={18} color={colors.button} />}
              </TouchableOpacity>
            ))}

            <View style={{ height: 8 }} />
            <View style={styles.modalButtons}>
              <TouchableOpacity onPress={closeAutoLockModal} activeOpacity={0.85} style={[styles.modalBtn, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}>
                <Text style={[styles.modalBtnText, { color: colors.textSecondary }]}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    paddingTop: 60,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: '600', flexShrink: 1 },
  placeholder: { width: 40 },
  scrollView: { flex: 1 },
  section: { marginTop: 24, paddingHorizontal: 16 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
    paddingLeft: 4,
  },
  card: {
    borderRadius: 16,
    paddingVertical: 8,
    paddingHorizontal: 12,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    flex: 1,
    paddingRight: 10,
  },
  rowRight: { alignItems: 'flex-end', justifyContent: 'center' },
  rowTitle: { fontSize: 15, fontWeight: '600' },
  rowDesc: { fontSize: 12, marginTop: 3, lineHeight: 16 },

  togglePill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  toggleText: { fontSize: 12, fontWeight: '800' },

  smallPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  smallPillText: { fontSize: 12, fontWeight: '800' },

  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 16,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 18,
    padding: 18,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', textAlign: 'center' },
  modalDesc: { fontSize: 13, marginTop: 8, textAlign: 'center' },
  pinInput: {
    marginTop: 14,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 2,
    textAlign: 'center',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 14,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
  },
  modalBtnText: { fontSize: 14, fontWeight: '800' },
  autoLockOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
    minHeight: 56,
  },
  autoLockOptionLabel: { fontSize: 15, fontWeight: '700' },
  autoLockOptionSub: { fontSize: 12, marginTop: 4 },
});
