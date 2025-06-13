import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar, Alert, Dimensions } from 'react-native';
import { RouteProp, useRoute, useNavigation } from '@react-navigation/native';
import Ionicons from "react-native-vector-icons/Ionicons";

const { width } = Dimensions.get('window');

type Subcuenta = {
  _id: string;
  nombre: string;
  cantidad: number;
  moneda: string;
  simbolo: string;
  color: string;
  afectaCuenta: boolean;
  subCuentaId: string;
  cuentaId: string | null;
  userId: string;
  activa: boolean;
  createdAt: string;
  updatedAt: string;
  __v: number;
};

type RouteParams = {
  SubaccountDetail: {
    subcuenta: Subcuenta;
  };
};

const SubaccountDetail = () => {
  const route = useRoute<RouteProp<RouteParams, 'SubaccountDetail'>>();
  const { subcuenta } = route.params;
  const navigation = useNavigation();

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatCurrency = (amount: number) => {
    return amount.toLocaleString('es-ES', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const InfoCard = ({ 
    icon, 
    label, 
    value, 
    accentColor = '#F59E0B',
    description 
  }: {
    icon: React.ReactNode;
    label: string;
    value: string;
    accentColor?: string;
    description?: string;
  }) => (
    <View style={styles.infoCard}>
      <View style={styles.infoCardContent}>
        <View style={[styles.iconWrapper, { backgroundColor: accentColor + '15' }]}>
          {React.cloneElement(icon as React.ReactElement<any>, { 
            size: 22, 
            color: accentColor
          })}
        </View>
        <View style={styles.infoTextContainer}>
          <Text style={styles.infoLabel}>{label}</Text>
          <Text style={styles.infoValue}>{value}</Text>
          {description && <Text style={styles.infoDescription}>{description}</Text>}
        </View>
      </View>
    </View>
  );

  const DetailRow = ({ 
    icon, 
    label, 
    value, 
    accentColor = '#F59E0B' 
  }: {
    icon: React.ReactNode;
    label: string;
    value: string;
    accentColor?: string;
  }) => (
    <View style={styles.detailRow}>
      <View style={styles.detailLeft}>
        <View style={[styles.detailIcon, { backgroundColor: accentColor + '12' }]}>
          {React.cloneElement(icon as React.ReactElement<any>, { 
            size: 18, 
            color: accentColor
          })}
        </View>
        <Text style={styles.detailLabel}>{label}</Text>
      </View>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );

  const handleEdit = () => {
    Alert.alert('Editar subcuenta', 'Funcionalidad de edición en desarrollo.');
  };

  const handleDelete = () => {
    Alert.alert(
      'Eliminar subcuenta',
      '¿Estás seguro de que deseas eliminar esta subcuenta?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive', onPress: () => console.log('Eliminar subcuenta') }
      ]
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />
      
      {/* Enhanced Header */}
      <View style={styles.headerContainer}>
        <View style={styles.headerContent}>
          <TouchableOpacity 
            style={styles.backButton} 
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#1F2937" />
          </TouchableOpacity>
          
            <Text style={styles.headerTitle} numberOfLines={1} ellipsizeMode="tail">
              {subcuenta.nombre}
            </Text>
            <View style={[
              styles.statusContainer,
              { backgroundColor: subcuenta.activa ? '#FFF3E0' : '#FFF2F2' }
            ]}>
              <Ionicons 
                name="checkmark-circle-outline" 
                size={16} 
                color={subcuenta.activa ? '#F59E0B' : '#6B7280'} 
              />
              <Text style={[
                styles.statusText,
                { color: subcuenta.activa ? '#F59E0B' : '#6B7280' }
              ]}>
                {subcuenta.activa ? 'Activa' : 'Inactiva'}
              </Text>
            </View>
        </View>
      </View>

      <ScrollView 
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* Enhanced Balance Card */}
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Saldo actual</Text>
          
          <View style={styles.balanceContainer}>
            <Text style={styles.currencySymbol}>{subcuenta.simbolo}</Text>
            <Text style={styles.balanceAmount}>
              {formatCurrency(subcuenta.cantidad)}
            </Text>
            <Text style={styles.currencyCode}>{subcuenta.moneda}</Text>
          </View>

          <View style={styles.colorIndicator}>
            <View style={[styles.colorDot, { backgroundColor: subcuenta.color }]} />
            <Text style={styles.colorText}>Color de identificación</Text>
          </View>
        </View>

        {/* Enhanced Quick Info Cards */}
        <View style={styles.quickInfoGrid}>
          <InfoCard
            icon={<Ionicons name="trending-up-outline" />}
            label="Impacto en cuenta"
            value={subcuenta.afectaCuenta ? 'Sí afecta' : 'No afecta'}
            accentColor={subcuenta.afectaCuenta ? '#F59E0B' : '#6B7280'}
            description={subcuenta.afectaCuenta ? 'Modifica el saldo principal' : 'Independiente'}
          />
          
          <InfoCard
            icon={<Ionicons name="finger-print-outline" />}
            label="ID Subcuenta"
            value={subcuenta.subCuentaId.slice(-8)}
            accentColor="#F59E0B"
            description="Identificador único"
          />
        </View>

        {/* Enhanced Account Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Información de cuenta</Text>
          <View style={styles.sectionContent}>
            <DetailRow
              icon={<Ionicons name="person-outline" />}
              label="Usuario"
              value={subcuenta.userId.slice(-12)}
              accentColor="#F59E0B"
            />
            <DetailRow
              icon={<Ionicons name="wallet-outline" />}
              label="Cuenta principal"
              value={subcuenta.cuentaId ? subcuenta.cuentaId.slice(-8) : 'No asignada'}
              accentColor="#F59E0B"
            />
          </View>
        </View>

        {/* Enhanced Timeline */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Historial</Text>
          <View style={styles.sectionContent}>
            <DetailRow
              icon={<Ionicons name="calendar-outline" />}
              label="Fecha de creación"
              value={formatDate(subcuenta.createdAt)}
              accentColor="#F59E0B"
            />
            <DetailRow
              icon={<Ionicons name="settings-outline" />}
              label="Última modificación"
              value={formatDate(subcuenta.updatedAt)}
              accentColor="#F59E0B"
            />
          </View>
        </View>

        {/* Enhanced Action Buttons */}
        <View style={styles.actionContainer}>
          <TouchableOpacity
            style={[styles.actionButton, styles.editButton]}
            onPress={handleEdit}
          >
            <Ionicons name="create-outline" size={20} color="#F59E0B" />
            <Text style={[styles.actionButtonText, { color: '#F59E0B' }]}>
              Editar
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.deleteButton]}
            onPress={handleDelete}
          >
            <Ionicons name="trash-outline" size={20} color="#EF4444" />
            <Text style={[styles.actionButtonText, { color: '#EF4444' }]}>
              Eliminar
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.bottomSpacing} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f3f3',
  },
  headerContainer: {
    backgroundColor: '#f3f3f3',
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
    borderBottomStartRadius: 28,
    borderBottomEndRadius: 28
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 44,
    height: 44,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 8,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  balanceCard: {
    backgroundColor: '#f3f3f3',
    marginHorizontal: 20,
    marginTop: 24,
    borderRadius: 24,
    padding: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 12,
    alignItems: 'center',
  },
  balanceLabel: {
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '600',
    marginBottom: 16,
  },
  balanceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 24,
  },
  currencySymbol: {
    fontSize: 32,
    fontWeight: '800',
    color: '#1F2937',
    marginRight: 4,
  },
  balanceAmount: {
    fontSize: 48,
    fontWeight: '800',
    color: '#1F2937',
    letterSpacing: -2,
  },
  currencyCode: {
    fontSize: 18,
    fontWeight: '700',
    color: '#6B7280',
    marginLeft: 8,
  },
  colorIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  colorDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 3,
    borderColor: '#f3f3f3',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  colorText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '600',
  },
  quickInfoGrid: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginTop: 16,
    gap: 12,
  },
  infoCard: {
    flex: 1,
    backgroundColor: '#f3f3f3',
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 6,
  },
  infoCardContent: {
    padding: 20,
  },
  iconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  infoTextContainer: {
    gap: 4,
  },
  infoLabel: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '600',
  },
  infoValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  infoDescription: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '500',
    marginTop: 2,
  },
  section: {
    backgroundColor: '#f3f3f3',
    marginHorizontal: 20,
    marginTop: 16,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 6,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
  },
  sectionContent: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    gap: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  detailLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 16,
  },
  detailIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  detailLabel: {
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '600',
    flex: 1,
  },
  detailValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    textAlign: 'right',
  },
  actionContainer: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginTop: 24,
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 16,
    borderWidth: 2,
    backgroundColor: '#f3f3f3',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 6,
    gap: 8,
  },
  editButton: {
    borderColor: '#F59E0B',
  },
  deleteButton: {
    borderColor: '#EF4444',
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  bottomSpacing: {
    height: 40,
  },
});

export default SubaccountDetail;