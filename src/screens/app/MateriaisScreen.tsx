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
import type { Material } from '@/types/database';
import type { AppScreenProps } from '@/navigation/types';

const STATUS_COLOR: Record<string, string> = {
  pendente: colors.textMuted,
  entregue: colors.success,
  faltando: colors.danger,
  pausada: colors.warning,
  cancelado: '#94a3b8',
};

const STATUS_LABEL: Record<string, string> = {
  pendente: 'Pendente',
  entregue: 'Entregue',
  faltando: 'Faltando',
  pausada: 'Pausada',
  cancelado: 'Cancelado',
};

function formatDate(d: string | null) {
  if (!d) return null;
  const [y, m, dd] = d.split('-');
  return `${dd}/${m}/${y}`;
}

export function MateriaisScreen({ route, navigation }: AppScreenProps<'Materiais'>) {
  const { obraId } = route.params;
  const { isOffline } = useNetwork();
  const { membros, loading: membroLoading } = useObraMembros(obraId);
  const [materiais, setMateriais] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null);
  const [atribuindo, setAtribuindo] = useState(false);

  const atribuir = useCallback(async (material: Material, pessoaId: string) => {
    try {
      setAtribuindo(true);
      const { error } = await supabase
        .from('materiais')
        .update({ pessoa_id: pessoaId })
        .eq('id', material.id);

      if (error) throw error;

      setMateriais(prev =>
        prev.map(m => (m.id === material.id ? { ...m, pessoa_id: pessoaId } : m))
      );

      const pessoa = membros.find(m => m.pessoa_id === pessoaId);
      Alert.alert(
        'Sucesso',
        `Material atribuído a ${pessoa?.nome || 'membro'}`,
        [{ text: 'OK' }]
      );
    } catch (err) {
      console.error('Erro ao atribuir:', err);
      Alert.alert('Erro', 'Falha ao atribuir material');
    } finally {
      setAtribuindo(false);
    }
  }, [membros]);

  const carregar = useCallback(async () => {
    const cacheKey = `materiais:${obraId}`;
    const cached = await loadCache<Material[]>(cacheKey);
    if (cached) setMateriais(cached);

    const { data, error } = await supabase
      .from('materiais')
      .select('*')
      .eq('obra_id', obraId)
      .eq('deletado', false)
      .order('criado_em', { ascending: false });
    if (!error && data) {
      setMateriais(data as Material[]);
      await saveCache(cacheKey, data);
    } else if (!cached) {
      setMateriais([]);
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

  // Recarrega ao voltar pra tela (ex.: após criar/editar no form).
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
          if (selectedMaterial) {
            atribuir(selectedMaterial, membro.pessoa_id);
          }
          setModalVisible(false);
          setSelectedMaterial(null);
        }}
        onClose={() => {
          setModalVisible(false);
          setSelectedMaterial(null);
        }}
        titulo="Atribuir material a"
      />

      <FlatList
        data={materiais}
        keyExtractor={m => m.id}
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
            <Text style={styles.emptyTitle}>Nenhum material</Text>
            <Text style={styles.emptyText}>Toque em + para adicionar o primeiro material.</Text>
          </View>
        }
        renderItem={({ item }) => {
          const membro = item.pessoa_id ? membros.find(m => m.pessoa_id === item.pessoa_id) : null;
          return (
            <View style={styles.card}>
              <Pressable
                style={styles.cardContent}
                onPress={() => navigation.navigate('MaterialForm', { obraId, materialId: item.id })}
              >
                <View style={styles.cardHeader}>
                  <Text style={styles.cardNome} numberOfLines={1}>{item.nome}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: STATUS_COLOR[item.status] + '22' }]}>
                    <Text style={[styles.statusText, { color: STATUS_COLOR[item.status] }]}>
                      {STATUS_LABEL[item.status]}
                    </Text>
                  </View>
                </View>
                {item.quantidade != null ? (
                  <Text style={styles.cardQtd}>
                    {item.quantidade} {item.unidade ?? ''}
                  </Text>
                ) : null}
                {item.data_previsao ? (
                  <Text style={styles.cardPrazo}>Prazo: {formatDate(item.data_previsao)}</Text>
                ) : null}
              </Pressable>
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
                    setSelectedMaterial(item);
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
      <Pressable style={styles.fab} onPress={() => navigation.navigate('MaterialForm', { obraId })}>
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
  cardContent: {
    padding: spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  cardNome: { fontSize: 15, fontWeight: '600', color: colors.text, flex: 1, marginRight: spacing.sm },
  statusBadge: { borderRadius: 4, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  statusText: { fontSize: 11, fontWeight: '600' },
  cardQtd: { fontSize: 13, color: colors.textMuted, marginBottom: 2 },
  cardPrazo: { fontSize: 12, color: colors.textMuted },
  fab: {
    position: 'absolute',
    bottom: spacing.lg,
    right: spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.warning,
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
    backgroundColor: colors.warning,
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
    backgroundColor: colors.warning + '20',
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
