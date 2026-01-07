import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../theme/useThemeColors';

type Props = {
  premiumSubscriptionStatus?: string | null;
  premiumUntil?: string | Date | null;
  stripeSubscriptionId?: string | null;
};

export default function PremiumStatusCard({ premiumSubscriptionStatus, premiumUntil, stripeSubscriptionId }: Props) {
  const colors = useThemeColors();

  const isPremium = useMemo(() => {
    return premiumSubscriptionStatus === 'active' || premiumSubscriptionStatus === 'trialing' ||
      (premiumUntil && new Date(premiumUntil) > new Date());
  }, [premiumSubscriptionStatus, premiumUntil]);

  const daysRemaining = useMemo(() => {
    if (!premiumUntil) return 0;
    const diff = new Date(premiumUntil).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }, [premiumUntil]);

  const renewalDate = useMemo(() => {
    if (!premiumUntil) return null;
    return new Date(premiumUntil).toLocaleDateString('es-MX', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }, [premiumUntil]);

  const isSubscription = premiumSubscriptionStatus === 'active' || premiumSubscriptionStatus === 'trialing';

  if (!isPremium) return null;

  return (
    <View style={[styles.container, { backgroundColor: colors.cardSecondary, borderColor: '#f59e0b' }]}>
      <View style={styles.header}>
        <Ionicons name="star" size={28} color="#f59e0b" />
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: colors.text }]}>
            {isSubscription ? 'Suscripción Premium Activa ✨' : 'Premium Activo ✨'}
          </Text>
          {isSubscription ? (
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              Suscripción mensual activa
            </Text>
          ) : (
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              Activado por apoyo ❤️
            </Text>
          )}
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.detailsContainer}>
        {isSubscription ? (
          <>
            <View style={styles.detailRow}>
              <Ionicons name="calendar-outline" size={20} color={colors.textSecondary} />
              <Text style={[styles.detailText, { color: colors.text }]}>
                Renovación: {renewalDate || 'Próximamente'}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Ionicons name="time-outline" size={20} color={colors.textSecondary} />
              <Text style={[styles.detailText, { color: colors.text }]}>
                {daysRemaining} días hasta la renovación
              </Text>
            </View>
          </>
        ) : (
          <>
            <View style={styles.detailRow}>
              <Ionicons name="gift-outline" size={20} color={colors.textSecondary} />
              <Text style={[styles.detailText, { color: colors.text }]}>
                {daysRemaining} día{daysRemaining === 1 ? '' : 's'} restante{daysRemaining === 1 ? '' : 's'}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Ionicons name="calendar-outline" size={20} color={colors.textSecondary} />
              <Text style={[styles.detailText, { color: colors.text }]}>
                Vence: {renewalDate}
              </Text>
            </View>
          </>
        )}
      </View>

      <View style={[styles.badge, { backgroundColor: '#f59e0b15' }]}>
        <Text style={[styles.badgeText, { color: '#f59e0b' }]}>
          Disfrutando todas las funciones premium
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 2,
    shadowColor: '#f59e0b',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerText: {
    flex: 1,
    marginLeft: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 13,
  },
  divider: {
    height: 1,
    backgroundColor: '#f59e0b30',
    marginVertical: 12,
  },
  detailsContainer: {
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  detailText: {
    fontSize: 14,
    flex: 1,
  },
  badge: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
