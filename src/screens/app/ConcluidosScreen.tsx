import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { colors, spacing } from '@/lib/theme';
import type { AppScreenProps } from '@/navigation/types';

type ItemConcluido = {
  id: string;
  tipo: 'etapa' | 'material' | 'contratacao';
  nome: string;
  prazo: string | null;
  concluido_em: string | null;
};

function fmt(d: string | null) {
  if (!d) return '—';
  const [y, m, dd] = d.split('-');
  return `${dd}/${m}/${y}`;
}

function calcDiff(prazo: string | null, conclusao: string | null): number | null {
  if (!prazo || !conclusao) return null;
  const p = new Date(prazo + 'T00:00:00');
  const c = new Date(conclusao + 'T00:00:00');
  return Math.round((c.getTime() - p.getTime()) / 86_400_000);
}

const TIPO_COR: Record<string, string> = {
  etapa: colors.primary,
  material: colors.warning,
  contratacao: '#8b5cf6',
};

const TIPO_LABEL: Record<string, string> = {
  etapa: 'Etapa',
  material: 'Material',
  contratacao: 'Contratação',
};

export function ConcluidosScreen({ route, navigation }: AppScreenProps<'Concluidos'>) {
  const { obraId } = route.params;
  const [items, setItems] = useState<ItemConcluido[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const carregar = useCallback(async () => {
    const [etapasRes, materiaisRes, contratacoesRes] = await Promise.all([
      supabase
        .from('etapas')
        .select('id, nome, data_previsao_fim, data_conclusao')
        .eq('obra_id', obraId)
        .eq('deletado', false)
        .eq('status', 'concluida')
        .order('data_conclusao', { ascending: false }),
      supabase
        .from('materiais')
        .select('id, nome, data_previsao, data_conclusao')
        .eq('obra_id', obraId)
        .eq('deletado', false)
        .eq('status', 'entregue')
        .order('data_conclusao', { ascending: false }),
      supabase
        .from('contratacoes')
        .select('id, nome, data_previsao_fim, data_conclusao')
        .eq('obra_id', obraId)
        .eq('deletado', false)
        .eq('status', 'concluida')
        .order('data_conclusao', { ascending: false }),
    ]);

    const merged: ItemConcluido[] = [
      ...((etapasRes.data ?? []) as { id: string; nome: string; data_previsao_fim: string | null; data_conclusao: string | null }[])
        .map(e => ({ id: e.id, tipo: 'etapa' as const, nome: e.nome, prazo: e.data_previsao_fim, concluido_em: e.data_conclusao })),
      ...((materiaisRes.data ?? []) as { id: string; nome: string; data_previsao: string | null; data_conclusao: string | null }[])
        .map(m => ({ id: m.id, tipo: 'material' as const, nome: m.nome, prazo: m.data_previsao, concluido_em: m.data_conclusao })),
      ...((contratacoesRes.data ?? []) as { id: string; nome: string; data_previsao_fim: string | null; data_conclusao: string | null }[])
        .map(c => ({ id: c.id, tipo: 'contratacao' as const, nome: c.nome, prazo: c.data_previsao_fim, concluido_em: c.data_conclusao })),
    ];

    // Ordenar por data de conclusão, mais recente primeiro; sem data vai pro fim
    merged.sort((a, b) => {
      if (!a.concluido_em && !b.concluido_em) return 0;
      if (!a.concluido_em) return 1;
      if (!b.concluido_em) return -1;
      return a.concluido_em > b.concluido_em ? -1 : 1;
    });

    setItems(merged);
  }, [obraId]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await carregar();
      setLoading(false);
    })();
  }, [carregar]);

  if (loading) return <View style={styles.center}><ActivityIndicator /></View>;

  const total = items.length;
  const noPrazo = items.filter(i => {
    const diff = calcDiff(i.prazo, i.concluido_em);
    return diff !== null && diff <= 0;
  }).length;
  const atrasados = items.filter(i => {
    const diff = calcDiff(i.prazo, i.concluido_em);
    return diff !== null && diff > 0;
  }).length;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {total > 0 && (
        <View style={styles.resumo}>
          <View style={styles.resumoItem}>
            <Text style={styles.resumoNum}>{total}</Text>
            <Text style={styles.resumoLabel}>Concluídos</Text>
          </View>
          {noPrazo > 0 && (
            <View style={styles.resumoItem}>
              <Text style={[styles.resumoNum, { color: colors.success }]}>{noPrazo}</Text>
              <Text style={styles.resumoLabel}>No prazo</Text>
            </View>
          )}
          {atrasados > 0 && (
            <View style={styles.resumoItem}>
              <Text style={[styles.resumoNum, { color: colors.danger }]}>{atrasados}</Text>
              <Text style={styles.resumoLabel}>Atrasados</Text>
            </View>
          )}
        </View>
      )}

      <FlatList
        data={items}
        keyExtractor={i => i.tipo + i.id}
        contentContainerStyle={styles.lista}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await carregar();
              setRefreshing(false);
            }}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>✅</Text>
            <Text style={styles.emptyTitle}>Nenhum item concluído</Text>
            <Text style={styles.emptyText}>
              Quando etapas, materiais ou contratações forem marcados como concluídos, eles aparecerão aqui.
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const diff = calcDiff(item.prazo, item.concluido_em);
          const adiantado = diff !== null && diff < 0;
          const noPrazoItem = diff !== null && diff === 0;
          const atrasado = diff !== null && diff > 0;

          return (
            <View style={styles.card}>
              <View style={styles.cardTop}>
                <View style={[styles.tipoBadge, { backgroundColor: TIPO_COR[item.tipo] }]}>
                  <Text style={styles.tipoBadgeText}>{TIPO_LABEL[item.tipo]}</Text>
                </View>
                <View style={[
                  styles.pontBadge,
                  adiantado && styles.pontAdiantado,
                  noPrazoItem && styles.pontNoPrazo,
                  atrasado && styles.pontAtrasado,
                  diff === null && styles.pontSemPrazo,
                ]}>
                  <Text style={[
                    styles.pontText,
                    adiantado && styles.pontTextAdiantado,
                    noPrazoItem && styles.pontTextNoPrazo,
                    atrasado && styles.pontTextAtrasado,
                    diff === null && styles.pontTextSemPrazo,
                  ]}>
                    {adiantado
                      ? `⚡ ${Math.abs(diff!)}d adiantado`
                      : noPrazoItem
                      ? '✓ No prazo'
                      : atrasado
                      ? `⚠ ${diff}d atrasado`
                      : '✓ Concluído'}
                  </Text>
                </View>
              </View>

              <Text style={styles.nome}>{item.nome}</Text>

              <View style={styles.datas}>
                <Text style={styles.dataItem}>
                  Concluído em: <Text style={styles.dataValor}>{fmt(item.concluido_em)}</Text>
                </Text>
                {item.prazo && (
                  <Text style={styles.dataItem}>
                    Prazo era: <Text style={styles.dataValor}>{fmt(item.prazo)}</Text>
                  </Text>
                )}
              </View>

              <Pressable
                style={styles.fotosBtn}
                onPress={() =>
                  navigation.navigate('Midias', {
                    obraId,
                    itemTipo: item.tipo,
                    itemId: item.id,
                    itemNome: item.nome,
                  })
                }
              >
                <Text style={styles.fotosBtnText}>📷 Ver / adicionar fotos</Text>
              </Pressable>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  resumo: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderColor: colors.border,
    gap: spacing.xl,
  },
  resumoItem: { alignItems: 'center' },
  resumoNum: { fontSize: 24, fontWeight: '700', color: colors.text },
  resumoLabel: { fontSize: 12, color: colors.textMuted, marginTop: 2 },

  lista: { padding: spacing.md, paddingBottom: 40 },

  empty: { alignItems: 'center', paddingTop: spacing.xl, paddingHorizontal: spacing.lg },
  emptyIcon: { fontSize: 40, marginBottom: spacing.md },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: colors.text, marginBottom: spacing.sm },
  emptyText: { fontSize: 14, color: colors.textMuted, textAlign: 'center', lineHeight: 22 },

  card: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  tipoBadge: {
    borderRadius: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  tipoBadgeText: { color: '#fff', fontSize: 11, fontWeight: '600' },

  pontBadge: {
    borderRadius: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  pontAdiantado: { backgroundColor: '#dcfce7' },
  pontNoPrazo: { backgroundColor: '#dcfce7' },
  pontAtrasado: { backgroundColor: '#fee2e2' },
  pontSemPrazo: { backgroundColor: colors.border },

  pontText: { fontSize: 11, fontWeight: '600' },
  pontTextAdiantado: { color: '#15803d' },
  pontTextNoPrazo: { color: '#15803d' },
  pontTextAtrasado: { color: colors.danger },
  pontTextSemPrazo: { color: colors.textMuted },

  nome: { fontSize: 15, fontWeight: '600', color: colors.text, marginBottom: spacing.sm },

  datas: { flexDirection: 'row', gap: spacing.lg, flexWrap: 'wrap', marginBottom: spacing.sm },
  dataItem: { fontSize: 12, color: colors.textMuted },
  dataValor: { color: colors.text, fontWeight: '500' },

  fotosBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.background,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
    alignSelf: 'flex-start',
  },
  fotosBtnText: { fontSize: 13, color: colors.primary, fontWeight: '500' },
});
