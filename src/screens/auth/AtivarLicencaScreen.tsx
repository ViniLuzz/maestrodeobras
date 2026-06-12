import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { TextField } from '@/components/TextField';
import { PrimaryButton } from '@/components/PrimaryButton';
import { colors, spacing } from '@/lib/theme';
import type { AuthScreenProps } from '@/navigation/types';

export function AtivarLicencaScreen(_: AuthScreenProps<'AtivarLicenca'>) {
  const { user, ativarLicenca } = useAuth();
  const [codigo, setCodigo] = useState('');
  const [loading, setLoading] = useState(false);

  const onAtivar = async () => {
    if (!user) {
      Alert.alert('Atenção', 'Você precisa estar logado para ativar uma licença.');
      return;
    }
    if (!codigo.trim()) return;
    setLoading(true);
    try {
      await ativarLicenca(codigo.trim());
      Alert.alert('Sucesso', 'Licença ativada!');
      setCodigo('');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erro ao ativar licença.';
      Alert.alert('Erro', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container} style={{ backgroundColor: colors.background }}>
      <Text style={styles.title}>Ativar licença</Text>
      <Text style={styles.subtitle}>
        Cole o código de ativação que você recebeu por email após a compra.
      </Text>

      <TextField
        label="Código"
        autoCapitalize="characters"
        autoCorrect={false}
        value={codigo}
        onChangeText={setCodigo}
        placeholder="XXXX-XXXX-XXXX"
      />

      <PrimaryButton title="Ativar" onPress={onAtivar} loading={loading} />

      {!user && (
        <Text style={styles.warn}>
          Faça login antes de ativar a licença.
        </Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg },
  title: { fontSize: 22, fontWeight: '700', color: colors.text, marginBottom: spacing.xs },
  subtitle: { fontSize: 14, color: colors.textMuted, marginBottom: spacing.lg },
  warn: { marginTop: spacing.md, color: colors.danger, fontSize: 13 },
});
