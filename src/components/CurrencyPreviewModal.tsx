import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView } from "react-native";
import Modal from "react-native-modal";
import { Ionicons } from "@expo/vector-icons";
import Toast from "react-native-toast-message";
import { analyticsService, PreviewBalance } from "../services/analyticsService";
import { CurrencyField, Moneda } from "./CurrencyPicker";
import SmartNumber from "./SmartNumber";

interface Props {
  visible: boolean;
  onClose: () => void;
}

const CurrencyPreviewModal: React.FC<Props> = ({ visible, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [previewData, setPreviewData] = useState<PreviewBalance | null>(null);
  const [selectedMoneda, setSelectedMoneda] = useState<Moneda | null>({
    id: "preview-usd",
    codigo: "USD",
    nombre: "US Dollar",
    simbolo: "$",
  });

  useEffect(() => {
    if (visible && selectedMoneda) {
      fetchPreview(selectedMoneda.codigo);
    }
  }, [visible, selectedMoneda]);

  const fetchPreview = async (codigoMoneda: string) => {
    setLoading(true);
    try {
      const data = await analyticsService.getPreview(codigoMoneda);
      setPreviewData(data);
    } catch (error) {
      console.error("Error al obtener preview:", error);
      Toast.show({
        type: "error",
        text1: "Error al cargar preview",
        text2: "No se pudo obtener la conversión de moneda",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleChangeCurrency = (m: Moneda) => {
    setSelectedMoneda(m);
  };

  return (
    <Modal
      isVisible={visible}
      onSwipeComplete={onClose}
      swipeDirection="down"
      backdropOpacity={0.3}
      style={styles.modalWrapper}
      onBackdropPress={onClose}
      propagateSwipe
      animationIn="slideInUp"
      animationOut="slideOutDown"
      animationInTiming={400}
      animationOutTiming={350}
      useNativeDriver={true}
    >
      <View style={styles.modal}>
        <View style={styles.grabber} />

        <View style={styles.header}>
          <Ionicons name="cash-outline" size={24} color="#EF6C00" />
          <Text style={styles.title}>Vista previa de moneda</Text>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color="#999" />
          </TouchableOpacity>
        </View>

        <Text style={styles.description}>
          Visualiza tus balances convertidos a cualquier moneda sin modificar tu configuración.
        </Text>

        <View style={styles.currencySelector}>
          <CurrencyField
            label="Selecciona la moneda para preview"
            value={selectedMoneda}
            onChange={handleChangeCurrency}
            showSearch
          />
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#EF6C00" />
            <Text style={styles.loadingText}>Convirtiendo balances...</Text>
          </View>
        ) : previewData ? (
          <ScrollView style={styles.previewContent} showsVerticalScrollIndicator={false}>
            {/* Cuenta Principal */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Cuenta Principal</Text>
              <View style={styles.balanceCard}>
                <View style={styles.balanceRow}>
                  <Text style={styles.balanceLabel}>Balance convertido:</Text>
                  <SmartNumber
                    value={previewData.cuentaPrincipal.cantidad}
                    currentCurrency={previewData.monedaPreview}
                    allowCurrencyChange={false}
                    textStyle={styles.balanceAmount}
                    options={{
                      context: 'card',
                      currency: previewData.monedaPreview,
                      maxLength: 20
                    }}
                  />
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Moneda original:</Text>
                  <Text style={styles.infoValue}>{previewData.cuentaPrincipal.monedaOriginal}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Tasa de conversión:</Text>
                  <Text style={styles.infoValue}>{previewData.cuentaPrincipal.tasaConversion.toFixed(6)}</Text>
                </View>
              </View>
            </View>

            {/* Subcuentas */}
            {previewData.subcuentas.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Subcuentas</Text>
                {previewData.subcuentas.map((subcuenta) => (
                  <View
                    key={subcuenta.id}
                    style={[
                      styles.subcuentaCard,
                      !subcuenta.activa && styles.subcuentaInactiva,
                    ]}
                  >
                    <View style={styles.subcuentaHeader}>
                      <View style={[styles.colorDot, { backgroundColor: subcuenta.color }]} />
                      <Text style={styles.subcuentaNombre}>{subcuenta.nombre}</Text>
                      {!subcuenta.activa && (
                        <Text style={styles.inactiveTag}>Inactiva</Text>
                      )}
                    </View>
                    <View style={styles.subcuentaContent}>
                      <SmartNumber
                        value={subcuenta.cantidad}
                        currentCurrency={previewData.monedaPreview}
                        allowCurrencyChange={false}
                        textStyle={styles.subcuentaAmount}
                        options={{
                          context: 'list',
                          currency: previewData.monedaPreview,
                          maxLength: 15
                        }}
                      />
                      <Text style={styles.subcuentaOriginal}>
                        De {subcuenta.monedaOriginal} • {subcuenta.tasaConversion.toFixed(4)}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Total General */}
            <View style={styles.totalSection}>
              <Text style={styles.totalLabel}>Total General</Text>
              <SmartNumber
                value={previewData.totalGeneral}
                currentCurrency={previewData.monedaPreview}
                allowCurrencyChange={false}
                textStyle={styles.totalAmount}
                options={{
                  context: 'card',
                  currency: previewData.monedaPreview,
                  maxLength: 20
                }}
              />
            </View>

            {/* Timestamp */}
            <Text style={styles.timestamp}>
              Actualizado: {new Date(previewData.timestamp).toLocaleString()}
            </Text>
          </ScrollView>
        ) : (
          <View style={styles.emptyContainer}>
            <Ionicons name="information-circle-outline" size={48} color="#999" />
            <Text style={styles.emptyText}>Selecciona una moneda para ver el preview</Text>
          </View>
        )}

        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Text style={styles.closeButtonText}>Cerrar</Text>
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
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 30,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "90%",
  },
  grabber: {
    width: 40,
    height: 5,
    backgroundColor: "#ccc",
    borderRadius: 3,
    alignSelf: "center",
    marginBottom: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
    flex: 1,
    textAlign: "center",
  },
  description: {
    fontSize: 13,
    color: "#666",
    textAlign: "center",
    marginBottom: 16,
    lineHeight: 18,
  },
  currencySelector: {
    marginBottom: 20,
  },
  loadingContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#666",
  },
  previewContent: {
    maxHeight: 400,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#444",
    marginBottom: 10,
  },
  balanceCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  balanceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  balanceLabel: {
    fontSize: 13,
    color: "#666",
    fontWeight: "500",
  },
  balanceAmount: {
    fontSize: 20,
    fontWeight: "700",
    color: "#333",
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
  },
  infoLabel: {
    fontSize: 12,
    color: "#888",
  },
  infoValue: {
    fontSize: 12,
    color: "#444",
    fontWeight: "500",
  },
  subcuentaCard: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: "#EF6C00",
  },
  subcuentaInactiva: {
    opacity: 0.6,
    borderLeftColor: "#999",
  },
  subcuentaHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  colorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  subcuentaNombre: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    flex: 1,
  },
  inactiveTag: {
    fontSize: 10,
    color: "#999",
    backgroundColor: "#f0f0f0",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  subcuentaContent: {
    paddingLeft: 18,
  },
  subcuentaAmount: {
    fontSize: 16,
    fontWeight: "700",
    color: "#444",
    marginBottom: 4,
  },
  subcuentaOriginal: {
    fontSize: 11,
    color: "#888",
  },
  totalSection: {
    backgroundColor: "#EF6C0015",
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#EF6C0030",
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#EF6C00",
    marginBottom: 8,
  },
  totalAmount: {
    fontSize: 24,
    fontWeight: "700",
    color: "#EF6C00",
  },
  timestamp: {
    fontSize: 10,
    color: "#999",
    textAlign: "center",
    marginTop: 8,
    marginBottom: 16,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 14,
    color: "#999",
    textAlign: "center",
  },
  closeButton: {
    marginTop: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  closeButtonText: {
    fontSize: 15,
    color: "#888",
    fontWeight: "500",
  },
});

export default CurrencyPreviewModal;
