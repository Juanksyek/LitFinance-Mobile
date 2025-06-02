import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import Modal from "react-native-modal";

interface Props {
  visible: boolean;
  onClose: () => void;
}

const AccountSettingsModal: React.FC<Props> = ({ visible, onClose }) => {
  return (
    <Modal
      isVisible={visible}
      onSwipeComplete={onClose}
      swipeDirection="down"
      backdropOpacity={0}
      style={styles.modalWrapper}
      onBackdropPress={onClose}
      propagateSwipe={true}
    >
      <View style={styles.modal}>
        <View style={styles.grabber} />

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
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalWrapper: {
    justifyContent: "flex-end",
    margin: 0,
  },
  modal: {
    backgroundColor: "#f0f0f3",
    padding: 24,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.7)",
  },
  grabber: {
    width: 40,
    height: 5,
    backgroundColor: "#ccc",
    borderRadius: 3,
    alignSelf: "center",
    marginBottom: 12,
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
    marginBottom: 26,
    color: "#888",
  },
});

export default AccountSettingsModal;