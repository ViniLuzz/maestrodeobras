import { Pressable, StyleSheet, Text, View } from 'react-native';
import { TextField } from '@/components/TextField';
import { colors, spacing } from '@/lib/theme';
import { CATEGORIAS_ATRASO, type CategoriaAtraso } from '@/lib/atraso';

type Props = {
  titulo?: string;
  categoria: CategoriaAtraso | null;
  motivo: string;
  onChangeCategoria: (c: CategoriaAtraso) => void;
  onChangeMotivo: (m: string) => void;
};

/**
 * Seção "Motivo do atraso" — aparece quando o item (etapa/material/contratação)
 * está atrasado. A causa escolhida fica gravada no relatório executivo da obra.
 */
export function MotivoAtrasoField({
  titulo = '⚠️ Está atrasado — qual o motivo?',
  categoria,
  motivo,
  onChangeCategoria,
  onChangeMotivo,
}: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.titulo}>{titulo}</Text>
      <Text style={styles.sub}>Isso fica registrado no relatório executivo da obra.</Text>
      <View style={styles.row}>
        {CATEGORIAS_ATRASO.map(c => (
          <Pressable
            key={c.value}
            style={[styles.pill, categoria === c.value && styles.pillActive]}
            onPress={() => onChangeCategoria(c.value)}
          >
            <Text style={[styles.pillText, categoria === c.value && styles.pillTextActive]}>
              {c.emoji} {c.label}
            </Text>
          </Pressable>
        ))}
      </View>
      {categoria === 'outro' && (
        <View style={{ marginTop: spacing.sm }}>
          <TextField
            label="Descreva o motivo *"
            value={motivo}
            onChangeText={onChangeMotivo}
            placeholder="Ex: greve de fornecedor, retrabalho..."
            multiline
          />
        </View>
      )}
      {categoria && categoria !== 'outro' && (
        <TextField
          label="Detalhe (opcional)"
          value={motivo}
          onChangeText={onChangeMotivo}
          placeholder="Algum detalhe a mais sobre o atraso..."
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: '#fef2f2',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#fecaca',
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  titulo: { fontSize: 14, fontWeight: '700', color: colors.danger, marginBottom: 2 },
  sub: { fontSize: 12, color: colors.textMuted, marginBottom: spacing.sm },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  pill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: '#fff',
  },
  pillActive: { borderColor: colors.danger, backgroundColor: '#fee2e2' },
  pillText: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  pillTextActive: { color: colors.danger },
});
