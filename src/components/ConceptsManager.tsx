import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, Dimensions } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import Toast from "react-native-toast-message";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { API_BASE_URL } from "../constants/api";

interface Concepto {
  conceptoId: string;
  nombre: string;
  color: string;
  icono?: string;
}

interface Props {
  onClose: () => void;
}

const COLORS = [
  "#FFA726", "#EF5350", "#42A5F5", "#AB47BC", "#66BB6A",
  "#FF7043", "#26A69A", "#5C6BC0", "#FFCA28", "#8D6E63",
  "#BDBDBD", "#78909C", "#7E57C2", "#D4E157", "#26C6DA",
];

const EMOJIS = ["💰", "🛒", "🍽️", "🚗", "🏠", "🎉", "📌", "📈", "💡", "🎁", "📊", "🧾"];

const SCREEN_HEIGHT = Dimensions.get("window").height;

const ConceptsManager: React.FC<Props> = ({ onClose }) => {
  const [nuevoConcepto, setNuevoConcepto] = useState("");
  const [conceptos, setConceptos] = useState<Concepto[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [colorSeleccionado, setColorSeleccionado] = useState("#FFA726");
  const [emojiSeleccionado, setEmojiSeleccionado] = useState("📌");

  const fetchConceptos = async () => {
    try {
      const token = await AsyncStorage.getItem("authToken");
      const res = await axios.get(`${API_BASE_URL}/conceptos?search=${busqueda}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setConceptos(res.data.resultados);
    } catch {
      Toast.show({
        type: "error",
        text1: "Error al cargar conceptos",
        text2: "Intenta más tarde.",
      });
    }
  };

  const crearConcepto = async () => {
    if (!nuevoConcepto.trim()) return;

    try {
      const token = await AsyncStorage.getItem("authToken");
      await axios.post(`${API_BASE_URL}/conceptos`, {
        nombre: nuevoConcepto,
        color: colorSeleccionado,
        icono: emojiSeleccionado,
      }, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setNuevoConcepto("");
      setEmojiSeleccionado(EMOJIS[Math.floor(Math.random() * EMOJIS.length)]);
      setColorSeleccionado("#FFA726");
      Toast.show({ type: "success", text1: "Concepto creado" });
      fetchConceptos();
    } catch {
      Toast.show({ type: "error", text1: "Error al crear concepto" });
    }
  };

  // Debounce de búsqueda
  useEffect(() => {
    const delay = setTimeout(() => {
      fetchConceptos();
    }, 500);

    return () => clearTimeout(delay);
  }, [busqueda]);

  useEffect(() => {
    const random = EMOJIS[Math.floor(Math.random() * EMOJIS.length)];
    setEmojiSeleccionado(random);
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Mis Conceptos</Text>
        <TouchableOpacity onPress={onClose}>
          <Ionicons name="close" size={26} color="#555" />
        </TouchableOpacity>
      </View>

      <TextInput
        placeholder="Buscar concepto..."
        value={busqueda}
        onChangeText={setBusqueda}
        style={styles.inputFull}
        placeholderTextColor="#999"
      />

      <View style={styles.addRow}>
        <TextInput
          placeholder="Nuevo concepto"
          value={nuevoConcepto}
          onChangeText={setNuevoConcepto}
          style={styles.inputInline}
          placeholderTextColor="#999"
        />
        <TouchableOpacity style={styles.addButton} onPress={crearConcepto}>
          <Ionicons name="add-circle-outline" size={26} color="#EF6C00" />
        </TouchableOpacity>
      </View>

      <View style={styles.symbolRow}>
        <Text style={styles.symbolLabel}>Símbolo:</Text>
        <TextInput
          value={emojiSeleccionado}
          onChangeText={(text) => {
            const emojiOnly = text.replace(/[^\p{Emoji}\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, '');
            setEmojiSeleccionado(emojiOnly);
          }}
          style={styles.emojiInput}
          placeholder="💰"
          maxLength={2}
          keyboardType="default"
          returnKeyType="done"
        />
      </View>

      <Text style={styles.subLabel}>Color:</Text>
      <View style={styles.colorGrid}>
        {COLORS.map((c) => (
          <TouchableOpacity
            key={c}
            style={[
              styles.colorCircle,
              {
                backgroundColor: c,
                borderWidth: c === colorSeleccionado ? 2 : 0,
              },
            ]}
            onPress={() => setColorSeleccionado(c)}
          />
        ))}
      </View>

      {conceptos.length === 0 ? (
        <Text style={styles.emptyText}>No tienes conceptos registrados aún.</Text>
      ) : (
        <FlatList
          data={conceptos}
          keyExtractor={(item) => item.conceptoId}
          numColumns={2}
          columnWrapperStyle={styles.row}
          renderItem={({ item }) => (
            <View style={[styles.conceptCard, { borderColor: item.color }]}>
              <Text style={styles.icon}>{item.icono}</Text>
              <Text style={styles.nombre}>{item.nombre}</Text>
            </View>
          )}
          style={{ maxHeight: 120 }}
          contentContainerStyle={{ paddingBottom: 16 }}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: "100%",
    maxHeight: SCREEN_HEIGHT * 0.85,
    backgroundColor: "#f0f0f3",
    padding: 16,
    borderRadius: 20,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
  },
  inputFull: {
    width: "100%",
    backgroundColor: "#fff",
    padding: 10,
    borderRadius: 12,
    marginBottom: 10,
    fontSize: 14,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  inputInline: {
    flex: 1,
    backgroundColor: "#fff",
    padding: 10,
    borderRadius: 12,
    fontSize: 14,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  addRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  addButton: {
    marginLeft: 8,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 6,
    elevation: 2,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  subLabel: {
    fontSize: 14,
    color: "#444",
    fontWeight: "500",
    marginBottom: 4,
  },
  symbolRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  symbolLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#444',
    marginRight: 8,
  },
  emojiButtonInline: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#ccc',
  },
  emojiInline: {
    fontSize: 20,
    marginRight: 6,
  },
  emojiInput: {
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    fontSize: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ccc',
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
  row: {
    justifyContent: "space-between",
    marginBottom: 12,
  },
  conceptCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 12,
    alignItems: "center",
    flex: 1,
    marginRight: 8,
    elevation: 1,
    borderWidth: 2,
  },
  icon: {
    fontSize: 24,
    marginBottom: 6,
  },
  nombre: {
    fontSize: 14,
    fontWeight: "500",
    color: "#333",
  },
  emptyText: {
    marginTop: 16,
    textAlign: "center",
    color: "#888",
    fontSize: 14,
  },
});

export default ConceptsManager;
