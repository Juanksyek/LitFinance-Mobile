import React, { useMemo } from 'react';
import { View, StyleSheet, TouchableOpacity, Platform, useWindowDimensions, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useStableSafeInsets } from '../hooks/useStableSafeInsets';
import { useKeyboardVisible } from '../hooks/useKeyboardVisible';
import { useThemeColors } from '../theme/useThemeColors';

type DockKey = 'home' | 'bloc' | 'reports' | 'shared';

type Props = {
  active?: DockKey;
  onPressHome: () => void;
  onPressTdc: () => void;
  onPressBloc: () => void;
  onPressCenter: () => void;
  onPressReports: () => void;
  onPressShared: () => void;
  reportsLocked?: boolean;
};

const DOCK_MAX_WIDTH = 760;
export const DASHBOARD_DOCK_APPROX_HEIGHT = 97;

export default function DashboardBottomDock({
  active = 'home',
  onPressHome,
  onPressTdc,
  onPressBloc,
  onPressCenter,
  onPressReports,
  onPressShared,
  reportsLocked = false,
}: Props) {
  const colors = useThemeColors();
  const insets = useStableSafeInsets();
  const keyboardVisible = useKeyboardVisible();

  // Always render the dock tree to avoid changing hook order between renders.
  // When the keyboard is visible, hide the dock visually and remove pointer events.
  const hiddenStyle = keyboardVisible
    ? { opacity: 0, height: 0, overflow: 'hidden' as 'hidden' }
    : {};

  const { width: screenWidth } = useWindowDimensions();

  const dockWidth = useMemo(() => {
    // Nearly full-width on phones; clamp on very large screens.
    const horizontalGutter = screenWidth >= 700 ? 22 : 36;
    return Math.min(DOCK_MAX_WIDTH, Math.max(280, screenWidth - horizontalGutter));
  }, [screenWidth]);

  const inactive = colors.textSecondary;
  const activeColor = colors.button;

  // Use stable insets that don't change when keyboard appears/disappears
  // This prevents the dock from jumping when modals/screens with text input are opened
  const padBottom = insets.bottom + (Platform.OS === 'android' ? 2 : 0);

  return (
    <View pointerEvents={keyboardVisible ? 'none' : 'box-none'} style={[styles.root, { bottom: padBottom }, hiddenStyle]}> 
      <View style={[styles.dockWrap, { width: dockWidth }]}>
        <View
          style={[
            styles.dock,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              shadowColor: colors.shadow,
            },
          ]}
        >
          <DockIconButton
            icon="card-outline"
            color={inactive}
            onPress={onPressTdc}
            label="TDC"
          />
          <DockIconButton
            icon={active === 'bloc' ? 'document-text' : 'document-text-outline'}
            color={active === 'bloc' ? activeColor : inactive}
            onPress={onPressBloc}
            label="Cuentas"
          />

          <View style={styles.centerSlot}>
            <Text style={[styles.iconLabel, { color: inactive }]}>Ticket Scan</Text>
          </View>

          <DockIconButton
            icon={active === 'reports' ? 'download' : 'download-outline'}
            color={active === 'reports' ? activeColor : inactive}
            onPress={onPressReports}
            locked={reportsLocked}
            lockedTint={colors.textSecondary}
            label="Reportes"
          />
          <DockIconButton
            icon={active === 'shared' ? 'people' : 'people-outline'}
            color={active === 'shared' ? activeColor : inactive}
            onPress={onPressShared}
            label="Espacios"
          />
        </View>

        <TouchableOpacity
          onPress={onPressCenter}
          activeOpacity={0.92}
          style={[
            styles.fab,
            {
              backgroundColor: colors.button,
              borderColor: colors.background,
              shadowColor: colors.shadow,
            },
          ]}
        >
          <Ionicons name="add" size={26} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

function DockIconButton({
  icon,
  color,
  onPress,
  locked,
  lockedTint,
  label,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  onPress: () => void;
  locked?: boolean;
  lockedTint?: string;
  label?: string;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={locked ? 1 : 0.85}
      style={[styles.iconBtn, locked ? styles.iconBtnLocked : null]}
    >
      <View style={{ alignItems: 'center' }}>
        <Ionicons name={icon} size={22} color={locked ? lockedTint || color : color} />
        {label ? <Text style={[styles.iconLabel, { color: locked ? lockedTint || color : color }]}>{label}</Text> : null}
      </View>
      {locked ? (
        <View style={styles.lockBadge} pointerEvents="none">
          <Ionicons name="lock-closed" size={11} color={lockedTint || color} />
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    paddingTop: 0,
    zIndex: 999,
  },

  dockWrap: {
    position: 'relative',
    alignItems: 'center',
  },

  dock: {
    height: 76,
    width: '100%',
    borderRadius: 22,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 6,
  },

  iconBtn: {
    width: 46,
    height: 46,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },

  iconBtnLocked: {
    opacity: 0.85,
  },

  lockBadge: {
    position: 'absolute',
    right: 8,
    top: 8,
    width: 16,
    height: 16,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },

  centerSlot: {
    width: 64,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },

  iconLabel: {
    marginTop: 4,
    fontSize: 9,
    fontWeight: '700',
    textAlign: 'center',
  },

  fab: {
    position: 'absolute',
    top: -22,
    left: '50%',
    marginLeft: -30,
    width: 60,
    height: 60,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 12,
  },
});
