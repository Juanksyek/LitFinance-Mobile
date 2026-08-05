import React, { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useThemeColors } from '../../theme/useThemeColors';
import { subaccountsRepository } from '../../local-db/repositories/subaccounts.repository';
import type { LiteSubaccount } from '../../local-db/types/local-models';
import { liteSubaccountService } from '../../services/lite/liteSubaccount.service';

export default function SubaccountsLiteScreen() {
  const colors = useThemeColors();
  const navigation = useNavigation<any>();
  const [items, setItems] = useState<LiteSubaccount[]>([]);
  const [name, setName] = useState('');
  const [balance, setBalance] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    subaccountsRepository.list().then(setItems);
  }, []);

  useFocusEffect(load);

  const save = async () => {
    if (!name.trim()) {
      Alert.alert('Nombre requerido', 'Escribe el nombre de la subcuenta.');
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await liteSubaccountService.updateSubaccount(editingId, {
          name,
          balance: Number(balance.replace(',', '.')) || 0,
        });
      } else {
        await liteSubaccountService.createSubaccount({
          name,
          balance: Number(balance.replace(',', '.')) || 0,
          currency: 'MXN',
        });
      }
      setName('');
      setBalance('');
      setEditingId(null);
      load();
    } catch (error) {
      Alert.alert('No se pudo guardar', String((error as any)?.message ?? error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Subcuentas</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Bolsillos locales para separar dinero por objetivo.</Text>

        <View style={[styles.form, { borderColor: colors.border, backgroundColor: colors.card }]}>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Nombre"
            placeholderTextColor={colors.placeholder}
            style={[styles.input, { borderColor: colors.border, color: colors.text }]}
          />
          <TextInput
            value={balance}
            onChangeText={setBalance}
            keyboardType="decimal-pad"
            placeholder="Saldo inicial"
            placeholderTextColor={colors.placeholder}
            style={[styles.input, { borderColor: colors.border, color: colors.text }]}
          />
          <TouchableOpacity disabled={saving} style={[styles.button, { backgroundColor: colors.button, opacity: saving ? 0.7 : 1 }]} onPress={save}>
            <Ionicons name={editingId ? 'save-outline' : 'add'} size={21} color={colors.buttonText} />
            <Text style={[styles.buttonText, { color: colors.buttonText }]}>{saving ? 'Guardando...' : editingId ? 'Guardar cambios' : 'Crear subcuenta'}</Text>
          </TouchableOpacity>
          {editingId ? (
            <TouchableOpacity
              style={[styles.cancelEditButton, { borderColor: colors.border }]}
              onPress={() => {
                setEditingId(null);
                setName('');
                setBalance('');
              }}
            >
              <Text style={[styles.cancelEditText, { color: colors.text }]}>Cancelar edicion</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {items.length === 0 ? (
          <Text style={[styles.empty, { color: colors.textSecondary }]}>Aun no hay subcuentas.</Text>
        ) : (
          items.map((item) => (
            <View key={item.id} style={[styles.row, { borderColor: colors.border }]}>
              <View style={styles.rowText}>
                <Text style={[styles.rowTitle, { color: colors.text }]}>{item.name}</Text>
                <Text style={[styles.rowMeta, { color: colors.textSecondary }]}>{item.syncStatus}</Text>
              </View>
              <Text style={[styles.amount, { color: colors.text }]}>{item.currency} {item.balance.toLocaleString('es-MX')}</Text>
              <TouchableOpacity
                style={styles.deleteIconButton}
                onPress={() => {
                  setEditingId(item.id);
                  setName(item.name);
                  setBalance(String(item.balance));
                }}
              >
                <Ionicons name="pencil-outline" size={18} color={colors.button} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.deleteIconButton}
                onPress={() => {
                  Alert.alert(
                    'Eliminar subcuenta',
                    'La subcuenta se ocultara localmente y se sincronizara el cambio despues.',
                    [
                      { text: 'Cancelar', style: 'cancel' },
                      {
                        text: 'Eliminar',
                        style: 'destructive',
                        onPress: async () => {
                          try {
                            await liteSubaccountService.deleteSubaccount(item.id);
                            load();
                          } catch (error) {
                            Alert.alert('No se pudo eliminar', String((error as any)?.message ?? error));
                          }
                        },
                      },
                    ],
                  );
                }}
              >
                <Ionicons name="trash-outline" size={18} color={colors.error} />
              </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  amount: { fontSize: 14, fontWeight: '900', marginLeft: 12 },
  back: { marginBottom: 16, width: 44 },
  button: { alignItems: 'center', borderRadius: 8, flexDirection: 'row', gap: 8, justifyContent: 'center', padding: 14 },
  buttonText: { fontSize: 15, fontWeight: '900' },
  cancelEditButton: { alignItems: 'center', borderRadius: 8, borderWidth: 1, justifyContent: 'center', padding: 12 },
  cancelEditText: { fontSize: 14, fontWeight: '800' },
  content: { padding: 20, paddingBottom: 36 },
  deleteIconButton: { alignItems: 'center', height: 40, justifyContent: 'center', marginLeft: 8, width: 34 },
  empty: { fontSize: 14, paddingTop: 16 },
  form: { borderRadius: 8, borderWidth: 1, gap: 10, marginBottom: 18, padding: 14 },
  input: { borderRadius: 8, borderWidth: 1, fontSize: 16, padding: 12 },
  row: { alignItems: 'center', borderBottomWidth: 1, flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 14 },
  rowMeta: { fontSize: 12, marginTop: 3 },
  rowText: { flex: 1 },
  rowTitle: { fontSize: 15, fontWeight: '900' },
  safe: { flex: 1 },
  subtitle: { fontSize: 15, lineHeight: 21, marginBottom: 18 },
  title: { fontSize: 30, fontWeight: '900', marginBottom: 8 },
});
