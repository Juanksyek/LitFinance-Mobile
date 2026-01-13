import React, { useState } from "react";
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Switch, Dimensions, KeyboardAvoidingView, Platform } from "react-native";
import Modal from "react-native-modal";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Toast from "react-native-toast-message";
import { API_BASE_URL } from "../constants/api";
import SmartInput from './SmartInput';
import SmartNumber from './SmartNumber';
import { CurrencyField, Moneda } from "../components/CurrencyPicker";
import { useThemeColors } from "../theme/useThemeColors";

const SCREEN_HEIGHT = Dimensions.get("window").height;

interface Props {
  visible: boolean;
  onClose: () => void;
  cuentaPrincipalId: string;
  onSuccess: () => void;
  subcuentaToEdit?: {
    id: string;
    nombre: string;
    cantidad: number;
    moneda: string;
    simbolo: string;
    color: string;
    afectaCuenta: boolean;
  };
}

const presetColors = [
  "#4CAF50", "#EF6C00", "#1976D2",
  "#9C27B0", "#FFEB3B", "#E91E63",
  "#795548", "#00BCD4", "#F44336",
  "#3F51B5", "#607D8B", "#8BC34A",
];

const SubaccountModal: React.FC<Props> = ({
  visible,
  onClose,
  cuentaPrincipalId,
  onSuccess,
  subcuentaToEdit,
}) => {
  const colors = useThemeColors();
  const [nombre, setNombre] = useState(subcuentaToEdit?.nombre || "");
  const [moneda, setMoneda] = useState(subcuentaToEdit?.moneda || "MXN");
  const [simbolo, setSimbolo] = useState(subcuentaToEdit?.simbolo || "$");
  const [color, setColor] = useState(subcuentaToEdit?.color || "#4CAF50");
  const [afectaCuenta, setAfectaCuenta] = useState(subcuentaToEdit?.afectaCuenta ?? true);
  const [loading, setLoading] = useState(false);
  const [cantidadNumerica, setCantidadNumerica] = useState<number | null>(subcuentaToEdit?.cantidad || 0);
  const [cantidadValida, setCantidadValida] = useState(true);
  const [erroresCantidad, setErroresCantidad] = useState<string[]>([]);
  const [selectedMonedaObj, setSelectedMonedaObj] = useState<Moneda | null>(null);
  const [usarSaldoCuentaPrincipal, setUsarSaldoCuentaPrincipal] = useState<boolean>(false);

  React.useEffect(() => {
    if (subcuentaToEdit) {
      setNombre(subcuentaToEdit.nombre);
      setCantidadNumerica(subcuentaToEdit.cantidad);
      setMoneda(subcuentaToEdit.moneda);
      setSimbolo(subcuentaToEdit.simbolo);
      setColor(subcuentaToEdit.color);
      setAfectaCuenta(subcuentaToEdit.afectaCuenta);
    } else {
      setNombre("");
      setCantidadNumerica(0);
      setMoneda("MXN");
      setSimbolo("$");
      setColor("#4CAF50");
      setAfectaCuenta(true);
      setUsarSaldoCuentaPrincipal(false);
    }
  }, [subcuentaToEdit]);

  const getLimitesSubcuenta = () => ({
    min: 0,
    max: 999999999999,
    warning: 100000000,
  });

  const handleCantidadChange = (value: number | null) => {
    setCantidadNumerica(value);
  };

  const handleCantidadValidation = (isValid: boolean, errors: string[]) => {
    setCantidadValida(isValid);
    setErroresCantidad(errors);
  };

  const handleCreate = async () => {
    if (!nombre.trim()) {
      Toast.show({
        type: "error",
        text1: "Nombre requerido",
        text2: "Ingresa un nombre para la subcuenta.",
      });
      return;
    }

    if (!cantidadValida || cantidadNumerica === null) {
      Toast.show({
        type: "error",
        text1: "Cantidad inválida",
        text2: "Verifica la cantidad inicial.",
      });
      return;
    }

    if (erroresCantidad.some(error => error.includes('muy grande'))) {
      Toast.show({
        type: "info",
        text1: "Cantidad inusualmente grande",
        text2: "Verifica que sea correcta antes de continuar.",
      });
    }

    try {
      setLoading(true);
      // Validar con backend si se puede crear la subcuenta
      const planConfigService = await import('../services/planConfigService');
      const userId = cuentaPrincipalId;
      const canPerformRes = await planConfigService.canPerform('subcuenta', { userId });
      if (!canPerformRes.allowed) {
        const isConfigError = canPerformRes.message?.includes('Configuración de plan no disponible');
        Toast.show({
          type: "error",
          text1: isConfigError ? "Error de configuración" : "Límite alcanzado",
          text2: isConfigError 
            ? "No se pudo verificar tu plan. Por favor, contacta a soporte."
            : canPerformRes.message || "Has alcanzado el límite de subcuentas para tu plan.",
        });
        setLoading(false);
        return;
      }

      const { authService } = await import('../services/authService');
      const token = await authService.getAccessToken();

      const payload: any = {
        nombre: nombre.trim(),
        cantidad: cantidadNumerica,
        moneda,
        simbolo,
        color,
        afectaCuenta,
        cuentaPrincipalId,
      };

      // Nuevo contrato backend: Apartado (true) vs Saldo nuevo (false/omit)
      if (!subcuentaToEdit) {
        payload.usarSaldoCuentaPrincipal = usarSaldoCuentaPrincipal;
      }

      const url = subcuentaToEdit
        ? `${API_BASE_URL}/subcuenta/${subcuentaToEdit.id}` // Endpoint para editar
        : `${API_BASE_URL}/subcuenta`; // Endpoint para crear

      const method = subcuentaToEdit ? "PUT" : "POST"; // Usar PUT para editar, POST para crear

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const responseData = await res.json().catch(() => null);
      if (!res.ok) {
        const msg = responseData?.message || "Error desconocido al guardar subcuenta";
        // Backend: 400 + "Saldo insuficiente en la cuenta principal"
        if (res.status === 400 && typeof msg === 'string' && msg.toLowerCase().includes('saldo insuficiente')) {
          throw new Error('No tienes suficiente saldo para apartar esa cantidad.');
        }
        throw new Error(msg);
      }

      Toast.show({
        type: "success",
        text1: subcuentaToEdit ? "Subcuenta actualizada" : "Subcuenta creada",
      });

      // Limpiar estado
      setNombre("");
      setCantidadNumerica(0);
      setCantidadValida(true);
      setErroresCantidad([]);
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error("❌ Error en handleCreate:", err);
      Toast.show({
        type: "error",
        text1: "Error",
        text2: err.message || "Algo salió mal.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isVisible={visible}
      onBackdropPress={onClose}
      onSwipeComplete={onClose}
      swipeDirection="down"
      style={styles.modalContainer}
      backdropOpacity={0.2}
      animationIn="slideInUp"
      animationOut="slideOutDown"
      animationInTiming={400}
      animationOutTiming={350}
      useNativeDriver={true}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={[styles.modal, { backgroundColor: colors.card }]}
      >
        <View style={[styles.handle, { backgroundColor: colors.border }]} />
        <View style={styles.header}>
          <Ionicons name="wallet-outline" size={22} color="#EF7725" />
          <Text style={[styles.title, { color: colors.text }]}>Nueva Subcuenta</Text>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={22} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <TextInput
          placeholder="Nombre de la subcuenta"
          value={nombre}
          onChangeText={setNombre}
          style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.inputText }]}
          placeholderTextColor={colors.placeholder}
        />

        {!subcuentaToEdit && (
          <View style={[styles.sourceContainer, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}
>
            <Text style={[styles.sourceTitle, { color: colors.text }]}>
              ¿Deseas apartar saldo de tu cuenta principal o ingresar saldo nuevo?
            </Text>
            <View style={styles.sourceOptionsRow}>
              <TouchableOpacity
                style={[
                  styles.sourceOption,
                  {
                    backgroundColor: usarSaldoCuentaPrincipal ? colors.button : colors.card,
                    borderColor: usarSaldoCuentaPrincipal ? colors.button : colors.border,
                  },
                ]}
                onPress={() => setUsarSaldoCuentaPrincipal(true)}
                activeOpacity={0.8}
              >
                <Ionicons name="lock-closed-outline" size={18} color={usarSaldoCuentaPrincipal ? '#fff' : colors.textSecondary} />
                <Text
                  style={[
                    styles.sourceOptionText,
                    { color: usarSaldoCuentaPrincipal ? '#fff' : colors.text },
                  ]}
                >
                  Apartado
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.sourceOption,
                  {
                    backgroundColor: !usarSaldoCuentaPrincipal ? colors.button : colors.card,
                    borderColor: !usarSaldoCuentaPrincipal ? colors.button : colors.border,
                  },
                ]}
                onPress={() => setUsarSaldoCuentaPrincipal(false)}
                activeOpacity={0.8}
              >
                <Ionicons name="add-circle-outline" size={18} color={!usarSaldoCuentaPrincipal ? '#fff' : colors.textSecondary} />
                <Text
                  style={[
                    styles.sourceOptionText,
                    { color: !usarSaldoCuentaPrincipal ? '#fff' : colors.text },
                  ]}
                >
                  Saldo nuevo
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={[styles.sourceHelper, { color: colors.textSecondary }]}>
              {usarSaldoCuentaPrincipal
                ? 'Apartado: reserva saldo existente (si no alcanza, falla).'
                : 'Saldo nuevo: incrementa el saldo total (depósito adicional).'}
            </Text>
          </View>
        )}

        {/* ✅ CurrencyPicker reutilizable */}
        <View style={{ marginBottom: 10 }}>
          <CurrencyField
            label="Moneda"
            value={selectedMonedaObj}
            currentCode={moneda}
            allowFavorites
            showSearch
            onChange={(m) => {
              setSelectedMonedaObj(m);
              setMoneda(m.codigo);
              setSimbolo(m.simbolo);
            }}
          />
        </View>

        {/* ✅ SmartInput para cantidad inicial */}
        <View style={styles.smartInputContainer}>
          <SmartInput
            type="currency"
            placeholder="Cantidad inicial"
            prefix={simbolo}
            initialValue={cantidadNumerica || undefined}
            {...getLimitesSubcuenta()}
            onValueChange={handleCantidadChange}
            onValidationChange={handleCantidadValidation}
            autoFix={true}
          />
        </View>

        {/* ✅ Advertencia si hay errores */}
        {erroresCantidad.length > 0 && (
          <View style={styles.warningContainer}>
            <Ionicons name="warning-outline" size={20} color="#F59E0B" />
            <View style={styles.warningContent}>
              <Text style={styles.warningTitle}>Cantidad muy grande</Text>
              <Text style={styles.warningText}>
                Cantidad: <SmartNumber value={cantidadNumerica || 0} options={{ context: 'modal', symbol: simbolo }} />
              </Text>
              <Text style={styles.warningSubtext}>
                {erroresCantidad[0]}
              </Text>
            </View>
          </View>
        )}

        <View style={{ marginBottom: 16 }}>
          <Text style={[styles.switchLabel, { color: colors.text }]}>Color</Text>
          <View style={styles.colorGrid}>
            {presetColors.map((c) => {
              const selected = c === color;
              return (
                <TouchableOpacity
                  key={c}
                  onPress={() => setColor(c)}
                  style={[
                    styles.colorCircle,
                    { backgroundColor: c, borderColor: colors.border },
                    selected && { borderWidth: 3, borderColor: colors.text },
                  ]}
                />
              );
            })}
          </View>
        </View>

        <View style={styles.switchRow}>
          <Text style={[styles.switchLabel, { color: colors.text }]}>¿Afecta cuenta principal?</Text>
          <Switch value={afectaCuenta} onValueChange={setAfectaCuenta} />
        </View>

        <TouchableOpacity
          style={[styles.button, { backgroundColor: "#EF7725" }]}
          onPress={handleCreate}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? "Guardando..." : "Crear Subcuenta"}
          </Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: { justifyContent: "flex-end", margin: 0 },
  modal: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 24,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    maxHeight: require('react-native').Dimensions.get('window').height * 0.95,
  },
  handle: {
    width: 40,
    height: 5,
    borderRadius: 5,
    alignSelf: "center",
    marginBottom: 8,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
  },
  input: {
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    height: 44,
    fontSize: 14,
    borderWidth: 1,
    marginBottom: 10,
  },
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginVertical: 10,
  },
  switchLabel: { fontSize: 14 },
  button: {
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 10,
    marginBottom: 40,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "600",
  },
  colorGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 10,
  },
  colorCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    marginRight: 10,
    marginBottom: 10,
    borderWidth: 1,
  },
  colorSelected: {
    borderWidth: 2,
    borderColor: "#000",
  },
  symbolBox: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 8,
    marginBottom: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
  },
  symbolValue: {
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 4,
  },
  // ✅ Estilos para SmartInput y advertencias
  smartInputContainer: {
    marginBottom: 0,
  },
  sourceContainer: {
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  sourceTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 10,
    lineHeight: 18,
  },
  sourceOptionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  sourceOption: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  sourceOptionText: {
    fontSize: 13,
    fontWeight: '700',
  },
  sourceHelper: {
    marginTop: 10,
    fontSize: 12,
    lineHeight: 16,
  },
  warningContainer: {
    flexDirection: 'row',
    backgroundColor: '#FEF3C7',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    marginTop: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
  },
  warningContent: {
    flex: 1,
    marginLeft: 8,
  },
  warningTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#92400E',
    marginBottom: 4,
  },
  warningText: {
    fontSize: 12,
    color: '#92400E',
    marginBottom: 2,
  },
  warningSubtext: {
    fontSize: 11,
    color: '#A16207',
    fontStyle: 'italic',
  },
});

export default SubaccountModal;
