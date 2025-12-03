
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
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
      >
        {chartOptions.map((option) => (
          <TouchableOpacity
            key={option.id}
            style={[
              styles.tab,
              { backgroundColor: activeChart === option.id ? '#6366f1' : colors.card },
              activeChart === option.id && styles.activeTab
            ]}
            onPress={() => setActiveChart(option.id)}
          >
            <Ionicons 
              name={option.icon as any} 
              size={20} 
              color={activeChart === option.id ? '#ffffff' : colors.textSecondary} 
            />
            <Text style={[
              styles.tabTitle,
              { color: activeChart === option.id ? '#ffffff' : colors.text },
              activeChart === option.id && styles.activeTabTitle
            ]}>
              {option.title}
            </Text>
            <Text style={[
              styles.tabDescription,
              { color: activeChart === option.id ? '#e2e8f0' : colors.textSecondary },
              activeChart === option.id && styles.activeTabDescription
            ]}>
              {option.description}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={[styles.chartContainer, { backgroundColor: colors.card }]}>
        {renderChart()}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  tabsContainer: {
    marginBottom: 20,
  },
  tab: {
    borderRadius: 12,
    padding: 16,
    marginRight: 12,
    minWidth: 120,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  activeTab: {
    backgroundColor: '#6366f1',
  },
  tabTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
    textAlign: 'center',
  },
  activeTabTitle: {
    color: '#ffffff',
  },
  tabDescription: {
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
  },
  activeTabDescription: {
    color: '#e2e8f0',
  },
  chartContainer: {
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
});

export default ChartSelector;
