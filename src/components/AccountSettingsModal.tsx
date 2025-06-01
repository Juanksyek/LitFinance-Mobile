import React from "react";
import { Modal, View, Text, StyleSheet, TouchableOpacity } from "react-native";

interface Props {
  visible: boolean;
  onClose: () => void;
}

const AccountSettingsModal: React.FC<Props> = ({ visible, onClose }) => {
  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <Text style={styles.title}>Ajustes de cuenta</Text>

          <TouchableOpacity style={styles.option}>
            <Text style={styles.optionText}>Renombrar cuenta</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.option}>
            <Text style={styles.optionText}>Cambiar moneda</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={onClose}>
            <Text style={styles.cancelText}>Cerrar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  modal: {
    backgroundColor: "#f0f0f3",
    padding: 24,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.7)",
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 16,
    textAlign: "center",
    color: "#EF6C00",
  },
  option: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#ddd",
  },
  optionText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#444",
  },
  cancelText: {
    textAlign: "center",
    marginTop: 16,
    color: "#888",
  },
});

export default AccountSettingsModal;
