import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Animated,
  Dimensions,
  PanResponder,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../theme/useThemeColors';

const { height: SCREEN_H } = Dimensions.get('window');

interface Props {
  visible: boolean;
  onClose: () => void;
  onScanCamera: () => void;
  onScanGallery: () => void;
  onManualEntry: () => void;
  onViewHistory: () => void;
}

export default function ScanActionModal({
  visible,
  onClose,
  onScanCamera,
  onScanGallery,
  onManualEntry,
  onViewHistory,
}: Props) {
  const colors = useThemeColors();
  const translateY = useRef(new Animated.Value(SCREEN_H)).current;
  const backdrop = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          damping: 22,
          stiffness: 260,
        }),
        Animated.timing(backdrop, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      translateY.setValue(SCREEN_H);
      backdrop.setValue(0);
    }
  }, [visible]);

  const dismiss = () => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: SCREEN_H,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(backdrop, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => onClose());
  };

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dy > 8 && Math.abs(g.dx) < 20,
      onPanResponderRelease: (_, g) => {
        if (g.dy > 60) dismiss();
      },
    }),
  ).current;

  const handle = (action: () => void) => () => {
    dismiss();
    setTimeout(action, 280);
  };

  const actions = [
    {
      icon: 'camera-outline' as const,
      label: 'Escanear ticket',
      sub: 'Toma una foto de tu recibo',
      color: '#EF7725',
      onPress: handle(onScanCamera),
    },
    {
      icon: 'images-outline' as const,
      label: 'Desde galería',
      sub: 'Selecciona una imagen existente',
      color: '#3B82F6',
      onPress: handle(onScanGallery),
    },
    {
      icon: 'create-outline' as const,
      label: 'Ingreso manual',
      sub: 'Crea un ticket a mano',
      color: '#10B981',
      onPress: handle(onManualEntry),
    },
    {
      icon: 'receipt-outline' as const,
      label: 'Historial de tickets',
      sub: 'Revisa tus tickets escaneados',
      color: '#8B5CF6',
      onPress: handle(onViewHistory),
    },
  ];

  if (!visible) return null;

  return (
    <Modal transparent visible={visible} animationType="none" statusBarTranslucent>
      <Animated.View style={[styles.backdrop, { opacity: backdrop }]}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={dismiss} />
      </Animated.View>

      <Animated.View
        style={[
          styles.sheet,
          {
            backgroundColor: colors.card,
            transform: [{ translateY }],
          },
        ]}
      >
        <View {...pan.panHandlers} style={styles.handleArea}>
          <View style={[styles.pill, { backgroundColor: colors.border }]} />
        </View>

        <Text style={[styles.title, { color: colors.text }]}>Ticket Scan</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Escanea tus recibos y registra tus gastos al instante
        </Text>

        <View style={styles.grid}>
          {actions.map((a, i) => (
            <TouchableOpacity
              key={i}
              style={[styles.actionCard, { backgroundColor: colors.background, borderColor: colors.border }]}
              activeOpacity={0.7}
              onPress={a.onPress}
            >
              <View style={[styles.iconCircle, { backgroundColor: a.color + '18' }]}>
                <Ionicons name={a.icon} size={24} color={a.color} />
              </View>
              <Text style={[styles.actionLabel, { color: colors.text }]}>{a.label}</Text>
              <Text style={[styles.actionSub, { color: colors.textSecondary }]} numberOfLines={2}>
                {a.sub}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={styles.cancelBtn} activeOpacity={0.7} onPress={dismiss}>
          <Text style={[styles.cancelText, { color: colors.textSecondary }]}>Cancelar</Text>
        </TouchableOpacity>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 40,
    paddingHorizontal: 20,
  },
  handleArea: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 6,
  },
  pill: {
    width: 40,
    height: 5,
    borderRadius: 999,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 8,
  },
  subtitle: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 20,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  actionCard: {
    width: '47%',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    alignItems: 'center',
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  actionLabel: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  actionSub: {
    fontSize: 11,
    textAlign: 'center',
    marginTop: 3,
    lineHeight: 15,
  },
  cancelBtn: {
    marginTop: 18,
    alignSelf: 'center',
    paddingVertical: 10,
    paddingHorizontal: 32,
  },
  cancelText: {
    fontSize: 15,
    fontWeight: '500',
  },
});
