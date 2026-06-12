import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { TextField } from '@/components/TextField';
import { PrimaryButton } from '@/components/PrimaryButton';
import { colors, spacing } from '@/lib/theme';
import type { AuthScreenProps } from '@/navigation/types';

type ObraInfo = {
  obra_id: string;
  obra_nome: string;
  obra_cidade: string | null;
  obra_estado: string | null;
};

export function AcessoTokenScreen({ route }: AuthScreenProps<'AcessoToken'>) {
  const { signInWithToken, isLoading } = useAuth();
  const [token, setToken] = useState((route?.params?.token ?? '').toUpperCase());
  const [nome, setNome] = useState('');
  const [step, setStep] = useState<'token' | 'nome'>('token');
  const [obraInfo, setObraInfo] = useState<ObraInfo | null>(null);
  const [validating, setValidating] = useState(false);

  const onValidarToken = async () => {
    const t = token.trim().toUpperCase();
    if (!t) return;
    setValidating(true);
    try {
      const { data, error } = await supabase.rpc('validar_token_obra', { _token: t });
      if (error || !Array.isArray(data) || !data.length) {
        Alert.alert('Código inválido', 'Verifique o código e tente novamente.');
        return;
      }
      setObraInfo(data[0] as ObraInfo);
      setStep('nome');
    } catch {
      Alert.alert('Erro', 'Não foi possível validar o código.');
    } finally {
      setValidating(false);
    }
  };

  const onEntrar = async () => {
    const n = nome.trim();
    if (!n) {
      Alert.alert('Atenção', 'Digite seu nome para entrar.');
      return;
    }
    try {
      await signInWithToken(token.trim(), n);
    } catch (e: unknown) {
      Alert.alert('Erro', e instanceof Error ? e.message : 'Erro ao entrar na obra.');
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Entrar na obra</Text>

        {step === 'token' ? (
          <>
            <Text style={styles.subtitle}>
              Digite o código enviado pelo responsável da obra.
            </Text>

            <TextField
              label="Código de acesso"
              autoCapitalize="characters"
              autoCorrect={false}
              value={token}
              onChangeText={t => setToken(t.toUpperCase())}
              placeholder="Ex: A1B2C3D4"
            />

            <PrimaryButton title="Verificar código" onPress={onValidarToken} loading={validating} />
          </>
        ) : (
          <>
            <View style={styles.obraCard}>
              <Text style={styles.obraLabel}>Obra encontrada</Text>
              <Text style={styles.obraNome}>{obraInfo?.obra_nome}</Text>
              {(obraInfo?.obra_cidade || obraInfo?.obra_estado) ? (
                <Text style={styles.obraLocal}>
                  {[obraInfo?.obra_cidade, obraInfo?.obra_estado].filter(Boolean).join(' · ')}
                </Text>
              ) : null}
            </View>

            <TextField
              label="Seu nome"
              autoCapitalize="words"
              autoCorrect={false}
              value={nome}
              onChangeText={setNome}
              placeholder="João da Silva"
            />

            <Text style={styles.hint}>
              Você entrará como trabalhador. Para acessar o marketplace, complete o cadastro depois.
            </Text>

            <PrimaryButton title="Entrar na obra" onPress={onEntrar} loading={isLoading} />
            <View style={{ height: spacing.sm }} />
            <PrimaryButton
              title="Usar outro código"
              variant="secondary"
              onPress={() => { setStep('token'); setObraInfo(null); }}
            />
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, flexGrow: 1, justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: '700', color: colors.text, marginBottom: spacing.xs },
  subtitle: { fontSize: 14, color: colors.textMuted, marginBottom: spacing.lg, lineHeight: 20 },

  obraCard: {
    backgroundColor: colors.success + '15',
    borderWidth: 1,
    borderColor: colors.success + '40',
    borderRadius: 10,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  obraLabel: { fontSize: 11, fontWeight: '700', color: colors.success, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  obraNome: { fontSize: 18, fontWeight: '700', color: colors.text },
  obraLocal: { fontSize: 13, color: colors.textMuted, marginTop: 2 },

  hint: { fontSize: 12, color: colors.textMuted, marginBottom: spacing.md, lineHeight: 18 },
});
