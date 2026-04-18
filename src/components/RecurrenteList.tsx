import React, { useEffect, useState, useRef } from "react";
import { View, Text, TextInput, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, Dimensions } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { authService } from "../services/authService";
import { API_BASE_URL } from "../constants/api";
import { useNavigation, NavigationProp } from "@react-navigation/native";
import { RootStackParamList } from "../navigation/AppNavigator";
import { Ionicons } from "@expo/vector-icons";
import { useThemeColors } from "../theme/useThemeColors";
import { describeFrequencyShort } from '../utils/recurrentUtils';
import SmartNumber from './SmartNumber';
import apiRateLimiter from "../services/apiRateLimiter";
import { analyticsService } from '../services/analyticsService';
import Toast from "react-native-toast-message";
import RecurrentModal from './RecurrentModal';
import { emitRecurrentesChanged } from '../utils/dashboardRefreshBus';
import { canPerform } from '../services/planConfigService';
import type { DashboardSnapshot } from "../types/dashboardSnapshot";

const { width } = Dimensions.get("window");
const LIMIT = 4;
type RecurrenteNavigationProp = NavigationProp<RootStackParamList, "RecurrenteDetail">;

type Recurrente = {
    recurrenteId: string;
    nombre: string;
    monto: number;
    moneda?: string;
    frecuenciaValor: string;
    frecuenciaTipo: 'dia_semana' | 'dia_mes' | 'fecha_anual';
    proximaEjecucion: string;
    plataforma?: { color: string; nombre: string; categoria: string };
    afectaCuentaPrincipal: boolean;
    afectaSubcuenta: boolean;
    subcuentaId?: string;
    recordatorios?: number[];
    pausado: boolean;
    tipoRecurrente?: 'indefinido' | 'plazo_fijo';
    totalPagos?: number;
    pagosRealizados?: number;
    estado?: 'activo' | 'pausado' | 'completado';
    pausadoPorPlan?: boolean;
    createdAt?: string;
    updatedAt?: string;
  };

