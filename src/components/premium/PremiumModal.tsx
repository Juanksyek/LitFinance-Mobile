import React, { useEffect, useMemo, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useStripe } from '@stripe/stripe-react-native';
import { STRIPE_PRICES } from '../constants/stripe';
import Toast from 'react-native-toast-message';
import { useThemeColors } from '../theme/useThemeColors';
import { logger } from '../../shared/monitoring/logger';
import {
  paymentsService,
  type CuentaPremiumStatus,
  type PaymentMethodSummary,
} from '../../services/paymentsService';

type Props = {
  visible: boolean;
  onClose: () => void;
  token: string;
  onRefresh?: () => void;
};

export default function PremiumModal({ visible, onClose, token, onRefresh }: Props) {
  const colors = useThemeColors();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const [loading, setLoading] = useState(false);
  const [manageLoading, setManageLoading] = useState(false);
  const [statusText, setStatusText] = useState<string | null>(null);
  const [cuenta, setCuenta] = useState<CuentaPremiumStatus | null>(null);
  const [cuentaLoading, setCuentaLoading] = useState(false);

  const loadCuenta = async (): Promise<CuentaPremiumStatus | null> => {
    try {
      const normalized = await paymentsService.getCuentaPremiumStatus();
      setCuenta(normalized);
      return normalized;
    } catch (error) {
      logger.warn('[PremiumModal] No se pudo cargar cuenta premium', {
        message: (error as any)?.message,
      });
      setCuenta(null);
      return null;
    }
  };

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;

    (async () => {
      setCuentaLoading(true);
      try {
        const normalized = await paymentsService.getCuentaPremiumStatus();
        if (!cancelled) setCuenta(normalized);
      } catch (error) {
        logger.warn('[PremiumModal] Error cargando cuenta al abrir modal', {
          message: (error as any)?.message,
        });
        if (!cancelled) setCuenta(null);
      } finally {
        if (!cancelled) setCuentaLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [visible, token]);

  const isPremium = useMemo(() => {
    return !!(
      cuenta?.premiumSubscriptionStatus === 'active' ||
      cuenta?.premiumSubscriptionStatus === 'trialing' ||
      (cuenta?.premiumUntil && new Date(cuenta.premiumUntil) > new Date())
    );
  }, [cuenta]);

  const daysRemaining = useMemo(() => {
    if (!cuenta?.premiumUntil) return 0;
    const diff = new Date(cuenta.premiumUntil).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }, [cuenta]);

  const renewalDate = useMemo(() => {
    if (!cuenta?.premiumUntil) return null;
    return new Date(cuenta.premiumUntil).toLocaleDateString('es-MX', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }, [cuenta]);

  useEffect(() => {
    if (!visible || cuentaLoading || !cuenta) return;
    logger.info('[PremiumModal] Estado premium cargado', {
      daysRemaining,
      isPremium,
      renewalDate,
    });
  }, [visible, cuentaLoading, isPremium, daysRemaining, renewalDate, cuenta]);

  const fetchPaymentMethods = async (): Promise<PaymentMethodSummary[]> => {
    const pmData = await paymentsService.getPaymentMethods();
    return Array.isArray(pmData?.paymentMethods)
      ? (pmData.paymentMethods as PaymentMethodSummary[])
      : [];
  };

  const addCardWithSetupIntent = async () => {
    const data = await paymentsService.createSetupIntent();
    if (!data.customerId || !data.customerEphemeralKeySecret || !data.setupIntentClientSecret) {
      throw new Error('Respuesta inválida al preparar la tarjeta');
    }

    const init = await initPaymentSheet({
      merchantDisplayName: 'LitFinance',
      customerId: data.customerId,
      customerEphemeralKeySecret: data.customerEphemeralKeySecret,
      setupIntentClientSecret: data.setupIntentClientSecret,
      allowsDelayedPaymentMethods: false,
      returnURL: 'litfinance://payment-success',
    });

    if (init.error) throw new Error(init.error.message);

    const present = await presentPaymentSheet();
    if (present.error) {
      if (present.error.code === 'Canceled') {
        throw new Error('Cancelado por el usuario');
      }
      throw new Error(present.error.message);
    }
  };

  const subscribeWithPaymentSheet = async (priceId: string, paymentMethodId: string) => {
    const data = await paymentsService.createSubscriptionPayment(priceId, paymentMethodId);
    if (!data.customerId || !data.ephemeralKeySecret || !data.paymentIntentClientSecret) {
      throw new Error('Respuesta inválida al preparar la suscripción');
    }

    const init = await initPaymentSheet({
      merchantDisplayName: 'LitFinance',
      customerId: data.customerId,
      customerEphemeralKeySecret: data.ephemeralKeySecret,
      paymentIntentClientSecret: data.paymentIntentClientSecret,
      allowsDelayedPaymentMethods: false,
      returnURL: 'litfinance://payment-success',
    });

    if (init.error) throw new Error(init.error.message);

    const present = await presentPaymentSheet();
    if (present.error) {
      if (present.error.code === 'Canceled') {
        throw new Error('Cancelado por el usuario');
      }
      throw new Error(present.error.message);
    }

    return data;
  };

  const pollPremiumStatus = async (maxMs = 45000, intervalMs = 1200) => {
    const start = Date.now();

    while (Date.now() - start < maxMs) {
      try {
        const normalized = await paymentsService.getCuentaPremiumStatus();
        const premiumActive =
          normalized?.premiumSubscriptionStatus === 'active' ||
          (normalized?.premiumUntil && new Date(normalized.premiumUntil).getTime() > Date.now());

        if (premiumActive) {
          setCuenta(normalized);
          return normalized;
        }
      } catch (error) {
        logger.warn('[PremiumModal] Poll premium falló', {
          message: (error as any)?.message,
        });
      }

      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }

    return null;
  };

  const cancelAtPeriodEnd = useMemo(() => {
    return !!(
      cuenta?.cancelAtPeriodEnd ||
      cuenta?.subscriptionCancelAtPeriodEnd ||
      cuenta?.premiumCancelAtPeriodEnd ||
      cuenta?.stripeCancelAtPeriodEnd
    );
  }, [cuenta]);

  const openBillingPortal = async () => {
    setManageLoading(true);
    try {
      const data = await paymentsService.getBillingPortalSession();
      const url = data?.url;
      if (!url) throw new Error('No se recibió URL del portal');
      await Linking.openURL(url);
    } catch (e: any) {
      logger.error('[PremiumModal] Error abriendo billing portal', {
        message: e?.message,
      });
      Toast.show({ type: 'error', text1: 'Error', text2: e?.message || 'No se pudo abrir el portal' });
    } finally {
      setManageLoading(false);
    }
  };

  const cancelRenewal = async () => {
    setManageLoading(true);
    try {
      await paymentsService.cancelRenewal();

      Toast.show({
        type: 'success',
        text1: 'Renovación cancelada',
        text2: 'Seguirás con premium hasta la fecha de vencimiento.',
      });

      const updated = await pollPremiumStatus(8000, 800);
      if (updated) setCuenta(updated);
      onRefresh?.();
    } catch (e: any) {
      logger.error('[PremiumModal] Error cancelando renovación', {
        message: e?.message,
      });
      Toast.show({ type: 'error', text1: 'Error', text2: e?.message || 'No se pudo cancelar' });
    } finally {
      setManageLoading(false);
    }
  };

  const resumeRenewal = async () => {
    setManageLoading(true);
    try {
      await paymentsService.resumeRenewal();

      Toast.show({
        type: 'success',
        text1: 'Renovación reactivada',
        text2: 'Tu suscripción seguirá renovándose automáticamente.',
      });

      const updated = await pollPremiumStatus(8000, 800);
      if (updated) setCuenta(updated);
      onRefresh?.();
    } catch (e: any) {
      logger.error('[PremiumModal] Error reactivando renovación', {
        message: e?.message,
      });
      Toast.show({ type: 'error', text1: 'Error', text2: e?.message || 'No se pudo reactivar' });
    } finally {
      setManageLoading(false);
    }
  };

  const subscribe = async (priceId: string, planName: string) => {
    if (!token) {
      Toast.show({ type: 'error', text1: 'Error', text2: 'No se pudo verificar tu sesión. Intenta de nuevo.' });
      return;
    }
    setLoading(true);
    setStatusText('Preparando pago…');
    try {
      setStatusText('Revisando método de pago…');
      let paymentMethods: PaymentMethodSummary[] = [];
      try {
        paymentMethods = await fetchPaymentMethods();
      } catch {
        paymentMethods = [];
      }

      if (!paymentMethods.length) {
        setStatusText('Agregando tarjeta…');
        await addCardWithSetupIntent();
        setStatusText('Guardando tarjeta…');
        paymentMethods = await fetchPaymentMethods();
      }

      if (!paymentMethods.length) {
        throw new Error('No se encontró un método de pago guardado');
      }

      const paymentMethodId = String(paymentMethods[0].id || '');
      if (!paymentMethodId) {
        throw new Error('No se encontró un método de pago válido');
      }

      setStatusText('Confirmando pago…');
      await subscribeWithPaymentSheet(priceId, paymentMethodId);

      setStatusText('Activando Premium…');
      const updated = await pollPremiumStatus();

      Toast.show({
        type: 'success',
        text1: 'Pago completado',
        text2: updated ? `Premium activo: ${planName}` : 'Tu cuenta se está actualizando',
      });

      await loadCuenta();
      onClose();
      onRefresh?.();
    } catch (e: any) {
      const errorMsg = e?.message || (typeof e === 'string' ? e : 'Error desconocido');
      logger.error('[PremiumModal] Error en flujo premium', {
        message: errorMsg,
      });

      if (errorMsg.includes('Cancelado')) {
        Toast.show({
          type: 'info',
          text1: 'Operación cancelada',
          text2: 'Puedes intentarlo de nuevo cuando quieras',
        });
      } else {
        Toast.show({
          type: 'error',
          text1: 'Error en el pago',
          text2: errorMsg,
        });
      }
    } finally {
      setLoading(false);
      setStatusText(null);
    }
  };

  // Renderizar el modal y los botones de planes
  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={[styles.overlay, { backgroundColor: 'rgba(0,0,0,0.6)' }]}> 
        <View style={[styles.container, { backgroundColor: colors.card }]}> 
          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Header */}
            <View style={styles.header}>
              <Ionicons name="sparkles" size={32} color="#f59e0b" />
              <Text style={[styles.title, { color: colors.text }]}> 
                {isPremium ? 'Tus beneficios premium' : 'LitFinance Premium'}
              </Text>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {(cuentaLoading || statusText) && (
              <View style={[styles.statusBox, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}> 
                <ActivityIndicator size="small" color={colors.button} />
                <Text style={[styles.statusText, { color: colors.textSecondary }]}> 
                  {statusText || 'Cargando…'}
                </Text>
              </View>
            )}

            {isPremium && !!renewalDate && (
              <>
                {/* Banner de advertencia si faltan pocos días */}
                {daysRemaining <= 5 && daysRemaining > 0 && (
                  <View style={[styles.expiryWarning, { backgroundColor: '#fef3c7', borderColor: '#f59e0b' }]}> 
                    <Ionicons name="alert-circle" size={18} color="#f59e0b" style={{ marginRight: 6 }} />
                    <Text style={[styles.expiryWarningText, { color: '#b45309' }]}>¡Tu premium vence en {daysRemaining} día{daysRemaining === 1 ? '' : 's'}!</Text>
                  </View>
                )}
                <View style={[styles.premiumInfoBox, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}> 
                  <View style={styles.premiumInfoRow}>
                    <Ionicons name="time-outline" size={18} color={colors.textSecondary} />
                    <Text style={[styles.premiumInfoText, { color: colors.text }]}> 
                      Te quedan <Text style={{ fontWeight: 'bold', color: daysRemaining <= 5 ? '#f59e0b' : colors.text }}>{daysRemaining}</Text> día{daysRemaining === 1 ? '' : 's'}
                    </Text>
                  </View>
                  <View style={styles.premiumInfoRow}>
                    <Ionicons name="calendar-outline" size={18} color={colors.textSecondary} />
                    <Text style={[styles.premiumInfoText, { color: colors.text }]}> 
                      Renovación: <Text style={{ fontWeight: 'bold' }}>{renewalDate}</Text>
                    </Text>
                  </View>
                </View>
              </>
            )}

            {isPremium && (
              <View style={styles.plansContainer}>
                <TouchableOpacity
                  style={[styles.planCard, { backgroundColor: colors.cardSecondary, borderColor: colors.border, opacity: manageLoading ? 0.7 : 1 }]}
                  onPress={openBillingPortal}
                  disabled={manageLoading || loading}
                >
                  {manageLoading ? (
                    <ActivityIndicator size="small" color={colors.button} />
                  ) : (
                    <>
                      <View style={styles.planHeader}>
                        <Text style={[styles.planName, { color: colors.text }]}>Administrar suscripción</Text>
                        <Ionicons name="open-outline" size={20} color={colors.button} />
                      </View>
                      <Text style={[styles.planDescription, { color: colors.textSecondary }]}>Abre el portal de Stripe para ver facturas y métodos de pago</Text>
                    </>
                  )}
                </TouchableOpacity>

                {!cancelAtPeriodEnd ? (
                  <TouchableOpacity
                    style={[styles.planCard, { backgroundColor: colors.cardSecondary, borderColor: colors.border, opacity: manageLoading ? 0.7 : 1 }]}
                    onPress={cancelRenewal}
                    disabled={manageLoading || loading}
                  >
                    {manageLoading ? (
                      <ActivityIndicator size="small" color={colors.button} />
                    ) : (
                      <>
                        <View style={styles.planHeader}>
                          <Text style={[styles.planName, { color: colors.text }]}>Cancelar renovación</Text>
                          <Ionicons name="pause-circle-outline" size={20} color={colors.textSecondary} />
                        </View>
                        <Text style={[styles.planDescription, { color: colors.textSecondary }]}>Tu premium seguirá activo hasta {renewalDate ?? 'la fecha de vencimiento'}</Text>
                      </>
                    )}
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={[styles.planCard, { backgroundColor: colors.cardSecondary, borderColor: colors.border, opacity: manageLoading ? 0.7 : 1 }]}
                    onPress={resumeRenewal}
                    disabled={manageLoading || loading}
                  >
                    {manageLoading ? (
                      <ActivityIndicator size="small" color={colors.button} />
                    ) : (
                      <>
                        <View style={styles.planHeader}>
                          <Text style={[styles.planName, { color: colors.text }]}>Reactivar renovación</Text>
                          <Ionicons name="play-circle-outline" size={20} color={colors.textSecondary} />
                        </View>
                        <Text style={[styles.planDescription, { color: colors.textSecondary }]}>Tu suscripción volverá a renovarse automáticamente</Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* Benefits */}
            <View style={styles.benefitsContainer}>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Desbloquea todas las funciones:</Text>
              {[
                'Análisis avanzados ilimitados',
                'Exportación de reportes',
                'Gráficas personalizadas',
                'Sin anuncios',
                'Soporte prioritario',
                'Nuevas funciones primero',
              ].map((benefit, idx) => (
                <View key={idx} style={styles.benefitRow}>
                  <Ionicons name="checkmark-circle" size={20} color="#10b981" />
                  <Text style={[styles.benefitText, { color: colors.text }]}>{benefit}</Text>
                </View>
              ))}
            </View>

            {/* Plans */}
            {!isPremium && (
            <View style={styles.plansContainer}>
              {/* Monthly */}
              <TouchableOpacity
                style={[styles.planCard, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}
                onPress={() => subscribe(STRIPE_PRICES.premiumMonthly, 'Premium Mensual')}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color={colors.button} />
                ) : (
                  <>
                    <View style={styles.planHeader}>
                      <Text style={[styles.planName, { color: colors.text }]}>Premium Mensual</Text>
                      <Ionicons name="calendar-outline" size={20} color={colors.button} />
                    </View>
                    <Text style={[styles.planPrice, { color: colors.button }]}>$39 MXN/mes</Text>
                    <Text style={[styles.planDescription, { color: colors.textSecondary }]}>Acceso completo mensual</Text>
                  </>
                )}
              </TouchableOpacity>

              {/* Yearly - Popular */}
              <TouchableOpacity
                style={[styles.planCard, styles.popularPlan, { backgroundColor: colors.cardSecondary, borderColor: colors.button }]}
                onPress={() => subscribe(STRIPE_PRICES.premiumYearly, 'Premium Anual')}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color={colors.button} />
                ) : (
                  <>
                    <View style={styles.popularBadge}>
                      <Text style={styles.popularText}>Más popular</Text>
                    </View>
                    <View style={styles.planHeader}>
                      <Text style={[styles.planName, { color: colors.text }]}>Premium Anual</Text>
                      <Ionicons name="trophy" size={20} color="#f59e0b" />
                    </View>
                    <Text style={[styles.planPrice, { color: colors.button }]}>$399 MXN/año</Text>
                    <Text style={[styles.planDescription, { color: colors.textSecondary }]}>Ahorra 15% • $33/mes</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
            )}

            {/* Footer */}
            <Text style={[styles.footer, { color: colors.textSecondary }]}>Cancela cuando quieras. Los pagos son procesados de forma segura por Stripe.</Text>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  container: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    flex: 1,
    marginLeft: 12,
  },
  closeButton: {
    padding: 4,
  },
  statusBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 14,
  },
  statusText: {
    fontSize: 13,
    flex: 1,
  },
  premiumInfoBox: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 14,
    gap: 8,
  },
  premiumInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  premiumInfoText: {
    fontSize: 14,
    flex: 1,
  },
  expiryWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    padding: 8,
    marginBottom: 8,
    marginTop: 2,
    gap: 6,
  },
  expiryWarningText: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  benefitsContainer: {
    marginBottom: 24,
  },
  subtitle: {
    fontSize: 14,
    marginBottom: 12,
    fontWeight: '500',
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  benefitText: {
    fontSize: 15,
    marginLeft: 10,
  },
  plansContainer: {
    marginBottom: 20,
  },
  planCard: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 2,
    marginBottom: 12,
  },
  popularPlan: {
    borderWidth: 3,
  },
  popularBadge: {
    position: 'absolute',
    top: -12,
    right: 16,
    backgroundColor: '#f59e0b',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  popularText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  planName: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  planPrice: {
    fontSize: 26,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  planDescription: {
    fontSize: 14,
  },
  footer: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
});
