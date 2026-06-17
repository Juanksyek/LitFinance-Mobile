import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';

import { useThemeColors } from '../theme/useThemeColors';
import { ticketScanService, type EvaluationReport } from '../services/ticketScanService';

// ─── Helpers ────────────────────────────────────────────────
function precisionColor(v: number): string {
  if (v >= 0.85) return '#10B981';
  if (v >= 0.6) return '#F59E0B';
  return '#EF4444';
}

function pct(v: number) {
  return `${Math.round(v * 100)}%`;
}

// ─── Bar component ───────────────────────────────────────────
function PrecisionBar({ label, value, colors }: { label: string; value: number; colors: ReturnType<typeof useThemeColors> }) {
  const color = precisionColor(value);
  return (
    <View style={styles.barRow}>
      <Text style={[styles.barLabel, { color: colors.textSecondary }]} numberOfLines={1}>{label}</Text>
      <View style={[styles.barTrack, { backgroundColor: colors.cardSecondary }]}>
        <View style={[styles.barFill, { width: `${Math.round(value * 100)}%` as any, backgroundColor: color }]} />
      </View>
      <Text style={[styles.barValue, { color }]}>{pct(value)}</Text>
    </View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────
export default function TicketEvaluationScreen() {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();

  const [report, setReport] = useState<EvaluationReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const data = await ticketScanService.evaluation();
      setReport(data);
    } catch (err: any) {
      setError(err?.message || 'Error al cargar métricas');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onRefresh = () => {
    setRefreshing(true);
    load(true);
  };

  const fieldPairs = report
    ? Object.entries(report.precisionPorCampo).sort(([, a], [, b]) => b - a)
    : [];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.backBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back-outline" size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Evaluación OCR</Text>
        </View>
        <TouchableOpacity
          style={[styles.backBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => load()}
          disabled={loading}
        >
          <Ionicons name="refresh-outline" size={20} color={colors.text} />
        </TouchableOpacity>
      </View>

      {loading && !report && (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#EF7725" />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Cargando métricas…</Text>
        </View>
      )}

      {!!error && !loading && (
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={48} color={colors.error} />
          <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
          <TouchableOpacity
            style={[styles.retryBtn, { backgroundColor: '#EF772514', borderColor: '#EF772530' }]}
            onPress={() => load()}
          >
            <Text style={{ color: '#EF7725', fontWeight: '600' }}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      )}

      {report && (
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 20 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#EF7725" />}
        >
          {/* Summary cards */}
          <View style={styles.cardRow}>
            <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Ionicons name="receipt-outline" size={22} color="#EF7725" />
              <Text style={[styles.summaryValue, { color: colors.text }]}>{report.totalTickets}</Text>
              <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Tickets</Text>
            </View>
            <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Ionicons name="cash-outline" size={22} color="#F59E0B" />
              <Text style={[styles.summaryValue, { color: colors.text }]}>{pct(1 - report.errorPromedioMontos)}</Text>
              <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Precisión importes</Text>
            </View>
          </View>

          {/* Precision por campo */}
          {fieldPairs.length > 0 && (
            <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Precisión por campo</Text>
              {fieldPairs.map(([field, val]) => (
                <PrecisionBar key={field} label={field} value={val} colors={colors} />
              ))}
            </View>
          )}

          {/* Por extractor */}
          {report.porExtractor.length > 0 && (
            <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Por extractor</Text>
              {report.porExtractor.map((ext) => (
                <View key={ext.extractor} style={[styles.extRow, { borderTopColor: colors.border }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.extName, { color: colors.text }]}>{ext.extractor}</Text>
                    <Text style={[styles.extTickets, { color: colors.textSecondary }]}>{ext.tickets} tickets</Text>
                  </View>
                  <View style={[styles.precBadge, { backgroundColor: precisionColor(ext.precision) + '18' }]}>
                    <Text style={[styles.precBadgeText, { color: precisionColor(ext.precision) }]}>
                      {pct(ext.precision)}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: { fontSize: 17, fontWeight: '600' },

  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 32,
  },
  loadingText: { fontSize: 14 },
  errorText: { fontSize: 15, textAlign: 'center' },
  retryBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 4,
  },

  content: { padding: 16, gap: 16 },

  cardRow: { flexDirection: 'row', gap: 12 },
  summaryCard: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    alignItems: 'center',
    gap: 6,
  },
  summaryValue: { fontSize: 22, fontWeight: '800' },
  summaryLabel: { fontSize: 12 },

  section: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    gap: 10,
  },
  sectionTitle: { fontSize: 15, fontWeight: '700', marginBottom: 2 },

  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  barLabel: { width: 100, fontSize: 12 },
  barTrack: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
  },
  barValue: { width: 38, textAlign: 'right', fontSize: 12, fontWeight: '700' },

  extRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  extName: { fontSize: 14, fontWeight: '600' },
  extTickets: { fontSize: 12, marginTop: 2 },
  precBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  precBadgeText: { fontSize: 13, fontWeight: '700' },
});
