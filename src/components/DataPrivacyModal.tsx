import React from 'react';
import { Modal, View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../theme/useThemeColors';

interface DataPrivacyModalProps {
  visible: boolean;
  onClose: () => void;
}

const DataPrivacyModal: React.FC<DataPrivacyModalProps> = ({ visible, onClose }) => {
  const colors = useThemeColors();
  
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
        <View style={[styles.modalHeader, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <Text style={[styles.modalTitle, { color: colors.text }]}>Información sobre tus datos</Text>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
        
        <ScrollView style={styles.contentList}>
          <View style={styles.contentPadding}>
            {/* Sección principal */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="shield-checkmark" size={24} color="#4CAF50" />
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                  Información completamente opcional
                </Text>
              </View>
              <Text style={[styles.sectionText, { color: colors.textSecondary }]}>
                Todos los campos de información adicional son <Text style={styles.boldText}>completamente opcionales</Text>. 
                Solo completa los que desees compartir con nosotros.
              </Text>
            </View>

            {/* Para qué se usan */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="analytics" size={24} color="#2196F3" />
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                  ¿Para qué usamos esta información?
                </Text>
              </View>
              <View style={styles.bulletList}>
                <Text style={[styles.bulletText, { color: colors.textSecondary }]}>
                  • <Text style={styles.boldText}>Estadísticas internas:</Text> Nos ayuda a entender mejor a nuestros usuarios
                </Text>
                <Text style={[styles.bulletText, { color: colors.textSecondary }]}>
                  • <Text style={styles.boldText}>Reportes demográficos:</Text> Ver de qué regiones y edades son nuestros usuarios
                </Text>
                <Text style={[styles.bulletText, { color: colors.textSecondary }]}>
                  • <Text style={styles.boldText}>Mejoras de la app:</Text> Adaptar funcionalidades según las profesiones de nuestros usuarios
                </Text>
                <Text style={[styles.bulletText, { color: colors.textSecondary }]}>
                  • <Text style={styles.boldText}>Soporte técnico:</Text> En caso de que necesites ayuda, podemos contactarte
                </Text>
              </View>
            </View>

            {/* Privacidad */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="lock-closed" size={24} color="#EF6C00" />
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                  Tu privacidad es importante
                </Text>
              </View>
              <Text style={[styles.sectionText, { color: colors.textSecondary }]}>
                <Text style={styles.highlightText}>Nunca compartimos</Text> tus datos con terceros. 
                Solo nuestro equipo tiene acceso a esta información para los propósitos mencionados.
              </Text>
              <Text style={[styles.sectionText, { color: colors.textSecondary }]}>
                Tú decides qué información compartir y puedes <Text style={styles.boldText}>editarla o eliminarla</Text> en cualquier momento.
              </Text>
            </View>

            {/* Botón de cierre */}
            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
            >
              <Text style={styles.closeButtonText}>
                Entendido
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  contentList: {
    flex: 1,
    paddingHorizontal: 20,
  },
  contentPadding: {
    padding: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginLeft: 8,
  },
  sectionText: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  bulletList: {
    paddingLeft: 8,
  },
  bulletText: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  boldText: {
    fontWeight: '600',
  },
  highlightText: {
    fontWeight: '600',
    color: '#EF6C00',
  },
  closeButton: {
    backgroundColor: '#4CAF50',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
  },
  closeButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default DataPrivacyModal;
