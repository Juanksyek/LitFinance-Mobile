import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useStableSafeInsets } from '../hooks/useStableSafeInsets';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import * as Animatable from 'react-native-animatable';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useNavigation } from '@react-navigation/native';

import { useTheme } from '../theme/ThemeContext';
import { useThemeColors } from '../theme/useThemeColors';
import { getPlanTypeFromStorage, isPremiumUser } from '../services/planConfigService';
import { userProfileService } from '../services/userProfileService';
import {
  exportReporte,
  ReportExportResponse,
  ReportFormat,
  ReportRango,
} from '../services/reportExportService';
import { shareBase64AsFile } from '../utils/base64File';

const RANGOS: Array<{ key: ReportRango; label: string }> = [
  { key: 'dia', label: 'Día' },
  { key: 'semana', label: 'Semana' },
  { key: 'mes', label: 'Mes' },
  { key: '3meses', label: '3 meses' },
  { key: '6meses', label: '6 meses' },
  { key: 'año', label: 'Año' },
];

function formatBytes(bytes?: number): string {
  const n = typeof bytes === 'number' ? bytes : 0;
  if (n <= 0) return '0 KB';
  const kb = n / 1024;
  if (kb < 1024) return `${kb.toFixed(0)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB`;
}

export default function ReportesExportScreen() {
  const colors = useThemeColors();
  const { isDark } = useTheme();
  const insets = useStableSafeInsets();
  const navigation = useNavigation();

  const [isPremium, setIsPremium] = useState<boolean>(false);
  const [checkingPlan, setCheckingPlan] = useState<boolean>(true);

  const [format, setFormat] = useState<ReportFormat>('pdf');
  const [rango, setRango] = useState<ReportRango>('mes');
  const [incluirMovimientos, setIncluirMovimientos] = useState<boolean>(true);
  const [topN, setTopN] = useState<number>(8);
  const [limiteMovimientos, setLimiteMovimientos] = useState<number>(800);

  const limiteTouchedRef = useRef(false);

  const [loading, setLoading] = useState<boolean>(false);
  const [lastExport, setLastExport] = useState<ReportExportResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setCheckingPlan(true);
      try {
        const cached = await userProfileService.getCachedProfile();
        // Consider premiumUntil and subscription status present in cached profile
        const quickPremium = !!cached && (isPremiumUser(cached) || cached?.planType === 'premium_plan' || cached?.isPremium === true);
        if (!cancelled && quickPremium) {
          setIsPremium(true);
          return;
        }

        const plan = await getPlanTypeFromStorage();
        if (!cancelled) setIsPremium(plan === 'premium_plan');
      } catch {
        if (!cancelled) setIsPremium(false);
      } finally {
        if (!cancelled) setCheckingPlan(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    // Ajustar default de limiteMovimientos por formato, sin pisar si el usuario ya lo toc\u00F3.
    if (limiteTouchedRef.current) return;
    setLimiteMovimientos(format === 'pdf' ? 800 : 5000);
  }, [format]);

  const gradient = useMemo(() => {
    if (isDark) return ['#10131C', '#121826', '#0B0F1A'] as const;
    return ['#F7F9FF', '#F1F5FF', '#FFFFFF'] as const;
  }, [isDark]);
    // Use app theme `button` color for premium gradient; add alpha helper
    function withAlpha(hex: string, alpha: number) {
      const clamp = (n: number, min = 0, max = 1) => Math.min(max, Math.max(min, n));
      try {
        const a = Math.round(clamp(alpha) * 255).toString(16).padStart(2, '0');
        let h = (hex || '').replace('#', '');
        if (!h) return hex;
        if (h.length === 3) h = h.split('').map(c => c + c).join('');
        return `#${h}${a}`;
      } catch {
        return hex;
      }
    }

    const premiumGradient = useMemo<readonly [string, string, string]>(() => {
      const baseOrange = colors.button || '#EF7725';
      const yellow = colors.warning || '#F59E0B';
      const warmAccent = '#FFD54A'; // soft warm accent to complete the trio
      return [withAlpha(baseOrange, 1), withAlpha(yellow, 1), withAlpha(warmAccent, 0.92)];
    }, [colors.button, colors.warning, isDark]);

  const handleGenerate = useCallback(async () => {
    if (checkingPlan) return;

    setLoading(true);
    try {
      // Step 0: force profile sync from server to ensure entitlements are current
      try {
        const updated = await userProfileService.fetchAndUpdateProfile();
        console.log('🔁 [ReportesExport] Perfil sync antes de export:', {
          isPremium: updated?.isPremium,
          planType: updated?.planType,
        });
        if (updated) setIsPremium(isPremiumUser(updated));
      } catch (syncErr) {
        console.warn('⚠️ [ReportesExport] No se pudo sincronizar perfil previo a export:', syncErr);
      }

      // Step 1: attempt export
      const res = await exportReporte({
        format,
        rango,
        incluirMovimientos,
        topN,
        limiteMovimientos,
      });
      setLastExport(res);

      Toast.show({
        type: 'success',
        text1: 'Reporte generado',
        text2: res?.filename ? res.filename : 'Listo para descargar',
        visibilityTime: 2500,
      });
    } catch (e: any) {
      const code = e?.code;
      const status = e?.status;

      // If server rejects with PREMIUM_REQUIRED, try one more time after fresh profile sync
      if (status === 403 || code === 'PREMIUM_REQUIRED') {
        try {
          const updated = await userProfileService.fetchAndUpdateProfile();
          console.log('🔁 [ReportesExport] Re-sync perfil tras 403:', {
            isPremium: updated?.isPremium,
            planType: updated?.planType,
          });
          if (updated) setIsPremium(isPremiumUser(updated));
        } catch {
          // ignore
        }

        // Reattempt once with the (possibly) updated profile/token
        try {
          const res2 = await exportReporte({
            format,
            rango,
            incluirMovimientos,
            topN,
            limiteMovimientos,
          });
          setLastExport(res2);
          Toast.show({
            type: 'success',
            text1: 'Reporte generado',
            text2: res2?.filename ? res2.filename : 'Listo para descargar',
            visibilityTime: 2500,
          });
          return;
        } catch (e2: any) {
          // If it still fails, show clear diagnostic guidance
          Toast.show({
            type: 'error',
            text1: 'Falta Premium',
            text2: 'Parece que no tienes premium :(',
            visibilityTime: 8000,
            onPress: () => {
              // @ts-ignore
              navigation.navigate('Support' as never);
            },
          });
          console.warn('❗ [ReportesExport] 2º intento falló con PREMIUM_REQUIRED o 403:', e2);
          return;
        }
      }

      Toast.show({
        type: 'error',
        text1: 'No se pudo generar el reporte',
        text2: e?.message || 'Intenta de nuevo en unos segundos',
        visibilityTime: 4500,
      });
    } finally {
      setLoading(false);
    }
  }, [checkingPlan, format, incluirMovimientos, isPremium, limiteMovimientos, navigation, rango, topN]);

  const handleShare = useCallback(async () => {
    if (!lastExport) return;
    try {
      await shareBase64AsFile({
        base64: lastExport.base64,
        filename: lastExport.filename,
        mimeType: lastExport.mimeType,
      });
    } catch (e: any) {
      Toast.show({
        type: 'error',
        text1: 'No se pudo exportar',
        text2: e?.message || 'Tu dispositivo no soporta compartir archivos.',
        visibilityTime: 4500,
      });
    }
  }, [lastExport]);

  const reportsLocked = !isPremium;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}> 
      <StatusBar style={isDark ? 'light' : 'dark'} />

      <LinearGradient colors={gradient} style={[styles.hero, { paddingTop: (insets.top || 0) + 14 }]}>
        <TouchableOpacity
          onPress={() => {
            // @ts-ignore
            navigation.goBack();
          }}
          activeOpacity={0.85}
          style={[styles.backBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <Ionicons name="chevron-back" size={18} color={colors.text} />
          <Text style={[styles.backText, { color: colors.text }]}>Dashboard</Text>
        </TouchableOpacity>

        <Animatable.View animation="fadeInUp" duration={650} useNativeDriver>
          <Text style={[styles.title, { color: colors.text }]}>Reportes exportables</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Genera un reporte formal (PDF o Excel) con resumen, comparativa, insights y top de gastos.
          </Text>

          <View style={styles.premiumRow}>
            <LinearGradient
              colors={premiumGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.premiumBadge}
            >
              <Ionicons name="sparkles" size={14} color="#fff" />
              <Text style={styles.premiumBadgeText}>Premium</Text>
            </LinearGradient>

            <View style={[styles.planPill, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Ionicons
                name={reportsLocked ? 'lock-closed' : 'checkmark-circle'}
                size={14}
                color={reportsLocked ? colors.textSecondary : '#22C55E'}
              />
              <Text style={[styles.planPillText, { color: reportsLocked ? colors.textSecondary : colors.text }]}>
                {checkingPlan ? 'Verificando...' : reportsLocked ? 'Bloqueado' : 'Activo'}
              </Text>
            </View>
          </View>
        </Animatable.View>
      </LinearGradient>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 24 + (insets.bottom || 0) }}
        showsVerticalScrollIndicator={false}
      >
        <Animatable.View animation="fadeInUp" duration={650} delay={80} useNativeDriver>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            <Text style={[styles.cardTitle, { color: colors.text }]}>Configuración</Text>

            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Formato</Text>
            <View style={styles.row}>
              <Pill
                label="PDF"
                active={format === 'pdf'}
                onPress={() => setFormat('pdf')}
                colors={colors}
              />
              <Pill
                label="Excel"
                active={format === 'xlsx'}
                onPress={() => setFormat('xlsx')}
                colors={colors}
              />
            </View>

            <Text style={[styles.sectionLabel, { color: colors.textSecondary, marginTop: 14 }]}>
              Periodo del reporte
            </Text>
            <View style={styles.chipsWrap}>
              {RANGOS.map((r) => (
                <Chip
                  key={r.key}
                  label={r.label}
                  active={rango === r.key}
                  onPress={() => setRango(r.key)}
                  colors={colors}
                />
              ))}
            </View>

            <View style={[styles.rowBetween, { marginTop: 14 }]}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Incluir movimientos</Text>
                <Text style={[styles.hint, { color: colors.textSecondary }]}>
                  Si lo desactivas, el reporte omite la tabla detallada.
                </Text>
              </View>
              <Switch
                value={incluirMovimientos}
                onValueChange={setIncluirMovimientos}
                trackColor={{ false: colors.border, true: colors.button }}
                thumbColor={Platform.OS === 'android' ? '#fff' : undefined}
              />
            </View>

            <View style={[styles.rowBetween, { marginTop: 14 }]}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Top gastos</Text>
                <Text style={[styles.hint, { color: colors.textSecondary }]}>
                  Cuántos conceptos mostrar en el ranking.
                </Text>
              </View>
              <Stepper
                value={topN}
                min={4}
                max={12}
                onChange={setTopN}
                colors={colors}
              />
            </View>

            <View style={[styles.rowBetween, { marginTop: 14 }]}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Límite de movimientos</Text>
                <Text style={[styles.hint, { color: colors.textSecondary }]}>
                  PDF recomienda menor límite; Excel soporta más volumen.
                </Text>
              </View>
              <Stepper
                value={limiteMovimientos}
                min={format === 'pdf' ? 100 : 500}
                max={format === 'pdf' ? 2000 : 20000}
                step={format === 'pdf' ? 100 : 500}
                onChange={(v) => {
                  limiteTouchedRef.current = true;
                  setLimiteMovimientos(v);
                }}
                colors={colors}
                wide
              />
            </View>

            <TouchableOpacity
              onPress={handleGenerate}
              activeOpacity={0.92}
              disabled={loading}
              style={{ marginTop: 16, opacity: loading ? 0.8 : 1 }}
            >
              <LinearGradient
                colors={premiumGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.primaryBtn}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Ionicons name="download" size={18} color="#fff" />
                )}
                <Text style={styles.primaryBtnText}>
                  {loading ? 'Generando...' : 'Generar reporte'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>

            {reportsLocked ? (
              <View style={[styles.lockNotice, { borderColor: colors.border }]}
              >
                <Text style={[styles.lockTitle, { color: colors.text }]}>
                  Vista previa (Premium)
                </Text>
                <Text style={[styles.lockText, { color: colors.textSecondary }]}>
                  Exporta reportes formales en PDF/Excel. Incluye resumen, comparativa vs periodo anterior, insights, top de gastos y serie mensual.
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    // @ts-ignore
                    navigation.navigate('Settings' as never);
                  }}
                  activeOpacity={0.9}
                  style={[styles.secondaryBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
                >
                  <Ionicons name="sparkles" size={16} color={colors.button} />
                  <Text style={[styles.secondaryBtnText, { color: colors.text }]}>
                    Ver Premium
                  </Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        </Animatable.View>

        <Animatable.View animation="fadeInUp" duration={650} delay={140} useNativeDriver>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            <Text style={[styles.cardTitle, { color: colors.text }]}>
              Preview del reporte
            </Text>

            <View style={[styles.previewFrame, { borderColor: colors.border, backgroundColor: colors.background }]}
            >
              <Text style={[styles.previewTitle, { color: colors.text }]}>
                Secciones incluidas
              </Text>
              <PreviewRow label="Resumen" colors={colors} />
              <PreviewRow label="Comparativa vs periodo anterior" colors={colors} />
              <PreviewRow label="Insights" colors={colors} />
              <PreviewRow label={`Top de gastos (Top ${topN})`} colors={colors} />
              <PreviewRow label="Serie mensual" colors={colors} />
              <PreviewRow
                label={incluirMovimientos ? `Movimientos (hasta ${limiteMovimientos})` : 'Movimientos (omitidos)'}
                colors={colors}
                muted={!incluirMovimientos}
              />
            </View>

            {lastExport ? (
              <View style={[styles.generatedBox, { borderColor: colors.border }]}
              >
                <View style={styles.generatedHeader}>
                  <Ionicons name="document-text" size={18} color={colors.button} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.generatedFilename, { color: colors.text }]} numberOfLines={1}>
                      {lastExport.filename}
                    </Text>
                    <Text style={[styles.generatedMeta, { color: colors.textSecondary }]}>
                      {formatBytes(lastExport.sizeBytes)} \u2022 {lastExport.mimeType}
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  onPress={handleShare}
                  activeOpacity={0.9}
                  style={[styles.secondaryBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
                >
                  <Ionicons name="share-outline" size={16} color={colors.text} />
                  <Text style={[styles.secondaryBtnText, { color: colors.text }]}>Abrir / Compartir</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                Aún no generas un reporte. Configura y presiona \"Generar reporte\".
              </Text>
            )}
          </View>
        </Animatable.View>
      </ScrollView>
    </View>
  );
}

function PreviewRow({
  label,
  colors,
  muted,
}: {
  label: string;
  colors: ReturnType<typeof useThemeColors>;
  muted?: boolean;
}) {
  return (
    <View style={styles.previewRow}>
      <Ionicons name={muted ? 'remove-circle-outline' : 'checkmark-circle-outline'} size={16} color={muted ? colors.textSecondary : '#22C55E'} />
      <Text style={[styles.previewRowText, { color: muted ? colors.textSecondary : colors.text }]}>
        {label}
      </Text>
    </View>
  );
}

function Pill({
  label,
  active,
  onPress,
  colors,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  colors: ReturnType<typeof useThemeColors>;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.88}
      style={[
        styles.pill,
        {
          backgroundColor: active ? colors.button : colors.background,
          borderColor: active ? colors.button : colors.border,
        },
      ]}
    >
      <Text style={[styles.pillText, { color: active ? '#fff' : colors.text }]}>{label}</Text>
    </TouchableOpacity>
  );
}

