import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useThemeColors } from '../theme/useThemeColors';
import { useTheme } from '../theme/ThemeContext';
import { authService } from '../services/authService';
import {
  requestAccountDeletion,
  verifyDeletionOtp,
  confirmAccountDeletion,
} from '../services/accountDeletionService';
import Toast from 'react-native-toast-message';

type Step = 'initial' | 'otp' | 'confirm';

export default function DeleteAccountScreen() {
  const navigation = useNavigation();
  const colors = useThemeColors();
  const { isDark } = useTheme();
  const [step, setStep] = useState<Step>('initial');
  const [otp, setOtp] = useState('');
  const [deletionToken, setDeletionToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Entrance animation
  const headerOpacity = useRef(new Animated.Value(0)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const contentSlide = useRef(new Animated.Value(18)).current;
  // Step transition
  const stepOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    loadEmail();
    Animated.sequence([
      Animated.timing(headerOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.parallel([
        Animated.timing(contentOpacity, { toValue: 1, duration: 380, useNativeDriver: true }),
        Animated.timing(contentSlide, { toValue: 0, duration: 380, useNativeDriver: true }),
      ]),
    ]).start();
    return () => {
      if (cooldownRef.current) clearInterval(cooldownRef.current);
    };
  }, []);

  const loadEmail = async () => {
    try {
      const userData = await AsyncStorage.getItem('userData');
      if (userData) {
        const parsed = JSON.parse(userData);
        setEmail(parsed.email || '');
      }
    } catch {}
  };

  const startCooldown = () => {
    setCooldown(60);
    cooldownRef.current = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          if (cooldownRef.current) clearInterval(cooldownRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleRequestOtp = async () => {
    setLoading(true);
    try {
      await requestAccountDeletion();
      setStep('otp');
      // Animate step transition
      stepOpacity.setValue(0);
      Animated.timing(stepOpacity, { toValue: 1, duration: 320, useNativeDriver: true }).start();
      startCooldown();
      Toast.show({
        type: 'info',
        text1: 'Código enviado',
        text2: `Revisa tu correo ${email}`,
        visibilityTime: 4000,
      });
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otp.length !== 6) {
      Alert.alert('Error', 'Ingresa el código de 6 dígitos');
      return;
    }
    setLoading(true);
    try {
      const { deletionToken: dt } = await verifyDeletionOtp(email, otp);
      setDeletionToken(dt);
      setStep('confirm');
      stepOpacity.setValue(0);
      Animated.timing(stepOpacity, { toValue: 1, duration: 320, useNativeDriver: true }).start();
    } catch (err: any) {
      Alert.alert('Código inválido', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmDeletion = () => {
    Alert.alert(
      '⚠️ Última confirmación',
      'Esta acción es IRREVERSIBLE. Se eliminarán permanentemente:\n\n• Tu cuenta y perfil\n• Todas tus transacciones\n• Subcuentas y metas\n• Recurrentes e historial\n• Tickets y soporte\n• Espacios compartidos\n\nSi tienes suscripción premium, se cancelará automáticamente.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar todo',
          style: 'destructive',
          onPress: performDeletion,
        },
      ],
    );
  };

  const performDeletion = async () => {
    setLoading(true);
    try {
      await confirmAccountDeletion(deletionToken);
      Toast.show({
        type: 'success',
        text1: 'Cuenta eliminada',
        text2: 'Tu cuenta y datos han sido eliminados permanentemente.',
        visibilityTime: 5000,
      });
      await authService.triggerLogout();
    } catch (err: any) {
      Alert.alert('Error', err.message);
      setLoading(false);
    }
  };

  const renderStepIndicator = () => (
    <View style={styles.stepsRow}>
      {[1, 2, 3].map((s) => {
        const stepMap: Record<number, Step> = { 1: 'initial', 2: 'otp', 3: 'confirm' };
        const currentIdx = step === 'initial' ? 1 : step === 'otp' ? 2 : 3;
        const isActive = s <= currentIdx;
        return (
          <View key={s} style={styles.stepItem}>
            <View
              style={[
                styles.stepCircle,
                { backgroundColor: isActive ? colors.error : colors.border },
              ]}
            >
              <Text style={[styles.stepNumber, { color: isActive ? '#fff' : colors.textTertiary }]}>
                {s}
              </Text>
            </View>
            <Text style={[styles.stepLabel, { color: isActive ? colors.text : colors.textTertiary }]}>
              {s === 1 ? 'Solicitar' : s === 2 ? 'Verificar' : 'Confirmar'}
            </Text>
            {s < 3 && (
              <View
                style={[
                  styles.stepLine,
                  { backgroundColor: s < currentIdx ? colors.error : colors.border },
                ]}
              />
            )}
          </View>
        );
      })}
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <Animated.View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border, opacity: headerOpacity }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Eliminar cuenta</Text>
        <View style={styles.placeholder} />
      </Animated.View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {renderStepIndicator()}

          <Animated.View style={{ opacity: Animated.multiply(contentOpacity, stepOpacity), transform: [{ translateY: contentSlide }] }}>

          {/* STEP 1: Initial warning */}
          {step === 'initial' && (
            <View style={styles.stepContent}>
              <View style={[styles.warningCard, { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.12)' : '#FEF2F2', borderColor: isDark ? 'rgba(239, 68, 68, 0.3)' : '#FECACA' }]}>
                <Ionicons name="warning" size={32} color={colors.error} style={{ marginBottom: 12 }} />
                <Text style={[styles.warningTitle, { color: colors.error }]}>
                  Zona de peligro
                </Text>
                <Text style={[styles.warningText, { color: isDark ? 'rgba(255,255,255,0.7)' : '#991B1B' }]}>
                  Al eliminar tu cuenta se borrarán permanentemente todos tus datos: cuentas, transacciones, subcuentas, metas, recurrentes, historial, tickets escaneados, espacios compartidos y toda tu información.
                </Text>
                <Text style={[styles.warningText, { color: isDark ? 'rgba(255,255,255,0.7)' : '#991B1B', marginTop: 8 }]}>
                  Si tienes una suscripción premium activa, se cancelará automáticamente.
                </Text>
                <Text style={[styles.warningBold, { color: colors.error, marginTop: 12 }]}>
                  Esta acción NO se puede deshacer.
                </Text>
              </View>

              <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                Para continuar, enviaremos un código de verificación de 6 dígitos a tu correo{' '}
                <Text style={{ fontWeight: '700', color: colors.text }}>{email}</Text>
              </Text>

              <TouchableOpacity
                style={[styles.dangerButton, { opacity: loading ? 0.6 : 1 }]}
                onPress={handleRequestOtp}
                disabled={loading}
                activeOpacity={0.8}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="mail-outline" size={20} color="#fff" />
                    <Text style={styles.dangerButtonText}>Enviar código de verificación</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* STEP 2: OTP verification */}
          {step === 'otp' && (
            <View style={styles.stepContent}>
              <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Ionicons name="mail-open-outline" size={28} color={colors.button} style={{ marginBottom: 8 }} />
                <Text style={[styles.infoCardTitle, { color: colors.text }]}>
                  Código enviado
                </Text>
                <Text style={[styles.infoCardText, { color: colors.textSecondary }]}>
                  Ingresa el código de 6 dígitos que enviamos a{' '}
                  <Text style={{ fontWeight: '700', color: colors.text }}>{email}</Text>
                </Text>
              </View>

              <TextInput
                style={[
                  styles.otpInput,
                  {
                    borderColor: otp.length === 6 ? colors.error : colors.border,
                    color: colors.text,
                    backgroundColor: colors.inputBackground,
                  },
                ]}
                value={otp}
                onChangeText={(text) => setOtp(text.replace(/\D/g, ''))}
                keyboardType="number-pad"
                maxLength={6}
                placeholder="000000"
                placeholderTextColor={colors.placeholder}
                autoFocus
              />

              <TouchableOpacity
                style={[styles.dangerButton, { opacity: loading || otp.length !== 6 ? 0.6 : 1 }]}
                onPress={handleVerifyOtp}
                disabled={loading || otp.length !== 6}
                activeOpacity={0.8}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
                    <Text style={styles.dangerButtonText}>Verificar código</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={cooldown > 0 ? undefined : handleRequestOtp}
                disabled={cooldown > 0 || loading}
                activeOpacity={0.7}
                style={styles.resendButton}
              >
                <Text style={[styles.resendText, { color: cooldown > 0 ? colors.textTertiary : colors.button }]}>
                  {cooldown > 0 ? `Reenviar código en ${cooldown}s` : 'Reenviar código'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* STEP 3: Final confirmation */}
          {step === 'confirm' && (
            <View style={styles.stepContent}>
              <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Ionicons name="shield-checkmark-outline" size={28} color={colors.success} style={{ marginBottom: 8 }} />
                <Text style={[styles.infoCardTitle, { color: colors.text }]}>
                  Identidad verificada
                </Text>
                <Text style={[styles.infoCardText, { color: colors.textSecondary }]}>
                  Tu identidad ha sido verificada correctamente. Presiona el botón para proceder con la eliminación permanente de tu cuenta.
                </Text>
              </View>

              <View style={[styles.deletionSummary, { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.08)' : '#FEF2F2', borderColor: isDark ? 'rgba(239, 68, 68, 0.2)' : '#FECACA' }]}>
                <Text style={[styles.deletionSummaryTitle, { color: colors.error }]}>
                  Se eliminarán:
                </Text>
                {[
                  'Tu cuenta y perfil',
                  'Todas las transacciones',
                  'Subcuentas y sobres',
                  'Metas de ahorro',
                  'Transacciones recurrentes',
                  'Historial completo',
                  'Tickets escaneados',
                  'Espacios compartidos',
                  'Tickets de soporte',
                  'Suscripción premium (si aplica)',
                ].map((item) => (
                  <View key={item} style={styles.deletionItem}>
                    <Ionicons name="close-circle" size={16} color={colors.error} />
                    <Text style={[styles.deletionItemText, { color: colors.textSecondary }]}>{item}</Text>
                  </View>
                ))}
              </View>

              <TouchableOpacity
                style={[styles.finalDeleteButton, { opacity: loading ? 0.6 : 1 }]}
                onPress={handleConfirmDeletion}
                disabled={loading}
                activeOpacity={0.8}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="trash-outline" size={20} color="#fff" />
                    <Text style={styles.dangerButtonText}>Eliminar mi cuenta permanentemente</Text>
                  </>
                )}
              </TouchableOpacity>

              <Text style={[styles.timerNote, { color: colors.textTertiary }]}>
                El token de verificación expira en 15 minutos
              </Text>
            </View>
          )}

          {/* Cancel button — always visible */}
          </Animated.View>
          <TouchableOpacity
            style={[styles.cancelButton, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
          >
            <Text style={[styles.cancelButtonText, { color: colors.text }]}>Cancelar</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
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
  backButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '600' },
  placeholder: { width: 40 },
  content: { padding: 20, paddingBottom: 40 },

  // Step indicator
  stepsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 28,
  },
  stepItem: { flexDirection: 'row', alignItems: 'center' },
  stepCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
  },
  stepNumber: { fontSize: 13, fontWeight: '700' },
  stepLabel: { fontSize: 12, fontWeight: '600' },
  stepLine: { width: 24, height: 2, borderRadius: 1, marginHorizontal: 8 },

  stepContent: { marginBottom: 16 },

  // Warning card (step 1)
  warningCard: {
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    marginBottom: 20,
    alignItems: 'center',
  },
  warningTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  warningText: { fontSize: 14, lineHeight: 21, textAlign: 'center' },
  warningBold: { fontSize: 14, fontWeight: '700', textAlign: 'center' },

  infoText: { fontSize: 14, lineHeight: 21, marginBottom: 20 },

  // Info card (step 2 & 3)
  infoCard: {
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    marginBottom: 20,
    alignItems: 'center',
  },
  infoCardTitle: { fontSize: 16, fontWeight: '700', marginBottom: 6 },
  infoCardText: { fontSize: 14, lineHeight: 21, textAlign: 'center' },

  // OTP input
  otpInput: {
    borderWidth: 2,
    borderRadius: 14,
    fontSize: 32,
    textAlign: 'center',
    letterSpacing: 14,
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginBottom: 20,
    fontWeight: '700',
  },

  // Buttons
  dangerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#DC2626',
    paddingVertical: 16,
    borderRadius: 14,
    gap: 8,
    marginBottom: 12,
  },
  finalDeleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#B91C1C',
    paddingVertical: 16,
    borderRadius: 14,
    gap: 8,
    marginBottom: 8,
  },
  dangerButtonText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  resendButton: { alignItems: 'center', paddingVertical: 10 },
  resendText: { fontSize: 14, fontWeight: '600' },

  cancelButton: {
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 8,
  },
  cancelButtonText: { fontSize: 15, fontWeight: '600' },

  // Deletion summary (step 3)
  deletionSummary: {
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    marginBottom: 20,
  },
  deletionSummaryTitle: { fontSize: 14, fontWeight: '700', marginBottom: 10 },
  deletionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  deletionItemText: { fontSize: 13, fontWeight: '500' },

  timerNote: { fontSize: 12, textAlign: 'center', marginTop: 4 },
});
