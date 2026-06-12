import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Linking,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Location from 'expo-location';
import { supabase } from '@/lib/supabase';
import { colors, spacing } from '@/lib/theme';
import { loadCache, saveCache } from '@/lib/cache';
import { useNetwork } from '@/hooks/useNetwork';
import { useAuth } from '@/contexts/AuthContext';
import { OfflineBanner } from '@/components/OfflineBanner';
import { AuthWall } from '@/components/AuthWall';
import type { TabScreenProps } from '@/navigation/types';

type Prestador = {
  id: string;
  nome: string;
  especialidade: string | null;
  descricao_marketplace: string | null;
  cidade: string | null;
  estado: string | null;
  telefone: string | null;
  avatar_url: string | null;
  latitude: number | null;
  longitude: number | null;
  distanciaKm?: number;
};

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistancia(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  if (km < 100) return `${km.toFixed(0)} km`;
  return `${Math.round(km)} km`;
}

function Avatar({ uri, nome, size = 48 }: { uri: string | null; nome: string; size?: number }) {
  const r = size / 2;
  if (uri) {
    return <Image source={{ uri }} style={{ width: size, height: size, borderRadius: r }} />;
  }
  return (
    <View style={[styles.avatarPlaceholder, { width: size, height: size, borderRadius: r }]}>
      <Text style={{ fontSize: size * 0.4, color: '#fff', fontWeight: '700' }}>
        {nome.charAt(0).toUpperCase()}
      </Text>
    </View>
  );
}

function localStr(cidade: string | null, estado: string | null): string {
  return [cidade, estado].filter(Boolean).join(' · ');
}

