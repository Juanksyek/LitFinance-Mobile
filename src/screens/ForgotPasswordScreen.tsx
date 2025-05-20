import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, Image, Alert } from 'react-native';
import FormInput from '../components/FormInput';
import { useThemeColors } from '../theme/useThemeColors';
import { useNavigation } from '@react-navigation/native';

const ForgotPasswordScreen: React.FC = () => {
    const colors = useThemeColors();
    const navigation = useNavigation();
    const [email, setEmail] = useState('');

    const handleSubmit = () => {
        if (!email.includes('@')) {
            return Alert.alert('Correo inválido', 'Por favor introduce un correo válido.');
        }

        console.log('Correo para recuperar contraseña:', email);
        Alert.alert('Enviado', 'Si el correo está registrado, recibirás instrucciones para restablecer tu contraseña.');
        navigation.goBack();
    };

    return (
        <KeyboardAvoidingView
            style={[styles.container, { backgroundColor: colors.background }]}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
            <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
                <View style={styles.header}>
                    <Image source={require('../images/LitFinance.png')} style={styles.logo} />
                    <Text style={[styles.title, { color: colors.text }]}>Recuperar contraseña</Text>
                    <Text style={[styles.subtitle, { color: colors.placeholder }]}>
                        Ingresa tu correo electrónico y te enviaremos instrucciones para recuperar tu cuenta.
                    </Text>
                </View>

                <FormInput
                    placeholder="Correo electrónico"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    value={email}
                    onChangeText={setEmail}
                />

                <TouchableOpacity style={[styles.button, { backgroundColor: '#EF7725' }]} onPress={handleSubmit}>
                    <Text style={styles.buttonText}>Enviar</Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Text style={[styles.backText, { color: colors.placeholder }]}>
                        ¿Ya la recordaste?{' '}
                        <Text style={{ color: '#EF7725', fontWeight: 'bold' }}>Inicia sesión</Text>
                    </Text>
                </TouchableOpacity>
            </ScrollView>
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    scroll: {
        flexGrow: 1,
        justifyContent: 'center',
        paddingHorizontal: 24,
        paddingBottom: 40,
    },
    header: {
        alignItems: 'center',
        marginBottom: 32,
    },
    logo: {
        width: 100,
        height: 100,
        marginBottom: 12,
        resizeMode: 'contain',
    },
    title: {
        fontSize: 24,
        fontWeight: '700',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 14,
        textAlign: 'center',
        marginBottom: 24,
        paddingHorizontal: 12,
    },
    button: {
        paddingVertical: 16,
        borderRadius: 10,
        alignItems: 'center',
        marginBottom: 20,
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    backText: {
        fontSize: 14,
        textAlign: 'center',
    },
});

export default ForgotPasswordScreen;