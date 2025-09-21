import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { analyticsService, ResumenFinanciero, AnalyticsFilters } from '../services/analyticsService';
import AnalyticsFiltersComponent from '../components/analytics/AnalyticsFilters';
import ResumenCard from '../components/analytics/ResumenCard';
import ChartSelector from '../components/analytics/ChartSelector';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface AnalyticsScreenProps {
  navigation: any; // Add navigation prop
}

const AnalyticsScreen: React.FC<AnalyticsScreenProps> = ({ navigation }) => {
  const [resumen, setResumen] = useState<ResumenFinanciero | null>(null);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<AnalyticsFilters>({
    rangoTiempo: 'mes',
    tipoTransaccion: 'ambos',
  });
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    loadResumenFinanciero();
  }, [filters]);

  const loadResumenFinanciero = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
  
      const token = await AsyncStorage.getItem("authToken");
      if (!token) {
        setErrorMsg('Tu sesión ha expirado. Por favor inicia sesión nuevamente.');
        setResumen(null);
        setLoading(false);
        return;
      }
  
      const data = await analyticsService.getResumenFinanciero(filters);
      setResumen(data);
    } catch (error: any) {
      if (error?.response?.status === 401) { 
        await AsyncStorage.removeItem("authToken");
        setErrorMsg('Tu sesión ha expirado. Redirigiendo al login...');
        
        setTimeout(() => {
          navigation.reset({
            index: 0,
            routes: [{ name: 'Login' }],
          });
        }, 2000);
      } else {
        setErrorMsg('Error cargando analytics. Intenta de nuevo.');
      }
      console.error('Error loading resumen financiero:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFiltersChange = (newFilters: AnalyticsFilters) => {
    setFilters(newFilters);
    setShowFilters(false);
  };

  // Add retry function
  const handleRetry = () => {
    loadResumenFinanciero();
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6366f1" />
          <Text style={styles.loadingText}>Cargando analytics...</Text>
          {errorMsg && (
            <Text style={styles.errorText}>{errorMsg}</Text>
          )}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Analytics</Text>
        <TouchableOpacity
          style={styles.filterButton}
          onPress={() => setShowFilters(true)}
        >
          <Ionicons name="filter" size={24} color="#6366f1" />
        </TouchableOpacity>
      </View>

      {errorMsg && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{errorMsg}</Text>
          {!errorMsg.includes('expirado') && (
            <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
              <Text style={styles.retryButtonText}>Reintentar</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {resumen && (
          <>
            <ResumenCard 
              balance={{
                balance: resumen.balance,
                totalIngresos: {
                  monto: resumen.ingresos,
                  moneda: '$',
                  esPositivo: resumen.ingresos >= 0,
                },
                totalGastos: {
                  monto: resumen.gastos,
                  moneda: '$',
                  esPositivo: resumen.gastos >= 0,
                },
              }} 
            />
            <ChartSelector filters={filters} />
          </>
        )}
      </ScrollView>

      {showFilters && (
        <AnalyticsFiltersComponent
          filters={filters}
          onApply={handleFiltersChange}
          onClose={() => setShowFilters(false)}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  filterButton: {
    padding: 8,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#64748b',
  },
  errorContainer: {
    padding: 16,
    backgroundColor: '#fee2e2',
    borderRadius: 8,
    margin: 16,
  },
  errorText: {
    color: '#b91c1c',
    fontSize: 16,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 12,
    backgroundColor: '#6366f1',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    alignSelf: 'center',
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default AnalyticsScreen;