import React from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../theme/useThemeColors';
import { useNavigation } from '@react-navigation/native';

interface UpgradeModalProps {
  visible: boolean;
  onClose: () => void;
  message?: string;
  feature?: string;
}

export default function UpgradeModal({ visible, onClose, message, feature }: UpgradeModalProps) {
  const colors = useThemeColors();
  const navigation = useNavigation<any>();

  const handleUpgrade = () => {
    onClose();
    // Navigate to settings/premium screen
    navigation.navigate('Settings');
  };

  const defaultMessage = feature
    ? `${feature} está disponible solo para usuarios Premium.`
    : 'Esta función requiere LitFinance Premium.';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.container, { backgroundColor: colors.card }]}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>

          <View style={styles.iconContainer}>
            <View style={[styles.iconCircle, { backgroundColor: '#EF772520' }]}>
              <Ionicons name="lock-closed" size={40} color="#EF7725" />
            </View>
          </View>

          <Text style={[styles.title, { color: colors.text }]}>
            Actualiza tu Plan
          </Text>

          <ScrollView
            style={styles.content}
            contentContainerStyle={styles.contentContainer}
            showsVerticalScrollIndicator={false}
          >
            <Text style={[styles.message, { color: colors.textSecondary }]}>
              {message || defaultMessage}
            </Text>

            <View style={styles.benefitsContainer}>
              <Text style={[styles.benefitsTitle, { color: colors.text }]}>
                Con LitFinance Premium obtienes:
              </Text>
              
              <BenefitItem
                icon="trending-up"
                text="Gráficas avanzadas y análisis completo"
                colors={colors}
              />
              <BenefitItem
                icon="infinite"
                text="Subcuentas y recurrentes ilimitados"
                colors={colors}
              />
              <BenefitItem
                icon="pie-chart"
                text="Reportes detallados por concepto"
                colors={colors}
              />
              <BenefitItem
                icon="calendar"
                text="Análisis temporal personalizado"
                colors={colors}
              />
              <BenefitItem
                icon="shield-checkmark"
                text="Soporte prioritario"
                colors={colors}
              />
            </View>
          </ScrollView>

          <TouchableOpacity
            style={[styles.upgradeButton, { backgroundColor: '#EF7725' }]}
            onPress={handleUpgrade}
            activeOpacity={0.8}
          >
            <Text style={styles.upgradeButtonText}>Ver Planes Premium</Text>
            <Ionicons name="arrow-forward" size={20} color="#fff" style={styles.buttonIcon} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cancelButton}
            onPress={onClose}
            activeOpacity={0.7}
          >
            <Text style={[styles.cancelButtonText, { color: colors.textSecondary }]}>
              Tal vez después
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function BenefitItem({ icon, text, colors }: { icon: any; text: string; colors: any }) {
  return (
    <View style={styles.benefitItem}>
      <View style={[styles.benefitIconCircle, { backgroundColor: '#EF772515' }]}>
        <Ionicons name={icon} size={18} color="#EF7725" />
      </View>
      <Text style={[styles.benefitText, { color: colors.text }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
    maxHeight: '85%',
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 10,
    padding: 4,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: -0.5,
  },
  content: {
    marginBottom: 20,
  },
  contentContainer: {
    paddingBottom: 8,
  },
  message: {
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  benefitsContainer: {
    gap: 12,
  },
  benefitsTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  benefitIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  benefitText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  upgradeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 14,
    marginBottom: 12,
    shadowColor: '#EF7725',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  upgradeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  buttonIcon: {
    marginLeft: 8,
  },
  cancelButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
