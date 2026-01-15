import React from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import type { EstadisticaConcepto } from '../../types/analytics';
import { useThemeColors } from '../../theme/useThemeColors';
import { fixMojibake, takeFirstGrapheme, emojiFontFix } from '../../utils/fixMojibake';

interface EstadisticasConceptoProps {
  data: EstadisticaConcepto[];
  isLoading?: boolean;
  error?: string;
}

const EstadisticasConcepto: React.FC<EstadisticasConceptoProps> = ({
  data,
  isLoading = false,
  error
}) => {
  const colors = useThemeColors();

  const formatAmount = (amount: number): string => {
    return amount.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const renderConceptoItem = ({ item }: { item: EstadisticaConcepto }) => (
    <View style={[styles.conceptoItem, { borderBottomColor: colors.border, backgroundColor: colors.cardSecondary, shadowColor: colors.shadow }]}> 
      <View style={styles.conceptoHeader}> 
        <View style={[styles.emojiCircle, { backgroundColor: item.concepto.color + '22', borderColor: item.concepto.color }]}> 
          <Text style={[styles.emoji, emojiFontFix]}>{takeFirstGrapheme(fixMojibake(item.concepto.icono ?? ''))}</Text> 
        </View> 
        <View style={styles.conceptoNameRow}>
          <Text style={[styles.conceptoNombre, { color: colors.text }]}>{item.concepto.nombre}</Text>
          <Text style={[styles.emojiInline, emojiFontFix]}>{takeFirstGrapheme(fixMojibake(item.concepto.icono ?? ''))}</Text>
        </View>
        <Text style={[styles.participacion, { color: colors.button }]}>{item.participacionPorcentual.toFixed(1)}%</Text> 
      </View> 
      <View style={styles.conceptoStats}> 
        <View style={styles.statItem}> 
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Ingresos</Text> 
          <Text style={[styles.statValue, { color: colors.success, fontWeight: '700' }]}> 
            ${formatAmount(item.totalIngreso)} 
          </Text> 
        </View> 
        <View style={styles.statItem}> 
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Gastos</Text> 
          <Text style={[styles.statValue, { color: colors.error, fontWeight: '700' }]}> 
            ${formatAmount(item.totalGasto)} 
          </Text> 
        </View> 
        <View style={styles.statItem}> 
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Movimientos</Text> 
          <Text style={[styles.statValue, { color: colors.text }]}>{item.cantidadMovimientos}</Text> 
        </View> 
        <View style={styles.statItem}> 
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Promedio</Text> 
          <Text style={[styles.statValue, { color: colors.text }]}>${formatAmount(item.montoPromedio)}</Text> 
        </View> 
      </View> 
    </View>
  );

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.card, shadowColor: colors.shadow }]}>
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Cargando estadísticas...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, { backgroundColor: colors.card, shadowColor: colors.shadow }]}>
        <Text style={styles.errorText}>Error: {error}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.card, shadowColor: colors.shadow }]}>
      <Text style={[styles.title, { color: colors.text }]}>Estadísticas por Concepto</Text>
      <FlatList
        data={data}
        renderItem={renderConceptoItem}
        keyExtractor={(item) => item.concepto.id}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
};

const styles = StyleSheet.create({
    conceptoNameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    emojiInline: {
      fontSize: 18,
      marginLeft: 2,
    },
  container: {
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 8,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  conceptoItem: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 8,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  conceptoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 10,
  },
  emojiCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    marginRight: 8,
  },
  emoji: {
    fontSize: 24,
  },
  conceptoNombre: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
  },
  participacion: {
    fontSize: 14,
    fontWeight: '700',
  },
  conceptoStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statItem: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 11,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  statValue: {
    fontSize: 13,
    fontWeight: '600',
  },
  // Removed incomeText and expenseText, now use theme colors
  loadingText: {
    textAlign: 'center',
    fontSize: 14,
  },
  errorText: {
    textAlign: 'center',
    color: '#EF4444',
    fontSize: 14,
  },
});

export default EstadisticasConcepto;
