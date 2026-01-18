import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import MovementModal from './MovementModal';
import SubaccountModal from './SubaccountModal';
import RecurrentModal from './RecurrentModal';
import { API_BASE_URL } from "../constants/api";
import Toast from "react-native-toast-message";
import { useNavigation } from '@react-navigation/native';
import { useThemeColors } from "../theme/useThemeColors";
import { canPerform } from '../services/planConfigService';
import { emitRecurrentesChanged, emitSubcuentasChanged } from "../utils/dashboardRefreshBus";

const { width } = Dimensions.get("window");

const actions: { icon: "arrow-up-outline" | "arrow-down-outline" | "add-outline" | "refresh-outline" | "stats-chart-outline", label: string }[] = [
  { icon: "arrow-up-outline", label: "Ingreso" },
  { icon: "arrow-down-outline", label: "Egreso" },
  { icon: "add-outline", label: "Subcuenta" },
  { icon: "refresh-outline", label: "Recurrente" },
  { icon: "stats-chart-outline", label: "Analiticas"} // icono válido
];

interface ActionButtonsProps {
  cuentaId?: string;
  onRefresh: () => void;
  showSubcuentaButton?: boolean;
  isSubcuenta?: boolean;
  subcuenta?: { cuentaPrincipalId: string; subCuentaId: string };
  fetchSubcuenta?: () => void;
  plataformas?: any[];
  userId?: string;
  onAnalyticsPress?: () => void;
}

const ActionButtons = ({
  cuentaId,
  onRefresh,
  showSubcuentaButton = true,
  isSubcuenta = false,
  subcuenta,
  fetchSubcuenta,
  plataformas = [],
  userId,
  onAnalyticsPress,
}: ActionButtonsProps) => {
  const colors = useThemeColors();
  console.log('🧭 [ActionButtons] render', { cuentaId, isSubcuenta });

  const [modalVisible, setModalVisible] = useState(false);
  const [subcuentaModalVisible, setSubcuentaModalVisible] = useState(false);
  const [recurrentModalVisible, setRecurrentModalVisible] = useState(false);
  const [tipo, setTipo] = useState<'ingreso' | 'egreso'>('ingreso');
  const [refreshKey, setRefreshKey] = useState(Date.now());
  const navigation = useNavigation();

  const visibleActions = actions.filter(action => {
    if (isSubcuenta && action.label === 'Subcuenta') return false;
    if (!showSubcuentaButton && action.label === 'Subcuenta') return false;
    return true;
  });

  const handlePress = async (label: string) => {
    console.log('🧭 [ActionButtons] handlePress', { label, cuentaId });
    // If no cuentaId yet, inform the user and avoid opening modals
    if (!cuentaId) {
      Toast.show({ type: 'info', text1: 'Cargando datos', text2: 'Espera un momento mientras iniciamos sesión' });
      return;
    }
    if (label === 'Ingreso' || label === 'Egreso') {
      setTipo(label.toLowerCase() as 'ingreso' | 'egreso');
      setModalVisible(true);
      return;
    }

    if (label === 'Subcuenta') {
      const gate = await canPerform('subcuenta', { userId });
      // debug logs removidos
      if (gate.allowed === false) {
        const isConfigError = gate.message?.includes('Configuración de plan no disponible');
        // Toast removido
        return;
      }
      setSubcuentaModalVisible(true);
      return;
    }

    if (label === 'Recurrente') {
      const gate = await canPerform('recurrente', { userId });
      // debug logs removidos
      if (gate.allowed === false) {
        const isConfigError = gate.message?.includes('Configuración de plan no disponible');
        // Toast removido
        return;
      }
      setRecurrentModalVisible(true);
      return;
    }

    if (label === 'Analiticas') {
      const gate = await canPerform('grafica');
      if (gate.allowed === false) {
        Toast.show({
          type: 'info',
          text1: 'Función Premium',
          text2:
            gate.message ||
            'Las gráficas avanzadas están disponibles solo para usuarios premium',
        });
        return;
      }
      if (onAnalyticsPress) {
        onAnalyticsPress();
      } else {
        navigation.navigate('Analytics' as never);
      }
    }
  };

  // visibleActions declared above

  const handleRecurrenteSubmit = async (data: any) => {
    try {
      const res = await fetch(`${API_BASE_URL}/recurrentes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      // Refrescar solo la lista de recurrentes (evitar refresh global)
      emitRecurrentesChanged();
    } catch (err) {
      Toast.show({
        type: 'error',
        text1: 'Error al crear el recurrente',
        text2: 'Por favor intenta nuevamente o revisa tu conexión',
      });
    }
  };

  return (
    <>
      <View style={styles.container}>
        {visibleActions.map((action, index) => (
          <View
            key={index}
            style={styles.buttonWrapper}
          >
            <TouchableOpacity
              style={[
                styles.button,
                { backgroundColor: colors.card, shadowColor: colors.shadow, borderColor: colors.border },
                !cuentaId && { opacity: 0.5 },
              ]}
              onPress={() => handlePress(action.label)}
              disabled={!cuentaId}
            >
              <Ionicons name={action.icon} size={20} color={colors.button} />
            </TouchableOpacity>
            <Text style={[styles.label, { color: colors.textSecondary }]}>{action.label}</Text>
          </View>
        ))}
      </View>

      <MovementModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        tipo={tipo}
        cuentaId={isSubcuenta && subcuenta ? subcuenta.cuentaPrincipalId : (cuentaId ?? '')}
        isSubcuenta={isSubcuenta}
        subcuentaId={isSubcuenta && subcuenta ? subcuenta.subCuentaId : ''}
        onSuccess={isSubcuenta ? fetchSubcuenta ?? (() => {}) : onRefresh}
        onRefresh={() => setRefreshKey(Date.now())}
      />

      {showSubcuentaButton && (
        <SubaccountModal
          visible={subcuentaModalVisible}
          onClose={() => setSubcuentaModalVisible(false)}
          cuentaPrincipalId={cuentaId ?? ''}
          onSuccess={() => {
            emitSubcuentasChanged();
          }}
        />
      )}

      <RecurrentModal
        visible={recurrentModalVisible}
        onClose={() => setRecurrentModalVisible(false)}
        onSubmit={handleRecurrenteSubmit}
        plataformas={plataformas}
        cuentaId={cuentaId ?? ''}
        subcuentaId={isSubcuenta && subcuenta ? subcuenta.subCuentaId : ''}
        userId={userId ?? ''}
      />
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 24,
    marginTop: 14,
    paddingHorizontal: 10,
  },
  buttonWrapper: {
    alignItems: "center",
    width: width / 4 - 34,
  },
  button: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
    shadowOffset: { width: 6, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    borderWidth: 1,
  },
  label: {
    fontSize: 10,
  },
});

export default ActionButtons;
// commit 