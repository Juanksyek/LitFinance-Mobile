import React, { useEffect, useMemo, useState, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Animated } from 'react-native';
import Toast from 'react-native-toast-message';
import OtpInput from '../components/OtpInput';
import { passwordResetService } from '../services/passwordResetService';
import { useThemeColors } from '../theme/useThemeColors';
import { useNavigation, useRoute, NavigationProp, RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../navigation/AppNavigator';
import { fixEncoding } from '../utils/fixEncoding';

export default function VerifyOtpScreen() {
  const colors = useThemeColors();
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'VerifyOtp'>>();
  const email = route.params?.email || '';

  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);

  const [cooldown, setCooldown] = useState(60); // 60s
  const canResend = cooldown <= 0;
  
  // Animaciones
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  const theme = useMemo(() => {
    const bg = colors.background;
    const shadowDark = 'rgba(0, 0, 0, 0.35)';
    const shadowLight = 'rgba(255, 255, 255, 0.18)';
    const borderSoft = 'rgba(255, 255, 255, 0.08)';
    const surface = colors.inputBackground ?? bg;
    const accent = '#EF7725';
    return { bg, surface, shadowDark, shadowLight, borderSoft, accent };
  }, [colors]);

  useEffect(() => {
    // Animaciones de entrada
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 40,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();

    // Timer
    const t = setInterval(() => setCooldown((c) => (c > 0 ? c - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    // Animación de progreso
    Animated.timing(progressAnim, {
      toValue: cooldown / 60,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [cooldown]);

  const handleVerify = async (code?: string) => {
    const finalCode = (code ?? otp).trim();
    if (finalCode.length < 6) {
      Toast.show({ type: 'error', text1: fixEncoding('Código incompleto'), text2: fixEncoding('Ingresa los 6 dígitos') });
      return;
    }

    setLoading(true);
    try {
      const { resetToken } = await passwordResetService.verifyOtp(email, finalCode);
      navigation.navigate('ResetPassword', { resetToken });
    } catch (err: any) {
      Toast.show({ type: 'error', text1: fixEncoding('Error'), text2: fixEncoding(err.message || 'Código inválido o expirado') });
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!canResend) return;

    setLoading(true);
    try {
      await passwordResetService.requestOtp(email);
      Toast.show({ type: 'success', text1: fixEncoding('Enviado'), text2: fixEncoding('Si el correo existe, reenviamos el código.') });
      setCooldown(60);
      setOtp('');
    } catch (err: any) {
      Toast.show({ type: 'error', text1: fixEncoding('Error'), text2: fixEncoding(err.message || 'No se pudo reenviar') });
    } finally {
      setLoading(false);
    }
  };

  const maskedEmail = useMemo(() => {
    if (!email) return '';
    const [user, domain] = email.split('@');
    if (!domain) return email;
    const u = user.length <= 2 ? user[0] + '*' : user[0] + '*'.repeat(Math.max(1, user.length - 2)) + user.slice(-1);
    return `${u}@${domain}`;
  }, [email]);

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Animated.View
          style={[
            styles.neuCard,
            {
              backgroundColor: theme.surface,
              shadowColor: theme.shadowDark,
              borderColor: theme.borderSoft,
              opacity: fadeAnim,
              transform: [
                { translateY: slideAnim },
                { scale: scaleAnim }
              ]
            },
          ]}
        >
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]}>{fixEncoding('Verifica el código')}</Text>
            <Text style={[styles.subtitle, { color: colors.placeholder }]}>
              {fixEncoding('Lo enviamos a: ')}
              <Text style={{ color: colors.text, fontWeight: '600' }}>{maskedEmail}</Text>
            </Text>
          </View>

          <View style={{ height: 20 }} />

          <OtpInput
            length={6}
            value={otp}
            onChange={setOtp}
            onComplete={(code) => handleVerify(code)}
            disabled={loading}
          />

          <View style={{ height: 24 }} />

          <TouchableOpacity
            style={[
              styles.button, 
              { backgroundColor: theme.accent },
              loading && { opacity: 0.75 }
            ]}
            onPress={() => handleVerify()}
            disabled={loading}
            activeOpacity={0.9}
          >
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator color="#fff" size="small" />
                <Text style={[styles.buttonText, { marginLeft: 10 }]}>{fixEncoding('Verificando...')}</Text>
              </View>
            ) : (
              <Text style={styles.buttonText}>{fixEncoding('Verificar')}</Text>
            )}
          </TouchableOpacity>

          <View style={{ height: 14 }} />

          <TouchableOpacity
            onPress={handleResend}
            disabled={!canResend || loading}
            style={[styles.resendBtn, (!canResend || loading) && { opacity: 0.5 }]}
            activeOpacity={0.85}
          >
            <View style={styles.resendContent}>
              {!canResend && (
                <View style={styles.progressRing}>
                  <Animated.View 
                    style={[
                      styles.progressFill,
                      {
                        transform: [{
                          rotate: progressAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: ['0deg', '360deg']
                          })
                        }],
                        borderColor: theme.accent,
                      }
                    ]}
                  />
                </View>
              )}
              <Text style={[styles.resendText, { color: colors.textSecondary }]}>
                {canResend ? fixEncoding('Reenviar código') : fixEncoding(`Reenviar en ${cooldown}s`)}
              </Text>
            </View>
          </TouchableOpacity>

          <View style={{ height: 14 }} />

          <TouchableOpacity
            style={[styles.backContainer, { backgroundColor: colors.inputBackground }]}
            onPress={() => navigation.goBack()}
          >
            <Text style={[styles.backText, { color: colors.placeholder }]}>{fixEncoding('← Volver')}</Text>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 20 },
  neuCard: {
    borderRadius: 26,
    padding: 28,
    borderWidth: 1,
    shadowOffset: { width: -8, height: -8 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 6,
  },
  header: { marginBottom: 10 },
  title: { fontSize: 24, fontWeight: '800', marginBottom: 8, letterSpacing: -0.5 },
  subtitle: { fontSize: 14, lineHeight: 20, letterSpacing: -0.2 },
  button: {
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '800', letterSpacing: 0.3 },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resendBtn: { alignItems: 'center', paddingVertical: 12 },
  resendContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  progressRing: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: 'rgba(239, 119, 37, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressFill: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderTopWidth: 2,
    borderRightWidth: 2,
    borderBottomWidth: 0,
    borderLeftWidth: 0,
  },
  resendText: { fontSize: 13, fontWeight: '700' },
  backContainer: {
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  backText: { fontSize: 14, fontWeight: '700' },
});
