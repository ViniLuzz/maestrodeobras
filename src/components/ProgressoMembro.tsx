import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '@/lib/theme';
import type { MembroProgresso } from '@/hooks/useProgressoEquipe';

interface Props {
  membro: MembroProgresso;
}

function renderStars(rank: number): string {
  if (rank === 1) return '⭐⭐⭐';
  if (rank === 2) return '⭐⭐';
  if (rank === 3) return '⭐';
  return '';
}

export function ProgressoMembro({ membro }: Props) {
  const totalTarefas = membro.etapas_total + membro.materiais_total + membro.contratos_total;
  const totalCompletas = membro.etapas_completas + membro.materiais_recebidos + membro.contratos_finalizados;

  return (
    <View style={styles.container}>
      {/* Header com rank e nome */}
      <View style={styles.header}>
        <View style={[styles.avatar, { backgroundColor: membro.cor }]}>
          <Text style={styles.avatarText}>{membro.nome.charAt(0).toUpperCase()}</Text>
        </View>
        <View style={styles.headerInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.nome} numberOfLines={1}>
              {membro.nome}
            </Text>
            {membro.rank <= 3 && <Text style={styles.stars}>{renderStars(membro.rank)}</Text>}
          </View>
          <Text style={styles.email} numberOfLines={1}>
            {membro.email || membro.telefone || '—'}
          </Text>
        </View>
        <View style={styles.scoreBox}>
          <Text style={styles.scoreNum}>{membro.score}%</Text>
          <Text style={styles.scoreLabel}>Completo</Text>
        </View>
      </View>

      {/* Progress bar */}
      <View style={styles.progressBarContainer}>
        <View
          style={[
            styles.progressBar,
            { width: `${membro.score}%`, backgroundColor: getMedalColor(membro.rank) },
          ]}
        />
      </View>

      {/* Stats row */}
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>
            {membro.etapas_completas}/{membro.etapas_total}
          </Text>
          <Text style={styles.statLabel}>🏗️ Etapas</Text>
        </View>

        <View style={[styles.statItem, styles.statItemDivider]}>
          <Text style={styles.statValue}>
            {membro.materiais_recebidos}/{membro.materiais_total}
          </Text>
          <Text style={styles.statLabel}>🧱 Materiais</Text>
        </View>

        <View style={styles.statItem}>
          <Text style={styles.statValue}>
            {membro.contratos_finalizados}/{membro.contratos_total}
          </Text>
          <Text style={styles.statLabel}>👷 Contratos</Text>
        </View>
      </View>

      {/* Mensagem de motivação */}
      {totalTarefas === 0 && (
        <View style={styles.messageBox}>
          <Text style={styles.messageText}>Nenhuma tarefa atribuída</Text>
        </View>
      )}
      {totalCompletas === totalTarefas && totalTarefas > 0 && (
        <View style={[styles.messageBox, styles.messageBoxSuccess]}>
          <Text style={[styles.messageText, styles.messageTextSuccess]}>✅ Todas as tarefas completas!</Text>
        </View>
      )}
    </View>
  );
}

function getMedalColor(rank: number): string {
  if (rank === 1) return '#FFD700'; // Ouro
  if (rank === 2) return '#C0C0C0'; // Prata
  if (rank === 3) return '#CD7F32'; // Bronze
  return colors.primary;
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    borderRadius: radius.md,
    padding: spacing.md,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderNeutral,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },

  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
  },

  headerInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: 2,
  },
  nome: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.navy,
    flex: 1,
  },
  stars: {
    fontSize: 12,
  },
  email: {
    fontSize: 12,
    color: colors.textMuted,
  },

  scoreBox: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    alignItems: 'center',
  },
  scoreNum: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.primary,
  },
  scoreLabel: {
    fontSize: 10,
    color: colors.textMuted,
    fontWeight: '600',
  },

  progressBarContainer: {
    height: 8,
    backgroundColor: colors.surface,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  progressBar: {
    height: '100%',
    borderRadius: 4,
  },

  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statItemDivider: {
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: colors.borderNeutral,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.navy,
  },
  statLabel: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },

  messageBox: {
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginTop: spacing.md,
    alignItems: 'center',
  },
  messageBoxSuccess: {
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
  },
  messageText: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '500',
  },
  messageTextSuccess: {
    color: colors.success,
  },
});
