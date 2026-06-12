import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';
import { AuthWall } from '@/components/AuthWall';
import { supabase } from '@/lib/supabase';
import { colors, radius, spacing } from '@/lib/theme';
import { loadCache, saveCache } from '@/lib/cache';
import { useNetwork } from '@/hooks/useNetwork';
import { OfflineBanner } from '@/components/OfflineBanner';
import type { Obra } from '@/types/database';
import type { TabScreenProps } from '@/navigation/types';

const STATUS_LABEL: Record<string, string> = {
  em_andamento: 'Em andamento',
  concluida: 'Concluída',
  pausada: 'Pausada',
  cancelada: 'Cancelada',
};

const STATUS_COLOR: Record<string, string> = {
  em_andamento: colors.primary,
  concluida: colors.success,
  pausada: colors.warning,
  cancelada: colors.danger,
};

type Section = { title: string; data: Obra[] };

export function ListaObrasScreen({ navigation }: TabScreenProps<'Obras'>) {
  const { pessoa, isAnon } = useAuth();
  const { isOffline } = useNetwork();
  const insets = useSafeAreaInsets();
  const [obras, setObras] = useState<Obra[]>([]);
  const [authWall, setAuthWall] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const carregar = useCallback(async () => {
    const cached = await loadCache<Obra[]>('obras');
    if (cached) setObras(cached);

    const { data, error } = await supabase
      .from('obras')
      .select('*')
      .eq('deletado', false)
      .order('criado_em', { ascending: false });
    if (!error && data) {
      setObras(data as Obra[]);
      await saveCache('obras', data);
    } else if (!cached) {
      setObras([]);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      await carregar();
      if (mounted) setLoading(false);
    })();
    return () => { mounted = false; };
    // Refaz a busca quando a pessoa/sessão fica disponível (resolve a corrida
    // do primeiro boot, em que a query rodava antes da auth assentar).
  }, [carregar, pessoa?.id]);

  const obrasAdmin = obras.filter(o => o.admin_id === pessoa?.id);
  const obrasWorker = obras.filter(o => o.admin_id !== pessoa?.id);
  const emAndamento = obras.filter(o => o.status === 'em_andamento').length;

  const sections: Section[] = [];
  if (obrasAdmin.length > 0) sections.push({ title: 'Obras que administro', data: obrasAdmin });
  if (obrasWorker.length > 0) sections.push({ title: 'Obras onde trabalho', data: obrasWorker });

  // Se o "nome" for um e-mail (conta sem nome real), usa só a parte antes do @.
  const nomeBase = pessoa?.nome?.includes('@')
    ? pessoa.nome.split('@')[0]
    : pessoa?.nome;
  const primeiroNome = nomeBase?.split(' ')[0] ?? '';
  const hora = new Date().getHours();
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      {isOffline && <OfflineBanner />}
      <SectionList
        sections={sections}
        keyExtractor={o => o.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={colors.primary}
            onRefresh={async () => {
              setRefreshing(true);
              await carregar();
              setRefreshing(false);
            }}
          />
        }
        ListHeaderComponent={
          <View>
            {/* Header compacto: logo à esquerda + saudação à direita */}
            <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
              <Image
                source={require('../../../assets/logo2.png')}
                style={styles.headerLogo}
              />
              <View style={styles.headerText}>
                <Text style={styles.greetingName} numberOfLines={2}>
                  {saudacao}{primeiroNome ? `, ${primeiroNome}!` : '!'} 👋
                </Text>
                <Text style={styles.greetingSub}>
                  {obras.length === 0
                    ? 'Crie sua primeira obra abaixo'
                    : 'Veja o andamento das suas obras'}
                </Text>
              </View>
            </View>

            {/* Stats em cards claros */}
            {obras.length > 0 && (
              <View style={styles.statsRow}>
                <View style={styles.statCard}>
                  <Text style={styles.statNum}>{obras.length}</Text>
                  <Text style={styles.statLabel}>Total</Text>
                </View>
                <View style={[styles.statCard, styles.statCardHighlight]}>
                  <Text style={[styles.statNum, styles.statNumOnDark]}>{emAndamento}</Text>
                  <Text style={[styles.statLabel, styles.statLabelOnDark]}>Em andamento</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statNum}>{obrasAdmin.length}</Text>
                  <Text style={styles.statLabel}>Admin</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statNum}>{obrasWorker.length}</Text>
                  <Text style={styles.statLabel}>Participo</Text>
                </View>
              </View>
            )}
          </View>
        }
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{section.title.toUpperCase()}</Text>
          </View>
        )}
        ListEmptyComponent={
          loading ? (
            <View style={styles.empty}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : (
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>🏗️</Text>
              <Text style={styles.emptyTitle}>Nenhuma obra ainda</Text>
              <Text style={styles.emptyText}>
                {isAnon
                  ? 'Você ainda não está vinculado a nenhuma obra.'
                  : 'Toque em + para criar sua primeira obra.'}
              </Text>
            </View>
          )
        }
        renderItem={({ item }) => {
          const statusColor = STATUS_COLOR[item.status] ?? colors.textMuted;
          return (
            <Pressable
              style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
              onPress={() => navigation.navigate('ObraDetalhe', { obraId: item.id, obraNome: item.nome })}
            >
              {/* Status strip */}
              <View style={[styles.statusStrip, { backgroundColor: statusColor }]} />

              <View style={styles.cardBody}>
                <View style={styles.cardTop}>
                  <Text style={styles.cardTitle} numberOfLines={1}>{item.nome}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: statusColor + '18' }]}>
                    <Text style={[styles.statusBadgeText, { color: statusColor }]}>
                      {STATUS_LABEL[item.status] ?? item.status}
                    </Text>
                  </View>
                </View>

                {(item.cidade || item.estado) && (
                  <Text style={styles.cardMeta}>
                    📍 {[item.cidade, item.estado].filter(Boolean).join(' · ')}
                  </Text>
                )}

                {item.data_previsao_termino && (
                  <Text style={styles.cardDate}>
                    Previsão: {new Date(item.data_previsao_termino).toLocaleDateString('pt-BR')}
                  </Text>
                )}
              </View>

              <Text style={styles.cardChevron}>›</Text>
            </Pressable>
          );
        }}
      />

      <Pressable
        style={({ pressed }) => [styles.fab, pressed && { opacity: 0.85, transform: [{ scale: 0.95 }] }]}
        onPress={() => (isAnon ? setAuthWall(true) : navigation.navigate('CriarObra'))}
      >
        <Text style={styles.fabText}>+</Text>
      </Pressable>

      <AuthWall
        visible={authWall}
        onClose={() => setAuthWall(false)}
        titulo="Crie sua conta pra começar"
        mensagem="Pra criar e gerenciar suas obras, você precisa de uma conta. É rápido e gratuito."
      />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.surface },
  list: { paddingBottom: 300, flexGrow: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.navy,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  headerLogo: { width: 140, height: 84, resizeMode: 'contain' },
  headerText: { flex: 1, justifyContent: 'center' },
  greetingName: { fontSize: 18, fontWeight: '700', color: '#FFFFFF', marginBottom: 2, textAlign: 'center' },
  greetingSub: { fontSize: 13, color: 'rgba(255,255,255,0.65)', textAlign: 'center' },

  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.borderNeutral,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  statCardHighlight: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  statNum: { fontSize: 20, fontWeight: '800', color: colors.navy },
  statNumOnDark: { color: '#FFFFFF' },
  statLabel: { fontSize: 10, fontWeight: '600', color: colors.textMuted, marginTop: 1 },
  statLabelOnDark: { color: 'rgba(255,255,255,0.9)' },

  sectionHeader: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 0.8,
  },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg, marginTop: spacing.xl * 2 },
  emptyEmoji: { fontSize: 52, marginBottom: spacing.md },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.navy, marginBottom: spacing.sm },
  emptyText: { fontSize: 14, color: colors.textMuted, textAlign: 'center', lineHeight: 20 },

  card: {
    backgroundColor: colors.background,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'stretch',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  cardPressed: { opacity: 0.9, transform: [{ scale: 0.99 }] },
  statusStrip: { width: 4 },
  cardBody: { flex: 1, padding: spacing.md },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 6 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: colors.navy, flex: 1, marginRight: spacing.sm },
  statusBadge: { borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 2 },
  statusBadgeText: { fontSize: 11, fontWeight: '600' },
  cardMeta: { fontSize: 13, color: colors.textMuted, marginBottom: 2 },
  cardDate: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  cardChevron: { fontSize: 22, color: colors.borderNeutral, alignSelf: 'center', paddingRight: spacing.sm },

  fab: {
    position: 'absolute',
    bottom: spacing.lg,
    right: spacing.lg,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  fabText: { color: '#fff', fontSize: 30, lineHeight: 34, fontWeight: '300' },
});
