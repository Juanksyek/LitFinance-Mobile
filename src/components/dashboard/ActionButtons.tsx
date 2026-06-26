import React, { useState, useEffect, useCallback } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import MovementModal from './MovementModal';
import SubaccountModal from './SubaccountModal';
import RecurrentModal from './RecurrentModal';
import TransferModal from './TransferModal';
import Toast from "react-native-toast-message";
import { useNavigation } from '@react-navigation/native';
import { useThemeColors } from "../theme/useThemeColors";
import { canPerform, getPlanTypeFromStorage } from '../../services/planConfigService';
import { emitRecurrentesChanged, emitSubcuentasChanged, dashboardRefreshBus } from "../../utils/dashboardRefreshBus";
import { logger } from '../../shared/monitoring/logger';
import { accountDashboardService } from '../../services/accountDashboardService';
import type { DashboardSnapshot } from '../../types/dashboardSnapshot';
import { getCachedSessionSnapshot } from '../../shared/state';

const actions: { icon: "arrow-up-outline" | "arrow-down-outline" | "add-outline" | "refresh-outline" | "stats-chart-outline" | "swap-horizontal-outline", label: string }[] = [
  { icon: "arrow-up-outline", label: "Ingreso" },
  { icon: "arrow-down-outline", label: "Egreso" },
  { icon: "swap-horizontal-outline", label: "Transferir" },
  { icon: "add-outline", label: "Subcuenta" },
  { icon: "refresh-outline", label: "Recurrente" },
  { icon: "stats-chart-outline", label: "Analiticas"} // icono válido
];

interface ActionButtonsProps {
  cuentaId?: string;
  onRefresh: () => void;
  showSubcuentaButton?: boolean;
  isSubcuenta?: boolean;
  subcuenta?: { cuentaPrincipalId: string; subCuentaId: string };
  fetchSubcuenta?: () => void;
  plataformas?: any[];
  userId?: string;
  onAnalyticsPress?: () => void;
  dashboardSnapshot?: DashboardSnapshot | null;
}

