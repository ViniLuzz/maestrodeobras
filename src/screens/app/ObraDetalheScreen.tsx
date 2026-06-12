import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { colors, radius, spacing } from '@/lib/theme';
import { SubMenuModal } from '@/components/SubMenuModal';
import { useObraMembros } from '@/hooks/useObraMembros';
import { reagendarLembretesDePrazo } from '@/lib/notificacoes';
import type { AppScreenProps } from '@/navigation/types';

type ItemUrgente = {
  id: string;
  tipo: 'etapa' | 'material' | 'contratacao';
  nome: string;
  prazo: string | null;
  status: string;
  responsavelId: string | null;
};

function diasRestantes(prazo: string | null): number | null {
  if (!prazo) return null;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const target = new Date(prazo);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - hoje.getTime()) / 86_400_000);
}

function formatDate(d: string | null) {
  if (!d) return '—';
  const [y, m, dd] = d.split('-');
  return `${dd}/${m}/${y}`;
}

const STATUS_PT: Record<string, string> = {
  pendente: 'Pendente',
  em_andamento: 'Em andamento',
  concluida: 'Concluída',
  cancelada: 'Cancelada',
  entregue: 'Entregue',
  faltando: 'Faltando',
  cancelado: 'Cancelado',
};

const TIPO_CONFIG: Record<string, { cor: string; label: string }> = {
  etapa: { cor: colors.primary, label: 'Etapa' },
  material: { cor: colors.warning, label: 'Material' },
  contratacao: { cor: '#8b5cf6', label: 'Contratação' },
};

const MENU_PRINCIPAL = [
  { label: 'Tarefas', emoji: '📋', submenu: 'tarefas' },
  { label: 'Monitoramento', emoji: '📊', submenu: 'monitoramento' },
  { label: 'Financeiro', emoji: '💰', screen: 'Financeiro' },
  { label: 'Gerenciar', emoji: '⚙️', submenu: 'gerenciar' },
] as const;

