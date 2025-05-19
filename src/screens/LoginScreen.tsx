import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import FormInput from '../components/FormInput';
import { useThemeColors } from '../theme/useThemeColors';

const LoginScreen: React.FC = () => {
    const colors = useThemeColors();

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={[styles.container, { backgroundColor: colors.background }]}
        >
            <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
                <Image source={require('../images/LitFinance.png')} style={styles.logo} />

                <Text style={[styles.title, { color: colors.text }]}>LitFinance</Text>

                <View style={styles.inputContainer}>
                    <FormInput placeholder="Correo" keyboardType="email-address" autoCapitalize="none" />
                    <FormInput placeholder="Contraseña" secureTextEntry />
                    <TouchableOpacity style={styles.forgotButton}>
                        <Text style={[styles.forgotText, { color: colors.placeholder }]}>¿Olvidaste tu contraseña?</Text>
                    </TouchableOpacity>
                </View>

                <TouchableOpacity style={[styles.button, { backgroundColor: colors.button }]}>
                    <Text style={styles.buttonText}>Iniciar Sesión</Text>
                </TouchableOpacity>

                <Text style={[styles.signupText, { color: colors.placeholder }]}>
                    ¿Aún no tienes cuenta?{' '}
                    <Text style={{ color: '#EF7725', fontWeight: 'bold' }}>Registrarse</Text>
                </Text>
            </ScrollView>
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
    },
    logo: {
        width: 100,
        height: 100,
        marginBottom: 20,
        resizeMode: 'contain',
    },
    title: {
        fontSize: 32,
        fontWeight: '700',
        marginBottom: 32,
    },
    inputContainer: {
        width: '100%',
        marginBottom: 16,
    },
    forgotButton: {
        alignSelf: 'flex-end',
        marginTop: 4,
        marginBottom: 20,
    },
    forgotText: {
        fontSize: 14,
    },
    button: {
        width: '100%',
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
    signupText: {
        fontSize: 14,
    },
});

export default LoginScreen;