const ActionButtons = ({
  cuentaId,
  onRefresh,
  showSubcuentaButton = true,
  isSubcuenta = false,
  subcuenta,
  fetchSubcuenta,
  plataformas = [],
  userId,
  onAnalyticsPress,
  dashboardSnapshot,
}: ActionButtonsProps) => {
  const colors = useThemeColors();
  const ACTION_BUTTONS_DEBUG_PREFIX = '[ActionButtons]';

  const [modalVisible, setModalVisible] = useState(false);
  const [subcuentaModalVisible, setSubcuentaModalVisible] = useState(false);
  const [recurrentModalVisible, setRecurrentModalVisible] = useState(false);
  const [transferModalVisible, setTransferModalVisible] = useState(false);
  const [tipo, setTipo] = useState<'ingreso' | 'egreso'>('ingreso');
  const [refreshKey, setRefreshKey] = useState(Date.now());
  const navigation = useNavigation();
  
  // Counters for limits
  const [subcuentasCount, setSubcuentasCount] = useState(0);
  const [recurrentesCount, setRecurrentesCount] = useState(0);
  const [isPremium, setIsPremium] = useState(false);
  const [limitsChecked, setLimitsChecked] = useState(false);
  
  // Backend-validated button states
  const [canCreateSubcuenta, setCanCreateSubcuenta] = useState(true);
  const [canCreateRecurrente, setCanCreateRecurrente] = useState(true);
  const [canAccessAnalytics, setCanAccessAnalytics] = useState(true);
  const isDashboardContext = dashboardSnapshot !== undefined && !isSubcuenta;
  
  // Fetch counts and premium status
  const fetchCounts = useCallback(async () => {
    let effectiveUserId = String(userId ?? '').trim();
    console.log(`${ACTION_BUTTONS_DEBUG_PREFIX} fetchCounts:start`, {
      propUserId: userId,
      cuentaId,
      isSubcuenta,
      subcuenta,
      isDashboardContext,
    });
    if (!effectiveUserId) {
      try {
        const snapshot = await getCachedSessionSnapshot();
        effectiveUserId = String(snapshot.userId ?? '').trim();
        console.log(`${ACTION_BUTTONS_DEBUG_PREFIX} fetchCounts:sessionFallback`, {
          snapshotUserId: snapshot.userId,
          effectiveUserId,
        });
      } catch {
        effectiveUserId = '';
      }
    }

    if (!effectiveUserId) return;

    // Dashboard mode: DashboardScreen owns the snapshot. Do not fan out to counts endpoints
    // while the snapshot is still loading.
    if (isDashboardContext) {
      console.log(`${ACTION_BUTTONS_DEBUG_PREFIX} fetchCounts:dashboardSnapshotMode`, {
        hasMeta: Boolean(dashboardSnapshot?.meta),
        subaccountsSummaryLength: Array.isArray(dashboardSnapshot?.subaccountsSummary) ? dashboardSnapshot?.subaccountsSummary.length : null,
        recurrentesSummaryLength: Array.isArray(dashboardSnapshot?.recurrentesSummary) ? dashboardSnapshot?.recurrentesSummary.length : null,
      });
      if (!dashboardSnapshot?.meta) {
        setLimitsChecked(false);
        setCanCreateSubcuenta(true);
        setCanCreateRecurrente(true);
        setCanAccessAnalytics(false);
        return;
      }
      const isPremiumValue = Boolean(dashboardSnapshot.meta.plan?.isPremium);
      setIsPremium(isPremiumValue);

      const subCount = Array.isArray(dashboardSnapshot.subaccountsSummary)
        ? dashboardSnapshot.subaccountsSummary.length
        : 0;
      const recCount = Array.isArray(dashboardSnapshot.recurrentesSummary)
        ? dashboardSnapshot.recurrentesSummary.length
        : 0;

      setSubcuentasCount(subCount);
      setRecurrentesCount(recCount);

      const maxSub = dashboardSnapshot.meta.limits?.maxSubcuentas;
      const maxRec = dashboardSnapshot.meta.limits?.maxRecurrentes;

      const unlimitedSub = maxSub === -1 || maxSub == null;
      const unlimitedRec = maxRec === -1 || maxRec == null;

      setCanCreateSubcuenta(isPremiumValue || unlimitedSub || (typeof maxSub === 'number' ? subCount < maxSub : true));
      setCanCreateRecurrente(isPremiumValue || unlimitedRec || (typeof maxRec === 'number' ? recCount < maxRec : true));

      // Analytics is premium-only.
      setCanAccessAnalytics(isPremiumValue);

      setLimitsChecked(true);
      return;
    }
    
    try {
      // Check premium status
      const planType = await getPlanTypeFromStorage();
      setIsPremium(planType === 'premium_plan');
      
      const subcuentasCountValue = await accountDashboardService.getSubcuentasCount();
      console.log(`${ACTION_BUTTONS_DEBUG_PREFIX} fetchCounts:subcuentasCount`, {
        subcuentasCountValue,
      });
      setSubcuentasCount(subcuentasCountValue);
      
      const recurrentesCountValue = await accountDashboardService.getRecurrentesCount(effectiveUserId);
      console.log(`${ACTION_BUTTONS_DEBUG_PREFIX} fetchCounts:recurrentesCount`, {
        recurrentesCountValue,
        effectiveUserId,
      });
      setRecurrentesCount(recurrentesCountValue);
      
      // Check backend limits dynamically
      const subcuentaGate = await canPerform('subcuenta', { userId: effectiveUserId, currentCount: subcuentasCountValue });
      console.log(`${ACTION_BUTTONS_DEBUG_PREFIX} fetchCounts:subcuentaGate`, subcuentaGate);
      setCanCreateSubcuenta(subcuentaGate.allowed);
      
      const recurrenteGate = await canPerform('recurrente', { userId: effectiveUserId, currentCount: recurrentesCountValue });
      console.log(`${ACTION_BUTTONS_DEBUG_PREFIX} fetchCounts:recurrenteGate`, recurrenteGate);
      setCanCreateRecurrente(recurrenteGate.allowed);
      
      const analyticsGate = await canPerform('grafica');
      console.log(`${ACTION_BUTTONS_DEBUG_PREFIX} fetchCounts:analyticsGate`, analyticsGate);
      setCanAccessAnalytics(analyticsGate.allowed);
      
      setLimitsChecked(true);
    } catch (error) {
      logger.error('[ActionButtons] Error fetching counts', {
        message: error instanceof Error ? error.message : String(error),
        userId: effectiveUserId,
      });
    }
  }, [userId, dashboardSnapshot, isDashboardContext]);
  
  // Initial fetch and listeners
  useEffect(() => {
    fetchCounts();

    // In dashboard mode, DashboardScreen refreshes the snapshot and re-renders this component.
    if (isDashboardContext) return;

    // Listen to subcuentas/recurrentes changes only when we rely on network counts
    const offSub = dashboardRefreshBus.on('subcuentas:changed', fetchCounts);
    const offRec = dashboardRefreshBus.on('recurrentes:changed', fetchCounts);

    return () => {
      offSub();
      offRec();
    };
  }, [fetchCounts, isDashboardContext]);

  const visibleActions = actions.filter(action => {
    if (isSubcuenta && action.label === 'Subcuenta') return false;
    if (!showSubcuentaButton && action.label === 'Subcuenta') return false;
    return true;
  });

  const handlePress = async (label: string) => {
    // Analytics doesn't depend on cuentaId; allow navigation even while cuenta loads.
    if (label === 'Analiticas') {
      if (onAnalyticsPress) {
        onAnalyticsPress();
      } else {
        navigation.navigate('Analytics' as never);
      }
      return;
    }

    // Other actions need cuentaId.
    if (!cuentaId) {
      Toast.show({ type: 'info', text1: 'Cargando datos', text2: 'Espera un momento mientras iniciamos sesión' });
      return;
    }
    
    if (label === 'Ingreso' || label === 'Egreso') {
      setTipo(label.toLowerCase() as 'ingreso' | 'egreso');
      setModalVisible(true);
      return;
    }

    if (label === 'Transferir') {
      setTransferModalVisible(true);
      return;
    }

    if (label === 'Subcuenta') {
      // Backend ya validó límites en fetchCounts, simplemente abrir modal
      setSubcuentaModalVisible(true);
      return;
    }

    if (label === 'Recurrente') {
      // Backend ya validó límites en fetchCounts, simplemente abrir modal
      setRecurrentModalVisible(true);
      return;
    }

  };
  
  // Helper to check if button should be disabled
  const isButtonDisabled = (label: string): boolean => {
    // Most actions require cuentaId to be present; analytics can be opened anytime.
    if (!cuentaId && label !== 'Analiticas') return true;
    
    // Use backend-validated states
    switch (label) {
      case 'Subcuenta':
        // If limits are not available yet, keep enabled to avoid a "dead" UI.
        if (!limitsChecked) return false;
        return !canCreateSubcuenta;
      case 'Recurrente':
        if (!limitsChecked) return false;
        return !canCreateRecurrente;
      case 'Analiticas':
        if (!limitsChecked) return false;
        return !canAccessAnalytics;
      default:
        return false;
    }
  };

  // visibleActions declared above

  const handleRecurrenteSubmit = async (data: any) => {
    try {
      await accountDashboardService.createRecurrente(data);

      // Refrescar solo la lista de recurrentes (evitar refresh global)
      emitRecurrentesChanged();
    } catch (err) {
      Toast.show({
        type: 'error',
        text1: 'Error al crear el recurrente',
        text2: 'Por favor intenta nuevamente o revisa tu conexión',
      });
    }
  };

  return (
    <>
      <View style={styles.container}>
        {visibleActions.map((action, index) => {
          const disabled = isButtonDisabled(action.label);
          return (
            <View
              key={index}
              style={styles.buttonWrapper}
              pointerEvents={disabled ? 'none' : 'auto'}
            >
              <TouchableOpacity
                style={[
                  styles.button,
                  { backgroundColor: colors.card, shadowColor: colors.shadow, borderColor: colors.border },
                  disabled && { opacity: 0.35, backgroundColor: colors.cardSecondary },
                ]}
                onPress={() => handlePress(action.label)}
                activeOpacity={disabled ? 1 : 0.7}
              >
                <Ionicons 
                  name={action.icon} 
                  size={20} 
                  color={disabled ? colors.textSecondary : colors.button} 
                />
                {disabled && (
                  <View style={styles.lockBadge}>
                    <Ionicons name="lock-closed" size={10} color="#EF7725" />
                  </View>
                )}
              </TouchableOpacity>
              <Text style={[styles.label, { color: disabled ? colors.placeholder : colors.textSecondary }]}>
                {action.label}
              </Text>
            </View>
          );
        })}
      </View>

      <MovementModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        tipo={tipo}
        cuentaId={isSubcuenta && subcuenta ? subcuenta.cuentaPrincipalId : (cuentaId ?? '')}
        isSubcuenta={isSubcuenta}
        subcuentaId={isSubcuenta && subcuenta ? subcuenta.subCuentaId : ''}
        onSuccess={isSubcuenta ? (fetchSubcuenta ?? (() => {})) : onRefresh}
        onRefresh={onRefresh ?? (() => setRefreshKey(Date.now()))}
      />

      <TransferModal
        visible={transferModalVisible}
        onClose={() => setTransferModalVisible(false)}
        cuentaId={isSubcuenta && subcuenta ? subcuenta.cuentaPrincipalId : (cuentaId ?? '')}
        userId={userId}
        isSubcuenta={isSubcuenta}
        currentSubcuentaId={isSubcuenta && subcuenta ? subcuenta.subCuentaId : undefined}
        onSuccess={() => {
          if (fetchSubcuenta) {
            fetchSubcuenta();
          }
          onRefresh();
          setRefreshKey(Date.now());
        }}
      />

      {showSubcuentaButton && (
        <SubaccountModal
          visible={subcuentaModalVisible}
          onClose={() => setSubcuentaModalVisible(false)}
          cuentaPrincipalId={cuentaId ?? ''}
          onSuccess={() => {
            emitSubcuentasChanged();
          }}
        />
      )}

      <RecurrentModal
        visible={recurrentModalVisible}
        onClose={() => setRecurrentModalVisible(false)}
        onSubmit={handleRecurrenteSubmit}
        plataformas={plataformas}
        cuentaId={cuentaId ?? ''}
        subcuentaId={isSubcuenta && subcuenta ? subcuenta.subCuentaId : ''}
        userId={userId ?? ''}
      />
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 24,
    marginTop: 14,
    paddingHorizontal: 10,
  },
  buttonWrapper: {
    alignItems: "center",
    flex: 1,
    minWidth: 56,
  },
  button: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
    shadowOffset: { width: 6, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    borderWidth: 1,
    position: 'relative',
  },
  label: {
    fontSize: 10,
  },
  lockBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    width: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#EF7725',
  },
});

export default ActionButtons;
// commit 
