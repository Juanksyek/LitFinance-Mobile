import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import SmartNumber from '../src/components/SmartNumber';

const SmartNumberExample = () => {
  const [currentCurrency, setCurrentCurrency] = useState('MXN');
  const [accountData, setAccountData] = useState({
    amount: 1500000,
    currency: 'MXN'
  });

  const handleCurrencyChange = (newCurrency: string) => {
    console.log(`Cambiando moneda de ${currentCurrency} a ${newCurrency}`);
    setCurrentCurrency(newCurrency);
    
    // El backend se encarga de la conversión automática
    // Aquí solo actualizas el estado local, el valor real vendrá del servidor
    setAccountData(prev => ({
      ...prev,
      currency: newCurrency
    }));
    
    // En una aplicación real, aquí podrías hacer un refresh de los datos
    // o escuchar la respuesta del backend para actualizar el monto
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>SmartNumber con Conversión Automática</Text>
      
      <View style={styles.exampleContainer}>
        <Text style={styles.label}>Saldo Principal:</Text>
        <SmartNumber
          value={accountData.amount}
          allowTooltip={true}
          allowCurrencyChange={true}
          currentCurrency={currentCurrency}
          onCurrencyChange={handleCurrencyChange}
          style={styles.numberContainer}
          textStyle={styles.numberText}
          options={{
            context: 'card',
            currency: currentCurrency
          }}
        />
      </View>

      <View style={styles.infoContainer}>
        <Text style={styles.infoText}>
          • Toca el número para ver información detallada
        </Text>
        <Text style={styles.infoText}>
          • Usa "Cambiar Moneda" para conversión automática
        </Text>
        <Text style={styles.infoText}>
          • Las monedas se cargan desde el endpoint /monedas
        </Text>
        <Text style={styles.infoText}>
          • El servidor maneja las tasas de cambio reales
        </Text>
        <Text style={styles.infoText}>
          • La conversión es permanente en tu cuenta
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 30,
    textAlign: 'center',
  },
  exampleContainer: {
    backgroundColor: '#F8FAFC',
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    color: '#64748B',
    marginBottom: 8,
  },
  numberContainer: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 8,
  },
  numberText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1E293B',
  },
  infoContainer: {
    backgroundColor: '#EFF6FF',
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#3B82F6',
  },
  infoText: {
    fontSize: 14,
    color: '#1E40AF',
    marginBottom: 4,
  },
});

export default SmartNumberExample;
