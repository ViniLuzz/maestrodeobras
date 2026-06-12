import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { TextField } from '@/components/TextField';
import { PrimaryButton } from '@/components/PrimaryButton';
import { colors, spacing } from '@/lib/theme';
import type { AuthScreenProps } from '@/navigation/types';

export function SignupScreen(_: AuthScreenProps<'Signup'>) {
  const { signUp, isLoading } = useAuth();
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [confirma, setConfirma] = useState('');

  const onSignup = async () => {
    if (!nome.trim()) return Alert.alert('Atenção', 'Informe seu nome.');
    if (!email.trim()) return Alert.alert('Atenção', 'Informe seu email.');
    if (senha.length < 6) return Alert.alert('Atenção', 'Senha precisa ter no mínimo 6 caracteres.');
    if (senha !== confirma) return Alert.alert('Atenção', 'As senhas não conferem.');

    try {
      await signUp(email.trim(), senha, nome.trim());
      Alert.alert(
        'Conta criada',
        'Se a confirmação de email estiver ativa no Supabase, verifique sua caixa de entrada antes de entrar.'
      );
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erro ao criar conta.';
      Alert.alert('Erro', msg);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Criar conta</Text>
        <Text style={styles.subtitle}>
          Você pode criar sua conta para gerenciar obras ou só para aparecer no marketplace de prestadores.
        </Text>

        <TextField label="Nome" value={nome} onChangeText={setNome} placeholder="Seu nome completo" />
        <TextField
          label="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          placeholder="seu@email.com"
        />
        <TextField label="Senha" secureTextEntry value={senha} onChangeText={setSenha} placeholder="Mínimo 6 caracteres" />
        <TextField label="Confirme a senha" secureTextEntry value={confirma} onChangeText={setConfirma} />

        <PrimaryButton title="Criar conta" onPress={onSignup} loading={isLoading} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg },
  title: { fontSize: 24, fontWeight: '700', color: colors.text, marginBottom: spacing.xs },
  subtitle: { fontSize: 14, color: colors.textMuted, marginBottom: spacing.lg },
});
