import React, { useMemo } from 'react';
import { View, StyleSheet, TouchableOpacity, Platform, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useStableSafeInsets } from '../hooks/useStableSafeInsets';
import { useKeyboardVisible } from '../hooks/useKeyboardVisible';
import { useThemeColors } from '../theme/useThemeColors';

type DockKey = 'home' | 'analytics' | 'reports' | 'settings';

type Props = {
  active?: DockKey;
  onPressHome: () => void;
  onPressAnalytics: () => void;
  onPressCenter: () => void;
  onPressReports: () => void;
  onPressSettings: () => void;
  reportsLocked?: boolean;
};

const DOCK_MAX_WIDTH = 760;
export const DASHBOARD_DOCK_APPROX_HEIGHT = 85; // spacer in Dashboard content (dock 64px + fab overlap 21px)

export default function DashboardBottomDock({
  active = 'home',
  onPressHome,
  onPressAnalytics,
  onPressCenter,
  onPressReports,
  onPressSettings,
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
            icon={active === 'home' ? 'home' : 'home-outline'}
            color={active === 'home' ? activeColor : inactive}
            onPress={onPressHome}
          />
          <DockIconButton
            icon={active === 'analytics' ? 'bar-chart' : 'bar-chart-outline'}
            color={active === 'analytics' ? activeColor : inactive}
            onPress={onPressAnalytics}
          />

          <View style={styles.centerSlot} />

          <DockIconButton
            icon={active === 'reports' ? 'download' : 'download-outline'}
            color={active === 'reports' ? activeColor : inactive}
            onPress={onPressReports}
            locked={reportsLocked}
            lockedTint={colors.textSecondary}
          />
          <DockIconButton
            icon={active === 'settings' ? 'person' : 'person-outline'}
            color={active === 'settings' ? activeColor : inactive}
            onPress={onPressSettings}
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
}: {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  onPress: () => void;
  locked?: boolean;
  lockedTint?: string;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={locked ? 1 : 0.85}
      style={[styles.iconBtn, locked ? styles.iconBtnLocked : null]}
    >
      <Ionicons name={icon} size={22} color={locked ? lockedTint || color : color} />
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
    height: 64,
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