const RecurrentesList = ({
    userId,
    subcuentaId,
    esSubcuenta = false,
    refreshKey,
    dashboardSnapshot,
}: {
    userId?: string;
    subcuentaId?: string;
    esSubcuenta?: boolean;
    refreshKey?: number;
    dashboardSnapshot?: DashboardSnapshot | null;
}) => {
    const colors = useThemeColors();
    console.log('🔁 [RecurrentesList] render', { userId, subcuentaId });
    const [recurrentes, setRecurrentes] = useState<Recurrente[]>([]);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [hasMore, setHasMore] = useState(true);
    const [loading, setLoading] = useState(false);
    const [hasReachedLimit, setHasReachedLimit] = useState(false);
    const [createModalVisible, setCreateModalVisible] = useState(false);
    const [allowedLimit, setAllowedLimit] = useState<number | null>(null);
    const [recurrentesWithPauseStatus, setRecurrentesWithPauseStatus] = useState<Recurrente[]>([]);

    const snapshotMode = dashboardSnapshot !== undefined && !esSubcuenta;

    const [convertedTotal, setConvertedTotal] = useState<number | null>(null);
    const [convertedLoading, setConvertedLoading] = useState(false);

    const getCurrencySymbol = (currency?: string | null) => {
        const normalized = String(currency ?? '').trim().toUpperCase();
        const symbols: Record<string, string> = {
            MXN: '$',
            USD: '$',
            EUR: '€',
            GBP: '£',
            JPY: '¥',
            CNY: '¥',
            CAD: '$',
            AUD: '$',
            CHF: 'CHF',
        };
        return symbols[normalized] ?? normalized;
    };

    // Cache for external rates fetched from the provided endpoint
    const externalRatesCacheRef = useRef<{ rates: Record<string, number>; baseCurrency?: string } | null>(null);

    const findCurrencyArray = (obj: any): any[] | null => {
        if (!obj || typeof obj !== 'object') return null;
        if (Array.isArray(obj)) {
            const arr = obj as any[];
            if (arr.length > 0 && arr.some((it) => it && (it.codigo || it.code || it.currency || it.tasaBase || it.tasa))) return arr;
        }
        for (const k of Object.keys(obj)) {
            try {
                const v = (obj as any)[k];
                const found = findCurrencyArray(v);
                if (found) return found;
            } catch (e) {
                continue;
            }
        }
        return null;
    };

    const fetchExternalRates = async (targetCurrency: string): Promise<{ rates: Record<string, number>; baseCurrency?: string }> => {
        // Return cached if present
        if (externalRatesCacheRef.current) return externalRatesCacheRef.current;

        const candidates = [
            `${API_BASE_URL.replace(/\/$/, '')}/monedas`
        ];

        for (const url of candidates) {
            try {
                // Use apiRateLimiter.fetch so Authorization and caching are handled consistently
                const res = await apiRateLimiter.fetch(url, { method: 'GET' });
                if (!res.ok) {
                    const txt = await res.text().catch(() => null);
                    console.warn('⚠️ [RecurrentesList] external rates fetch failed', url, res.status, txt);
                    continue;
                }

                const body = await res.json().catch(() => null);
                const parsed: Record<string, number> = {};
                let detectedBase: string | undefined;

                if (!body) {
                    externalRatesCacheRef.current = { rates: parsed };
                    return { rates: parsed };
                }

                // Heurísticas para distintos formatos de respuesta
                if (Array.isArray(body)) {
                    for (const item of body) {
                        if (!item) continue;
                        const code = item.codigo || item.currency || item.code || item.moneda || item.from || item.to;
                        const rate = item.tasaBase || item.tasa || item.rate || item.value || item.ratio || item.price;
                        if (item.esPrincipal || item.isPrincipal) detectedBase = String(code).toUpperCase();
                        if (code && typeof rate === 'number') parsed[String(code).toUpperCase()] = rate;
                    }
                } else if (typeof body === 'object') {
                    if (body.rates && typeof body.rates === 'object') {
                        for (const [k, v] of Object.entries(body.rates)) {
                            if (typeof v === 'number') parsed[String(k).toUpperCase()] = v;
                            else if (v && typeof v === 'object' && typeof (v as any).value === 'number') parsed[String(k).toUpperCase()] = (v as any).value;
                        }
                    } else if (body.data && body.data.rates && typeof body.data.rates === 'object') {
                        for (const [k, v] of Object.entries(body.data.rates)) {
                            if (typeof v === 'number') parsed[String(k).toUpperCase()] = v;
                        }
                    } else {
                        // Try to interpret body as direct mapping
                        for (const [k, v] of Object.entries(body)) {
                            // If the payload contains known grouped arrays, parse them explicitly
                            if (Array.isArray(v) && (k === 'favoritas' || k === 'otras' || k === 'monedas' || k === 'items' || k === 'data' || k === 'lista')) {
                                for (const item of v) {
                                    if (!item || typeof item !== 'object') continue;
                                    const code = item.codigo || item.currency || item.code || item.moneda || item.from || item.to;
                                    const rate = item.tasaBase || item.tasa || item.rate || item.value || item.ratio || item.price;
                                    if (item.esPrincipal || item.isPrincipal) detectedBase = String(code).toUpperCase();
                                    if (code && typeof rate === 'number') parsed[String(code).toUpperCase()] = rate;
                                }
                                continue;
                            }

                            // If objects with tasaBase per currency
                            if (v && typeof v === 'object') {
                                const code = (v as any).codigo ?? k;
                                const rate = (v as any).tasaBase ?? (v as any).tasa ?? (v as any).rate ?? (v as any).value;
                                if ((v as any).esPrincipal || (v as any).isPrincipal) detectedBase = String(code).toUpperCase();
                                if (code && typeof rate === 'number') parsed[String(code).toUpperCase()] = rate;
                            } else if (typeof v === 'number') {
                                // Only accept top-level numeric entries if the key looks like a 3-letter currency code (avoid TOTAL-like keys)
                                const upk = String(k).toUpperCase();
                                if (/^[A-Z]{3}$/.test(upk)) {
                                    parsed[upk] = v;
                                }
                            }
                        }
                    }
                }

                // If parsing above didn't find currency-like keys, try to locate nested arrays containing currency objects
                const looksLikeCurrencyKey = (key: string) => /^[A-Z]{3}$/.test(key);
                if (Object.keys(parsed).length === 0 || !Object.keys(parsed).some(looksLikeCurrencyKey)) {
                    const candidate = findCurrencyArray(body);
                    if (Array.isArray(candidate)) {
                        for (const item of candidate) {
                            if (!item || typeof item !== 'object') continue;
                            const code = item.codigo || item.currency || item.code || item.moneda || item.from || item.to;
                            const rate = item.tasaBase || item.tasa || item.rate || item.value || item.ratio || item.price;
                            if (item.esPrincipal || item.isPrincipal) detectedBase = String(code).toUpperCase();
                            if (code && typeof rate === 'number') parsed[String(code).toUpperCase()] = rate;
                        }
                    }
                }

                externalRatesCacheRef.current = { rates: parsed, baseCurrency: detectedBase };
                console.log('🔁 [RecurrentesList] external rates fetched from', url, parsed, 'detectedBase=', detectedBase);
                return { rates: parsed, baseCurrency: detectedBase };
            } catch (err) {
                console.error('❌ [RecurrentesList] fetchExternalRates error', err, url);
                // try next candidate
                continue;
            }
        }

        // All candidates failed
        externalRatesCacheRef.current = { rates: {} };
        return { rates: {} };
    };

    const recurrentesTotals = dashboardSnapshot?.recurrentesTotals;
    const showRecurrentesTotals =
        snapshotMode &&
        !!recurrentesTotals &&
        (Array.isArray(recurrentesTotals.active?.byCurrency) || Array.isArray(recurrentesTotals.paused?.byCurrency));

    const navigation = useNavigation<RecurrenteNavigationProp>();
    
    // Refs para cleanup y control de estado
    const isMountedRef = useRef(true);
    const abortControllerRef = useRef<AbortController | null>(null);
    const lastFetchRef = useRef<number>(0);

    // Cleanup al desmontar
    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
    }, []);

    useEffect(() => {
        const timeout = setTimeout(() => setDebouncedSearch(search), 400);
        return () => clearTimeout(timeout);
    }, [search]);

    // Snapshot mode (Dashboard): compute list locally from snapshot, avoid network + canPerform
    useEffect(() => {
        if (!snapshotMode || !dashboardSnapshot) return;

        const pauseIds = new Set(
            (dashboardSnapshot.meta?.planEnforcement?.recurrentes?.toPauseOnThisPage || []).map((x) => String(x))
        );

                const allBase = (dashboardSnapshot.recurrentesSummary || []).map((r) => {
            const pausedByPlan = Boolean(r.pausadoPorPlan) || pauseIds.has(String(r.id));
            const baseEstado = (r.estado as any) ?? (r.pausado ? 'pausado' : 'activo');
            const estado = pausedByPlan && baseEstado !== 'completado' ? 'pausado' : baseEstado;
            const pausado = Boolean(r.pausado) || (pausedByPlan && estado !== 'completado');
            return {
            recurrenteId: r.id,
            nombre: r.nombre,
            monto: Number(r.monto || 0),
            moneda: r.moneda,
            frecuenciaValor: r.frecuenciaValor,
            frecuenciaTipo: (r.frecuenciaTipo as any) ?? 'dia_mes',
            proximaEjecucion: r.nextRun,
            plataforma: r.color ? { color: r.color, nombre: '', categoria: '' } : undefined,
            pausado,
            estado,
            pausadoPorPlan: pausedByPlan,
                        createdAt: (r as any).createdAt,
                        updatedAt: (r as any).updatedAt,
            afectaCuentaPrincipal: true,
            afectaSubcuenta: false,
        };
        }) as Recurrente[];

                const isPremium = Boolean(dashboardSnapshot.meta?.plan?.isPremium);
                const max = dashboardSnapshot.meta?.limits?.maxRecurrentes ?? null;
                const unlimited = max === -1 || max === null;

                // Re-apply plan enforcement using the server-provided total count, not the page-slice
                // length. This corrects stale pausadoPorPlan flags that may linger in cached snapshots:
                // - If realTotal <= max → no item should be plan-paused; clear any stale flags.
                // - If realTotal >  max → keep the most-recent `max` active; pause the rest.
                const planEnfTotal = (dashboardSnapshot.meta?.planEnforcement?.recurrentes as any)?.total;
                const realTotal = typeof planEnfTotal === 'number' ? planEnfTotal : allBase.length;
                const isOverLimit = !isPremium && !unlimited && typeof max === 'number' && realTotal > max;

                let all = allBase;
                if (!isPremium && !unlimited && typeof max === 'number') {
                    const getTime = (x: Recurrente) => {
                        const ts = (x.createdAt as string | undefined) || (x.updatedAt as string | undefined) || '';
                        const t = ts ? new Date(ts).getTime() : 0;
                        return Number.isFinite(t) ? t : 0;
                    };

                    if (isOverLimit) {
                        // Keep most recent `max` active; pause the oldest beyond the limit.
                        const sorted = [...allBase].sort((a, b) => getTime(b) - getTime(a));
                        const allowedIds = new Set(sorted.slice(0, max).map((x) => x.recurrenteId));
                        all = allBase.map((x) =>
                            allowedIds.has(x.recurrenteId)
                                ? x.pausadoPorPlan ? { ...x, pausadoPorPlan: false } : x
                                : { ...x, pausadoPorPlan: true, pausado: true, estado: 'pausado' }
                        );
                    } else {
                        // Within limit: clear any stale pausadoPorPlan flags from cached snapshot.
                        const hasStale = allBase.some((x) => x.pausadoPorPlan);
                        if (hasStale) {
                            all = allBase.map((x) =>
                                x.pausadoPorPlan
                                    ? { ...x, pausadoPorPlan: false, pausado: false, estado: 'activo' as const }
                                    : x
                            );
                        }
                    }
                }

        const q = debouncedSearch.trim().toLowerCase();
        const filtered = q ? all.filter((x) => (x.nombre || '').toLowerCase().includes(q)) : all;

        const start = (page - 1) * LIMIT;
        const slice = filtered.slice(start, start + LIMIT);

        setRecurrentes(slice);
        setRecurrentesWithPauseStatus(slice);
        setHasMore(start + LIMIT < filtered.length);
        setLoading(false);

        setAllowedLimit(unlimited ? null : Number(max));
        setHasReachedLimit(!isPremium && !unlimited && filtered.length >= Number(max));
    }, [snapshotMode, dashboardSnapshot, debouncedSearch, page]);

    const fetchRecurrentes = async (forceFresh = false) => {
        if (!userId) {
            console.log('📋 [RecurrentesList] Esperando userId antes de hacer fetch');
            return;
        }
        const now = Date.now();

        console.log('📋 [RecurrentesList] Iniciando fetch de recurrentes:', {
            userId,
            page,
            debouncedSearch,
            esSubcuenta,
            subcuentaId,
            forceFresh
        });
        
        // Cancelar fetch anterior
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        
        abortControllerRef.current = new AbortController();
        const signal = abortControllerRef.current.signal;
        
        try {
            setLoading(true);
            lastFetchRef.current = now;

            const token = await authService.getAccessToken();
            const query = `userId=${userId}&page=${page}&limit=${LIMIT}&search=${debouncedSearch}`;

            // Permitir forzar fetch fresco cuando se pasa header desde el refreshKey
            const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
            if (forceFresh) {
                headers['X-Skip-Cache'] = '1';
            }

            // 🔥 Usar apiRateLimiter en lugar de fetch directo
            const res = await apiRateLimiter.fetch(`${API_BASE_URL}/recurrentes?${query}`, {
                headers,
                signal,
            });

            // Verificar si fue abortado
            if (signal.aborted) {
                console.log('📋 [RecurrentesList] Fetch cancelado');
                return;
            }

            const data = await res.json();

            console.log('📥 [RecurrentesList] Respuesta recibida:', {
                itemsLength: data.items?.length || 0,
                hasNextPage: data.hasNextPage
            });
            
            // Log para verificar el estado pausadoPorPlan
            if (data.items?.length > 0) {
                console.log('🔍 [RecurrentesList] Estados de recurrentes:', 
                    data.items.map((r: Recurrente) => ({
                        nombre: r.nombre,
                        pausado: r.pausado,
                        pausadoPorPlan: r.pausadoPorPlan,
                        estado: r.estado
                    }))
                );
            }

            if (!Array.isArray(data.items)) return;

            const filtrados = esSubcuenta
                ? data.items.filter((r: Recurrente) => String(r.subcuentaId ?? '') === String(subcuentaId ?? ''))
                : data.items.filter((r: Recurrente) => {
                    // Support both possible backend shapes: 'afectaCuentaPrincipal' or legacy 'afectaCuenta'
                    const affectsPrincipal = (r as any).afectaCuentaPrincipal;
                    const affectsLegacy = (r as any).afectaCuenta;
                    return (typeof affectsPrincipal === 'boolean' ? affectsPrincipal : (typeof affectsLegacy === 'boolean' ? affectsLegacy : true));
                });

            console.log('✅ [RecurrentesList] Recurrentes filtrados:', {
                totalOriginal: data.items.length,
                totalFiltrado: filtrados.length,
                totalCount: data.totalCount,
                tipo: esSubcuenta ? 'subcuenta' : 'cuenta principal'
            });

            // Solo actualizar estado si el componente está montado
            if (isMountedRef.current && !signal.aborted) {
                setHasMore(data.hasNextPage);
                
                // Verificar límite para mostrar información al usuario
                if (userId && !esSubcuenta) {
                    const recurrentesCount = data.totalCount || filtrados.length;
                    const limitCheck = await canPerform('recurrente', { userId, currentCount: recurrentesCount });
                    const hasReachedLimitValue = !limitCheck.allowed;
                    setHasReachedLimit(hasReachedLimitValue);
                    
                    // Extraer el límite del mensaje del backend (ej: "Límite: 3/10" o "4/10")
                    let limit = null;
                    if (limitCheck.message) {
                        const match = limitCheck.message.match(/(\d+)\/(\d+)/);
                        if (match) {
                            limit = parseInt(match[2], 10);
                        }
                    }
                    if (!limit && hasReachedLimitValue) {
                        limit = recurrentesCount;
                    }
                    setAllowedLimit(limit);
                    
                    console.log('🔍 [RecurrentesList] Estado de recurrentes:', {
                        count: recurrentesCount,
                        allowed: limitCheck.allowed,
                        limit,
                        recurrentes: filtrados.map((r: Recurrente) => ({
                            nombre: r.nombre,
                            pausadoPorPlan: r.pausadoPorPlan,
                            pausado: r.pausado,
                            estado: r.estado,
                            createdAt: r.createdAt
                        }))
                    });
                    
                    // 🛡️ VALIDACIÓN DEFENSIVA: Si el backend no marcó pausadoPorPlan correctamente,
                    // el frontend lo calcula basado en fecha de creación y límite del plan
                    if (hasReachedLimitValue && limit) {
                        // Ordenar por fecha de creación (más recientes primero)
                        const sorted = [...filtrados].sort((a, b) => {
                            const dateA = new Date(a.createdAt || a.updatedAt || 0).getTime();
                            const dateB = new Date(b.createdAt || b.updatedAt || 0).getTime();
                            return dateB - dateA; // Más recientes primero
                        });
                        
                        // Verificar si el backend marcó correctamente
                        const backendMarkedCorrectly = sorted.some((r, i) => {
                            const shouldBePaused = i >= limit;
                            return shouldBePaused && r.pausadoPorPlan;
                        });
                        
                        if (!backendMarkedCorrectly) {
                            console.warn('⚠️ [RecurrentesList] Backend no marcó pausadoPorPlan correctamente. Aplicando validación defensiva.');
                            
                            // Marcar los que exceden el límite como pausados
                            const withPauseStatus = sorted.map((rec, index) => ({
                                ...rec,
                                pausadoPorPlan: rec.pausadoPorPlan || index >= limit
                            }));
                            
                            console.log('🔍 [RecurrentesList] Recurrentes con validación defensiva:', 
                                withPauseStatus.map((r, i) => ({
                                    index: i,
                                    nombre: r.nombre,
                                    pausadoPorPlan: r.pausadoPorPlan,
                                    mantenerActivo: i < limit,
                                    createdAt: r.createdAt
                                }))
                            );
                            
                            setRecurrentesWithPauseStatus(withPauseStatus);
                            setRecurrentes(withPauseStatus);
                            return;
                        }
                    }
                }
                
                // Si el backend marcó correctamente o no se alcanzó el límite
                setRecurrentesWithPauseStatus(filtrados);
                setRecurrentes(filtrados);
            }
        } catch (err: any) {
            // Ignorar errores de abort
            if (err.name === 'AbortError' || signal.aborted) {
                console.log('📋 [RecurrentesList] Fetch cancelado');
                return;
            }
            console.error("❌ [RecurrentesList] Error al obtener recurrentes:", err);            
        } finally {
            if (isMountedRef.current) {
                setLoading(false);
            }
        }
    };

    // Compute converted total (sum of all currencies -> viewer preferred/original currency)
    useEffect(() => {
        let mounted = true;
        if (!showRecurrentesTotals || !dashboardSnapshot) {
            setConvertedTotal(null);
            return;
        }

        // Prefer the user's original account currency (`monedaPrincipal`) as the target for conversion.
        const targetCurrency = String(dashboardSnapshot.viewer?.monedaPrincipal ?? dashboardSnapshot.viewer?.monedaPreferencia ?? '').toUpperCase();
        if (!targetCurrency) {
            setConvertedTotal(null);
            return;
        }

        const compute = async () => {
            setConvertedLoading(true);
            try {
                const totalsMap: Record<string, number> = {};
                const addList = (list: any[] | undefined) => {
                    (list || []).forEach((x: any) => {
                        const cur = String(x.moneda ?? '').toUpperCase() || targetCurrency;
                        totalsMap[cur] = (totalsMap[cur] || 0) + Number(x.total || 0);
                    });
                };

                addList(dashboardSnapshot.recurrentesTotals?.active?.byCurrency);
                addList(dashboardSnapshot.recurrentesTotals?.paused?.byCurrency);

                if (Object.keys(totalsMap).length === 0) {
                    if (mounted) setConvertedTotal(0);
                    return;
                }

                // If already in target currency only
                if (Object.keys(totalsMap).length === 1 && Object.keys(totalsMap)[0] === targetCurrency) {
                    if (mounted) setConvertedTotal(totalsMap[targetCurrency] || 0);
                    return;
                }

                const preview = await analyticsService.getPreview(targetCurrency);

                // Normalize tasas keys to uppercase to avoid missing lookups (backend may return lowercase keys)
                const rawTasas: Record<string, number> = preview?.tasasUtilizadas ?? {};
                const tasas: Record<string, number> = Object.fromEntries(
                    Object.entries(rawTasas || {}).map(([k, v]) => [String(k).toUpperCase(), v])
                );

                console.log('🔁 [RecurrentesList] totalsMap', totalsMap);
                console.log('🔁 [RecurrentesList] preview.tasasUtilizadas (normalized)', tasas);

                // If some currencies are missing rates, try external endpoint to get base rates
                const missing = Object.keys(totalsMap).filter((c) => c !== targetCurrency && !(tasas && typeof tasas[c.toUpperCase()] === 'number'));
                let externalRates: Record<string, number> = {};
                let externalBaseCurrency: string | undefined;
                if (missing.length > 0) {
                    const externalRes = await fetchExternalRates(targetCurrency);
                    externalRates = externalRes.rates || {};
                    externalBaseCurrency = externalRes.baseCurrency;
                    console.log('🔁 [RecurrentesList] external rates result', externalRates, 'base=', externalBaseCurrency);
                }

                let sum = 0;
                for (const [cur, amt] of Object.entries(totalsMap)) {
                    const code = String(cur).toUpperCase();
                    if (code === targetCurrency) {
                        sum += amt;
                        console.log('→ same currency', code, amt);
                        continue;
                    }

                    // Prefer server-provided tasa (conversion to targetCurrency)
                    if (tasas && typeof tasas[code] === 'number') {
                        const rate = Number(tasas[code]);
                        const converted = Number(amt) * rate;
                        sum += converted;
                        console.log('→ converted (server)', amt, code, '->', targetCurrency, 'rate=', rate, 'converted=', converted);
                        continue;
                    }

                    // Try external base rates (tasaBase) to compute rate: rate = tasaBase(code) / tasaBase(target)
                    if (externalRates && typeof externalRates[code] === 'number') {
                        // If external provides a base currency and it's the same as targetCurrency, use tasaBase directly
                        if (externalBaseCurrency && externalBaseCurrency === targetCurrency) {
                            const rate = Number(externalRates[code]);
                            const converted = Number(amt) * rate;
                            sum += converted;
                            console.log('→ converted (external base==target)', amt, code, '->', targetCurrency, 'rate=', rate, 'converted=', converted);
                            continue;
                        }

                        // If external has tasaBase for targetCurrency too, compute ratio
                        if (externalRates && typeof externalRates[targetCurrency] === 'number') {
                            const rate = Number(externalRates[code]) / Number(externalRates[targetCurrency]);
                            const converted = Number(amt) * rate;
                            sum += converted;
                            console.log('→ converted (external ratio)', amt, code, '->', targetCurrency, 'rate=', rate, 'converted=', converted);
                            continue;
                        }

                        // If no way to compute, fallback to adding raw amount (best-effort)
                        sum += amt;
                        console.warn('⚠️ [RecurrentesList] No rate for', code, 'after external lookup - falling back to raw amount');
                        continue;
                    }

                    // Fallback: add original amount (best-effort) if no rate available anywhere
                    sum += amt;
                    console.warn('⚠️ [RecurrentesList] No rate for', code, 'falling back to raw amount');
                }

                if (mounted) setConvertedTotal(sum);
            } catch (err) {
                console.error('Error computing converted recurrentes totals', err);
                if (mounted) setConvertedTotal(null);
            } finally {
                if (mounted) setConvertedLoading(false);
            }
        };

        compute();
        return () => {
            mounted = false;
        };
    }, [dashboardSnapshot?.recurrentesTotals, showRecurrentesTotals]);

    useEffect(() => {
        if (snapshotMode) return;
        const force = !!userId;
        fetchRecurrentes(force);
    }, [page, debouncedSearch, userId, snapshotMode]);

    useEffect(() => {
        if (snapshotMode) return;
        if (refreshKey) {
            console.log('🔄 [RecurrentesList] RefreshKey cambió, recargando datos (forceFresh):', refreshKey);
            setPage(1);
            setDebouncedSearch("");
            fetchRecurrentes(true);
        }
    }, [refreshKey, snapshotMode]);

    const handleCreateSubmit = async (data: any) => {
        try {
            await fetch(`${API_BASE_URL}/recurrentes`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });

            emitRecurrentesChanged();
            setCreateModalVisible(false);
            Toast.show({ type: 'success', text1: 'Recurrente creado', visibilityTime: 2500 });
        } catch (err) {
            Toast.show({ type: 'error', text1: 'Error al crear el recurrente', text2: 'Intenta nuevamente' });
        }
    };

        const renderItem = ({ item }: { item: Recurrente }) => {
        const obtenerPeriodo = () => describeFrequencyShort(item.frecuenciaTipo as any, item.frecuenciaValor as any);
        const getEstadoInfo = () => {
          // Prioridad 1: Completado
          if (item.estado === 'completado' || (item.tipoRecurrente === 'plazo_fijo' && item.pagosRealizados === item.totalPagos)) {
            return { icon: 'checkmark-circle', color: '#10B981', label: 'Completado', emoji: '✅' };
          }
          // Prioridad 2: Pausado por plan (límite alcanzado)
          if (item.pausadoPorPlan) {
                        return { icon: 'lock-closed', color: '#F59E0B', label: 'Pausado por plan', emoji: '⚠️' };
          }
          // Prioridad 3: Pausado manualmente
          if (item.pausado || item.estado === 'pausado') {
            return { icon: 'pause-circle', color: '#F59E0B', label: 'Pausado', emoji: '⏸' };
          }
          // Por defecto: Activo
          return { icon: 'checkmark-circle', color: '#10B981', label: 'Activo', emoji: '🟢' };
        };

        const estadoInfo = getEstadoInfo();
        const esCompletado = estadoInfo.label === 'Completado';
      
        return (
          <TouchableOpacity
            onPress={() => {
              if (item.pausadoPorPlan) {
                Toast.show({
                  type: 'info',
                  text1: '🔒 Recurrente pausado automáticamente',
                  text2: allowedLimit 
                    ? `Tu plan actual permite ${allowedLimit} recurrentes activos. Los más antiguos se pausaron automáticamente. Actualiza a Premium para ilimitados.`
                    : 'Este recurrente fue pausado automáticamente por tu plan. Actualiza a Premium para reactivarlo.',
                  visibilityTime: 6000,
                  onPress: () => {
                    // Navegar a Settings para upgrade
                  },
                });
                return;
              }
              navigation.navigate("RecurrenteDetail", { recurrente: item });
            }}
            activeOpacity={item.pausadoPorPlan ? 1 : 0.7}
            style={[
              styles.card,
              { 
                borderColor: item.plataforma?.color || "#EF7725", 
                backgroundColor: colors.card, 
                shadowColor: colors.shadow,
                opacity: esCompletado ? 0.75 : (item.pausadoPorPlan ? 0.5 : 1)
              },
            ]}
          >
            {/* Estado visual (emoji o icono) */}
            <View style={[styles.estadoBadge, { backgroundColor: estadoInfo.color + '20' }]}>
              <Text style={{ fontSize: 14 }}>{estadoInfo.emoji}</Text>
            </View>

            <View style={{ flex: 1 }}>
              <Text style={[styles.nombre, { color: colors.text }]} numberOfLines={1}>
                {item.nombre}
              </Text>
              <Text style={[styles.monto, { color: colors.text }]}>
                ${item.monto >= 1000000 
                  ? `${(item.monto / 1000000).toFixed(1)}M`
                  : item.monto.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                } {item.moneda || ''}
              </Text>
              
              {/* Badge de frecuencia */}
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{obtenerPeriodo()}</Text>
              </View>

              {/* Badge de estado (solo si no es activo) */}
              {estadoInfo.label !== 'Activo' && (
                <View style={[styles.estadoLabelBadge, { backgroundColor: estadoInfo.color + '20' }]}> 
                  <Ionicons name={estadoInfo.icon as any} size={14} color={estadoInfo.color} />
                  <Text style={[styles.estadoLabelText, { color: estadoInfo.color }]}>
                    {estadoInfo.label}
                  </Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        );
      };

    return (
        <View style={[styles.wrapper, { backgroundColor: colors.chartBackground, shadowColor: colors.shadow, borderColor: colors.border }]}>
            <View style={styles.headerBlock}>
                <View style={styles.titleRow}>
                    <Text style={[styles.title, { color: colors.text, marginBottom: 0 }]}>Recurrentes</Text>
                        {showRecurrentesTotals && (
                            <View style={[styles.totalsBadge, { backgroundColor: colors.button + '15', borderColor: colors.button + '35' }]}>
                                <Ionicons name="stats-chart" size={10} color={colors.button} />
                                <Text style={[styles.totalsBadgeText, { color: colors.button }]}>Totales</Text>
                                {convertedLoading ? (
                                    <ActivityIndicator size="small" color={colors.button} style={{ marginLeft: 8 }} />
                                ) : (
                                    !convertedLoading && convertedTotal != null && dashboardSnapshot?.viewer && (
                                        <View style={{ marginLeft: 8 }}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                <SmartNumber
                                                    value={convertedTotal}
                                                    textStyle={[styles.totalsBadgeValue, { color: colors.button }]}
                                                    options={{ context: 'list', currency: String(dashboardSnapshot.viewer?.monedaPrincipal ?? dashboardSnapshot.viewer?.monedaPreferencia ?? '').toUpperCase(), symbol: getCurrencySymbol(String(dashboardSnapshot.viewer?.monedaPrincipal ?? dashboardSnapshot.viewer?.monedaPreferencia ?? '')) }}
                                                />
                                                <Text style={[styles.currencyCode, { color: colors.button }]}>{String(dashboardSnapshot.viewer?.monedaPrincipal ?? dashboardSnapshot.viewer?.monedaPreferencia ?? '').toUpperCase()}</Text>
                                            </View>
                                        </View>
                                    )
                                )}
                            </View>
                        )}
                </View>

                {showRecurrentesTotals && (
                    <View style={[styles.totalsContainer, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}>
                        {Array.isArray(recurrentesTotals?.active?.byCurrency) && recurrentesTotals!.active.byCurrency.length > 0 && (
                            <View style={styles.totalsRow}>
                                <View style={styles.totalsStatusLabel}>
                                    <View style={[styles.statusDot, { backgroundColor: '#10B981' }]} />
                                    <Text style={[styles.totalsStatusText, { color: colors.textSecondary }]}>Activos</Text>
                                </View>

                                <View style={styles.totalsCurrencyRow}>
                                    {recurrentesTotals!.active.byCurrency.map((x) => (
                                        <View
                                            key={`active-${x.moneda}`}
                                            style={[styles.totalsCurrencyPill, { backgroundColor: '#10B98112', borderColor: '#10B98132' }]}
                                        >
                                            <SmartNumber
                                                value={Number(x.total || 0)}
                                                textStyle={[styles.totalsValue, { color: colors.text }]}
                                                options={{ context: 'list', currency: x.moneda, symbol: getCurrencySymbol(x.moneda), maxLength: 14 }}
                                            />
                                            <Text style={[styles.currencyCode, { color: colors.textSecondary }]}>{String(x.moneda).toUpperCase()}</Text>
                                            <Text style={[styles.totalsCount, { color: '#10B981' }]}>{Number(x.count || 0)}</Text>
                                        </View>
                                    ))}
                                </View>
                            </View>
                        )}
                        {Array.isArray(recurrentesTotals?.active?.byCurrency) && recurrentesTotals!.active.byCurrency.length > 0 &&
                         Array.isArray(recurrentesTotals?.paused?.byCurrency) && recurrentesTotals!.paused.byCurrency.length > 0 && (
                            <View style={[styles.totalsDivider, { backgroundColor: colors.border }]} />
                        )}
                        {Array.isArray(recurrentesTotals?.paused?.byCurrency) && recurrentesTotals!.paused.byCurrency.length > 0 && (
                            <View style={styles.totalsRow}>
                                <View style={styles.totalsStatusLabel}>
                                    <View style={[styles.statusDot, { backgroundColor: '#F59E0B' }]} />
                                    <Text style={[styles.totalsStatusText, { color: colors.textSecondary }]}>Pausados</Text>
                                </View>
                                <View style={styles.totalsCurrencyRow}>
                                    {recurrentesTotals!.paused.byCurrency.map((x) => (
                                        <View
                                            key={`paused-${x.moneda}`}
                                            style={[styles.totalsCurrencyPill, { backgroundColor: '#F59E0B12', borderColor: '#F59E0B32' }]}
                                        >
                                            <SmartNumber
                                                value={Number(x.total || 0)}
                                                textStyle={[styles.totalsValue, { color: colors.text }]}
                                                options={{ context: 'list', currency: x.moneda, symbol: getCurrencySymbol(x.moneda), maxLength: 14 }}
                                            />
                                            <Text style={[styles.currencyCode, { color: colors.textSecondary }]}>{String(x.moneda).toUpperCase()}</Text>
                                            <Text style={[styles.totalsCount, { color: '#F59E0B' }]}>{Number(x.count || 0)}</Text>
                                        </View>
                                    ))}
                                </View>
                            </View>
                        )}
                    </View>
                )}
            </View>
            <TextInput
                style={[styles.searchInput, { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.inputText }]}
                placeholder="Buscar recurrente..."
                value={search}
                onChangeText={setSearch}
                placeholderTextColor={colors.placeholder}
            />
            {loading ? (
                <ActivityIndicator color={colors.button} style={{ marginTop: 20 }} />
            ) : (
                <>
                    {(!recurrentes || recurrentes.length === 0) && (
                        <View style={{ alignItems: 'center', paddingVertical: 18 }}>
                            <TouchableOpacity
                                onPress={() => setCreateModalVisible(true)}
                                style={{ paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }}
                            >
                                <Text style={{ color: colors.button, fontWeight: '700' }}>Añade un recurrente +</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                    <FlatList
                        data={recurrentes}
                        keyExtractor={(item) => item.recurrenteId}
                        renderItem={renderItem}
                        numColumns={2}
                        scrollEnabled={false}
                        columnWrapperStyle={styles.rowWrapper}
                        contentContainerStyle={{ paddingBottom: 16 }}
                    />
                    <View style={styles.pagination}>
                        <TouchableOpacity
                            onPress={() => setPage((p) => Math.max(p - 1, 1))}
                            style={[
                                styles.pageButton,
                                { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.shadow },
                                page === 1 && styles.pageButtonDisabled,
                            ]}
                            disabled={page === 1}
                        >
                            <Text style={[styles.pageButtonText, { color: colors.textSecondary }]}>Anterior</Text>
                        </TouchableOpacity>
                        <Text style={[styles.pageIndicator, { color: colors.text }]}>Página {page}</Text>
                        <TouchableOpacity
                            onPress={() => hasMore && setPage((p) => p + 1)}
                            style={[
                                styles.pageButton,
                                { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.shadow },
                                !hasMore && styles.pageButtonDisabled,
                            ]}
                            disabled={!hasMore}
                        >
                            <Text style={[styles.pageButtonText, { color: colors.textSecondary }]}>Siguiente</Text>
                        </TouchableOpacity>
                    </View>
                </>
            )}
            <RecurrentModal
                visible={createModalVisible}
                onClose={() => setCreateModalVisible(false)}
                onSubmit={handleCreateSubmit}
                plataformas={[]}
                cuentaId={''}
                subcuentaId={subcuentaId}
                userId={userId ?? ''}
            />
        </View>
    );
};

export default RecurrentesList;

const styles = StyleSheet.create({
    wrapper: {
        marginBottom: 24,
        borderRadius: 14,
        padding: 16,
        shadowOpacity: 0.06,
        shadowRadius: 5,
        elevation: 3,
        borderWidth: 1,
    },
    title: {
        fontSize: 18,
        fontWeight: "600",
        marginBottom: 10,
    },
    headerBlock: {
        marginBottom: 10,
    },
    totalsContainer: {
        borderWidth: 1,
        borderRadius: 10,
        paddingHorizontal: 10,
        paddingVertical: 7,
        marginTop: 6,
        gap: 6,
        
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    totalsBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        borderWidth: 1,
        borderRadius: 999,
        paddingHorizontal: 8,
        paddingVertical: 3,
    },
    totalsBadgeText: {
        fontSize: 10,
        fontWeight: '700',
    },
    totalsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    totalsStatusLabel: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        width: 66,
    },
    statusDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    totalsStatusText: {
        fontSize: 10,
        fontWeight: '600',
    },
    totalsCurrencyRow: {
        flex: 1,
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 5,
    },
    totalsCurrencyPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        borderWidth: 1,
        borderRadius: 999,
        paddingHorizontal: 7,
        paddingVertical: 3,
    },
    totalsDivider: {
        height: 1,
        marginVertical: 1,
    },
    totalsValue: {
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: -0.2,
    },
    totalsCount: {
        fontSize: 10,
        fontWeight: '600',
    },
    totalsBadgeValue: {
        fontSize: 12,
        fontWeight: '700',
        marginLeft: 6,
    },
    currencyCode: {
        fontSize: 10,
        fontWeight: '600',
        marginLeft: 6,
        alignSelf: 'center'
    },
    searchInput: {
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderWidth: 1,
        marginBottom: 14,
    },
    rowWrapper: {
        justifyContent: "space-between",
        marginBottom: 14,
    },
    card: {
        width: (width - 64) / 2 - 8,
        height: 80,
        marginBottom: -5,
        padding: 8,
        borderRadius: 10,
        borderWidth: 2,
        shadowOpacity: 0.04,
        shadowRadius: 3,
        elevation: 1,
        justifyContent: "space-between",
    },
    nombre: {
        fontSize: 12,
        fontWeight: "600",
    },
    monto: {
        fontSize: 14,
        fontWeight: "700",
    },
    badge: {
        backgroundColor: "#E0E7FF",
        alignSelf: "flex-start",
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
        marginTop: 2,
    },
    badgeText: {
        fontSize: 10,
        color: "#3730A3",
        fontWeight: "500",
    },
    estadoBadge: {
        position: 'absolute',
        top: 8,
        right: 8,
        width: 24,
        height: 24,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    estadoLabelBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 8,
        marginTop: 4,
        gap: 4,
    },
    estadoLabelText: {
        fontSize: 10,
        fontWeight: '600',
    },
    progresoContainer: {
        marginTop: 6,
    },
    progressBar: {
        height: 4,
        borderRadius: 2,
        overflow: 'hidden',
        marginBottom: 3,
    },
    progressFill: {
        height: '100%',
        borderRadius: 2,
    },
    progresoText: {
        fontSize: 10,
        fontWeight: '500',
    },
    pagination: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginTop: 12,
    },
    pageButton: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 10,
        borderWidth: 1,
        shadowOpacity: 0.06,
        shadowRadius: 4,
        elevation: 2,
    },
    pageButtonDisabled: {
        opacity: 0.4,
    },
    pageButtonText: {
        fontWeight: "600",
    },
    pageIndicator: {
        fontWeight: "500",
    },
});
