import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { TextField } from '@/components/TextField';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Logo } from '@/components/Logo';
import { colors, radius, spacing } from '@/lib/theme';
import type { AuthScreenProps } from '@/navigation/types';

export function LoginScreen({ navigation }: AuthScreenProps<'Login'>) {
  const { signIn, isLoading, resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');

  const onLogin = async () => {
    if (!email || !senha) {
      Alert.alert('Atenção', 'Preencha email e senha.');
      return;
    }
    try {
      await signIn(email.trim(), senha);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erro ao entrar.';
      Alert.alert('Erro', msg);
    }
  };

  const onEsqueciSenha = async () => {
    if (!email.trim()) {
      Alert.alert('Esqueci minha senha', 'Digite seu e-mail no campo acima e toque novamente.');
      return;
    }
    try {
      await resetPassword(email);
      Alert.alert('Pronto!', 'Se este e-mail tiver conta, enviamos um link para redefinir a senha. Confira sua caixa de entrada.');
    } catch (e: unknown) {
      Alert.alert('Erro', e instanceof Error ? e.message : 'Não foi possível enviar o link.');
    }
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={colors.navyDark} />

      {/* Header navy com logo */}
      <View style={styles.header}>
        <Logo size="large" dark />
        <Text style={styles.tagline}>Gerencie suas obras com precisão</Text>
      </View>

      {/* Formulário sobre fundo branco com topo arredondado */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.formWrapper}
      >
        <ScrollView
          contentContainerStyle={styles.formContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.formTitle}>Entre na sua conta</Text>

          <TextField
            label="Email"
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            value={email}
            onChangeText={setEmail}
            placeholder="seu@email.com"
          />
          <TextField
            label="Senha"
            secureTextEntry
            value={senha}
            onChangeText={setSenha}
            placeholder="••••••••"
          />

          <View style={{ height: spacing.sm }} />
          <PrimaryButton title="Entrar" onPress={onLogin} loading={isLoading} />

          <Pressable onPress={onEsqueciSenha} style={styles.esqueciLink}>
            <Text style={styles.esqueciText}>Esqueci minha senha</Text>
          </Pressable>

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>ou</Text>
            <View style={styles.dividerLine} />
          </View>

          <PrimaryButton
            title="Criar conta"
            variant="secondary"
            onPress={() => navigation.navigate('Signup')}
          />
          <View style={{ height: spacing.sm }} />
          <PrimaryButton
            title="Tenho um código de ativação"
            variant="secondary"
            onPress={() => navigation.navigate('AtivarLicenca')}
          />
          <View style={{ height: spacing.sm }} />
          <Pressable
            onPress={() => navigation.navigate('AcessoToken')}
            style={styles.tokenLink}
          >
            <Text style={styles.tokenLinkText}>Acessar com token de obra</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.navyDark },
  header: {
    alignItems: 'center',
    paddingTop: spacing.xxl + spacing.lg,
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  tagline: {
    marginTop: spacing.sm,
    fontSize: 14,
    color: 'rgba(255,255,255,0.65)',
    letterSpacing: 0.3,
  },
  formWrapper: {
    flex: 1,
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    overflow: 'hidden',
  },
  formContent: {
    padding: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl,
    flexGrow: 1,
  },
  formTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.navy,
    marginBottom: spacing.lg,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.lg,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.borderNeutral },
  dividerText: {
    marginHorizontal: spacing.md,
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: '500',
  },
  tokenLink: { alignItems: 'center', paddingVertical: spacing.sm },
  tokenLinkText: { fontSize: 14, color: colors.primary, fontWeight: '600' },
  esqueciLink: { alignItems: 'center', paddingVertical: spacing.sm, marginTop: spacing.xs },
  esqueciText: { fontSize: 14, color: colors.textMuted, fontWeight: '600' },
});
