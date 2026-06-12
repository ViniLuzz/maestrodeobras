import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { colors, radius, spacing } from '@/lib/theme';
import { useProgressoEquipe } from '@/hooks/useProgressoEquipe';
import { ProgressoMembro } from '@/components/ProgressoMembro';
import type { AppScreenProps } from '@/navigation/types';

export function ProgressoEquipeScreen({ route, navigation }: AppScreenProps<'ProgressoEquipe'>) {
  const { obraId, obraNome } = route.params;
  const { membros, loading, error, refetch } = useProgressoEquipe(obraId);
  const [expandedMembro, setExpandedMembro] = useState<string | null>(null);

  useEffect(() => {
    navigation.setOptions({
      title: `${obraNome} — Progresso`,
    });
  }, [navigation, obraNome]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>❌ Erro ao carregar dados</Text>
        <Text style={styles.errorDetail}>{error}</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      {/* Header com resumo geral */}
      <View style={styles.headerSection}>
        <Text style={styles.headerTitle}>Desempenho da Equipe</Text>
        <Text style={styles.headerSub}>
          {membros.length} membro{membros.length !== 1 ? 's' : ''} acompanhado{membros.length !== 1 ? 's' : ''}
        </Text>

        {membros.length > 0 && (
          <View style={styles.statsBar}>
            <View style={styles.statChip}>
              <Text style={styles.statLabel}>Média</Text>
              <Text style={styles.statValue}>
                {Math.round(membros.reduce((acc, m) => acc + m.score, 0) / membros.length)}%
              </Text>
            </View>
            <View style={styles.statChip}>
              <Text style={styles.statLabel}>Líder</Text>
              <Text style={styles.statValue}>{membros[0]?.nome.split(' ')[0] ?? '—'}</Text>
            </View>
            <View style={styles.statChip}>
              <Text style={styles.statLabel}>Completos</Text>
              <Text style={styles.statValue}>
                {membros.filter(m => m.score === 100).length}/{membros.length}
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* Lista de membros */}
      <FlatList
        data={membros}
        keyExtractor={m => m.pessoa_id}
        contentContainerStyle={styles.list}
        refreshing={false}
        onRefresh={refetch}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>👥</Text>
            <Text style={styles.emptyTitle}>Nenhum membro na equipe</Text>
            <Text style={styles.emptyText}>
              Convide membros para acompanhar o progresso
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <ProgressoMembro membro={item} />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  errorText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.navy,
    marginBottom: spacing.sm,
  },
  errorDetail: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
  },

  headerSection: {
    backgroundColor: colors.background,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderNeutral,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.navy,
    marginBottom: spacing.xs,
  },
  headerSub: {
    fontSize: 13,
    color: colors.textMuted,
    marginBottom: spacing.md,
  },

  statsBar: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  statChip: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderNeutral,
  },
  statLabel: {
    fontSize: 10,
    color: colors.textMuted,
    fontWeight: '600',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.primary,
    marginTop: 2,
  },

  list: {
    paddingVertical: spacing.md,
    paddingBottom: 40,
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl * 2,
    paddingHorizontal: spacing.lg,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.navy,
    marginBottom: spacing.xs,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
