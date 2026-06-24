import React from 'react';
import { Linking, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../theme/useThemeColors';

type ForceUpdateModalProps = {
  build?: string | null;
  latestVersion?: string | null;
  message?: string;
  minVersion?: string | null;
  storeUrl?: string | null;
  visible: boolean;
};

export default function ForceUpdateModal({
  build,
  latestVersion,
  message,
  minVersion,
  storeUrl,
  visible,
}: ForceUpdateModalProps) {
  const colors = useThemeColors();

  const openStore = () => {
    if (!storeUrl) return;
    Linking.openURL(storeUrl).catch(() => {});
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <View style={[styles.iconWrap, { backgroundColor: '#EF772520' }]}>
            <Ionicons name="download-outline" size={38} color="#EF7725" />
          </View>

          <Text style={[styles.title, { color: colors.text }]}>
            Actualización obligatoria
          </Text>

          <Text style={[styles.message, { color: colors.textSecondary }]}>
            {message || 'Debes actualizar la app para continuar usando LitFinance.'}
          </Text>

          <View style={styles.metaWrap}>
            {latestVersion ? (
              <Text style={[styles.metaText, { color: colors.text }]}>
                Última versión: {latestVersion}
              </Text>
            ) : null}
            {minVersion ? (
              <Text style={[styles.metaText, { color: colors.text }]}>
                Versión mínima: {minVersion}
              </Text>
            ) : null}
            {build ? (
              <Text style={[styles.metaText, { color: colors.text }]}>
                Build requerido: {build}
              </Text>
            ) : null}
          </View>

          <TouchableOpacity
            style={[styles.button, { backgroundColor: '#EF7725' }]}
            onPress={openStore}
            disabled={!storeUrl}
          >
            <Text style={styles.buttonText}>Actualizar ahora</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
  },
  iconWrap: {
    width: 74,
    height: 74,
    borderRadius: 37,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 10,
    textAlign: 'center',
  },
  message: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 18,
  },
  metaWrap: {
    alignSelf: 'stretch',
    marginBottom: 20,
    gap: 6,
  },
  metaText: {
    fontSize: 14,
    textAlign: 'center',
  },
  button: {
    width: '100%',
    minHeight: 52,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
});
