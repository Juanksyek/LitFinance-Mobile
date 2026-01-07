import React, { useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, TextInput, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useStripe } from '@stripe/stripe-react-native';
import { TIP_JAR_AMOUNTS } from '../constants/stripe';
import { API_BASE_URL } from '../constants/api';
import Toast from 'react-native-toast-message';
import { useThemeColors } from '../theme/useThemeColors';

type Props = {
  visible: boolean;
  onClose: () => void;
  token: string;
  onRefresh?: () => void;
};

export default function TipJarModal({ visible, onClose, token, onRefresh }: Props) {
  const colors = useThemeColors();
  const stripe = useStripe();
  const [loading, setLoading] = useState(false);
  const [customAmount, setCustomAmount] = useState('');

  const pay = async (amountMXN: number) => {
    if (amountMXN < 10) {
      Toast.show({
        type: 'error',
        text1: 'Monto inválido',
        text2: 'El monto mínimo es $10 MXN',
      });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/stripe/mobile/paymentsheet/tipjar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ amountMXN }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || 'Error al procesar el pago');
      const init = await stripe.initPaymentSheet({
        merchantDisplayName: 'LitFinance',
        customerId: data.customerId,
        customerEphemeralKeySecret: data.ephemeralKeySecret,
        paymentIntentClientSecret: data.paymentIntentClientSecret,
        returnURL: 'litfinance://payment-success',
      });
      if (init.error) throw new Error(init.error.message);
      const present = await stripe.presentPaymentSheet();
      if (present.error) {
        if (present.error.code !== 'Canceled') throw new Error(present.error.message);
        return;
      }
      // Calcular días Premium basado en el monto
      let days = 0;
      if (amountMXN >= 200) days = 90;
      else if (amountMXN >= 100) days = 30;
      else if (amountMXN >= 50) days = 15;
      else if (amountMXN >= 20) days = 7;
      Toast.show({
        type: 'success',
        text1: '¡Gracias por tu apoyo! ❤️',
        text2: days > 0 ? `Has recibido ${days} días de Premium` : 'Tu contribución ayuda mucho',
      });
      onClose();
      setCustomAmount('');
      onRefresh?.();
    } catch (e: any) {
      console.error('TipJar error:', e?.message);
      Toast.show({
        type: 'error',
        text1: 'Error en el pago',
        text2: e?.message || 'Intenta nuevamente',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={[styles.overlay, { backgroundColor: 'rgba(0,0,0,0.6)' }]}> 
        <View style={[styles.container, { backgroundColor: colors.card }]}> 
          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Header */}
            <View style={styles.header}>
              <Ionicons name="heart" size={32} color="#ef4444" />
              <Text style={[styles.title, { color: colors.text }]}>Apoya el desarrollo</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.description, { color: colors.textSecondary }]}>Tu apoyo ayuda a mantener y mejorar LitFinance. Como agradecimiento, recibirás acceso Premium temporal.</Text>
            {/* Distintivo premium por donación */}
            <View style={[{ backgroundColor: '#fef3c7', borderColor: '#f59e0b', borderWidth: 1, borderRadius: 10, padding: 8, marginBottom: 10, flexDirection: 'row', alignItems: 'center' }]}> 
              <Ionicons name="gift" size={18} color="#f59e0b" style={{ marginRight: 6 }} />
              <Text style={{ color: '#b45309', fontWeight: 'bold' }}>Premium temporal por donación</Text>
            </View>
            {/* Beneficios premium */}
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
            {/* Botones de suscripción premium */}
            <View style={styles.plansContainer}>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>¿Prefieres suscribirte?</Text>
              <TouchableOpacity
                style={[styles.planCard, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}
                onPress={() => pay(39)}
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
              <TouchableOpacity
                style={[styles.planCard, styles.popularPlan, { backgroundColor: colors.cardSecondary, borderColor: colors.button }]}
                onPress={() => pay(399)}
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
            {/* Fixed amounts (donación) */}
            <View style={styles.amountsContainer}>
              {Object.values(TIP_JAR_AMOUNTS).map((item) => (
                <TouchableOpacity
                  key={item.amount}
                  style={[styles.amountCard, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}
                  onPress={() => pay(item.amount)}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color={colors.button} />
                  ) : (
                    <>
                      <View style={styles.amountHeader}>
                        <Text style={[styles.amountPrice, { color: colors.button }]}>${item.amount} MXN</Text>
                        <Ionicons name="gift" size={20} color="#f59e0b" />
                      </View>
                      <Text style={[styles.amountDays, { color: colors.text }]}>{item.days} días Premium</Text>
                    </>
                  )}
                </TouchableOpacity>
              ))}
            </View>
            {/* Custom amount (donación) */}
            <View style={styles.customContainer}>
              <Text style={[styles.customLabel, { color: colors.text }]}>Monto personalizado</Text>
              <View style={styles.customInputRow}>
                <View style={[styles.inputWrapper, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}> 
                  <Text style={[styles.currencySymbol, { color: colors.textSecondary }]}>$</Text>
                  <TextInput
                    style={[styles.input, { color: colors.inputText }]}
                    value={customAmount}
                    onChangeText={setCustomAmount}
                    placeholder="100"
                    placeholderTextColor={colors.placeholder}
                    keyboardType="numeric"
                  />
                  <Text style={[styles.currencySymbol, { color: colors.textSecondary }]}>MXN</Text>
                </View>
                <TouchableOpacity
                  style={[styles.customButton, { backgroundColor: colors.button }, (!customAmount || loading) && { opacity: 0.5 }]}
                  onPress={() => pay(Number(customAmount))}
                  disabled={!customAmount || loading}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Ionicons name="arrow-forward" size={20} color="#fff" />
                  )}
                </TouchableOpacity>
              </View>
              <Text style={[styles.customHint, { color: colors.textSecondary }]}>Mínimo $10 MXN. $200+ otorga 90 días Premium</Text>
            </View>
            {/* Footer */}
            <Text style={[styles.footer, { color: colors.textSecondary }]}>Los pagos son procesados de forma segura por Stripe. Gracias por tu apoyo ❤️</Text>
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
    marginBottom: 16,
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
  description: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 24,
  },
  benefitsContainer: {
    marginBottom: 24,
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
  subtitle: {
    fontSize: 14,
    marginBottom: 12,
    fontWeight: '500',
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
  amountsContainer: {
    marginBottom: 24,
  },
  amountCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
  },
  amountHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  amountPrice: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  amountDays: {
    fontSize: 14,
    fontWeight: '500',
  },
  customContainer: {
    marginBottom: 20,
  },
  customLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
  },
  customInputRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 8,
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
  },
  currencySymbol: {
    fontSize: 16,
    fontWeight: '500',
  },
  input: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  customButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customHint: {
    fontSize: 12,
    marginLeft: 4,
  },
  footer: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
});
