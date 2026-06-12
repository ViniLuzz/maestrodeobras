import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { colors, spacing } from '@/lib/theme';
import { useFinanceiro } from '@/hooks/useFinanceiro';
import type { AppScreenProps } from '@/navigation/types';

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

const CATEGORIA_ICONS: Record<string, string> = {
  material: '🛒',
  mao_obra: '👷',
  aluguel: '🚗',
  servicos: '🔧',
  outro: '📋',
};

export function FinanceiroScreen({ route, navigation }: AppScreenProps<'Financeiro'>) {
  const { obraId, obraNome } = route.params;
  const { orcamento_total, gasto_total, restante, percentual_gasto, categorias, despesas_recentes, loading, refetch } = useFinanceiro(obraId);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    navigation.setOptions({
      title: `${obraNome} — Financeiro`,
    });
  }, [navigation, obraNome]);

  // Recarrega ao focar — pega despesas novas (ex.: aluguel aceito no portal).
  useEffect(() => {
    const unsub = navigation.addListener('focus', () => { refetch(); });
    return unsub;
  }, [navigation, refetch]);

  // Alerta diário se extrapolar orçamento
  useEffect(() => {
    if (orcamento_total > 0 && gasto_total > orcamento_total) {
      const excesso = gasto_total - orcamento_total;
      const percentualExcesso = Math.round((excesso / orcamento_total) * 100);
      Alert.alert(
        '⚠️ Orçamento Extrapolado',
        `Você gastou R$ ${excesso.toFixed(2)} a mais que o orçamento inicial (+${percentualExcesso}%).\n\nTotal gasto: R$ ${gasto_total.toFixed(2)}\nOrçamento: R$ ${orcamento_total.toFixed(2)}`,
        [{ text: 'OK' }]
      );
    }
  }, [orcamento_total, gasto_total]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  type Row =
    | { type: 'header' }
    | { type: 'categorias' }
    | { type: 'despesas' }
    | { type: 'despesa'; data: (typeof despesas_recentes)[number]; key: number };

  const rows: Row[] = [
    { type: 'header' },
    { type: 'categorias' },
    { type: 'despesas' },
    ...despesas_recentes.map((d, i) => ({ type: 'despesa' as const, data: d, key: i })),
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <FlatList
        data={rows}
        keyExtractor={(item, idx) => ('key' in item ? String(item.key) : `${item.type}-${idx}`)}
        contentContainerStyle={styles.lista}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await refetch();
              setRefreshing(false);
            }}
          />
        }
        renderItem={({ item }) => {
          if (item.type === 'header') {
            return (
              <View>
                {/* Card principal: Orçamento Total */}
                <View style={styles.cardPrincipal}>
                  <View style={styles.rowPrincipal}>
                    <View style={styles.colPrincipal}>
                      <Text style={styles.labelPrincipal}>Orçamento</Text>
                      <Text style={styles.valorPrincipal}>{formatCurrency(orcamento_total)}</Text>
                    </View>
                    <View style={styles.colPrincipal}>
                      <Text style={styles.labelPrincipal}>Gasto</Text>
                      <Text style={[styles.valorPrincipal, { color: percentual_gasto > 80 ? colors.danger : colors.primary }]}>
                        {formatCurrency(gasto_total)}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.rowSecundaria}>
                    <View style={styles.colPrincipal}>
                      <Text style={styles.labelPrincipal}>Restante</Text>
                      <Text style={[styles.valorPrincipal, { color: restante < 0 ? colors.danger : colors.success }]}>
                        {formatCurrency(restante)}
                      </Text>
                    </View>
                  </View>

                  {/* Progress Bar */}
                  <View style={styles.progressContainer}>
                    <View
                      style={[
                        styles.progressBar,
                        {
                          width: `${Math.min(percentual_gasto, 100)}%`,
                          backgroundColor:
                            percentual_gasto > 100
                              ? colors.danger
                              : percentual_gasto > 80
                              ? colors.warning
                              : colors.success,
                        },
                      ]}
                    />
                  </View>

                  <Text style={styles.percentualText}>{percentual_gasto}% gasto</Text>
                </View>
              </View>
            );
          }

          if (item.type === 'categorias') {
            return (
              <View>
                <Text style={styles.sectionTitle}>Gastos por Categoria</Text>
                {categorias.map((cat, idx) => (
                  <View key={idx} style={styles.categoriaCard}>
                    <View style={styles.categoriaHeader}>
                      <View style={styles.categoriaLeft}>
                        <Text style={styles.categoriaIcon}>{CATEGORIA_ICONS[cat.categoria]}</Text>
                        <View>
                          <Text style={styles.categoriaLabel}>{cat.label}</Text>
                          <Text style={styles.categoriaMeta}>
                            {formatCurrency(cat.gasto)}
                          </Text>
                        </View>
                      </View>
                      <Text style={[styles.categoriaPercentual]}>
                        {cat.percentual}%
                      </Text>
                    </View>
                    {cat.gasto > 0 && (
                      <View style={styles.categoriaProgressBar}>
                        <View
                          style={[
                            styles.categoriaProgressFill,
                            {
                              width: `${Math.min(cat.percentual, 100)}%`,
                              backgroundColor: colors.primary,
                            },
                          ]}
                        />
                      </View>
                    )}
                  </View>
                ))}
              </View>
            );
          }

          if (item.type === 'despesas') {
            return (
              <View>
                <Text style={styles.sectionTitle}>Despesas Recentes</Text>
              </View>
            );
          }

          if (item.type === 'despesa') {
            const d = item.data;
            return (
              <View style={styles.despesaItem}>
                <View style={styles.despesaLeft}>
                  <Text style={styles.despesaIcon}>{CATEGORIA_ICONS[d.categoria]}</Text>
                  <View>
                    <Text style={styles.despesaDescricao}>{d.descricao}</Text>
                    <Text style={styles.despesaData}>{formatDate(d.data)}</Text>
                  </View>
                </View>
                <Text style={styles.despesaValor}>{formatCurrency(d.valor)}</Text>
              </View>
            );
          }

          return null;
        }}
      />

      {/* FAB para registrar despesa */}
      <Pressable
        style={styles.fab}
        onPress={() => navigation.navigate('RegistrarDespesa', { obraId, obraNome })}
      >
        <Text style={styles.fabText}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  lista: { padding: spacing.lg, paddingBottom: 200, gap: spacing.lg },

  cardPrincipal: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.lg,
    marginBottom: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowPrincipal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
    gap: spacing.md,
  },
  rowSecundaria: {
    flexDirection: 'row',
    marginBottom: spacing.lg,
  },
  colPrincipal: {
    alignItems: 'center',
    flex: 1,
  },
  labelPrincipal: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  valorPrincipal: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.primary,
  },
  progressContainer: {
    height: 10,
    backgroundColor: colors.background,
    borderRadius: 5,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  progressBar: {
    height: '100%',
    borderRadius: 5,
  },
  percentualText: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: '600',
    textAlign: 'center',
  },

  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    marginTop: spacing.lg,
    marginBottom: spacing.lg,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  categoriaCard: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  categoriaHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  categoriaLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: spacing.md,
  },
  categoriaIcon: {
    fontSize: 28,
  },
  categoriaLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  categoriaMeta: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  categoriaPercentual: {
    fontSize: 15,
    fontWeight: '700',
  },
  categoriaProgressBar: {
    height: 8,
    backgroundColor: colors.background,
    borderRadius: 4,
    overflow: 'hidden',
  },
  categoriaProgressFill: {
    height: '100%',
    borderRadius: 4,
  },

  despesaItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: 8,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  despesaLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
  },
  despesaIcon: {
    fontSize: 24,
  },
  despesaDescricao: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  despesaData: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  despesaValor: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.navy,
  },

  fab: {
    position: 'absolute',
    bottom: spacing.lg,
    right: spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  fabText: { color: '#fff', fontSize: 28, lineHeight: 32 },
});
