
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AnalyticsFilters } from '../../services/analyticsService';
import ConceptosChart from '../analytics/ConceptosChart';
import SubcuentasChart from '../analytics/SubcuentasChart';
import RecurrentesChart from '../analytics//RecurrentesChart';
import TemporalChart from '../analytics/TemporalChart';

interface ChartSelectorProps {
  filters: AnalyticsFilters;
}

type ChartType = 'conceptos' | 'subcuentas' | 'recurrentes' | 'temporal';

const ChartSelector: React.FC<ChartSelectorProps> = ({ filters }) => {
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
        return <ConceptosChart filters={filters} />;
      case 'subcuentas':
        return <SubcuentasChart filters={filters} />;
      case 'recurrentes':
        return <RecurrentesChart filters={filters} />;
      case 'temporal':
        return <TemporalChart filters={filters} />;
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
              activeChart === option.id && styles.activeTab
            ]}
            onPress={() => setActiveChart(option.id)}
          >
            <Ionicons 
              name={option.icon as any} 
              size={20} 
              color={activeChart === option.id ? '#ffffff' : '#64748b'} 
            />
            <Text style={[
              styles.tabTitle,
              activeChart === option.id && styles.activeTabTitle
            ]}>
              {option.title}
            </Text>
            <Text style={[
              styles.tabDescription,
              activeChart === option.id && styles.activeTabDescription
            ]}>
              {option.description}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.chartContainer}>
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
    backgroundColor: '#ffffff',
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
    color: '#1e293b',
    marginTop: 8,
    textAlign: 'center',
  },
  activeTabTitle: {
    color: '#ffffff',
  },
  tabDescription: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
    textAlign: 'center',
  },
  activeTabDescription: {
    color: '#e2e8f0',
  },
  chartContainer: {
    backgroundColor: '#ffffff',
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
