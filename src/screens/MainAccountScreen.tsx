import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView, Dimensions, Animated, TouchableOpacity, TextInput, Modal, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../constants/api';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import DataPrivacyModal from '../components/DataPrivacyModal';
import SmartNumber from '../components/SmartNumber';
import { formatForCard, formatForDetail } from '../utils/numberFormatter';

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

interface Usuario {
  id: string;
  nombreCompleto: string;
  email: string;
  edad: number;
  ocupacion: string;
  isPremium: boolean;
  monedaPreferencia: string;
  telefono?: string;
  pais?: string;
  estado?: string;
  ciudad?: string;
  bio?: string;
}

interface Moneda {
  codigo: string;
  nombre: string;
  simbolo: string;
}

const { width, height } = Dimensions.get('window');

const MainAccountScreen = () => {
  const [cuenta, setCuenta] = useState<CuentaPrincipal | null>(null);
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [monedas, setMonedas] = useState<Moneda[]>([]);
  const [monedaModalVisible, setMonedaModalVisible] = useState(false);
  const [currencyModalVisible, setCurrencyModalVisible] = useState(false);
  const [convertingCurrency, setConvertingCurrency] = useState(false);
  const [infoModalVisible, setInfoModalVisible] = useState(false);
  const [formData, setFormData] = useState<Partial<Usuario>>({});
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
    }
  };

  const fetchUsuario = async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      
      if (!token) {
        return;
      }

      const res = await fetch(`${API_BASE_URL}/user/profile`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (res.ok) {
        const userData = await res.json();
        setUsuario(userData);
        setFormData(userData);
      } else {
        console.error('Error al obtener perfil de usuario');
      }
    } catch (error) {
      console.error('Error al obtener perfil de usuario:', error);
    }
  };

  const fetchData = async () => {
    await Promise.all([
      fetchCuentaPrincipal(),
      fetchUsuario(),
      fetchMonedas()
    ]);
    setLoading(false);
  };

  const fetchMonedas = async () => {
    try {
      console.log('[MainAccount] Obteniendo monedas desde: /monedas/catalogo');
      const response = await fetch(`${API_BASE_URL}/monedas/catalogo`);
      
      if (response.ok) {
        const data = await response.json();
        if (data && Array.isArray(data)) {
          console.log('[MainAccount] ✅ Monedas obtenidas exitosamente');
          setMonedas(data);
          return;
        }
      }
    } catch (error) {
      console.log('[MainAccount] ❌ Error obteniendo monedas:', error);
    }

    console.log('[MainAccount] 📋 No se pudieron obtener monedas del endpoint');
  };

  const handleUpdateProfile = async () => {
    try {
      setSaving(true);
      const token = await AsyncStorage.getItem('authToken');
      if (!token) return;

      const response = await fetch(`${API_BASE_URL}/user/update`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        const updatedProfile = await response.json();
        
        // Actualizar el estado del usuario con los datos del servidor
        setUsuario(updatedProfile);
        setFormData(updatedProfile);
        setEditMode(false);
        
        // Recargar los datos desde el servidor para asegurar sincronización
        await fetchUsuario();
        
        Toast.show({
          type: 'success',
          text1: 'Perfil actualizado',
          text2: 'Los cambios se guardaron correctamente',
        });
      } else {
        const errorData = await response.json();
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: errorData.message || 'No se pudo actualizar el perfil',
        });
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Error de conexión',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field: keyof Usuario, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleCancel = () => {
    Alert.alert(
      'Cancelar cambios',
      '¿Estás seguro de que quieres descartar los cambios?',
      [
        { text: 'Continuar editando', style: 'cancel' },
        { 
          text: 'Descartar', 
          style: 'destructive',
          onPress: () => {
            setFormData(usuario || {});
            setEditMode(false);
          }
        },
      ]
    );
  };

  // Nueva función para convertir moneda
  const convertCurrency = async (fromCurrency: string, toCurrency: string, amount: number) => {
    try {
      // Usar tasas de cambio aproximadas (en una app real usarías una API como exchangerate-api.com)
      const exchangeRates: { [key: string]: { [key: string]: number } } = {
        'USD': { 'MXN': 17.5, 'EUR': 0.85, 'GBP': 0.75, 'JPY': 110, 'CAD': 1.25 },
        'MXN': { 'USD': 0.057, 'EUR': 0.048, 'GBP': 0.043, 'JPY': 6.3, 'CAD': 0.071 },
        'EUR': { 'USD': 1.18, 'MXN': 20.6, 'GBP': 0.88, 'JPY': 130, 'CAD': 1.47 },
        'GBP': { 'USD': 1.33, 'MXN': 23.3, 'EUR': 1.14, 'JPY': 147, 'CAD': 1.67 },
        'JPY': { 'USD': 0.009, 'MXN': 0.16, 'EUR': 0.0077, 'GBP': 0.0068, 'CAD': 0.011 },
        'CAD': { 'USD': 0.8, 'MXN': 14, 'EUR': 0.68, 'GBP': 0.6, 'JPY': 88 },
      };

      if (fromCurrency === toCurrency) return amount;
      
      const rate = exchangeRates[fromCurrency]?.[toCurrency];
      if (!rate) {
        throw new Error('Conversión no disponible');
      }
      
      return amount * rate;
    } catch (error) {
      console.error('Error en conversión:', error);
      throw error;
    }
  };

  const handleCurrencyChange = async (newMoneda: Moneda) => {
    try {
      setConvertingCurrency(true);
      
      // Convertir el monto actual a la nueva moneda
      const convertedAmount = await convertCurrency(cuenta!.moneda, newMoneda.codigo, cuenta!.cantidad);
      
      const token = await AsyncStorage.getItem('authToken');
      if (!token) return;

      const response = await fetch(`${API_BASE_URL}/cuenta/principal/currency`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          moneda: newMoneda.codigo,
          simbolo: newMoneda.simbolo,
          cantidad: convertedAmount
        }),
      });

      if (response.ok) {
        // Actualizar el estado local
        setCuenta(prev => prev ? {
          ...prev,
          moneda: newMoneda.codigo,
          simbolo: newMoneda.simbolo,
          cantidad: convertedAmount
        } : null);

        setCurrencyModalVisible(false);
        
        Toast.show({
          type: 'success',
          text1: 'Moneda actualizada',
          text2: `Convertido a ${newMoneda.codigo} exitosamente`,
        });

        // Recargar datos para asegurar sincronización
        await fetchCuentaPrincipal();
      } else {
        const errorData = await response.json();
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: errorData.message || 'No se pudo cambiar la moneda',
        });
      }
    } catch (error) {
      console.error('Error changing currency:', error);
      Toast.show({
        type: 'error',
        text1: 'Error de conversión',
        text2: 'No se pudo convertir la moneda',
      });
    } finally {
      setConvertingCurrency(false);
    }
  };

  // Función wrapper para el SmartNumber
  const handleCurrencyChangeFromSmartNumber = async (newCurrencyCode: string) => {
    // Buscar la moneda completa en la lista de monedas
    const newMoneda = monedas.find(m => m.codigo === newCurrencyCode);
    if (newMoneda) {
      await handleCurrencyChange(newMoneda);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const getAccentColor = (baseColor: string) => {
    const accents = {
      '#2BDE3F': '#E8F8EA',
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
      '#2BDE3F': '#1DB834',
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
    <>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header mejorado */}
      <View style={[styles.header, { backgroundColor: cuenta.color }]}>
        <View style={styles.headerOverlay} />
        <View style={[ styles.headerContent]}>
          <View style={styles.headerIconContainer}>
            <Ionicons name="wallet-outline" size={32} color="white" />
            <View style={styles.headerIconGlow} />
          </View>
          <Text style={styles.headerTitle}>Cuenta Principal</Text>
          <Text style={styles.headerSubtitle}>Información detallada de tu cuenta</Text>
        </View>

        {/* Elementos decorativos */}
        <View style={styles.decorativeCircle1} />
        <View style={styles.decorativeCircle2} />
        <View style={styles.decorativeCircle3} />
      </View>

      {/* Tarjeta principal del balance mejorada */}
      <View style={[styles.balanceContainer]}>
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
            <SmartNumber 
              value={cuenta.cantidad}
              options={{ 
                context: 'card', 
                symbol: '', 
                currency: cuenta.moneda 
              }}
              textStyle={styles.amount}
              allowTooltip={true}
              allowCurrencyChange={true}
              currentCurrency={cuenta.moneda}
              onCurrencyChange={handleCurrencyChangeFromSmartNumber}
            />
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
      </View>

      {/* Información detallada mejorada */}
      <View style={[ styles.detailsContainer ]}>
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

          {/* Nueva tarjeta para mostrar el balance detallado */}
          <View style={[styles.infoCard, { backgroundColor: accentColor, borderLeftColor: cuenta.color }]}>
            <View style={styles.infoHeader}>
              <View style={[styles.infoIconContainer, { backgroundColor: cuenta.color }]}>
                <Ionicons name="calculator-outline" size={20} color="white" />
              </View>
              <Text style={styles.infoLabel}>Balance Detallado</Text>
            </View>
            <View style={styles.balanceDetails}>
              <Text style={styles.balanceDetailLabel}>Cantidad exacta:</Text>
              <SmartNumber 
                value={cuenta.cantidad}
                options={{ 
                  context: 'detail', 
                  symbol: cuenta.simbolo,
                  currency: cuenta.moneda 
                }}
                textStyle={styles.balanceDetailValue}
                allowTooltip={true}
                showWarnings={true}
              />
              <Text style={styles.balanceDetailLabel}>Formato científico:</Text>
              <Text style={styles.balanceDetailValue}>{cuenta.cantidad.toExponential(6)}</Text>
            </View>
          </View>
        </View>

        {/* Información del Usuario */}
        {usuario && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Mi Perfil</Text>
              <View style={styles.headerButtonsContainer}>
                <TouchableOpacity 
                  style={styles.infoButton}
                  onPress={() => setInfoModalVisible(true)}
                >
                  <Ionicons name="help-circle-outline" size={20} color={cuenta.color} />
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.editButton} 
                  onPress={() => setEditMode(!editMode)}
                >
                  <Ionicons 
                    name={editMode ? "close" : "pencil"} 
                    size={20} 
                    color={cuenta.color} 
                  />
                  <Text style={[styles.editButtonText, { color: cuenta.color }]}>
                    {editMode ? 'Cancelar' : 'Editar'}
                  </Text>
                </TouchableOpacity>
              </View>
              <View style={[styles.sectionAccent, { backgroundColor: cuenta.color }]} />
            </View>
            
            {editMode ? (
              <View style={styles.editContainer}>
                <ScrollView style={styles.editForm} showsVerticalScrollIndicator={false}>
                  {/* Información Personal */}
                  <View style={[styles.editSection, { backgroundColor: accentColor, borderLeftColor: cuenta.color }]}>
                    <Text style={styles.editSectionTitle}>Información Personal</Text>
                    
                    <View style={styles.editField}>
                      <Text style={styles.editLabel}>Nombre Completo</Text>
                      <TextInput
                        style={styles.editInput}
                        value={formData.nombreCompleto || ''}
                        onChangeText={(text) => handleChange('nombreCompleto', text)}
                        placeholder="Tu nombre completo"
                      />
                    </View>

                    <View style={styles.editField}>
                      <Text style={styles.editLabel}>Email</Text>
                      <TextInput
                        style={styles.editInput}
                        value={formData.email || ''}
                        onChangeText={(text) => handleChange('email', text)}
                        placeholder="Tu email"
                        keyboardType="email-address"
                        autoCapitalize="none"
                      />
                    </View>

                    <View style={styles.editFieldRow}>
                      <View style={[styles.editField, { flex: 1, marginRight: 10 }]}>
                        <Text style={styles.editLabel}>Edad</Text>
                        <TextInput
                          style={styles.editInput}
                          value={formData.edad?.toString() || ''}
                          onChangeText={(text) => handleChange('edad', parseInt(text) || 0)}
                          placeholder="Edad"
                          keyboardType="numeric"
                        />
                      </View>
                      <View style={[styles.editField, { flex: 2 }]}>
                        <Text style={styles.editLabel}>Ocupación</Text>
                        <TextInput
                          style={styles.editInput}
                          value={formData.ocupacion || ''}
                          onChangeText={(text) => handleChange('ocupacion', text)}
                          placeholder="Tu ocupación"
                        />
                      </View>
                    </View>
                  </View>

                  {/* Preferencias */}
                  <View style={[styles.editSection, { backgroundColor: accentColor, borderLeftColor: cuenta.color }]}>
                    <Text style={styles.editSectionTitle}>Preferencias</Text>
                    
                    <View style={styles.editField}>
                      <Text style={styles.editLabel}>Moneda Preferida</Text>
                      <TouchableOpacity
                        style={styles.monedaSelector}
                        onPress={() => setMonedaModalVisible(true)}
                      >
                        <Text style={styles.monedaSelectorText}>
                          {monedas.find(m => m.codigo === (formData.monedaPreferencia || usuario.monedaPreferencia))?.nombre || 'Seleccionar moneda'}
                        </Text>
                        <Ionicons name="chevron-down" size={20} color="#666" />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Información Adicional */}
                  <View style={[styles.editSection, { backgroundColor: accentColor, borderLeftColor: cuenta.color }]}>
                    <View style={styles.sectionTitleRow}>
                      <Text style={styles.editSectionTitle}>Información Adicional</Text>
                      <TouchableOpacity 
                        style={styles.infoButton}
                        onPress={() => setInfoModalVisible(true)}
                      >
                        <Ionicons name="help-circle-outline" size={20} color={cuenta.color} />
                      </TouchableOpacity>
                    </View>
                    
                    <View style={styles.editField}>
                      <View style={styles.labelRow}>
                        <Text style={styles.editLabel}>Teléfono</Text>
                        <Text style={styles.optionalLabel}>(Opcional)</Text>
                      </View>
                      <TextInput
                        style={styles.editInput}
                        value={formData.telefono || ''}
                        onChangeText={(text) => handleChange('telefono', text)}
                        placeholder="Tu número de teléfono"
                        keyboardType="phone-pad"
                      />
                    </View>

                    <View style={styles.editField}>
                      <View style={styles.labelRow}>
                        <Text style={styles.editLabel}>País</Text>
                        <Text style={styles.optionalLabel}>(Opcional)</Text>
                      </View>
                      <TextInput
                        style={styles.editInput}
                        value={formData.pais || ''}
                        onChangeText={(text) => handleChange('pais', text)}
                        placeholder="Tu país"
                      />
                    </View>

                    <View style={styles.editFieldRow}>
                      <View style={[styles.editField, { flex: 1, marginRight: 10 }]}>
                        <View style={styles.labelRow}>
                          <Text style={styles.editLabel}>Estado</Text>
                          <Text style={styles.optionalLabel}>(Opcional)</Text>
                        </View>
                        <TextInput
                          style={styles.editInput}
                          value={formData.estado || ''}
                          onChangeText={(text) => handleChange('estado', text)}
                          placeholder="Estado"
                        />
                      </View>
                      <View style={[styles.editField, { flex: 1 }]}>
                        <View style={styles.labelRow}>
                          <Text style={styles.editLabel}>Ciudad</Text>
                          <Text style={styles.optionalLabel}>(Opcional)</Text>
                        </View>
                        <TextInput
                          style={styles.editInput}
                          value={formData.ciudad || ''}
                          onChangeText={(text) => handleChange('ciudad', text)}
                          placeholder="Ciudad"
                        />
                      </View>
                    </View>

                    <View style={styles.editField}>
                      <View style={styles.labelRow}>
                        <Text style={styles.editLabel}>Biografía</Text>
                        <Text style={styles.optionalLabel}>(Opcional)</Text>
                      </View>
                      <TextInput
                        style={[styles.editInput, styles.bioInput]}
                        value={formData.bio || ''}
                        onChangeText={(text) => handleChange('bio', text)}
                        placeholder="Cuéntanos sobre ti..."
                        multiline
                        numberOfLines={4}
                      />
                    </View>
                  </View>

                  {/* Botones de acción */}
                  <View style={styles.actionButtons}>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.cancelButton]}
                      onPress={handleCancel}
                    >
                      <Text style={styles.cancelButtonText}>Cancelar</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                      style={[styles.actionButton, styles.saveButton, { backgroundColor: cuenta.color }]}
                      onPress={handleUpdateProfile}
                      disabled={saving}
                    >
                      {saving ? (
                        <ActivityIndicator size="small" color="white" />
                      ) : (
                        <Text style={styles.saveButtonText}>Guardar</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </ScrollView>
              </View>
            ) : (
              <View style={styles.infoGrid}>
                <View style={[styles.infoCard, { backgroundColor: accentColor, borderLeftColor: cuenta.color }]}>
                  <View style={styles.infoHeader}>
                    <View style={[styles.infoIconContainer, { backgroundColor: cuenta.color }]}>
                      <Ionicons name="person" size={20} color="white" />
                    </View>
                    <Text style={styles.infoLabel}>Nombre Completo</Text>
                  </View>
                  <Text style={styles.infoValue}>{usuario.nombreCompleto}</Text>
                </View>

                <View style={[styles.infoCard, { backgroundColor: accentColor, borderLeftColor: cuenta.color }]}>
                  <View style={styles.infoHeader}>
                    <View style={[styles.infoIconContainer, { backgroundColor: cuenta.color }]}>
                      <Ionicons name="mail" size={20} color="white" />
                    </View>
                    <Text style={styles.infoLabel}>Email</Text>
                  </View>
                  <Text style={styles.infoValue} numberOfLines={1} ellipsizeMode="middle">
                    {usuario.email}
                  </Text>
                </View>

                <View style={[styles.infoCard, { backgroundColor: accentColor, borderLeftColor: cuenta.color }]}>
                  <View style={styles.infoHeader}>
                    <View style={[styles.infoIconContainer, { backgroundColor: cuenta.color }]}>
                      <Ionicons name="calendar" size={20} color="white" />
                    </View>
                    <Text style={styles.infoLabel}>Edad y Ocupación</Text>
                  </View>
                  <Text style={styles.infoValue}>{usuario.edad} años - {usuario.ocupacion}</Text>
                </View>

                <View style={[styles.infoCard, { backgroundColor: accentColor, borderLeftColor: cuenta.color }]}>
                  <View style={styles.infoHeader}>
                    <View style={[styles.infoIconContainer, { backgroundColor: cuenta.color }]}>
                      <Ionicons name="card" size={20} color="white" />
                    </View>
                    <Text style={styles.infoLabel}>Configuración de Usuario</Text>
                  </View>
                  <View style={styles.planRow}>
                    <Text style={styles.infoValue}>
                      Moneda preferida: {usuario.monedaPreferencia}
                    </Text>
                  </View>
                </View>

                {/* Información adicional */}
                <View style={[styles.infoCard, { backgroundColor: accentColor, borderLeftColor: cuenta.color }]}>
                  <View style={styles.infoHeader}>
                    <View style={[styles.infoIconContainer, { backgroundColor: cuenta.color }]}>
                      <Ionicons name="location" size={20} color="white" />
                    </View>
                    <Text style={styles.infoLabel}>Información de Contacto</Text>
                  </View>
                  <View style={styles.contactInfo}>
                    <Text style={styles.contactItem}>
                      📞 {usuario.telefono || 'No especificado'}
                    </Text>
                    <Text style={styles.contactItem}>
                      🌍 {usuario.pais || 'No especificado'}
                    </Text>
                    <Text style={styles.contactItem}>
                      📍 {usuario.estado || 'No especificado'}
                    </Text>
                    <Text style={styles.contactItem}>
                      🏙️ {usuario.ciudad || 'No especificado'}
                    </Text>
                  </View>
                </View>

                {/* Biografía */}
                <View style={[styles.infoCard, { backgroundColor: accentColor, borderLeftColor: cuenta.color }]}>
                  <View style={styles.infoHeader}>
                    <View style={[styles.infoIconContainer, { backgroundColor: cuenta.color }]}>
                      <Ionicons name="document-text" size={20} color="white" />
                    </View>
                    <Text style={styles.infoLabel}>Biografía</Text>
                  </View>
                  <Text style={styles.bioText}>
                    {usuario.bio || 'No hay biografía disponible'}
                  </Text>
                </View>
              </View>
            )}
          </>
        )}

        {/* Estado de la cuenta mejorado */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Estado de la Cuenta</Text>
          <View style={[styles.sectionAccent, { backgroundColor: cuenta.color }]} />
        </View>
        
        <View style={styles.statusContainer}>
          <TouchableOpacity 
            style={styles.statusItem}
            onPress={() => setCurrencyModalVisible(true)}
          >
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
              <Text style={styles.statusHint}>Toca para cambiar moneda</Text>
            </View>
            <View style={styles.statusActions}>
              <View style={[styles.statusIndicator, { 
                backgroundColor: cuenta.isPrincipal ? "#4CAF50" : "#FF6B6B" 
              }]} />
              <Ionicons name="chevron-forward" size={20} color="#94A3B8" />
            </View>
          </TouchableOpacity>

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
      </View>
    </ScrollView>

    {/* Modal de selección de moneda */}
    <Modal
      visible={monedaModalVisible}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Seleccionar Moneda</Text>
          <TouchableOpacity onPress={() => setMonedaModalVisible(false)}>
            <Ionicons name="close" size={24} color="#64748B" />
          </TouchableOpacity>
        </View>
        
        <ScrollView style={styles.monedaList}>
          {monedas.map((moneda) => (
            <TouchableOpacity
              key={moneda.codigo}
              style={[
                styles.monedaItem,
                (formData.monedaPreferencia || usuario?.monedaPreferencia) === moneda.codigo && styles.monedaItemSelected
              ]}
              onPress={() => {
                handleChange('monedaPreferencia', moneda.codigo);
                setMonedaModalVisible(false);
              }}
            >
              <View style={styles.monedaInfo}>
                <Text style={styles.monedaCodigo}>{moneda.codigo}</Text>
                <Text style={styles.monedaNombre}>{moneda.nombre}</Text>
              </View>
              <Text style={styles.monedaSimbolo}>{moneda.simbolo}</Text>
              {(formData.monedaPreferencia || usuario?.monedaPreferencia) === moneda.codigo && (
                <Ionicons name="checkmark" size={20} color="#4CAF50" />
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </Modal>

    {/* Modal de cambio de moneda de cuenta principal */}
    <Modal
      visible={currencyModalVisible}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Cambiar Moneda de Cuenta</Text>
          <TouchableOpacity onPress={() => setCurrencyModalVisible(false)}>
            <Ionicons name="close" size={24} color="#64748B" />
          </TouchableOpacity>
        </View>
        
        <View style={styles.currencyInfo}>
          <Text style={styles.currencyInfoLabel}>Saldo actual:</Text>
          <Text style={styles.currencyInfoValue}>
            {cuenta?.simbolo}{cuenta?.cantidad.toLocaleString('es-MX', { 
              minimumFractionDigits: 2, 
              maximumFractionDigits: 2 
            })} {cuenta?.moneda}
          </Text>
        </View>
        
        <ScrollView style={styles.monedaList}>
          {monedas.map((moneda) => (
            <TouchableOpacity
              key={moneda.codigo}
              style={[
                styles.currencyItem,
                cuenta?.moneda === moneda.codigo && styles.currencyItemSelected
              ]}
              onPress={() => handleCurrencyChange(moneda)}
              disabled={convertingCurrency || cuenta?.moneda === moneda.codigo}
            >
              <View style={styles.currencyItemLeft}>
                <View style={styles.currencyIcon}>
                  <Text style={styles.currencySymbolModal}>{moneda.simbolo}</Text>
                </View>
                <View style={styles.currencyDetails}>
                  <Text style={styles.currencyCode}>{moneda.codigo}</Text>
                  <Text style={styles.currencyName}>{moneda.nombre}</Text>
                </View>
              </View>
              
              <View style={styles.currencyItemRight}>
                {cuenta?.moneda === moneda.codigo ? (
                  <View style={styles.currentBadge}>
                    <Text style={styles.currentText}>Actual</Text>
                  </View>
                ) : (
                  <>
                    <Text style={styles.previewAmount}>
                      ≈ {moneda.simbolo}
                      {cuenta ? 
                        (cuenta.cantidad * getExchangeRate(cuenta.moneda, moneda.codigo)).toLocaleString('es-MX', {
                          minimumFractionDigits: 2, 
                          maximumFractionDigits: 2 
                        })
                        : '0.00'
                      }
                    </Text>
                    <Ionicons name="arrow-forward" size={16} color="#94A3B8" />
                  </>
                )}
              </View>
              
              {convertingCurrency && cuenta?.moneda !== moneda.codigo && (
                <ActivityIndicator size="small" color="#667EEA" style={styles.convertingIndicator} />
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
        
        <View style={styles.modalFooter}>
          <Text style={styles.disclaimerText}>
            💡 Las tasas de cambio son aproximadas. El monto se convertirá automáticamente.
          </Text>
        </View>
      </View>
    </Modal>

    {/* Modal de información sobre datos opcionales */}
    <DataPrivacyModal 
      visible={infoModalVisible}
      onClose={() => setInfoModalVisible(false)}
    />
    </>
  );
};

// Función auxiliar para obtener tasas de cambio
const getExchangeRate = (fromCurrency: string, toCurrency: string): number => {
  const exchangeRates: { [key: string]: { [key: string]: number } } = {
    'USD': { 'MXN': 17.5, 'EUR': 0.85, 'GBP': 0.75, 'JPY': 110, 'CAD': 1.25 },
    'MXN': { 'USD': 0.057, 'EUR': 0.048, 'GBP': 0.043, 'JPY': 6.3, 'CAD': 0.071 },
    'EUR': { 'USD': 1.18, 'MXN': 20.6, 'GBP': 0.88, 'JPY': 130, 'CAD': 1.47 },
    'GBP': { 'USD': 1.33, 'MXN': 23.3, 'EUR': 1.14, 'JPY': 147, 'CAD': 1.67 },
    'JPY': { 'USD': 0.009, 'MXN': 0.16, 'EUR': 0.0077, 'GBP': 0.0068, 'CAD': 0.011 },
    'CAD': { 'USD': 0.8, 'MXN': 14, 'EUR': 0.68, 'GBP': 0.6, 'JPY': 88 },
  };

  if (fromCurrency === toCurrency) return 1;
  return exchangeRates[fromCurrency]?.[toCurrency] || 1;
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
    marginTop: 25,
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
    fontSize: 36,
    fontWeight: '800',
    color: 'white',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
    flexShrink: 1,
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
  balanceDetails: {
    gap: 8,
  },
  balanceDetailLabel: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '600',
  },
  balanceDetailValue: {
    fontSize: 14,
    color: '#1E293B',
    fontFamily: 'monospace',
    backgroundColor: '#F1F5F9',
    padding: 8,
    borderRadius: 6,
    marginBottom: 8,
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
  planRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  planBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  planText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  contactInfo: {
    gap: 8,
  },
  contactItem: {
    fontSize: 14,
    color: '#1E293B',
    lineHeight: 20,
  },
  bioText: {
    fontSize: 14,
    color: '#1E293B',
    lineHeight: 22,
    fontStyle: 'italic',
  },
  // Estilos para edición
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: 'white',
    gap: 6,
  },
  editButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  editContainer: {
    marginBottom: 20,
  },
  editForm: {
    paddingBottom: 20,
  },
  editSection: {
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  editSectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 16,
  },
  editField: {
    marginBottom: 16,
  },
  editFieldRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  editLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 8,
  },
  editInput: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: 'white',
    color: '#1E293B',
  },
  bioInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  monedaSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: 'white',
  },
  monedaSelectorText: {
    fontSize: 16,
    color: '#1E293B',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
    marginBottom: 20,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cancelButtonText: {
    color: '#64748B',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
  },
  // Estilos para modal de moneda
  modalContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    backgroundColor: 'white',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
  },
  monedaList: {
    flex: 1,
    paddingHorizontal: 20,
  },
  monedaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: 'white',
    borderRadius: 12,
    marginVertical: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  monedaItemSelected: {
    borderColor: '#4CAF50',
    backgroundColor: '#F0F9FF',
  },
  monedaInfo: {
    flex: 1,
  },
  monedaCodigo: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
  },
  monedaNombre: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 2,
  },
  monedaSimbolo: {
    fontSize: 18,
    fontWeight: '600',
    color: '#475569',
    marginRight: 12,
  },
  // Estilos para información opcional
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  infoButton: {
    padding: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  optionalLabel: {
    fontSize: 12,
    color: '#94A3B8',
    fontStyle: 'italic',
  },
  headerButtonsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusHint: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 4,
  },
  // Estilos para el modal de cambio de moneda
  currencyInfo: {
    backgroundColor: '#F8FAFC',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  currencyInfoLabel: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 4,
  },
  currencyInfoValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
  },
  currencyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    backgroundColor: 'white',
  },
  currencyItemSelected: {
    backgroundColor: '#F1F5F9',
    borderLeftWidth: 4,
    borderLeftColor: '#667EEA',
  },
  currencyItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  currencyIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#667EEA',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  currencySymbolModal: {
    fontSize: 20,
    fontWeight: '700',
    color: 'white',
  },
  currencyDetails: {
    flex: 1,
  },
  currencyCode: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
  },
  currencyItemRight: {
    alignItems: 'flex-end',
  },
  currentBadge: {
    backgroundColor: '#10B981',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  currentText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'white',
  },
  previewAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
    marginRight: 8,
  },
  convertingIndicator: {
    marginLeft: 8,
  },
  modalFooter: {
    padding: 20,
    backgroundColor: '#F8FAFC',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  disclaimerText: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
  },
});

export default MainAccountScreen;