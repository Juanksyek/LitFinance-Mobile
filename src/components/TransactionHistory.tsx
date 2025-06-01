import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";

type TransactionItemProps = {
  icon: React.ReactNode;
  title: string;
  amount: string;
  date: string;
};

const TransactionItem = ({
  icon,
  title,
  amount,
  date,
}: TransactionItemProps) => {
  return (
    <TouchableOpacity style={styles.transactionItem}>
      <View style={[styles.transactionIconContainer, styles.neumorphicInset]}>
        {icon}
      </View>
      <View style={styles.transactionDetails}>
        <Text style={styles.transactionTitle}>{title}</Text>
        <Text style={styles.transactionDate}>{date}</Text>
      </View>
      <Text style={styles.transactionAmount}>{amount}</Text>
    </TouchableOpacity>
  );
};

const TransactionHistory = () => {
  return (
    <View style={[styles.card, styles.neumorphicLight]}>
      <Text style={styles.cardLabel}>Historial de transacciones</Text>

      <TransactionItem
        icon={<Ionicons name="time-outline" size={20} color="#EF6C00" />}
        title="Nenas"
        amount="$1500.00"
        date="Today"
      />

      <TransactionItem
        icon={<Ionicons name="bar-chart-outline" size={20} color="#EF6C00" />}
        title="Juegos"
        amount="$1,200.50"
        date="Yesterday"
      />

      <TouchableOpacity style={[styles.viewAllButton, styles.neumorphicLight]}>
        <Text style={styles.viewAllText}>Ver todas las transacciones</Text>
        <Ionicons name="chevron-forward-outline" size={16} color="#EF6C00" />
      </TouchableOpacity>
    </View>
  );
};

export default TransactionHistory;

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    backgroundColor: "#f0f0f3",
  },
  cardLabel: {
    fontSize: 16,
    fontWeight: "500",
    color: "#EF6C00",
    marginBottom: 10,
  },
  transactionItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.05)",
  },
  transactionIconContainer: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  transactionDetails: {
    flex: 1,
  },
  transactionTitle: {
    fontSize: 15,
    fontWeight: "500",
    color: "#424242",
    marginBottom: 2,
  },
  transactionDate: {
    fontSize: 13,
    color: "#9e9e9e",
  },
  transactionAmount: {
    fontSize: 15,
    fontWeight: "600",
    color: "#424242",
  },
  viewAllButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
    padding: 14,
    borderRadius: 12,
  },
  viewAllText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#EF6C00",
    marginRight: 6,
  },
  neumorphicLight: {
    backgroundColor: "#f0f0f3",
    shadowColor: "#000",
    shadowOffset: { width: 10, height: 10 },
    shadowOpacity: 0.16,
    shadowRadius: 14,
    elevation: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.7)",
  },
  neumorphicInset: {
    backgroundColor: "#e6e6e9",
    shadowColor: "#000",
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 1,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.4)",
  },
});
