import React, { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator, Dimensions } from 'react-native';
import { API_BASE_URL } from '../constants/api';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import DeleteModal from './DeleteModal';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import SmartNumber from './SmartNumber';
import { useThemeColors } from '../theme/useThemeColors';

const { width } = Dimensions.get('window');

interface Props {
  subcuentaId: string;
  userId: string;
  onRefresh?: () => void;
}

const SubaccountRecurrentesList = ({ subcuentaId, userId, onRefresh }: Props) => {
  const colors = useThemeColors();
  interface Recurrente {
    recurrenteId: string;
    nombre: string;
    monto: number;
    moneda: string;
    proximaEjecucion: string;
    plataforma?: { color: string; nombre: string; categoria: string };
    frecuenciaTipo: 'dia_semana' | 'dia_mes' | 'fecha_anual';
    frecuenciaValor: string;
    afectaCuentaPrincipal: boolean;
    afectaSubcuenta: boolean;
    recordatorios?: number[];
    cuentaId?: string;
    userId?: string;
    pausado?: boolean;
  }

  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const [recurrentes, setRecurrentes] = useState<Recurrente[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [deleteVisible, setDeleteVisible] = useState(false);

  const fetchRecurrentes = async () => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('authToken');
      const res = await fetch(`${API_BASE_URL}/recurrentes?userId=${userId}&subcuentaId=${subcuentaId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setRecurrentes(data.items || []);
    } catch (err) {
      Toast.show({
        type: 'error',
        text1: 'Error al cargar',
        text2: 'No se pudieron cargar los recurrentes',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      await fetch(`${API_BASE_URL}/recurrentes/${selectedId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      Toast.show({
        type: 'success',
        text1: 'Recurrente eliminado',
      });
      setDeleteVisible(false);
      fetchRecurrentes();
      if (onRefresh) onRefresh();
    } catch (err) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'No se pudo eliminar el recurrente',
      });
      setDeleteVisible(false);
    }
  };

  useEffect(() => {
    fetchRecurrentes();
  }, [subcuentaId, userId]);

  if (loading) {
    return <ActivityIndicator color={colors.button} style={{ marginTop: 20 }} />;
  }

  if (!recurrentes.length) {
    return (
      <View style={[styles.emptyContainer, { backgroundColor: colors.card }]}>
        <Ionicons name="calendar-outline" size={48} color={colors.placeholder} />
        <Text style={[styles.emptyTitle, { color: colors.text }]}>Sin recurrentes</Text>
        <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
          No hay recurrentes registrados para esta subcuenta.
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.wrapper, { backgroundColor: colors.inputBackground, shadowColor: colors.shadow }]}>
      <Text style={[styles.title, { color: colors.text }]}>Recurrentes</Text>
      <FlatList
        data={recurrentes}
        keyExtractor={(item) => item.recurrenteId}
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => navigation.navigate('RecurrenteDetail', { recurrente: { ...item, pausado: item.pausado ?? false } })}
            style={[styles.card, { borderColor: colors.button, backgroundColor: colors.card }]}
          >
            <View>
              <Text style={[styles.nombre, { color: colors.text }]} numberOfLines={1}>{item.nombre}</Text>
              <Text style={[styles.monto, { color: colors.text }]}>
                ${item.monto >= 1000000 
                  ? `${(item.monto / 1000000).toFixed(1)}M`
                  : item.monto.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                }
              </Text>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>Próxima: {item.proximaEjecucion.slice(0, 10)}</Text>
              </View>
            </View>
          </TouchableOpacity>
        )}
        scrollEnabled={false}
        numColumns={2}
        columnWrapperStyle={{ justifyContent: 'space-between', marginBottom: 14 }}
        contentContainerStyle={{ paddingBottom: 16 }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 40,
    borderRadius: 14,
    padding: 16,
    shadowOpacity: 0.06,
    shadowRadius: 5,
    elevation: 3,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 10,
  },
  card: {
    width: (width - 64) / 2 - 8,
    height: 100,
    padding: 12,
    borderRadius: 10,
    borderWidth: 2,
    justifyContent: 'space-between',
  },
  nombre: {
    fontSize: 12,
    fontWeight: '600',
  },
  monto: {
    fontSize: 14,
    fontWeight: '700',
  },
  badge: {
    backgroundColor: '#E0E7FF',
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 4,
  },
  badgeText: {
    fontSize: 10,
    color: '#3730A3',
    fontWeight: '500',
  },
  iconActions: {
    position: 'absolute',
    top: 6,
    right: 6,
  },
  emptyContainer: {
    padding: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    fontWeight: '400',
  },
});

export default SubaccountRecurrentesList;
