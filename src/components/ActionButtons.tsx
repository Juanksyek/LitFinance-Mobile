import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import MovementModal from './MovementModal';
import SubaccountModal from './SubaccountModal';

const { width } = Dimensions.get("window");

const actions = [
  { icon: "arrow-up-outline", label: "Ingreso" },
  { icon: "arrow-down-outline", label: "Egreso" },
  { icon: "add-outline", label: "Subcuenta" },
  { icon: "refresh-outline", label: "Recurrente" },
];

interface ActionButtonsProps {
  cuentaId: string;
  onRefresh: () => void;
  showSubcuentaButton?: boolean;
  isSubcuenta?: boolean;
  subcuenta?: { cuentaPrincipalId: string; subCuentaId: string };
  fetchSubcuenta?: () => void;
  
}

const ActionButtons = ({
  cuentaId,
  onRefresh,
  showSubcuentaButton = true,
  isSubcuenta = false,
  subcuenta,
  fetchSubcuenta,
}: ActionButtonsProps) => {

  const [modalVisible, setModalVisible] = useState(false);
  const [subcuentaModalVisible, setSubcuentaModalVisible] = useState(false);
  const [tipo, setTipo] = useState<'ingreso' | 'egreso'>('ingreso');
  const [refreshKey, setRefreshKey] = useState(Date.now());

  const handlePress = (label: string) => {
    if (label === 'Ingreso' || label === 'Egreso') {
      setTipo(label.toLowerCase() as 'ingreso' | 'egreso');
      setModalVisible(true);
    } else if (label === 'Subcuenta') {
      setSubcuentaModalVisible(true);
    }
  };

  const visibleActions = actions.filter(action => {
    if (isSubcuenta && action.label === 'Subcuenta') return false;
    if (!showSubcuentaButton && action.label === 'Subcuenta') return false;
    return true;
  });

  if (__DEV__ && isSubcuenta && !subcuenta) {
    console.error('❌ subcuenta es undefined cuando isSubcuenta=true');
  }

  return (
    <>
      <View style={styles.container}>
        {visibleActions.map((action, index) => (
          <View key={index} style={styles.buttonWrapper}>
            <TouchableOpacity
              style={[styles.button, styles.neumorphic]}
              onPress={() => handlePress(action.label)}
            >
              <Ionicons name={action.icon} size={20} color="#EF6C00" />
            </TouchableOpacity>
            <Text style={styles.label}>{action.label}</Text>
          </View>
        ))}
      </View>

      <MovementModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        tipo={tipo}
        cuentaId={isSubcuenta && subcuenta ? subcuenta.cuentaPrincipalId : cuentaId}
        isSubcuenta={isSubcuenta}
        subcuentaId={isSubcuenta && subcuenta ? subcuenta.subCuentaId : undefined}
        onSuccess={isSubcuenta ? fetchSubcuenta ?? (() => {}) : onRefresh}
        onRefresh={() => setRefreshKey(Date.now())}
      />

      {/* Modal para subcuenta */}
      {showSubcuentaButton && (
        <SubaccountModal
          visible={subcuentaModalVisible}
          onClose={() => setSubcuentaModalVisible(false)}
          cuentaPrincipalId={cuentaId}
          onSuccess={onRefresh}
        />
      )}
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  buttonWrapper: {
    alignItems: "center",
    width: width / 4 - 24,
  },
  button: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  label: {
    fontSize: 12,
    color: "#757575",
  },
  neumorphic: {
    backgroundColor: "#f0f0f3",
    shadowColor: "#000",
    shadowOffset: { width: 6, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 6,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.7)",
  },
  neumorphicPressed: {
    backgroundColor: "#f0f0f3",
    shadowColor: "#000",
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.7)",
  },
});

export default ActionButtons;
