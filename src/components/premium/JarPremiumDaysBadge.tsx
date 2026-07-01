import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../theme/useThemeColors';

type Props = {
  premiumSubscriptionStatus?: string | null;
  premiumUntil?: string | Date | null;
};

export default function JarPremiumDaysBadge({ premiumSubscriptionStatus, premiumUntil }: Props) {
  const colors = useThemeColors();

  const shouldShow = useMemo(() => {
    // No mostrar si tiene suscripción activa
    const subOk = premiumSubscriptionStatus === 'active' || premiumSubscriptionStatus === 'trialing';
    if (subOk) return false;
    
    // Mostrar solo si tiene días regalados pendientes
    if (!premiumUntil) return false;
    return new Date(premiumUntil).getTime() > Date.now();
  }, [premiumSubscriptionStatus, premiumUntil]);

  const days = useMemo(() => {
    if (!premiumUntil) return 0;
    const diff = new Date(premiumUntil).getTime() - Date.now();
    return Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }, [premiumUntil]);

  if (!shouldShow) return null;

  return (
    <View style={[styles.container, { backgroundColor: colors.cardSecondary, borderColor: '#f59e0b' }]}>
      <View style={styles.iconContainer}>
        <Ionicons name="gift" size={24} color="#f59e0b" />
      </View>
      <View style={styles.textContainer}>
        <Text style={[styles.title, { color: colors.text }]}>Premium por apoyo ❤️</Text>
        <Text style={[styles.days, { color: '#f59e0b' }]}>
          {days} día{days === 1 ? '' : 's'} restante{days === 1 ? '' : 's'}
        </Text>
        <Text style={[styles.description, { color: colors.textSecondary }]}>
          Gracias por apoyar el desarrollo de LitFinance
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 16,
    borderWidth: 2,
    marginBottom: 16,
    shadowColor: '#f59e0b',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  iconContainer: {
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  days: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  description: {
    fontSize: 12,
    lineHeight: 16,
  },
});
