import React, { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useThemeColors } from '../../theme/useThemeColors';
import { budgetsRepository } from '../../local-db/repositories/budgets.repository';
import { liteBudgetService } from '../../services/lite/liteBudget.service';
import type { LiteBudget } from '../../local-db/types/local-models';

const currentMonth = () => new Date().toISOString().slice(0, 7);

export default function BudgetCurrentScreen() {
  const colors = useThemeColors();
  const navigation = useNavigation<any>();
  const [incomePlanned, setIncomePlanned] = useState('');
  const [savingsTarget, setSavingsTarget] = useState('');
  const [spendingLimit, setSpendingLimit] = useState('');
  const [currentBudget, setCurrentBudget] = useState<LiteBudget | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    budgetsRepository.getCurrent(currentMonth()).then((budget) => {
      if (!budget) return;
      setCurrentBudget(budget);
      setIncomePlanned(String(budget.incomePlanned));
      setSavingsTarget(String(budget.savingsTarget));
      setSpendingLimit(String(budget.spendingLimit));
    });
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await liteBudgetService.saveBudget({
        month: currentMonth(),
        incomePlanned: Number(incomePlanned) || 0,
        savingsTarget: Number(savingsTarget) || 0,
        spendingLimit: Number(spendingLimit) || 0,
        currency: 'MXN',
      });
      navigation.navigate('DashboardLite');
    } catch (error) {
      Alert.alert('No se pudo guardar', String((error as any)?.message ?? error));
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = () => {
    if (!currentBudget) return;
    Alert.alert('Eliminar presupuesto', 'Se quitara el presupuesto local de este mes y se sincronizara despues.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          setSaving(true);
          try {
            await liteBudgetService.deleteBudget(currentMonth());
            setCurrentBudget(null);
            setIncomePlanned('');
            setSavingsTarget('');
            setSpendingLimit('');
            navigation.navigate('DashboardLite');
          } catch (error) {
            Alert.alert('No se pudo eliminar', String((error as any)?.message ?? error));
          } finally {
            setSaving(false);
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.safe}>
        <ScrollView contentContainerStyle={styles.content}>
          <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.text }]}>Presupuesto mensual</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Define cuanto puedes gastar sin afectar tu objetivo.</Text>

          <Field label="Ingreso planeado" value={incomePlanned} onChangeText={setIncomePlanned} />
          <Field label="Meta de ahorro" value={savingsTarget} onChangeText={setSavingsTarget} />
          <Field label="Limite de gasto" value={spendingLimit} onChangeText={setSpendingLimit} />

          <TouchableOpacity disabled={saving} style={[styles.saveButton, { backgroundColor: colors.button, opacity: saving ? 0.7 : 1 }]} onPress={save}>
            <Ionicons name="save-outline" size={21} color={colors.buttonText} />
            <Text style={[styles.saveText, { color: colors.buttonText }]}>{saving ? 'Guardando...' : 'Guardar presupuesto'}</Text>
          </TouchableOpacity>
          {currentBudget ? (
            <TouchableOpacity disabled={saving} style={styles.deleteButton} onPress={confirmDelete}>
              <Text style={styles.deleteText}>Eliminar presupuesto del mes</Text>
            </TouchableOpacity>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({ label, value, onChangeText }: { label: string; value: string; onChangeText: (value: string) => void }) {
  const colors = useThemeColors();
  return (
    <>
      <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType="decimal-pad"
        placeholder="0"
        placeholderTextColor={colors.placeholder}
        style={[styles.input, { borderColor: colors.border, color: colors.text }]}
      />
    </>
  );
}

const styles = StyleSheet.create({
  back: { marginBottom: 16, width: 44 },
  content: { padding: 20, paddingBottom: 36 },
  deleteButton: { alignItems: 'center', marginTop: 14, padding: 10 },
  deleteText: { color: '#D94A4A', fontSize: 14, fontWeight: '900' },
  input: { borderRadius: 8, borderWidth: 1, fontSize: 18, marginBottom: 18, padding: 14 },
  label: { fontSize: 13, fontWeight: '800', marginBottom: 8, textTransform: 'uppercase' },
  safe: { flex: 1 },
  saveButton: { alignItems: 'center', borderRadius: 8, flexDirection: 'row', gap: 8, justifyContent: 'center', marginTop: 10, padding: 16 },
  saveText: { fontSize: 16, fontWeight: '900' },
  subtitle: { fontSize: 15, lineHeight: 21, marginBottom: 24 },
  title: { fontSize: 30, fontWeight: '900', marginBottom: 8 },
});
