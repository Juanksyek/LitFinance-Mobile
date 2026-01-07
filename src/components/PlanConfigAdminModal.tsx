import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Modal, View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Switch, ScrollView, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { API_BASE_URL } from '../constants/api';
import { useThemeColors } from '../theme/useThemeColors';
import FormInput from './FormInput';

type PlanType = string;

type PlanConfig = {
  planType: PlanType;
  transaccionesPorDia: number;
  historicoLimitadoDias: number;
  recurrentesPorUsuario: number;
  subcuentasPorUsuario: number;
  graficasAvanzadas: boolean;
  activo: boolean;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  token: string;
};

function parseIntSafe(value: string, fallback: number) {
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
}

function isValidLimitNumber(n: number) {
  return Number.isFinite(n) && Number.isInteger(n) && n >= -1;
}

async function readJsonSafe(res: Response) {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch (e) {
    return {};
  }
}

export default function PlanConfigAdminModal({ visible, onClose, token }: Props) {
  const colors = useThemeColors();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [plans, setPlans] = useState<PlanConfig[]>([]);
  const [selectedPlanType, setSelectedPlanType] = useState<string>('');
  const [newPlanType, setNewPlanType] = useState('');
  const [config, setConfig] = useState<PlanConfig | null>(null);
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const slideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) {
      slideAnim.setValue(0);
      return;
    }
    Animated.timing(slideAnim, {
      toValue: 1,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [slideAnim, visible]);

  const form = useMemo(() => {
    if (!config) return null;
    return {
      transaccionesPorDia: String(config.transaccionesPorDia),
      historicoLimitadoDias: String(config.historicoLimitadoDias),
      recurrentesPorUsuario: String(config.recurrentesPorUsuario),
      subcuentasPorUsuario: String(config.subcuentasPorUsuario),
      graficasAvanzadas: !!config.graficasAvanzadas,
      activo: !!config.activo,
    };
  }, [config]);

  // 1) Cargar lista de planes disponibles
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE_URL}/plan-config`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await readJsonSafe(res);

        if (!cancelled) {
          if (!res.ok) throw new Error((data as any)?.message || 'No se pudo cargar la lista de planes');
          const list = Array.isArray(data) ? (data as PlanConfig[]) : [];
          setPlans(list);
          const first = list?.[0]?.planType;
          setSelectedPlanType(prev => prev || first || '');
        }
      } catch (e: any) {
        if (!cancelled) {
          Toast.show({ type: 'error', text1: 'Error', text2: e?.message || 'No se pudo cargar la lista de planes' });
          setPlans([]);
          setSelectedPlanType('');
          setConfig(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [visible, token]);

  // 2) Cargar config del plan seleccionado
  useEffect(() => {
    if (!visible) return;
    if (!selectedPlanType) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE_URL}/plan-config/${selectedPlanType}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await readJsonSafe(res);

        if (!cancelled) {
          if (res.ok && data && typeof data === 'object' && 'planType' in (data as any)) {
            setConfig(data as PlanConfig);
            setTouched({});
          } else {
            setConfig(null);
            throw new Error((data as any)?.message || 'No se pudo cargar la configuración');
          }
        }
      } catch (e: any) {
        if (!cancelled) {
          Toast.show({ type: 'error', text1: 'Error', text2: e?.message || 'No se pudo cargar la configuración' });
          setConfig(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [visible, token, selectedPlanType]);

  const updateField = (key: keyof PlanConfig, value: any) => {
    setConfig(prev => (prev ? { ...prev, [key]: value } : prev));
  };

  const markTouched = (key: keyof PlanConfig) => {
    setTouched(prev => ({ ...prev, [String(key)]: true }));
  };

  const initializeDefaults = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE_URL}/plan-config/initialize-defaults`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await readJsonSafe(res);
      if (!res.ok) throw new Error((data as any)?.message || 'No se pudo inicializar');

      Toast.show({ type: 'success', text1: 'Listo', text2: 'Configuración inicializada' });

      const reload = await fetch(`${API_BASE_URL}/plan-config`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const reloadData = await readJsonSafe(reload);
      if (reload.ok) {
        const list = Array.isArray(reloadData) ? (reloadData as PlanConfig[]) : [];
        setPlans(list);
        const first = list?.[0]?.planType;
        setSelectedPlanType(prev => prev || first || '');
      }
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'Error', text2: e?.message || 'No se pudo inicializar' });
    } finally {
      setSaving(false);
    }
  };

  const createPlan = async () => {
    const planType = newPlanType.trim();
    if (!planType) {
      Toast.show({ type: 'info', text1: 'Plan', text2: 'Escribe un planType' });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE_URL}/plan-config`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          planType,
          transaccionesPorDia: 10,
          historicoLimitadoDias: 30,
          recurrentesPorUsuario: 3,
          subcuentasPorUsuario: 2,
          graficasAvanzadas: false,
          activo: true,
        }),
      });
      const data = await readJsonSafe(res);
      if (!res.ok) throw new Error((data as any)?.message || 'No se pudo crear');

      Toast.show({ type: 'success', text1: 'Creado', text2: `Plan ${planType} creado` });
      setNewPlanType('');

      const reload = await fetch(`${API_BASE_URL}/plan-config`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const reloadData = await readJsonSafe(reload);
      if (reload.ok) {
        const list = Array.isArray(reloadData) ? (reloadData as PlanConfig[]) : [];
        setPlans(list);
        setSelectedPlanType(planType);
      }
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'Error', text2: e?.message || 'No se pudo crear' });
    } finally {
      setSaving(false);
    }
  };

  const save = async () => {
    if (!config) return;

    const invalids: string[] = [];
    const numericKeys: Array<keyof PlanConfig> = [
      'transaccionesPorDia',
      'historicoLimitadoDias',
      'recurrentesPorUsuario',
      'subcuentasPorUsuario',
    ];
    for (const key of numericKeys) {
      const val = config[key] as unknown as number;
      if (!isValidLimitNumber(val)) invalids.push(String(key));
    }
    if (invalids.length > 0) {
      Toast.show({
        type: 'error',
        text1: 'Valores inválidos',
        text2: 'Usa números enteros (mínimo -1 para ilimitado).',
      });
      const nextTouched: Record<string, boolean> = {};
      for (const k of invalids) nextTouched[k] = true;
      setTouched(prev => ({ ...prev, ...nextTouched }));
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`${API_BASE_URL}/plan-config/${config.planType}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          planType: config.planType,
          transaccionesPorDia: config.transaccionesPorDia,
          historicoLimitadoDias: config.historicoLimitadoDias,
          recurrentesPorUsuario: config.recurrentesPorUsuario,
          subcuentasPorUsuario: config.subcuentasPorUsuario,
          graficasAvanzadas: config.graficasAvanzadas,
          activo: config.activo,
        }),
      });
      const data = await readJsonSafe(res);
      if (!res.ok) throw new Error((data as any)?.message || 'No se pudo guardar');

      Toast.show({ type: 'success', text1: 'Guardado', text2: 'Límites actualizados' });
      setConfig(data);
      onClose();
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'Error', text2: e?.message || 'No se pudo guardar' });
    } finally {
      setSaving(false);
    }
  };

  const deletePlan = async () => {
    if (!config?.planType) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE_URL}/plan-config/${config.planType}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await readJsonSafe(res);
      if (!res.ok) throw new Error((data as any)?.message || 'No se pudo eliminar');

      Toast.show({ type: 'success', text1: 'Eliminado', text2: (data as any)?.message || 'Plan eliminado' });
      setConfig(null);

      const reload = await fetch(`${API_BASE_URL}/plan-config`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const reloadData = await readJsonSafe(reload);
      if (reload.ok) {
        const list = Array.isArray(reloadData) ? (reloadData as PlanConfig[]) : [];
        setPlans(list);
        const first = list?.[0]?.planType;
        setSelectedPlanType(first || '');
      }
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'Error', text2: e?.message || 'No se pudo eliminar' });
    } finally {
      setSaving(false);
    }
  };

  const fieldError = useMemo(() => {
    if (!config) return {} as Record<string, string | null>;
    const errors: Record<string, string | null> = {};
    const add = (key: keyof PlanConfig, label: string) => {
      const val = config[key] as unknown as number;
      if (!touched[String(key)]) {
        errors[String(key)] = null;
        return;
      }
      errors[String(key)] = isValidLimitNumber(val) ? null : `${label}: entero >= -1`;
    };
    add('transaccionesPorDia', 'Transacciones por día');
    add('historicoLimitadoDias', 'Histórico (días)');
    add('recurrentesPorUsuario', 'Recurrentes por usuario');
    add('subcuentasPorUsuario', 'Subcuentas por usuario');
    return errors;
  }, [config, touched]);

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={[styles.overlay, { backgroundColor: 'rgba(0,0,0,0.6)' }]}>
        <Animated.View
          style={[
            styles.container,
            {
              backgroundColor: colors.card,
              transform: [
                {
                  translateY: slideAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [30, 0],
                  }),
                },
              ],
              opacity: slideAnim,
            },
          ]}
        >
          <View style={styles.header}>
            <Ionicons name="settings" size={24} color={colors.text} />
            <Text style={[styles.title, { color: colors.text }]}>Límites del plan gratuito</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="small" color={colors.button} />
              <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Cargando…</Text>
            </View>
          ) : !config ? (
            <View>
              <Text style={[styles.errorText, { color: colors.textSecondary }]}>No se pudo cargar la configuración.</Text>
              <Text style={[styles.helpText, { color: colors.textSecondary }]}>
                Verifica que el backend responda con un objeto válido en /plan-config/{'{planType}'}.
              </Text>
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Selector de plan */}
              <Text style={[styles.label, { color: colors.textSecondary }]}>Plan</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
                {plans.map(p => {
                  const selected = p.planType === selectedPlanType;
                  return (
                    <TouchableOpacity
                      key={p.planType}
                      onPress={() => setSelectedPlanType(p.planType)}
                      style={[
                        styles.planChip,
                        {
                          backgroundColor: selected ? colors.button : colors.cardSecondary,
                          borderColor: colors.border,
                        },
                      ]}
                    >
                      <Text style={{ color: selected ? '#fff' : colors.text, fontWeight: '700' }}>{p.planType}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* Crear plan */}
              <Text style={[styles.label, { color: colors.textSecondary }]}>Crear nuevo plan</Text>
              <FormInput
                value={newPlanType}
                onChangeText={setNewPlanType}
                placeholder="ej: nuevo_plan"
                autoCapitalize="none"
              />
              <TouchableOpacity
                style={[styles.secondaryButton, { borderColor: colors.border, marginBottom: 10 }]}
                onPress={createPlan}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color={colors.textSecondary} />
                ) : (
                  <Text style={[styles.secondaryButtonText, { color: colors.textSecondary }]}>Crear</Text>
                )}
              </TouchableOpacity>

              <Text style={[styles.helpText, { color: colors.textSecondary }]}>Usa -1 para ilimitado.</Text>

              <Text style={[styles.label, { color: colors.textSecondary }]}>Transacciones por día</Text>
              <FormInput
                value={form?.transaccionesPorDia}
                onChangeText={(v) => {
                  markTouched('transaccionesPorDia');
                  updateField('transaccionesPorDia', parseIntSafe(v, config.transaccionesPorDia));
                }}
                keyboardType="number-pad"
              />
              {!!fieldError.transaccionesPorDia && (
                <Text style={[styles.validationText, { color: colors.error }]}>{fieldError.transaccionesPorDia}</Text>
              )}

              <Text style={[styles.label, { color: colors.textSecondary }]}>Histórico limitado (días)</Text>
              <FormInput
                value={form?.historicoLimitadoDias}
                onChangeText={(v) => {
                  markTouched('historicoLimitadoDias');
                  updateField('historicoLimitadoDias', parseIntSafe(v, config.historicoLimitadoDias));
                }}
                keyboardType="number-pad"
              />
              {!!fieldError.historicoLimitadoDias && (
                <Text style={[styles.validationText, { color: colors.error }]}>{fieldError.historicoLimitadoDias}</Text>
              )}

              <Text style={[styles.label, { color: colors.textSecondary }]}>Recurrentes por usuario</Text>
              <FormInput
                value={form?.recurrentesPorUsuario}
                onChangeText={(v) => {
                  markTouched('recurrentesPorUsuario');
                  updateField('recurrentesPorUsuario', parseIntSafe(v, config.recurrentesPorUsuario));
                }}
                keyboardType="number-pad"
              />
              {!!fieldError.recurrentesPorUsuario && (
                <Text style={[styles.validationText, { color: colors.error }]}>{fieldError.recurrentesPorUsuario}</Text>
              )}

              <Text style={[styles.label, { color: colors.textSecondary }]}>Subcuentas por usuario</Text>
              <FormInput
                value={form?.subcuentasPorUsuario}
                onChangeText={(v) => {
                  markTouched('subcuentasPorUsuario');
                  updateField('subcuentasPorUsuario', parseIntSafe(v, config.subcuentasPorUsuario));
                }}
                keyboardType="number-pad"
              />
              {!!fieldError.subcuentasPorUsuario && (
                <Text style={[styles.validationText, { color: colors.error }]}>{fieldError.subcuentasPorUsuario}</Text>
              )}

              <View style={styles.switchRow}>
                <View style={styles.switchText}>
                  <Text style={[styles.switchTitle, { color: colors.text }]}>Gráficas avanzadas</Text>
                  <Text style={[styles.switchSub, { color: colors.textSecondary }]}>Habilita/inhabilita acceso para plan gratuito</Text>
                </View>
                <Switch
                  value={!!config.graficasAvanzadas}
                  onValueChange={(v) => updateField('graficasAvanzadas', v)}
                  trackColor={{ false: colors.border, true: colors.button }}
                  thumbColor={colors.card}
                />
              </View>

              <View style={styles.switchRow}>
                <View style={styles.switchText}>
                  <Text style={[styles.switchTitle, { color: colors.text }]}>Activo</Text>
                  <Text style={[styles.switchSub, { color: colors.textSecondary }]}>Desactiva si quieres ignorar límites temporalmente</Text>
                </View>
                <Switch
                  value={!!config.activo}
                  onValueChange={(v) => updateField('activo', v)}
                  trackColor={{ false: colors.border, true: colors.button }}
                  thumbColor={colors.card}
                />
              </View>

              <View style={styles.actionsRow}>
                <TouchableOpacity
                  style={[styles.secondaryButton, { borderColor: colors.border }]}
                  onPress={initializeDefaults}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator size="small" color={colors.textSecondary} />
                  ) : (
                    <Text style={[styles.secondaryButtonText, { color: colors.textSecondary }]}>Inicializar defaults</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.primaryButton, { backgroundColor: colors.button }]}
                  onPress={save}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.primaryButtonText}>Guardar</Text>
                  )}
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[styles.dangerButton, { borderColor: colors.error }]}
                onPress={deletePlan}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color={colors.error} />
                ) : (
                  <Text style={{ color: colors.error, fontWeight: '800' }}>Eliminar plan</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  container: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 10,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
  },
  closeButton: {
    padding: 4,
  },
  loadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 20,
  },
  loadingText: {
    fontSize: 14,
  },
  errorText: {
    paddingVertical: 16,
    fontSize: 14,
  },
  helpText: {
    fontSize: 12,
    marginBottom: 12,
  },
  label: {
    fontSize: 12,
    marginBottom: 6,
  },
  validationText: {
    fontSize: 12,
    marginTop: -6,
    marginBottom: 10,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  switchText: {
    flex: 1,
    paddingRight: 10,
  },
  switchTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  switchSub: {
    fontSize: 12,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
    marginBottom: 6,
  },
  primaryButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
  secondaryButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    fontWeight: '700',
  },
  planChip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    marginRight: 8,
  },
  dangerButton: {
    marginTop: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
