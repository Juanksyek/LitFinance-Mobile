import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import MovementModal from './MovementModal';

const { width } = Dimensions.get("window");

const actions = [
  { icon: "arrow-up-outline", label: "Ingreso" },
  { icon: "arrow-down-outline", label: "Egreso" },
  { icon: "add-outline", label: "Subcuenta" },
  { icon: "refresh-outline", label: "Recurrente" },
];

const ActionButtons = ({ cuentaId, onRefresh }: { cuentaId: string, onRefresh: () => void }) => {
  const [modalVisible, setModalVisible] = useState(false);
  const [tipo, setTipo] = useState<'ingreso' | 'egreso'>('ingreso');

  const handlePress = (label: string) => {
    if (label === 'Ingreso' || label === 'Egreso') {
      setTipo(label.toLowerCase() as 'ingreso' | 'egreso');
      setModalVisible(true);
    }
  };

  return (
    <>
      <View style={styles.container}>
        {actions.map((action, index) => (
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
        cuentaId={cuentaId}
        onSuccess={onRefresh}
      />
    </>
  );
};

const ActionButton = ({ icon, label }: { icon: string; label: string }) => {
  const [isPressed, setIsPressed] = useState(false);

  return (
    <View style={styles.buttonWrapper}>
      <TouchableOpacity
        style={[
          styles.button,
          isPressed ? styles.neumorphicPressed : styles.neumorphic,
        ]}
        onPressIn={() => setIsPressed(true)}
        onPressOut={() => setIsPressed(false)}
        activeOpacity={1}
      >
        <Ionicons name={icon} size={20} color="#EF6C00" />
      </TouchableOpacity>
      <Text style={styles.label}>{label}</Text>
    </View>
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
