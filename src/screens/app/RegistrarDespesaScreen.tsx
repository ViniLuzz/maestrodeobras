import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View, Text, Pressable } from 'react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { requireOnline } from '@/lib/network';
import { colors, spacing, radius } from '@/lib/theme';
import { TextField } from '@/components/TextField';
import { DateField } from '@/components/DateField';
import { PrimaryButton } from '@/components/PrimaryButton';
import type { AppScreenProps } from '@/navigation/types';

const CATEGORIAS = [
  { id: 'material', label: 'Materiais', icon: '🛒' },
  { id: 'mao_obra', label: 'Mão de Obra', icon: '👷' },
  { id: 'aluguel', label: 'Aluguel', icon: '🚗' },
  { id: 'servicos', label: 'Serviços', icon: '🔧' },
  { id: 'outro', label: 'Outro', icon: '📋' },
];

export function RegistrarDespesaScreen({ route, navigation }: AppScreenProps<'RegistrarDespesa'>) {
  const { obraId, obraNome } = route.params;
  const { pessoa } = useAuth();
  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState('');
  const [data, setData] = useState('');
  const [categoria, setCategoria] = useState<'material' | 'mao_obra' | 'aluguel' | 'servicos' | 'outro'>('material');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    navigation.setOptions({
      title: `${obraNome} — Registrar Despesa`,
    });
  }, [navigation, obraNome]);

  const onRegistrar = async () => {
    if (!descricao.trim()) {
      Alert.alert('Atenção', 'Descrição é obrigatória.');
      return;
    }
    if (!valor.trim()) {
      Alert.alert('Atenção', 'Valor é obrigatório.');
      return;
    }
    if (!data.trim()) {
      Alert.alert('Atenção', 'Data é obrigatória.');
      return;
    }
    if (!pessoa) {
      Alert.alert('Erro', 'Usuário não encontrado.');
      return;
    }

    setLoading(true);
    try {
      await requireOnline();
      const valorNumerico = parseFloat(valor.replace(/[^\d,.-]/g, '').replace(',', '.'));
      if (isNaN(valorNumerico) || valorNumerico <= 0) {
        Alert.alert('Erro', 'Valor inválido.');
        return;
      }

      const { error } = await supabase
        .from('despesas')
        .insert({
          obra_id: obraId,
          categoria,
          descricao: descricao.trim(),
          valor: valorNumerico,
          data: data.trim(),
          registrado_por: pessoa.id,
        });

      if (error) throw error;

      Alert.alert('Sucesso', 'Despesa registrada!', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (e: unknown) {
      Alert.alert('Erro', e instanceof Error ? e.message : 'Erro ao registrar despesa.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.container}>
      <TextField
        label="Descrição *"
        value={descricao}
        onChangeText={setDescricao}
        placeholder="Ex: Compra de tijolos"
      />

      <View style={styles.categoriaSection}>
        <Text style={styles.categoriaLabel}>Categoria *</Text>
        <View style={styles.categoriasGrid}>
          {CATEGORIAS.map(cat => (
            <Pressable
              key={cat.id}
              style={[
                styles.categoriaBtn,
                categoria === cat.id && styles.categoriaBtnActive,
              ]}
              onPress={() => setCategoria(cat.id as any)}
            >
              <Text style={styles.categoriaIcon}>{cat.icon}</Text>
              <Text
                style={[
                  styles.categoriaBtnText,
                  categoria === cat.id && styles.categoriaBtnTextActive,
                ]}
              >
                {cat.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <TextField
        label="Valor (R$) *"
        value={valor}
        onChangeText={setValor}
        placeholder="Ex: 1500,50"
        keyboardType="decimal-pad"
      />

      <DateField
        label="Data *"
        value={data || null}
        onChange={d => setData(d ?? '')}
      />

      <PrimaryButton
        title="Registrar Despesa"
        onPress={onRegistrar}
        loading={loading}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, paddingBottom: 120 },
  categoriaSection: {
    marginBottom: spacing.lg,
    marginTop: spacing.md,
  },
  categoriaLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.md,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  categoriasGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    justifyContent: 'flex-start',
  },
  categoriaBtn: {
    width: '31%',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.xs,
    marginBottom: spacing.sm,
  },
  categoriaBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  categoriaIcon: {
    fontSize: 24,
    marginBottom: spacing.xs,
  },
  categoriaBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
  },
  categoriaBtnTextActive: {
    color: '#fff',
  },
});