export function ObraDetalheScreen({ route, navigation }: AppScreenProps<'ObraDetalhe'>) {
  const { obraId, obraNome } = route.params;
  const [items, setItems] = useState<ItemUrgente[]>([]);
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState({ etapas: 0, materiais: 0, contratacoes: 0 });
  const [submenuAberto, setSubmenuAberto] = useState<string | null>(null);
  const { membros } = useObraMembros(obraId);
  const nomeResponsavel = (id: string | null) =>
    id ? (membros.find(m => m.pessoa_id === id)?.nome ?? null) : null;

  const abrirItem = (item: ItemUrgente) => {
    if (item.tipo === 'etapa') navigation.navigate('EtapaForm', { obraId, etapaId: item.id });
    else if (item.tipo === 'material') navigation.navigate('MaterialForm', { obraId, materialId: item.id });
    else navigation.navigate('ContratacaoForm', { obraId, contratacaoId: item.id });
  };

  useEffect(() => {
    navigation.setOptions({ title: obraNome });
  }, [navigation, obraNome]);

  const carregar = useCallback(async () => {
    const [etapasRes, materiaisRes, contratacoesRes] = await Promise.all([
      supabase
        .from('etapas')
        .select('id, nome, status, data_previsao_fim, pessoa_id')
        .eq('obra_id', obraId)
        .eq('deletado', false)
        .neq('status', 'concluida')
        .neq('status', 'cancelada'),
      supabase
        .from('materiais')
        .select('id, nome, status, data_previsao, pessoa_id')
        .eq('obra_id', obraId)
        .eq('deletado', false)
        .neq('status', 'entregue')
        .neq('status', 'cancelado'),
      supabase
        .from('contratacoes')
        .select('id, nome, status, data_previsao_fim, pessoa_id')
        .eq('obra_id', obraId)
        .eq('deletado', false)
        .neq('status', 'concluida')
        .neq('status', 'cancelada'),
    ]);

    const etapas = (etapasRes.data ?? []) as { id: string; nome: string; status: string; data_previsao_fim: string; pessoa_id: string | null }[];
    const mats = (materiaisRes.data ?? []) as { id: string; nome: string; status: string; data_previsao: string; pessoa_id: string | null }[];
    const conts = (contratacoesRes.data ?? []) as { id: string; nome: string; status: string; data_previsao_fim: string; pessoa_id: string | null }[];

    setCounts({ etapas: etapas.length, materiais: mats.length, contratacoes: conts.length });

    const merged: ItemUrgente[] = [
      ...etapas.map(e => ({ id: e.id, tipo: 'etapa' as const, nome: e.nome, prazo: e.data_previsao_fim, status: e.status, responsavelId: e.pessoa_id ?? null })),
      ...mats.map(m => ({ id: m.id, tipo: 'material' as const, nome: m.nome, prazo: m.data_previsao, status: m.status, responsavelId: m.pessoa_id ?? null })),
      ...conts.map(c => ({ id: c.id, tipo: 'contratacao' as const, nome: c.nome, prazo: c.data_previsao_fim, status: c.status, responsavelId: c.pessoa_id ?? null })),
    ];

    merged.sort((a, b) => {
      if (!a.prazo) return 1;
      if (!b.prazo) return -1;
      return a.prazo < b.prazo ? -1 : a.prazo > b.prazo ? 1 : 0;
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

  // Recarrega ao voltar pra tela (números e cronograma atualizam na hora) e
  // reagenda os lembretes de prazo (caso um prazo tenha sido editado).
  useEffect(() => {
    const unsub = navigation.addListener('focus', () => {
      carregar();
      reagendarLembretesDePrazo();
    });
    return unsub;
  }, [navigation, carregar]);

  const cabecalho = (
    <View>
      {/* MENU PRINCIPAL (topo) */}
      <View style={styles.acoesSection}>
        <Text style={styles.sectionTitle}>MENU PRINCIPAL</Text>
        <View style={styles.acoesGrid}>
          {MENU_PRINCIPAL.map(a => (
            <Pressable
              key={a.label}
              style={({ pressed }) => [styles.acaoCard, pressed && styles.acaoCardPressed]}
              onPress={() => {
                if ('screen' in a && a.screen) {
                  navigation.navigate(a.screen as any, { obraId, obraNome });
                } else if ('submenu' in a) {
                  setSubmenuAberto(a.submenu);
                }
              }}
            >
              <Text style={styles.acaoEmoji}>{a.emoji}</Text>
              <Text style={styles.acaoLabel}>{a.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* CRONOGRAMA: números (resumo) + lista logo abaixo */}
      <View style={styles.cronoSection}>
        <Text style={styles.sectionTitle}>CRONOGRAMA</Text>
        <Text style={styles.sectionSub}>Itens pendentes ordenados por prazo</Text>

        <View style={styles.statsCard}>
          <View style={styles.statItem}>
            <Text style={[styles.statNum, { color: colors.primary }]}>{counts.etapas}</Text>
            <Text style={styles.statLabel}>Etapas{'\n'}pendentes</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statNum, { color: colors.warning }]}>{counts.materiais}</Text>
            <Text style={styles.statLabel}>Materiais{'\n'}pendentes</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statNum, { color: '#8b5cf6' }]}>{counts.contratacoes}</Text>
            <Text style={styles.statLabel}>Contratações{'\n'}ativas</Text>
          </View>
        </View>
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <FlatList
        data={items}
        keyExtractor={i => i.tipo + i.id}
        contentContainerStyle={styles.lista}
        onRefresh={carregar}
        refreshing={false}
        ListHeaderComponent={cabecalho}
        ListEmptyComponent={
          loading ? (
            <View style={styles.center}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : (
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>✅</Text>
              <Text style={styles.emptyText}>
                Nenhum item com prazo pendente.{'\n'}Adicione etapas, materiais ou contratações.
              </Text>
            </View>
          )
        }
        renderItem={({ item }) => {
          const dias = diasRestantes(item.prazo);
          const atrasado = dias !== null && dias < 0;
          const urgente = dias !== null && dias >= 0 && dias <= 3;
          const cfg = TIPO_CONFIG[item.tipo];
          const responsavel = nomeResponsavel(item.responsavelId);
          return (
            <Pressable
              style={({ pressed }) => [styles.card, atrasado && styles.cardAtrasado, pressed && styles.cardPressed]}
              onPress={() => abrirItem(item)}
            >
              <View style={[styles.cardStrip, { backgroundColor: cfg.cor }]} />
              <View style={styles.cardContent}>
                <View style={styles.cardRow}>
                  <View style={[styles.tipoBadge, { backgroundColor: cfg.cor + '18' }]}>
                    <Text style={[styles.tipoBadgeText, { color: cfg.cor }]}>{cfg.label}</Text>
                  </View>
                  <Text style={[
                    styles.prazoBadge,
                    urgente && styles.prazoUrgente,
                    atrasado && styles.prazoAtrasado,
                  ]}>
                    {atrasado
                      ? `⚠ ${Math.abs(dias!)}d atrasado`
                      : dias === 0
                      ? '🔥 Vence hoje'
                      : urgente
                      ? `⏳ ${dias}d restantes`
                      : item.prazo
                      ? formatDate(item.prazo)
                      : ''}
                  </Text>
                </View>
                <Text style={styles.cardNome} numberOfLines={2}>{item.nome}</Text>
                <View style={styles.cardFooter}>
                  <Text style={styles.cardStatus}>{STATUS_PT[item.status] ?? item.status}</Text>
                  <Text style={styles.cardResponsavel} numberOfLines={1}>
                    {responsavel ? `👤 ${responsavel}` : '👤 Sem responsável'}
                  </Text>
                </View>
                <Text style={styles.cardAbrirHint}>Toque para abrir e concluir ›</Text>
              </View>
            </Pressable>
          );
        }}
      />

      {/* Submenus */}
      <SubMenuModal
        visible={submenuAberto === 'tarefas'}
        title="Tarefas"
        items={[
          {
            label: 'Etapas',
            emoji: '🏗️',
            onPress: () => navigation.navigate('Etapas', { obraId }),
          },
          {
            label: 'Materiais',
            emoji: '🧱',
            onPress: () => navigation.navigate('Materiais', { obraId }),
          },
          {
            label: 'Contratar',
            emoji: '👷',
            onPress: () => navigation.navigate('Contratacoes', { obraId }),
          },
        ]}
        onClose={() => setSubmenuAberto(null)}
      />

      <SubMenuModal
        visible={submenuAberto === 'monitoramento'}
        title="Monitoramento"
        items={[
          {
            label: 'Progresso da Equipe',
            emoji: '📊',
            onPress: () => navigation.navigate('ProgressoEquipe', { obraId, obraNome }),
          },
          {
            label: 'Concluídos',
            emoji: '✅',
            onPress: () => navigation.navigate('Concluidos', { obraId }),
          },
          {
            label: 'Diário de Obra (RDO)',
            emoji: '📒',
            onPress: () => navigation.navigate('DiarioObra', { obraId, obraNome }),
          },
          {
            label: 'Relatório Executivo',
            emoji: '📄',
            onPress: () => navigation.navigate('RelatorioObra', { obraId, obraNome }),
          },
        ]}
        onClose={() => setSubmenuAberto(null)}
      />

      <SubMenuModal
        visible={submenuAberto === 'gerenciar'}
        title="Gerenciar"
        items={[
          {
            label: 'Membros',
            emoji: '👥',
            onPress: () => navigation.navigate('AdministracaoObra', { obraId }),
          },
        ]}
        onClose={() => setSubmenuAberto(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  statsCard: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderNeutral,
    paddingVertical: spacing.md,
    marginTop: spacing.sm,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statNum: { fontSize: 28, fontWeight: '800', lineHeight: 32 },
  statLabel: { fontSize: 11, color: colors.textMuted, textAlign: 'center', marginTop: 2, lineHeight: 14 },
  statDivider: { width: 1, backgroundColor: colors.borderNeutral, marginVertical: spacing.xs },

  acoesSection: {
    backgroundColor: colors.background,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  sectionTitle: { fontSize: 11, fontWeight: '700', color: colors.textMuted, letterSpacing: 0.8, marginBottom: spacing.sm },
  sectionSub: { fontSize: 11, color: colors.textMuted, marginTop: -spacing.xs, marginBottom: spacing.sm },

  acoesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  acaoCard: {
    width: '48%',
    aspectRatio: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.sm,
  },
  acaoCardPressed: { opacity: 0.75, transform: [{ scale: 0.97 }] },
  acaoEmoji: { fontSize: 40, marginBottom: spacing.sm },
  acaoLabel: { fontSize: 13, color: colors.navy, fontWeight: '700', textAlign: 'center' },

  cronoSection: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
  },

  center: { alignItems: 'center', justifyContent: 'center', paddingTop: spacing.xl },
  lista: { paddingBottom: 40 },
  empty: { alignItems: 'center', paddingTop: spacing.xl, paddingHorizontal: spacing.lg },
  emptyEmoji: { fontSize: 40, marginBottom: spacing.sm },
  emptyText: { color: colors.textMuted, fontSize: 14, textAlign: 'center', lineHeight: 22 },

  card: {
    backgroundColor: colors.background,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
    marginHorizontal: spacing.md,
    flexDirection: 'row',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  cardAtrasado: { borderWidth: 1, borderColor: colors.danger + '40' },
  cardStrip: { width: 4 },
  cardContent: { flex: 1, padding: spacing.md },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  tipoBadge: { borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 2 },
  tipoBadgeText: { fontSize: 11, fontWeight: '600' },
  prazoBadge: { fontSize: 12, color: colors.textMuted, fontWeight: '500' },
  prazoUrgente: { color: colors.warning, fontWeight: '700' },
  prazoAtrasado: { color: colors.danger, fontWeight: '700' },
  cardNome: { fontSize: 15, fontWeight: '600', color: colors.navy, marginBottom: 4 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
  cardStatus: { fontSize: 12, color: colors.textMuted },
  cardResponsavel: { fontSize: 12, color: colors.navy, fontWeight: '600', flexShrink: 1, textAlign: 'right' },
  cardPressed: { opacity: 0.7 },
  cardAbrirHint: { fontSize: 11, color: colors.primary, fontWeight: '600', marginTop: 6 },
});
