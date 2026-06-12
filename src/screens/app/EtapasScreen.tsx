import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
  Alert,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { colors, spacing } from '@/lib/theme';
import { loadCache, saveCache } from '@/lib/cache';
import { useNetwork } from '@/hooks/useNetwork';
import { useObraMembros } from '@/hooks/useObraMembros';
import { OfflineBanner } from '@/components/OfflineBanner';
import { AtribuirModal } from '@/components/AtribuirModal';
import type { Etapa } from '@/types/database';
import type { AppScreenProps } from '@/navigation/types';

const STATUS_COLOR: Record<string, string> = {
  pendente: colors.textMuted,
  em_andamento: colors.primary,
  concluida: colors.success,
  pausada: colors.warning,
  cancelada: colors.danger,
};

const STATUS_LABEL: Record<string, string> = {
  pendente: 'Pendente',
  em_andamento: 'Em andamento',
  concluida: 'Concluída',
  pausada: 'Pausada',
  cancelada: 'Cancelada',
};

function formatDate(d: string | null) {
  if (!d) return null;
  const [y, m, dd] = d.split('-');
  return `${dd}/${m}/${y}`;
}

export function EtapasScreen({ route, navigation }: AppScreenProps<'Etapas'>) {
  const { obraId } = route.params;
  const { isOffline } = useNetwork();
  const { membros, loading: membroLoading } = useObraMembros(obraId);
  const [etapas, setEtapas] = useState<Etapa[]>([]);
  const [blockedIds, setBlockedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedEtapa, setSelectedEtapa] = useState<Etapa | null>(null);
  const [atribuindo, setAtribuindo] = useState(false);

  const atribuir = useCallback(async (etapa: Etapa, pessoaId: string) => {
    try {
      setAtribuindo(true);
      const { error } = await supabase
        .from('etapas')
        .update({ pessoa_id: pessoaId })
        .eq('id', etapa.id);

      if (error) throw error;

      // Atualizar local
      setEtapas(prev =>
        prev.map(e => (e.id === etapa.id ? { ...e, pessoa_id: pessoaId } : e))
      );

      const pessoa = membros.find(m => m.pessoa_id === pessoaId);
      Alert.alert(
        'Sucesso',
        `Etapa atribuída a ${pessoa?.nome || 'membro'}`,
        [{ text: 'OK' }]
      );
    } catch (err) {
      console.error('Erro ao atribuir:', err);
      Alert.alert('Erro', 'Falha ao atribuir etapa');
    } finally {
      setAtribuindo(false);
    }
  }, [membros]);

  const carregar = useCallback(async () => {
    const cacheKey = `etapas:${obraId}`;
    const cached = await loadCache<Etapa[]>(cacheKey);
    if (cached) setEtapas(cached);

    const { data, error } = await supabase
      .from('etapas')
      .select('*')
      .eq('obra_id', obraId)
      .eq('deletado', false)
      .order('ordem', { ascending: true })
      .order('criado_em', { ascending: true });
    if (error) {
      console.warn(error);
      if (!cached) setEtapas([]);
      return;
    }

    const lista = (data as Etapa[]) ?? [];
    setEtapas(lista);
    await saveCache(cacheKey, lista);

    // Dependências: só calcula quando há conexão (requer query extra)
    if (lista.length > 0) {
      const ids = lista.map(e => e.id);
      const { data: deps } = await supabase
        .from('etapa_dependencias')
        .select('etapa_id, depende_de_id')
        .in('etapa_id', ids);

      if (deps && deps.length > 0) {
        const concluidas = new Set(lista.filter(e => e.status === 'concluida').map(e => e.id));
        const bloqueadas = new Set<string>();
        for (const dep of deps) {
          if (!concluidas.has(dep.depende_de_id)) bloqueadas.add(dep.etapa_id);
        }
        setBlockedIds(bloqueadas);
      } else {
        setBlockedIds(new Set());
      }
    }
  }, [obraId]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      await carregar();
      if (mounted) setLoading(false);
    })();
    return () => { mounted = false; };
  }, [carregar]);

  // Recarrega ao voltar pra tela (ex.: depois de criar/editar uma etapa no form),
  // pra a lista atualizar na hora sem precisar de refresh manual.
  useEffect(() => {
    const unsub = navigation.addListener('focus', () => { carregar(); });
    return unsub;
  }, [navigation, carregar]);

  if (loading) return <View style={styles.center}><ActivityIndicator /></View>;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {isOffline && <OfflineBanner />}

      <AtribuirModal
        visible={modalVisible}
        membros={membros}
        loading={membroLoading || atribuindo}
        onSelect={membro => {
          if (selectedEtapa) {
            atribuir(selectedEtapa, membro.pessoa_id);
          }
          setModalVisible(false);
          setSelectedEtapa(null);
        }}
        onClose={() => {
          setModalVisible(false);
          setSelectedEtapa(null);
        }}
        titulo="Atribuir etapa a"
      />

      <FlatList
        data={etapas}
        keyExtractor={e => e.id}
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
            <Text style={styles.emptyTitle}>Nenhuma etapa</Text>
            <Text style={styles.emptyText}>Toque em + para adicionar a primeira etapa.</Text>
          </View>
        }
        renderItem={({ item }) => {
          const bloqueada = blockedIds.has(item.id) && item.status !== 'concluida' && item.status !== 'cancelada';
          const membro = item.pessoa_id ? membros.find(m => m.pessoa_id === item.pessoa_id) : null;

          return (
            <View style={[styles.card, bloqueada && styles.cardBloqueado]}>
              <Pressable
                style={styles.cardContent}
                onPress={() => navigation.navigate('EtapaForm', { obraId, etapaId: item.id })}
              >
                <View style={styles.cardHeader}>
                  <View style={styles.cardTitleRow}>
                    {bloqueada && <Text style={styles.lockIcon}>🔒 </Text>}
                    <Text style={[styles.cardNome, bloqueada && styles.cardNomeBloqueado]} numberOfLines={1}>
                      {item.nome}
                    </Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: STATUS_COLOR[item.status] + '22' }]}>
                    <Text style={[styles.statusText, { color: STATUS_COLOR[item.status] }]}>
                      {STATUS_LABEL[item.status]}
                    </Text>
                  </View>
                </View>
                {bloqueada && (
                  <Text style={styles.bloqueadoText}>Aguardando pré-requisitos</Text>
                )}
                {item.descricao ? (
                  <Text style={styles.cardDesc} numberOfLines={2}>{item.descricao}</Text>
                ) : null}
                {item.data_previsao_fim ? (
                  <Text style={styles.cardPrazo}>Prazo: {formatDate(item.data_previsao_fim)}</Text>
                ) : null}
              </Pressable>

              {/* Botão de atribuição e informações do membro */}
              <View style={styles.cardFooter}>
                {membro ? (
                  <View style={styles.membroInfo}>
                    {membro.avatar_url ? (
                      <Image
                        source={{ uri: membro.avatar_url }}
                        style={styles.membroAvatar}
                      />
                    ) : (
                      <View style={[styles.membroAvatar, styles.membroAvatarPlaceholder]}>
                        <Text style={styles.membroAvatarText}>
                          {membro.nome.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    )}
                    <Text style={styles.membroNome} numberOfLines={1}>
                      {membro.nome}
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.atribuidoLabel}>Sem atribuição</Text>
                )}
                <Pressable
                  style={({ pressed }) => [
                    styles.atribuirBtn,
                    pressed && styles.atribuirBtnPressed,
                  ]}
                  onPress={() => {
                    setSelectedEtapa(item);
                    setModalVisible(true);
                  }}
                >
                  <Text style={styles.atribuirBtnText}>👤</Text>
                </Pressable>
              </View>
            </View>
          );
        }}
      />
      <Pressable style={styles.fab} onPress={() => navigation.navigate('EtapaForm', { obraId })}>
        <Text style={styles.fabText}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  lista: { padding: spacing.md, paddingBottom: 80 },
  empty: { alignItems: 'center', paddingTop: spacing.xl },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: colors.text, marginBottom: spacing.sm },
  emptyText: { fontSize: 14, color: colors.textMuted, textAlign: 'center' },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
    overflow: 'hidden',
  },
  cardBloqueado: {
    borderColor: colors.warning,
    backgroundColor: '#fffbeb',
  },
  cardContent: {
    padding: spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: spacing.sm },
  lockIcon: { fontSize: 13 },
  cardNome: { fontSize: 15, fontWeight: '600', color: colors.text, flex: 1 },
  cardNomeBloqueado: { color: colors.textMuted },
  bloqueadoText: { fontSize: 11, color: colors.warning, fontWeight: '600', marginBottom: 4 },
  statusBadge: { borderRadius: 4, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  statusText: { fontSize: 11, fontWeight: '600' },
  cardDesc: { fontSize: 13, color: colors.textMuted, marginBottom: 4 },
  cardPrazo: { fontSize: 12, color: colors.textMuted },
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

  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderNeutral,
    backgroundColor: colors.background,
    gap: spacing.md,
  },
  membroInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  membroAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  membroAvatarPlaceholder: {
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  membroAvatarText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  membroNome: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: colors.navy,
  },
  atribuidoLabel: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '600',
  },
  atribuirBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  atribuirBtnPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.95 }],
  },
  atribuirBtnText: {
    fontSize: 18,
  },
});
