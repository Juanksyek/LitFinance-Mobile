
import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AnalyticsFilters } from '../../services/analyticsService';
import ConceptosChart from '../analytics/ConceptosChart';
import SubcuentasChart from '../analytics/SubcuentasChart';
import RecurrentesChart from '../analytics//RecurrentesChart';
import TemporalChart from '../analytics/TemporalChart';
import { useThemeColors } from '../../theme/useThemeColors';

interface ChartSelectorProps {
  filters: AnalyticsFilters;
  refreshKey?: number;
}

type ChartType = 'conceptos' | 'subcuentas' | 'recurrentes' | 'temporal';

const ChartSelector: React.FC<ChartSelectorProps> = ({ filters, refreshKey = 0 }) => {
  const colors = useThemeColors();
  const [activeChart, setActiveChart] = useState<ChartType>('conceptos');
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const chartOptions = [
    {
      id: 'conceptos' as ChartType,
      title: 'Por Concepto',
      icon: 'pie-chart',
      description: 'Gastos por categoría',
    },
    {
      id: 'subcuentas' as ChartType,
      title: 'Subcuentas',
      icon: 'wallet',
      description: 'Estado de ahorros',
    },
    {
      id: 'recurrentes' as ChartType,
      title: 'Recurrentes',
      icon: 'repeat',
      description: 'Suscripciones activas',
    },
    {
      id: 'temporal' as ChartType,
      title: 'Temporal',
      icon: 'trending-up',
      description: 'Tendencias en el tiempo',
    },
  ];

  const handleChartChange = (chartId: ChartType) => {
    if (chartId === activeChart) return;

    // Animación de transición
    Animated.sequence([
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 0.95,
          duration: 200,
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 80,
          friction: 8,
          useNativeDriver: true,
        }),
      ]),
    ]).start();

    setActiveChart(chartId);
  };

  const renderChart = () => {
    switch (activeChart) {
      case 'conceptos':
        return <ConceptosChart filters={filters} refreshKey={refreshKey} />;
      case 'subcuentas':
        return <SubcuentasChart filters={filters} refreshKey={refreshKey} />;
      case 'recurrentes':
        return <RecurrentesChart filters={filters} refreshKey={refreshKey} />;
      case 'temporal':
        return <TemporalChart filters={filters} refreshKey={refreshKey} />;
      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.tabsContainer}
        contentContainerStyle={styles.tabsContent}
      >
        {chartOptions.map((option) => (
          <TouchableOpacity
            key={option.id}
            style={[
              styles.tab,
              { 
                backgroundColor: activeChart === option.id ? colors.button : colors.cardSecondary,
                shadowColor: activeChart === option.id ? colors.button : colors.shadow,
                borderColor: activeChart === option.id ? colors.button : 'transparent',
              }
            ]}
            onPress={() => handleChartChange(option.id)}
            activeOpacity={0.85}
          >
            <View style={[
              styles.iconContainer,
              { backgroundColor: activeChart === option.id ? 'rgba(255,255,255,0.2)' : 'transparent' }
            ]}>
              <Ionicons 
                name={option.icon as any} 
                size={24} 
                color={activeChart === option.id ? '#FFF' : colors.text} 
              />
            </View>
            <Text style={[
              styles.tabTitle,
              { color: activeChart === option.id ? '#FFF' : colors.text }
            ]}>
              {option.title}
            </Text>
            <Text style={[
              styles.tabDescription,
              { color: activeChart === option.id ? 'rgba(255,255,255,0.85)' : colors.textSecondary }
            ]}>
              {option.description}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Animated.View style={[
        styles.chartContainer, 
        { 
          backgroundColor: colors.card,
          shadowColor: colors.shadow,
          opacity: fadeAnim,
          transform: [{ scale: scaleAnim }],
        }
      ]}>
        {renderChart()}
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  tabsContainer: {
    marginBottom: 18,
    flexGrow: 0,
  },
  tabsContent: {
    paddingHorizontal: 4,
    gap: 12,
  },
  tab: {
    borderRadius: 18,
    padding: 18,
    minWidth: 130,
    alignItems: 'center',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    borderWidth: 2,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  tabTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 6,
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  tabDescription: {
    fontSize: 11,
    textAlign: 'center',
    letterSpacing: 0.1,
    lineHeight: 14,
  },
  chartContainer: {
    borderRadius: 20,
    padding: 18,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
  },
});

export default ChartSelector;