function normalizar(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export function MarketplaceScreen(_: TabScreenProps<'Marketplace'>) {
  const { isOffline } = useNetwork();
  const { isAnon } = useAuth();
  const [authWall, setAuthWall] = useState(false);
  const [todos, setTodos] = useState<Prestador[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busca, setBusca] = useState('');
  const [selecionado, setSelecionado] = useState<Prestador | null>(null);
  const [fotosPortfolio, setFotosPortfolio] = useState<{ id: string; url: string }[]>([]);
  const [fotoVisualizando, setFotoVisualizando] = useState<string | null>(null);
  const [minhaLocalizacao, setMinhaLocalizacao] = useState<{ lat: number; lon: number } | null>(null);
  const [semGps, setSemGps] = useState(false);

  const pedirLocalizacao = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { setSemGps(true); return; }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setMinhaLocalizacao({ lat: pos.coords.latitude, lon: pos.coords.longitude });
    } catch {
      setSemGps(true);
    }
  }, []);

  const carregar = useCallback(async () => {
    const cached = await loadCache<Prestador[]>('marketplace:prestadores');
    if (cached) { setTodos(cached); setLoading(false); }

    // Tenta com lat/lon; se a coluna ainda não existir (migration 008 pendente), recarrega sem ela
    const { data: d1, error: e1 } = await supabase
      .from('pessoas')
      .select('id, nome, especialidade, descricao_marketplace, cidade, estado, telefone, avatar_url, latitude, longitude')
      .eq('disponivel_marketplace', true)
      .eq('deletado', false)
      .eq('ativo', true)
      .order('nome');

    if (e1?.code === '42703') {
      const { data: d2, error: e2 } = await supabase
        .from('pessoas')
        .select('id, nome, especialidade, descricao_marketplace, cidade, estado, telefone, avatar_url')
        .eq('disponivel_marketplace', true)
        .eq('deletado', false)
        .eq('ativo', true)
        .order('nome');
      if (e2) { console.warn(e2); return; }
      setTodos(((d2 ?? []) as unknown as Prestador[]).map(p => ({ ...p, latitude: null, longitude: null })));
      return;
    }

    if (e1) { console.warn(e1); if (!cached) setTodos([]); return; }
    const resultado = (d1 ?? []) as unknown as Prestador[];
    setTodos(resultado);
    await saveCache('marketplace:prestadores', resultado);
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      // Só o carregamento dos dados controla o spinner. O GPS roda em paralelo
      // sem bloquear — pegar localização pode demorar/pendurar no 1º uso.
      await carregar();
      if (mounted) setLoading(false);
    })();
    pedirLocalizacao();
    return () => { mounted = false; };
  }, [carregar, pedirLocalizacao]);

  // Carrega fotos do portfólio ao abrir o modal de um prestador
  useEffect(() => {
    setFotosPortfolio([]);
    if (!selecionado) return;
    supabase
      .from('portfolio_fotos')
      .select('id, url')
      .eq('pessoa_id', selecionado.id)
      .order('criado_em', { ascending: true })
      .then(({ data }) => setFotosPortfolio((data ?? []) as { id: string; url: string }[]));
  }, [selecionado]);

  // Calcula distância e ordena
  const comDistancia: Prestador[] = todos.map(p => ({
    ...p,
    distanciaKm:
      minhaLocalizacao && p.latitude != null && p.longitude != null
        ? haversineKm(minhaLocalizacao.lat, minhaLocalizacao.lon, p.latitude, p.longitude)
        : undefined,
  }));

  const ordenados = [...comDistancia].sort((a, b) => {
    if (a.distanciaKm != null && b.distanciaKm != null) return a.distanciaKm - b.distanciaKm;
    if (a.distanciaKm != null) return -1;
    if (b.distanciaKm != null) return 1;
    return a.nome.localeCompare(b.nome);
  });

  const filtrados = busca.trim()
    ? ordenados.filter(p => {
        const q = normalizar(busca);
        return (
          normalizar(p.nome).includes(q) ||
          normalizar(p.especialidade ?? '').includes(q) ||
          normalizar(p.cidade ?? '').includes(q) ||
          normalizar(p.estado ?? '').includes(q)
        );
      })
    : ordenados;

  const onWhatsApp = (tel: string) => {
    const num = tel.replace(/\D/g, '');
    Linking.openURL(`https://wa.me/55${num}`).catch(() => Linking.openURL(`tel:${tel}`));
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" /></View>;
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {isOffline && <OfflineBanner />}
      {/* Barra de busca */}
      <View style={styles.searchBar}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          value={busca}
          onChangeText={setBusca}
          placeholder="Buscar por especialidade ou cidade..."
          placeholderTextColor={colors.textMuted}
          autoCorrect={false}
          clearButtonMode="while-editing"
        />
      </View>

      {/* Banner de status de localização */}
      {minhaLocalizacao ? (
        <View style={styles.gpsBanner}>
          <Text style={styles.gpsBannerText}>📍 Ordenado por distância da sua localização</Text>
        </View>
      ) : semGps ? (
        <Pressable style={styles.gpsBannerWarn} onPress={pedirLocalizacao}>
          <Text style={styles.gpsBannerWarnText}>📍 Permitir localização para ordenar por proximidade</Text>
        </Pressable>
      ) : null}

      <FlatList
        data={filtrados}
        keyExtractor={p => p.id}
        contentContainerStyle={styles.lista}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await Promise.all([carregar(), pedirLocalizacao()]);
              setRefreshing(false);
            }}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🏪</Text>
            <Text style={styles.emptyTitle}>
              {busca ? 'Nenhum resultado' : 'Nenhum prestador disponível ainda'}
            </Text>
            <Text style={styles.emptyText}>
              {busca ? 'Tente outros termos de busca.' : 'Trabalhadores que ativarem o perfil aparecerão aqui.'}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable style={styles.card} onPress={() => setSelecionado(item)}>
            <Avatar uri={item.avatar_url} nome={item.nome} size={52} />
            <View style={styles.cardInfo}>
              <Text style={styles.cardNome}>{item.nome}</Text>
              <View style={styles.cardRow}>
                {item.especialidade ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{item.especialidade}</Text>
                  </View>
                ) : null}
                {item.distanciaKm != null && (
                  <View style={styles.distBadge}>
                    <Text style={styles.distBadgeText}>{formatDistancia(item.distanciaKm)}</Text>
                  </View>
                )}
              </View>
              {localStr(item.cidade, item.estado) ? (
                <Text style={styles.cardLocal}>📍 {localStr(item.cidade, item.estado)}</Text>
              ) : null}
            </View>
            <Text style={styles.cardChevron}>›</Text>
          </Pressable>
        )}
      />

      {/* Modal de perfil completo */}
      <Modal
        visible={!!selecionado}
        animationType="slide"
        transparent
        onRequestClose={() => setSelecionado(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setSelecionado(null)} />
        {selecionado && (
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />

            <View style={styles.modalHeader}>
              <Avatar uri={selecionado.avatar_url} nome={selecionado.nome} size={72} />
              <View style={{ marginLeft: spacing.md, flex: 1 }}>
                <Text style={styles.modalNome}>{selecionado.nome}</Text>
                <View style={styles.cardRow}>
                  {selecionado.especialidade ? (
                    <View style={[styles.badge, { marginTop: 4 }]}>
                      <Text style={styles.badgeText}>{selecionado.especialidade}</Text>
                    </View>
                  ) : null}
                  {selecionado.distanciaKm != null && (
                    <View style={[styles.distBadge, { marginTop: 4 }]}>
                      <Text style={styles.distBadgeText}>{formatDistancia(selecionado.distanciaKm)}</Text>
                    </View>
                  )}
                </View>
                {localStr(selecionado.cidade, selecionado.estado) ? (
                  <Text style={styles.modalLocal}>
                    📍 {localStr(selecionado.cidade, selecionado.estado)}
                  </Text>
                ) : null}
              </View>
            </View>

            {selecionado.descricao_marketplace ? (
              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>Sobre</Text>
                <Text style={styles.modalDescricao}>{selecionado.descricao_marketplace}</Text>
              </View>
            ) : null}

            {fotosPortfolio.length > 0 && (
              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>Portfólio de serviços</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -spacing.lg }}>
                  <View style={{ flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg }}>
                    {fotosPortfolio.map(foto => (
                      <Pressable key={foto.id} onPress={() => setFotoVisualizando(foto.url)}>
                        <Image source={{ uri: foto.url }} style={styles.portfolioThumb} />
                      </Pressable>
                    ))}
                  </View>
                </ScrollView>
              </View>
            )}

            {selecionado.telefone ? (
              <Pressable
                style={styles.btnWhatsApp}
                onPress={() => (isAnon ? setAuthWall(true) : onWhatsApp(selecionado.telefone!))}
              >
                <Text style={styles.btnWhatsAppText}>💬  Chamar no WhatsApp</Text>
              </Pressable>
            ) : (
              <View style={styles.semContato}>
                <Text style={styles.semContatoText}>Este prestador não informou contato.</Text>
              </View>
            )}

            <Pressable style={styles.btnFechar} onPress={() => setSelecionado(null)}>
              <Text style={styles.btnFecharText}>Fechar</Text>
            </Pressable>
          </View>
        )}
      </Modal>

      {/* Visualizador de foto em tela cheia */}
      <Modal
        visible={!!fotoVisualizando}
        transparent
        animationType="fade"
        onRequestClose={() => setFotoVisualizando(null)}
      >
        <Pressable style={styles.fotoViewer} onPress={() => setFotoVisualizando(null)}>
          {fotoVisualizando && (
            <Image source={{ uri: fotoVisualizando }} style={styles.fotoViewerImg} resizeMode="contain" />
          )}
          <View style={styles.fotoViewerClose}>
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>✕ Fechar</Text>
          </View>
        </Pressable>
      </Modal>

      <AuthWall
        visible={authWall}
        onClose={() => setAuthWall(false)}
        titulo="Crie sua conta pra contratar"
        mensagem="Veja os profissionais à vontade. Pra entrar em contato, crie sua conta — é rápido e grátis."
      />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  avatarPlaceholder: { backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },

  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: spacing.md,
    marginBottom: spacing.xs,
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
  },
  searchIcon: { fontSize: 16, marginRight: spacing.xs },
  searchInput: { flex: 1, fontSize: 14, color: colors.text, paddingVertical: spacing.sm + 2 },

  gpsBanner: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.xs,
    backgroundColor: colors.success + '15',
    borderRadius: 8,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  gpsBannerText: { fontSize: 12, color: colors.success, fontWeight: '500' },
  gpsBannerWarn: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.xs,
    backgroundColor: colors.warning + '18',
    borderRadius: 8,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  gpsBannerWarnText: { fontSize: 12, color: colors.warning, fontWeight: '500' },

  lista: { padding: spacing.md, paddingBottom: 40 },

  empty: { alignItems: 'center', paddingTop: spacing.xl * 2, paddingHorizontal: spacing.lg },
  emptyIcon: { fontSize: 48, marginBottom: spacing.md },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: colors.text, marginBottom: spacing.sm },
  emptyText: { fontSize: 14, color: colors.textMuted, textAlign: 'center', lineHeight: 20 },

  card: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardInfo: { flex: 1, marginLeft: spacing.sm },
  cardNome: { fontSize: 15, fontWeight: '600', color: colors.text, marginBottom: 4 },
  cardRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.xs },
  cardLocal: { fontSize: 12, color: colors.textMuted, marginTop: 3 },
  cardChevron: { fontSize: 22, color: colors.textMuted },

  badge: {
    backgroundColor: colors.primary + '18',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeText: { fontSize: 11, color: colors.primary, fontWeight: '600' },

  distBadge: {
    backgroundColor: colors.success + '18',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  distBadgeText: { fontSize: 11, color: colors.success, fontWeight: '600' },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  modalSheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: spacing.lg,
    paddingBottom: 32,
  },
  modalHandle: {
    width: 40, height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  modalHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.md },
  modalNome: { fontSize: 20, fontWeight: '700', color: colors.text },
  modalLocal: { fontSize: 13, color: colors.textMuted, marginTop: 4 },
  modalSection: { marginBottom: spacing.md },
  modalSectionTitle: {
    fontSize: 11, fontWeight: '700', color: colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6,
  },
  modalDescricao: { fontSize: 14, color: colors.text, lineHeight: 22 },
  btnWhatsApp: {
    backgroundColor: '#25D366',
    borderRadius: 10,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  btnWhatsAppText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  semContato: { paddingVertical: spacing.sm, marginBottom: spacing.sm },
  semContatoText: { color: colors.textMuted, fontSize: 13, textAlign: 'center' },
  btnFechar: {
    borderWidth: 1, borderColor: colors.border,
    borderRadius: 10, paddingVertical: spacing.sm + 2, alignItems: 'center',
  },
  btnFecharText: { fontSize: 15, color: colors.text },

  portfolioThumb: {
    width: 120,
    height: 120,
    borderRadius: 8,
    backgroundColor: colors.surface,
  },

  fotoViewer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fotoViewerImg: { width: '100%', height: '80%' },
  fotoViewerClose: {
    position: 'absolute',
    top: 52,
    right: spacing.lg,
  },
});
