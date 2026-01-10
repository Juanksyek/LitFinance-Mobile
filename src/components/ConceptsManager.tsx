import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Animated, Dimensions, FlatList, Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiRateLimiter } from "../services/apiRateLimiter";
import Toast from "react-native-toast-message";

import { API_BASE_URL } from "../constants/api";
import { useThemeColors } from "../theme/useThemeColors";

interface Concepto {
  conceptoId: string;
  nombre: string;
  color: string;
  icono?: string;
}

interface Props {
  onClose: () => void;
}

interface EditState {
  conceptoId: string;
  nombre: string;
  color: string;
  icono: string;
}

const COLORS = [
  "#FFA726",
  "#EF5350",
  "#42A5F5",
  "#AB47BC",
  "#66BB6A",
  "#FF7043",
  "#26A69A",
  "#5C6BC0",
  "#FFCA28",
  "#8D6E63",
  "#BDBDBD",
  "#78909C",
  "#7E57C2",
  "#D4E157",
  "#26C6DA",
];

const EMOJIS = ["💰", "🛒", "🍽️", "🚗", "🏠", "🎉", "📌", "📈", "💡", "🎁", "📊", "🧾"];

const SCREEN_HEIGHT = Dimensions.get("window").height;

const ConceptsManager: React.FC<Props> = ({ onClose }) => {
  const colors = useThemeColors();

  const [conceptos, setConceptos] = useState<Concepto[]>([]);
  const [busqueda, setBusqueda] = useState("");

  const [nuevoConcepto, setNuevoConcepto] = useState("");
  const [colorSeleccionado, setColorSeleccionado] = useState(COLORS[0]);
  const [emojiSeleccionado, setEmojiSeleccionado] = useState("📌");

  const [editState, setEditState] = useState<EditState | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const activeColor = editState ? editState.color : colorSeleccionado;
  const activeIcono = editState ? editState.icono : emojiSeleccionado;

  const fetchConceptos = useCallback(async () => {
    try {
      const res = await apiRateLimiter.fetch(`${API_BASE_URL}/conceptos?search=${encodeURIComponent(busqueda)}`);
      if (res.ok) {
        const data = await res.json();
        setConceptos(data.resultados ?? []);
      }
    } catch {
      Toast.show({ type: "error", text1: "Error al cargar conceptos", text2: "Intenta más tarde." });
    }
  }, [busqueda]);

  useEffect(() => {
    fetchConceptos();
  }, [fetchConceptos]);

  const crearConcepto = useCallback(async () => {
    const nombre = nuevoConcepto.trim();
    if (!nombre) return;

    try {
      const res = await apiRateLimiter.fetch(`${API_BASE_URL}/conceptos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre, color: colorSeleccionado, icono: emojiSeleccionado }),
      });

      if (!res.ok) throw new Error('Error al crear');

      setNuevoConcepto("");
      setEmojiSeleccionado(EMOJIS[Math.floor(Math.random() * EMOJIS.length)]);
      setColorSeleccionado(COLORS[0]);
      Toast.show({ type: "success", text1: "Concepto creado" });
      fetchConceptos();
    } catch {
      Toast.show({ type: "error", text1: "Error al crear concepto" });
    }
  }, [colorSeleccionado, emojiSeleccionado, fetchConceptos, nuevoConcepto]);

  const editarConcepto = useCallback(async () => {
    if (!editState) return;

    const original = conceptos.find((c) => c.conceptoId === editState.conceptoId);
    const nextNombre = editState.nombre.trim();
    if (!nextNombre) {
      Toast.show({ type: "error", text1: "El nombre no puede estar vacío" });
      return;
    }

    const payload: Partial<Pick<Concepto, "nombre" | "color" | "icono">> = {};
    if (!original || nextNombre !== original.nombre) payload.nombre = nextNombre;
    if (!original || editState.color !== original.color) payload.color = editState.color;
    if (!original || editState.icono !== (original.icono ?? "")) payload.icono = editState.icono;

    if (Object.keys(payload).length === 0) {
      Toast.show({ type: "info", text1: "Sin cambios para guardar" });
      setEditState(null);
      return;
    }

    try {
      const res = await apiRateLimiter.fetch(`${API_BASE_URL}/conceptos/${editState.conceptoId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Error al editar');
      Toast.show({ type: "success", text1: "Concepto actualizado" });
      setEditState(null);
      fetchConceptos();
    } catch {
      Toast.show({ type: "error", text1: "Error al editar concepto" });
    }
  }, [conceptos, editState, fetchConceptos]);

  const openDeleteConfirm = useCallback((id: string) => {
    setConfirmDeleteId(id);
    setShowDeleteModal(true);
  }, []);

  const closeDeleteConfirm = useCallback(() => {
    setShowDeleteModal(false);
    setConfirmDeleteId(null);
  }, []);

  const eliminarConcepto = useCallback(
    async (conceptoId: string) => {
      setDeletingId(conceptoId);
      try {
        const res = await apiRateLimiter.fetch(`${API_BASE_URL}/conceptos/${conceptoId}`, {
          method: 'DELETE',
        });
        if (!res.ok) throw new Error('Error al eliminar');
        Toast.show({ type: "success", text1: "Concepto eliminado" });
        fetchConceptos();
      } catch {
        Toast.show({ type: "error", text1: "Error al eliminar concepto" });
      } finally {
        setDeletingId(null);
        closeDeleteConfirm();
      }
    },
    [closeDeleteConfirm, fetchConceptos]
  );

  const renderConcept = useCallback(
    ({ item }: { item: Concepto }) => (
      <Animated.View
        style={[
          styles.conceptCard,
          {
            borderColor: item.color,
            backgroundColor: colors.card,
            opacity: deletingId === item.conceptoId ? 0.4 : 1,
            shadowColor: item.color,
          },
        ]}
      >
        <View style={styles.cardTop}>
          <Text style={[styles.icon, { fontSize: 36 }]}>{item.icono}</Text>
          <View style={[styles.colorDot, { backgroundColor: item.color, borderColor: colors.card }]} />
        </View>

        <Text style={[styles.nombre, { color: colors.text }]} numberOfLines={2}>
          {item.nombre}
        </Text>
        <Text style={[styles.idText, { color: colors.textSecondary }]} numberOfLines={1}>
          ID: {item.conceptoId}
        </Text>

        <View style={styles.cardActions}>
          <TouchableOpacity
            onPress={() =>
              setEditState({
                conceptoId: item.conceptoId,
                nombre: item.nombre,
                color: item.color,
                icono: item.icono ?? "",
              })
            }
            activeOpacity={0.7}
          >
            <Ionicons name="create-outline" size={22} color={colors.button} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              if (deletingId === item.conceptoId) return;
              openDeleteConfirm(item.conceptoId);
            }}
            activeOpacity={0.7}
          >
            <Ionicons name="trash-outline" size={22} color={colors.error} />
          </TouchableOpacity>
        </View>
      </Animated.View>
    ),
    [colors.button, colors.card, colors.error, colors.text, colors.textSecondary, deletingId, openDeleteConfirm]
  );

  const columnWrapperStyle = useMemo(() => ({ justifyContent: "space-between" as const, marginBottom: 18 }), []);

  return (
    <View style={[styles.container, { backgroundColor: colors.cardSecondary }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Mis Conceptos</Text>
        <TouchableOpacity onPress={onClose}>
          <Ionicons name="close" size={26} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <TextInput
        placeholder="Buscar concepto..."
        value={busqueda}
        onChangeText={setBusqueda}
        style={[
          styles.inputFull,
          { backgroundColor: colors.card, borderColor: colors.border, color: colors.inputText },
        ]}
        placeholderTextColor={colors.placeholder}
      />

      {editState ? (
        <View
          style={[
            styles.addRow,
            {
              borderWidth: 1,
              borderColor: colors.warning,
              borderRadius: 10,
              backgroundColor: colors.backgroundSecondary,
            },
          ]}
        >
          <TextInput
            placeholder="Editar concepto"
            value={editState.nombre}
            onChangeText={(v) => setEditState((s) => (s ? { ...s, nombre: v } : s))}
            style={[
              styles.inputInline,
              { backgroundColor: colors.card, borderColor: colors.border, color: colors.inputText },
            ]}
            placeholderTextColor={colors.placeholder}
          />
          <TouchableOpacity
            style={[styles.addButton, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={editarConcepto}
          >
            <Ionicons name="checkmark-circle-outline" size={26} color="#059669" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.addButton, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => setEditState(null)}
          >
            <Ionicons name="close-circle-outline" size={26} color="#EF4444" />
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.addRow}>
          <TextInput
            placeholder="Nuevo concepto"
            value={nuevoConcepto}
            onChangeText={setNuevoConcepto}
            style={[
              styles.inputInline,
              { backgroundColor: colors.card, borderColor: colors.border, color: colors.inputText },
            ]}
            placeholderTextColor={colors.placeholder}
          />
          <TouchableOpacity
            style={[styles.addButton, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={crearConcepto}
          >
            <Ionicons name="add-circle-outline" size={26} color="#EF6C00" />
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.symbolRow}>
        <Text style={[styles.symbolLabel, { color: colors.text }]}>Símbolo:</Text>
        <TextInput
          value={activeIcono}
          onChangeText={(text) => {
            const emojiOnly = text.replace(/[^\u0000-\uFFFF]/gu, "");
            if (editState) setEditState({ ...editState, icono: emojiOnly });
            else setEmojiSeleccionado(emojiOnly);
          }}
          style={[styles.emojiInput, { backgroundColor: colors.card, borderColor: colors.border }]}
          placeholder="💰"
          maxLength={2}
          keyboardType="default"
          returnKeyType="done"
        />
      </View>

      <Text style={[styles.subLabel, { color: colors.text }]}>Color:</Text>
      <View style={styles.colorGrid}>
        {COLORS.map((c) => (
          <TouchableOpacity
            key={c}
            style={[styles.colorCircle, { backgroundColor: c, borderWidth: activeColor === c ? 2 : 0 }]}
            onPress={() => (editState ? setEditState({ ...editState, color: c }) : setColorSeleccionado(c))}
          />
        ))}
      </View>

      {conceptos.length === 0 ? (
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No tienes conceptos registrados aún.</Text>
      ) : (
        <FlatList
          data={conceptos}
          keyExtractor={(item) => item.conceptoId}
          numColumns={2}
          columnWrapperStyle={columnWrapperStyle}
          renderItem={renderConcept}
          style={{ maxHeight: SCREEN_HEIGHT * 0.38, minHeight: SCREEN_HEIGHT * 0.25 }}
          contentContainerStyle={{ paddingBottom: 24 }}
          showsVerticalScrollIndicator
        />
      )}

      <Modal
        visible={showDeleteModal}
        transparent
        animationType="fade"
        onRequestClose={closeDeleteConfirm}
      >
        <View style={[styles.modalOverlay, { backgroundColor: "rgba(0,0,0,0.02)" }]}>
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>¿Eliminar concepto?</Text>
            <Text style={[styles.modalText, { color: colors.textSecondary }]}>Esta acción no se puede deshacer.</Text>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}
                onPress={closeDeleteConfirm}
              >
                <Text style={[styles.modalButtonText, { color: colors.text }]}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}
                onPress={() => {
                  if (!confirmDeleteId) return;
                  eliminarConcepto(confirmDeleteId);
                }}
              >
                <Text style={[styles.modalButtonText, { color: colors.error }]}>Eliminar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: "100%",
    maxHeight: SCREEN_HEIGHT * 0.95,
    minHeight: SCREEN_HEIGHT * 0.7,
    padding: 24,
    borderRadius: 28,
    alignSelf: "center",
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  inputFull: {
    width: "100%",
    padding: 14,
    borderRadius: 16,
    marginBottom: 14,
    fontSize: 16,
    borderWidth: 1,
  },
  inputInline: {
    flex: 1,
    padding: 10,
    borderRadius: 12,
    fontSize: 14,
    borderWidth: 1,
  },
  addRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  addButton: {
    marginLeft: 8,
    borderRadius: 16,
    padding: 10,
    borderWidth: 1,
  },
  subLabel: {
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 4,
  },
  symbolRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  symbolLabel: {
    fontSize: 14,
    fontWeight: "500",
    marginRight: 8,
  },
  emojiInput: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    fontSize: 20,
    borderRadius: 8,
    borderWidth: 1,
    minWidth: 60,
  },
  colorGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-start",
    marginBottom: 10,
    marginTop: 4,
  },
  colorCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginRight: 10,
    marginBottom: 10,
    borderColor: "#555",
  },
  conceptCard: {
    borderRadius: 16,
    borderWidth: 2,
    alignItems: "center",
    flex: 1,
    marginHorizontal: 6,
    minWidth: 0,
    maxWidth: "48%",
    paddingVertical: 20,
    paddingHorizontal: 10,
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  cardTop: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  colorDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginTop: 2,
    borderWidth: 2,
  },
  icon: {
    fontSize: 32,
    marginBottom: 8,
  },
  nombre: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 2,
    textAlign: "center",
  },
  idText: {
    fontSize: 12,
    marginBottom: 8,
  },
  cardActions: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 12,
  },
  emptyText: {
    marginTop: 24,
    textAlign: "center",
    fontSize: 16,
    fontWeight: "500",
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalCard: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 6,
  },
  modalText: {
    fontSize: 13,
    marginBottom: 12,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
  },
  modalButton: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  modalButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },
});

export default ConceptsManager;
