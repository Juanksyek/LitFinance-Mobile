import React from "react";
import { View, Text, StyleSheet } from "react-native";

const expensesData = [
  { label: "Lun", value: 40 },
  { label: "Mar", value: 80 },
  { label: "Mie", value: 60 },
  { label: "Jue", value: 100 },
  { label: "Vie", value: 70 },
];

const ExpensesChart = () => {
  return (
    <View style={[styles.card, styles.neumorphicLight]}>
      <View style={styles.header}>
        <Text style={styles.title}>Gastos</Text>
        <Text style={styles.amount}>$1,250</Text>
      </View>

      <View style={styles.graphContainer}>
        {expensesData.map((item, index) => (
          <View key={index} style={styles.graphItem}>
            <View style={[styles.bar, { height: item.value }]} />
            <Text style={styles.label}>{item.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    backgroundColor: "#f0f0f3",
  },
  neumorphicLight: {
    backgroundColor: "#f0f0f3",
    shadowColor: "#000",
    shadowOffset: { width: 6, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.7)",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: "600",
    color: "#EF6C00",
  },
  amount: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  graphContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    height: 100,
  },
  graphItem: {
    alignItems: "center",
    width: "18%",
  },
  bar: {
    width: 20,
    borderRadius: 6,
    backgroundColor: "#EF6C00",
    marginBottom: 6,
  },
  label: {
    fontSize: 12,
    color: "#9e9e9e",
  },
});

export default ExpensesChart;
