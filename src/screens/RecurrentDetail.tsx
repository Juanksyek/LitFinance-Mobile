// commnt
import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar, Dimensions } from "react-native";
import { RouteProp, useRoute, useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import RecurrentModal from "../components/RecurrentModal";
import { API_BASE_URL } from '../constants/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import DeleteModal from '../components/DeleteModal';

const { width } = Dimensions.get('window');

type RecurrenteDetailRouteProp = RouteProp<{
  RecurrenteDetail: {
    recurrente: {
      recurrenteId: string;
      nombre: string;
      monto: number;
      frecuenciaTipo: string;
      frecuenciaValor: string;
      proximaEjecucion: string;
      plataforma?: { nombre: string; categoria: string };
      afectaCuentaPrincipal: boolean;
      afectaSubcuenta: boolean;
      recordatorios?: number[];
      userId?: string;
      cuentaId?: string;
      pausado?: boolean;
    }
  }
}, "RecurrenteDetail">;

const obtenerDescripcionFrecuencia = (tipo: string, valor: string): string => {
  switch (tipo) {
    case 'dia_mes':
      return `Cada día ${valor} del mes`;
    case 'dia_semana':
      return `Cada ${obtenerNombreDia(valor)}`;
    case 'fecha_fija':
      return `Cada ${obtenerFechaCompleta(valor)}`;
    case 'dias':
      return `Cada ${valor} días`;
    default:
      return 'Frecuencia desconocida';
  }
};

const formatearFechaLocal = (fechaISO: string) => {
  const fecha = new Date(fechaISO);
  const fechaLocal = new Date(fecha.getTime() + fecha.getTimezoneOffset() * 60000);

  return fechaLocal.toLocaleDateString('es-MX', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

const obtenerNombreDia = (valor: string): string => {
  const dias = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const index = parseInt(valor);
  return dias[index] || 'día desconocido';
};

const obtenerFechaCompleta = (valor: string): string => {
  const partes = valor.split('-');
  if (partes.length !== 2) return valor;
  const [dia, mes] = partes;
  const meses = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
  ];
  return `el ${dia} de ${meses[parseInt(mes) - 1]}`;
};

const RecurrenteDetail = () => {
  const route = useRoute<RecurrenteDetailRouteProp>();
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const [recurrente, setRecurrente] = useState(route.params.recurrente);
  const [deleteVisible, setDeleteVisible] = useState(false);

  const [modalVisible, setModalVisible] = useState(false);

  const formatCurrency = (amount: number, currency: string = 'MXN') => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const NeumorphicCard = ({ children, style = {}, pressed = false }: { children: React.ReactNode; style?: any; pressed?: boolean }) => (
    <View style={[styles.neumorphicCard, pressed ? styles.neumorphicCardPressed : null, style]}>
      {children}
    </View>
  );

  const InfoSection = ({ icon, title, value, subtitle, children }: {
    icon: keyof typeof Ionicons.glyphMap;
    title: string;
    value?: string;
    subtitle?: string;
    children?: React.ReactNode;
  }) => (
    <NeumorphicCard style={styles.infoSection}>
      <View style={styles.infoHeader}>
        <View style={styles.iconContainer}>
          <Ionicons name={icon} size={20} color="#6B7280" />
        </View>
        <Text style={styles.infoTitle}>{title}</Text>
      </View>
      {value && <Text style={styles.infoValue}>{value}</Text>}
      {subtitle && <Text style={styles.infoSubtitle}>{subtitle}</Text>}
      {children}
    </NeumorphicCard>
  );

  const ActionButton = ({ onPress, icon, text, primary = false }: {
    onPress: () => void;
    icon: keyof typeof Ionicons.glyphMap;
    text: string;
    primary?: boolean;
  }) => (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={[styles.actionButton, primary ? styles.primaryActionButton : styles.secondaryActionButton]}
    >
      <Ionicons name={icon} size={18} color={primary ? "#FFFFFF" : "#6B7280"} />
      <Text style={[styles.actionButtonText, primary ? styles.primaryActionButtonText : styles.secondaryActionButtonText]}>
        {text}
      </Text>
    </TouchableOpacity>
  );

  const toggleEstadoRecurrente = async () => {
    try {
      const token = await AsyncStorage.getItem("authToken");
      const endpoint = `${API_BASE_URL}/recurrentes/${recurrente.recurrenteId}/${recurrente.pausado ? 'reanudar' : 'pausar'}`;
      const res = await fetch(endpoint, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.message || 'Error al actualizar estado');

      Toast.show({
        type: 'success',
        text1: 'Recurrente actualizado',
      });

      setTimeout(() => {
        navigation.navigate('Dashboard', { updated: true });
      }, 600);

      setRecurrente({ ...recurrente, pausado: !recurrente.pausado });
    } catch (err) {
      Toast.show({
        type: 'error',
        text1: 'Error al cambiar estado',
        text2: 'No se pudo pausar o reanudar el recurrente',
      });
    }
  };

  const handleDelete = async () => {
    try {
      const token = await AsyncStorage.getItem("authToken");
      if (!token) return;

      await fetch(`${API_BASE_URL}/recurrentes/${recurrente.recurrenteId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      Toast.show({
        type: 'success',
        text1: 'Recurrente eliminado',
      });

      setDeleteVisible(false);
      navigation.navigate('Dashboard', { updated: true });
    } catch (error) {
      console.error('Error al eliminar recurrente:', error);
      Toast.show({
        type: 'error',
        text1: 'Hubo un problema al eliminar',
      });
    }
  };

  return (
    <>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton} activeOpacity={0.8}>
            <Ionicons name="chevron-back" size={24} color="#6B7280" />
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Detalle</Text>
            <Text style={styles.headerSubtitle}>Pago recurrente</Text>
          </View>

          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.amountSection}>
          <NeumorphicCard style={styles.amountCard}>
            <Text style={styles.serviceTitle}>{recurrente.nombre}</Text>
            <Text style={styles.amountValue}>{formatCurrency(recurrente.monto)}</Text>
          </NeumorphicCard>
        </View>

        <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
          <View style={styles.section}>
            <InfoSection
              icon="repeat"
              title="Frecuencia"
              value={obtenerDescripcionFrecuencia(recurrente.frecuenciaTipo, recurrente.frecuenciaValor)}
            />

            <InfoSection
              icon="calendar"
              title="Próxima ejecución"
              value={formatearFechaLocal(recurrente.proximaEjecucion)}
            />
          </View>

          <View style={styles.section}>
            <InfoSection icon="card" title="Plataforma">
              <View style={styles.platformContainer}>
                <View style={styles.platformInfo}>
                  <Text style={styles.platformName}>{recurrente.plataforma?.nombre || "N/A"}</Text>
                  <Text style={styles.platformCategory}>{recurrente.plataforma?.categoria}</Text>
                </View>
              </View>
            </InfoSection>
          </View>

          <View style={styles.section}>
            <InfoSection
              icon="wallet"
              title="Aplica a"
              value={
                recurrente.afectaCuentaPrincipal
                  ? "Cuenta principal"
                  : recurrente.afectaSubcuenta
                    ? "Subcuenta"
                    : "No especificado"
              }
            />
          </View>

          <View style={styles.section}>
            <InfoSection icon="notifications" title="Recordatorios">
              <View style={styles.remindersContainer}>
                {(recurrente.recordatorios?.length ?? 0) > 0 ? (
                  <View style={styles.remindersList}>
                    {recurrente.recordatorios?.map((days: number, index: number) => (
                      <View key={index} style={styles.reminderChip}>
                        <Text style={styles.reminderText}>{days} días antes</Text>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text style={styles.noRemindersText}>Sin recordatorios</Text>
                )}
              </View>
            </InfoSection>
          </View>

          <View style={styles.actionSection}>
            <ActionButton onPress={() => setModalVisible(true)} icon="create" text="Editar" primary={true} />
            <ActionButton
              onPress={toggleEstadoRecurrente}
              icon={recurrente.pausado ? "play" : "pause"}
              text={recurrente.pausado ? "Reanudar" : "Pausar"}
            />
            <TouchableOpacity onPress={() => setDeleteVisible(true)}>
              <Ionicons name="trash-outline" size={24} color="#EF4444" />
            </TouchableOpacity>
          </View>

          {modalVisible && (
            <RecurrentModal
              visible={modalVisible}
              onClose={() => setModalVisible(false)}
              onSubmit={(data) => {
                setRecurrente(data);
                setModalVisible(false);
              }}
              cuentaId={recurrente.cuentaId || '0000000'}
              userId={recurrente.userId || "0000000"}
              plataformas={recurrente.plataforma ? [recurrente.plataforma] : []}
              recurrenteExistente={recurrente}
            />
          )}

          {modalVisible && (
            <RecurrentModal
              visible={modalVisible}
              onClose={() => setModalVisible(false)}
              onSubmit={(data) => {
                setRecurrente(data);
                setModalVisible(false);
              }}
              cuentaId={recurrente.cuentaId || '0000000'}
              userId={recurrente.userId || "0000000"}
              plataformas={recurrente.plataforma ? [recurrente.plataforma] : []}
              recurrenteExistente={recurrente}
            />
          )}
          <View style={styles.bottomSpacer} />
        </ScrollView>
      </View>
      <DeleteModal
        visible={deleteVisible}
        onCancel={() => setDeleteVisible(false)}
        onConfirm={handleDelete}
        title="Eliminar recurrente"
        message="¿Estás seguro de que deseas eliminar este recurrente? Esta acción no se puede deshacer."
      />
    </>
  );
};

export default RecurrenteDetail;
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#F8FAFC",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: -2,
      height: -2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1F2937",
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: 14,
    color: "#6B7280",
  },
  headerSpacer: {
    width: 44,
  },
  amountSection: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  amountCard: {
    alignItems: "center",
    paddingVertical: 30,
    paddingHorizontal: 20,
  },
  serviceTitle: {
    fontSize: 16,
    fontWeight: "500",
    color: "#6B7280",
    marginBottom: 8,
    textAlign: "center",
  },
  amountValue: {
    fontSize: 32,
    fontWeight: "700",
    color: "#1F2937",
    letterSpacing: -0.5,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 20,
  },
  section: {
    marginBottom: 20,
  },
  neumorphicCard: {
    backgroundColor: "#F8FAFC",
    borderRadius: 20,
    padding: 20,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: {
      width: 8,
      height: 8,
    },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 8,
    borderWidth: 1,
    borderColor: "#FFFFFF",
  },
  neumorphicCardPressed: {
    shadowOffset: {
      width: 4,
      height: 4,
    },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 4,
  },
  infoSection: {
    marginBottom: 8,
  },
  infoHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
    shadowColor: "#000",
    shadowOffset: {
      width: 2,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: "500",
    color: "#6B7280",
  },
  infoValue: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1F2937",
    marginBottom: 4,
  },
  infoSubtitle: {
    fontSize: 14,
    color: "#9CA3AF",
    textTransform: "capitalize",
  },
  platformContainer: {
    marginTop: 8,
  },
  platformInfo: {
    alignItems: "flex-start",
  },
  platformName: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1F2937",
    marginBottom: 4,
  },
  platformCategory: {
    fontSize: 14,
    color: "#6B7280",
    textTransform: "capitalize",
  },
  remindersContainer: {
    marginTop: 8,
  },
  remindersList: {
    gap: 8,
  },
  reminderChip: {
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    alignSelf: "flex-start",
    shadowColor: "#000",
    shadowOffset: {
      width: 1,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  reminderText: {
    fontSize: 14,
    color: "#6B7280",
    fontWeight: "500",
  },
  noRemindersText: {
    fontSize: 14,
    color: "#9CA3AF",
    fontStyle: "italic",
    marginTop: 8,
  },
  actionSection: {
    marginTop: 20,
    gap: 12,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 16,
    gap: 8,
    shadowColor: "#000",
    shadowOffset: {
      width: 4,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryActionButton: {
    backgroundColor: "#1F2937",
  },
  secondaryActionButton: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  primaryActionButtonText: {
    color: "#FFFFFF",
  },
  secondaryActionButtonText: {
    color: "#6B7280",
  },
  bottomSpacer: {
    height: 40,
  },
});