function Chip({
  label,
  active,
  onPress,
  colors,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  colors: ReturnType<typeof useThemeColors>;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.88}
      style={[
        styles.chip,
        {
          backgroundColor: active ? colors.button : colors.background,
          borderColor: active ? colors.button : colors.border,
        },
      ]}
    >
      <Text style={[styles.chipText, { color: active ? '#fff' : colors.text }]}>{label}</Text>
    </TouchableOpacity>
  );
}

function Stepper({
  value,
  min,
  max,
  step = 1,
  onChange,
  colors,
  wide,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (next: number) => void;
  colors: ReturnType<typeof useThemeColors>;
  wide?: boolean;
}) {
  const dec = () => onChange(Math.max(min, value - step));
  const inc = () => onChange(Math.min(max, value + step));

  return (
    <View style={[styles.stepper, { borderColor: colors.border, backgroundColor: colors.background }, wide ? styles.stepperWide : null]}>
      <TouchableOpacity onPress={dec} activeOpacity={0.85} style={styles.stepperBtn}>
        <Ionicons name="remove" size={16} color={colors.text} />
      </TouchableOpacity>
      <Text style={[styles.stepperValue, { color: colors.text }]}>{value}</Text>
      <TouchableOpacity onPress={inc} activeOpacity={0.85} style={styles.stepperBtn}>
        <Ionicons name="add" size={16} color={colors.text} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },

  hero: {
    paddingHorizontal: 18,
    paddingBottom: 16,
  },

  backBtn: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    marginBottom: 10,
  },
  backText: {
    fontSize: 13,
    fontWeight: '600',
  },

  title: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  subtitle: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 20,
  },

  premiumRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  premiumBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  premiumBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },

  planPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  planPillText: {
    fontSize: 12,
    fontWeight: '700',
  },

  card: {
    marginTop: 14,
    marginHorizontal: 14,
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
  },

  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 10,
  },

  sectionLabel: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },

  hint: {
    marginTop: 2,
    fontSize: 12,
    lineHeight: 16,
  },

  row: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },

  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },

  pill: {
    flex: 1,
    borderRadius: 999,
    borderWidth: 1,
    paddingVertical: 10,
    alignItems: 'center',
  },
  pillText: {
    fontSize: 13,
    fontWeight: '800',
  },

  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '800',
  },

  primaryBtn: {
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '900',
  },

  secondaryBtn: {
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    marginTop: 10,
  },
  secondaryBtnText: {
    fontSize: 13,
    fontWeight: '800',
  },

  lockNotice: {
    marginTop: 14,
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
  },
  lockTitle: {
    fontSize: 14,
    fontWeight: '900',
  },
  lockText: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 17,
  },

  previewFrame: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
  },
  previewTitle: {
    fontSize: 13,
    fontWeight: '900',
    marginBottom: 8,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
  },
  previewRowText: {
    fontSize: 13,
    fontWeight: '700',
  },

  generatedBox: {
    marginTop: 12,
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
  },
  generatedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  generatedFilename: {
    fontSize: 13,
    fontWeight: '900',
  },
  generatedMeta: {
    marginTop: 2,
    fontSize: 12,
  },

  emptyText: {
    marginTop: 10,
    fontSize: 12,
    lineHeight: 17,
  },

  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 999,
    overflow: 'hidden',
  },
  stepperWide: {
    minWidth: 158,
  },
  stepperBtn: {
    width: 40,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperValue: {
    minWidth: 52,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '900',
  },
});
