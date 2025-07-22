import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView, Dimensions, Animated } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../constants/api';
import { Ionicons } from '@expo/vector-icons';

interface CuentaPrincipal {
  esPrincipal: boolean;
  _id: string;
  userId: string;
  nombre: string;
  moneda: string;
  simbolo: string;
  color: string;
  cantidad: number;
  isPrincipal: boolean;
  id: string;
  updatedAt: string;
}

const { width, height } = Dimensions.get('window');

const MainAccountScreen = () => {
  const [cuenta, setCuenta] = useState<CuentaPrincipal | null>(null);
  const [loading, setLoading] = useState(true);
  const fadeAnim = new Animated.Value(0);
  const slideAnim = new Animated.Value(50);
  const scaleAnim = new Animated.Value(0.9);

  const fetchCuentaPrincipal = async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');
  
      if (!token) {
        console.warn('Token no encontrado en AsyncStorage');
        setCuenta(null);
        setLoading(false);
        return;
      }
  
      const res = await fetch(`${API_BASE_URL}/cuenta/principal`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
  
      const data = await res.json();
      console.log('DATA:', data);
  
      if (res.ok) {
        setCuenta(data);
        // Animación de entrada
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(slideAnim, {
            toValue: 0,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: 1,
            duration: 700,
            useNativeDriver: true,
          }),
        ]).start();
      } else {
        console.error('Error en la respuesta:', data);
        setCuenta(null);
      }
    } catch (error) {
      console.error('Error al obtener cuenta principal:', error);
      setCuenta(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCuentaPrincipal();
  }, []);

  const getAccentColor = (baseColor: string) => {
    const accents = {
      '#4CAF50': '#E8F5E8',
      '#2196F3': '#E3F2FD',
      '#FF9800': '#FFF3E0',
      '#9C27B0': '#F3E5F5',
      '#F44336': '#FFEBEE',
      '#607D8B': '#ECEFF1',
    };
    return accents[baseColor as keyof typeof accents] || '#F5F5F5';
  };

  const getDarkerColor = (baseColor: string) => {
    const darker = {
      '#4CAF50': '#388E3C',
      '#2196F3': '#1976D2',
      '#FF9800': '#F57C00',
      '#9C27B0': '#7B1FA2',
      '#F44336': '#D32F2F',
      '#607D8B': '#455A64',
    };
    return darker[baseColor as keyof typeof darker] || baseColor;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) return 'Hace 1 día';
    if (diffDays < 7) return `Hace ${diffDays} días`;
    return date.toLocaleDateString('es-MX', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <View style={styles.loadingCard}>
          <View style={styles.loadingIconContainer}>
            <ActivityIndicator size="large" color="#667EEA" />
            <View style={styles.loadingPulse} />
          </View>
          <Text style={styles.loadingText}>Cargando cuenta principal...</Text>
          <Text style={styles.loadingSubtext}>Obteniendo información financiera</Text>
        </View>
      </View>
    );
  }

  if (!cuenta) {
    return (
      <View style={styles.errorContainer}>
        <View style={styles.errorCard}>
          <View style={styles.errorIconContainer}>
            <Ionicons name="warning-outline" size={64} color="#FF6B6B" />
            <View style={styles.errorPulse} />
          </View>
          <Text style={styles.errorTitle}>¡Oops!</Text>
          <Text style={styles.errorText}>No se pudo cargar la cuenta principal</Text>
          <Text style={styles.errorSubtext}>Verifica tu conexión e intenta nuevamente</Text>
        </View>
      </View>
    );
  }

  const accentColor = getAccentColor(cuenta.color);
  const darkerColor = getDarkerColor(cuenta.color);

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header mejorado */}
      <View style={[styles.header, { backgroundColor: '#667EEA' }]}>
        <View style={styles.headerOverlay} />
        <Animated.View 
          style={[
            styles.headerContent,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }]
            }
          ]}
        >
          <View style={styles.headerIconContainer}>
            <Ionicons name="wallet-outline" size={32} color="white" />
            <View style={styles.headerIconGlow} />
          </View>
          <Text style={styles.headerTitle}>Cuenta Principal</Text>
          <Text style={styles.headerSubtitle}>Información detallada de tu cuenta</Text>
        </Animated.View>
        
        {/* Elementos decorativos */}
        <View style={styles.decorativeCircle1} />
        <View style={styles.decorativeCircle2} />
        <View style={styles.decorativeCircle3} />
      </View>

      {/* Tarjeta principal del balance mejorada */}
      <Animated.View 
        style={[
          styles.balanceContainer,
          {
            opacity: fadeAnim,
            transform: [
              { translateY: slideAnim },
              { scale: scaleAnim }
            ]
          }
        ]}
      >
        <View style={[styles.balanceCard, { backgroundColor: cuenta.color }]}>
          <View style={styles.balanceOverlay} />
          
          <View style={styles.balanceHeader}>
            <View style={styles.balanceIconContainer}>
              <Ionicons name="card-outline" size={24} color="white" />
              <View style={styles.balanceIconGlow} />
            </View>
            <Text style={styles.accountName}>{cuenta.nombre}</Text>
          </View>
          
          <View style={styles.balanceAmount}>
            <Text style={styles.currencySymbol}>{cuenta.simbolo}</Text>
            <Text style={styles.amount}>
              {typeof cuenta.cantidad === 'number'
                ? cuenta.cantidad.toLocaleString('es-MX', { minimumFractionDigits: 2 })
                : '0.00'}
            </Text>
          </View>

          <View style={styles.balanceFooter}>
            <View style={styles.currencyContainer}>
              <Text style={styles.currencyName}>{cuenta.moneda}</Text>
              <View style={styles.currencyDot} />
            </View>
            <View style={styles.principalBadge}>
              <Ionicons name="star" size={12} color="white" />
              <Text style={styles.principalText}>Principal</Text>
            </View>
          </View>

          {/* Elementos decorativos en la tarjeta */}
          <View style={styles.cardDecorativeElement1} />
          <View style={styles.cardDecorativeElement2} />
        </View>
      </Animated.View>

      {/* Información detallada mejorada */}
      <Animated.View 
        style={[
          styles.detailsContainer,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }]
          }
        ]}
      >
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Información de la Cuenta</Text>
          <View style={[styles.sectionAccent, { backgroundColor: cuenta.color }]} />
        </View>
        
        <View style={styles.infoGrid}>
          <View style={[styles.infoCard, { backgroundColor: accentColor, borderLeftColor: cuenta.color }]}>
            <View style={styles.infoHeader}>
              <View style={[styles.infoIconContainer, { backgroundColor: cuenta.color }]}>
                <Ionicons name="id-card-outline" size={20} color="white" />
              </View>
              <Text style={styles.infoLabel}>ID de Cuenta</Text>
            </View>
            <Text style={styles.infoValue} numberOfLines={1} ellipsizeMode="middle">
              {cuenta.id}
            </Text>
          </View>

          <View style={[styles.infoCard, { backgroundColor: accentColor, borderLeftColor: cuenta.color }]}>
            <View style={styles.infoHeader}>
              <View style={[styles.infoIconContainer, { backgroundColor: cuenta.color }]}>
                <Ionicons name="person-outline" size={20} color="white" />
              </View>
              <Text style={styles.infoLabel}>Usuario</Text>
            </View>
            <Text style={styles.infoValue} numberOfLines={1} ellipsizeMode="middle">
              {cuenta.userId}
            </Text>
          </View>

          <View style={[styles.infoCard, { backgroundColor: accentColor, borderLeftColor: cuenta.color }]}>
            <View style={styles.infoHeader}>
              <View style={[styles.infoIconContainer, { backgroundColor: cuenta.color }]}>
                <Ionicons name="color-palette-outline" size={20} color="white" />
              </View>
              <Text style={styles.infoLabel}>Color de Tema</Text>
            </View>
            <View style={styles.colorRow}>
              <View style={[styles.colorIndicator, { backgroundColor: cuenta.color }]} />
              <Text style={styles.infoValue}>{cuenta.color}</Text>
            </View>
          </View>

          <View style={[styles.infoCard, { backgroundColor: accentColor, borderLeftColor: cuenta.color }]}>
            <View style={styles.infoHeader}>
              <View style={[styles.infoIconContainer, { backgroundColor: cuenta.color }]}>
                <Ionicons name="time-outline" size={20} color="white" />
              </View>
              <Text style={styles.infoLabel}>Última Actualización</Text>
            </View>
            <Text style={styles.infoValue}>
              {cuenta.updatedAt ? formatDate(cuenta.updatedAt) : 'Fecha desconocida'}
            </Text>
          </View>
        </View>

        {/* Estado de la cuenta mejorado */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Estado de la Cuenta</Text>
          <View style={[styles.sectionAccent, { backgroundColor: cuenta.color }]} />
        </View>
        
        <View style={styles.statusContainer}>
          <View style={styles.statusItem}>
            <View style={[
              styles.statusIconContainer, 
              { backgroundColor: cuenta.isPrincipal ? '#4CAF50' : '#FF6B6B' }
            ]}>
              <Ionicons 
                name={cuenta.isPrincipal ? "checkmark-circle" : "close-circle"} 
                size={24} 
                color="white"
              />
              <View style={[
                styles.statusIconGlow,
                { backgroundColor: cuenta.isPrincipal ? 'rgba(76, 175, 80, 0.2)' : 'rgba(255, 107, 107, 0.2)' }
              ]} />
            </View>
            <View style={styles.statusContent}>
              <Text style={styles.statusLabel}>Cuenta Principal</Text>
              <Text style={[styles.statusValue, { 
                color: cuenta.isPrincipal ? "#4CAF50" : "#FF6B6B" 
              }]}>
                {cuenta.isPrincipal ? 'Activa' : 'Inactiva'}
              </Text>
            </View>
            <View style={[styles.statusIndicator, { 
              backgroundColor: cuenta.isPrincipal ? "#4CAF50" : "#FF6B6B" 
            }]} />
          </View>

          <View style={styles.statusItem}>
            <View style={[
              styles.statusIconContainer, 
              { backgroundColor: cuenta.esPrincipal ? '#4CAF50' : '#FF6B6B' }
            ]}>
              <Ionicons 
                name={cuenta.esPrincipal ? "checkmark-circle" : "close-circle"} 
                size={24} 
                color="white"
              />
              <View style={[
                styles.statusIconGlow,
                { backgroundColor: cuenta.esPrincipal ? 'rgba(76, 175, 80, 0.2)' : 'rgba(255, 107, 107, 0.2)' }
              ]} />
            </View>
            <View style={styles.statusContent}>
              <Text style={styles.statusLabel}>Estado Legacy</Text>
              <Text style={[styles.statusValue, { 
                color: cuenta.esPrincipal ? "#4CAF50" : "#FF6B6B" 
              }]}>
                {cuenta.esPrincipal ? 'Habilitado' : 'Deshabilitado'}
              </Text>
            </View>
            <View style={[styles.statusIndicator, { 
              backgroundColor: cuenta.esPrincipal ? "#4CAF50" : "#FF6B6B" 
            }]} />
          </View>
        </View>

        {/* Información técnica mejorada */}
        <View style={styles.technicalInfo}>
          <View style={styles.technicalHeader}>
            <View style={[styles.technicalIconContainer, { backgroundColor: cuenta.color }]}>
              <Ionicons name="code-outline" size={20} color="white" />
            </View>
            <Text style={styles.technicalTitle}>Información Técnica</Text>
          </View>
          <View style={styles.technicalGrid}>
            <View style={styles.technicalItem}>
              <Text style={styles.technicalLabel}>Database ID</Text>
              <View style={styles.technicalValueContainer}>
                <Text style={styles.technicalValue} numberOfLines={1} ellipsizeMode="middle">
                  {cuenta._id}
                </Text>
                <Ionicons name="copy-outline" size={16} color="#94A3B8" />
              </View>
            </View>
          </View>
        </View>
      </Animated.View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  loadingCard: {
    backgroundColor: 'white',
    padding: 40,
    borderRadius: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  loadingIconContainer: {
    position: 'relative',
    marginBottom: 20,
  },
  loadingPulse: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(102, 126, 234, 0.1)',
    top: -15,
    left: -15,
  },
  loadingText: {
    fontSize: 18,
    color: '#1E293B',
    fontWeight: '600',
    marginBottom: 8,
  },
  loadingSubtext: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 24,
  },
  errorCard: {
    backgroundColor: 'white',
    padding: 40,
    borderRadius: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 12,
    width: '100%',
    maxWidth: 320,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  errorIconContainer: {
    position: 'relative',
    marginBottom: 20,
  },
  errorPulse: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
    top: -18,
    left: -18,
  },
  errorTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 12,
  },
  errorText: {
    fontSize: 16,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 8,
  },
  errorSubtext: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
  },
  header: {
    paddingTop: 60,
    paddingBottom: 50,
    paddingHorizontal: 24,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    position: 'relative',
    overflow: 'hidden',
  },
  headerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
  },
  headerContent: {
    alignItems: 'center',
    zIndex: 2,
  },
  headerIconContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  headerIconGlow: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    top: -14,
    left: -14,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: 'white',
    marginBottom: 8,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    fontWeight: '500',
  },
  decorativeCircle1: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    top: -20,
    right: -30,
  },
  decorativeCircle2: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    bottom: 20,
    left: -20,
  },
  decorativeCircle3: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    top: 100,
    left: 50,
  },
  balanceContainer: {
    paddingHorizontal: 24,
    marginTop: -25,
    marginBottom: 32,
  },
  balanceCard: {
    borderRadius: 24,
    padding: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 15,
    position: 'relative',
    overflow: 'hidden',
  },
  balanceOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  balanceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    zIndex: 2,
  },
  balanceIconContainer: {
    position: 'relative',
    marginRight: 12,
  },
  balanceIconGlow: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    top: -8,
    left: -8,
  },
  accountName: {
    fontSize: 20,
    fontWeight: '700',
    color: 'white',
    flex: 1,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  balanceAmount: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 24,
    zIndex: 2,
  },
  currencySymbol: {
    fontSize: 28,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.9)',
    marginRight: 8,
  },
  amount: {
    fontSize: 42,
    fontWeight: '800',
    color: 'white',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  balanceFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 2,
  },
  currencyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  currencyName: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '600',
  },
  currencyDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    marginLeft: 8,
  },
  principalBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  principalText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 6,
  },
  cardDecorativeElement1: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    top: -30,
    right: -30,
  },
  cardDecorativeElement2: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    bottom: -20,
    left: -20,
  },
  detailsContainer: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1E293B',
    flex: 1,
  },
  sectionAccent: {
    width: 4,
    height: 24,
    borderRadius: 2,
  },
  infoGrid: {
    gap: 16,
    marginBottom: 40,
  },
  infoCard: {
    padding: 24,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 6,
    borderLeftWidth: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.8)',
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  infoIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  infoLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#475569',
    flex: 1,
  },
  infoValue: {
    fontSize: 16,
    color: '#1E293B',
    fontWeight: '600',
    lineHeight: 24,
  },
  colorRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  colorIndicator: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginRight: 12,
    borderWidth: 3,
    borderColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  statusContainer: {
    marginBottom: 40,
    gap: 16,
  },
  statusItem: {
    backgroundColor: 'white',
    padding: 24,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.8)',
    position: 'relative',
  },
  statusIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    position: 'relative',
  },
  statusIconGlow: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 30,
    top: -6,
    left: -6,
  },
  statusContent: {
    flex: 1,
  },
  statusLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 4,
  },
  statusValue: {
    fontSize: 15,
    fontWeight: '600',
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    position: 'absolute',
    top: 12,
    right: 12,
  },
  technicalInfo: {
    backgroundColor: '#F1F5F9',
    padding: 24,
    borderRadius: 20,
    borderLeftWidth: 6,
    borderLeftColor: '#667EEA',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 6,
  },
  technicalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  technicalIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  technicalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#334155',
    flex: 1,
  },
  technicalGrid: {
    gap: 16,
  },
  technicalItem: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(226, 232, 240, 0.8)',
  },
  technicalLabel: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  technicalValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  technicalValue: {
    fontSize: 14,
    color: '#475569',
    fontFamily: 'monospace',
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 8,
    flex: 1,
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
});

export default MainAccountScreen;