import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { DateField } from '@/components/DateField';
import type { TabScreenProps } from '@/navigation/types';

type EquipamentoComLoja = {
  id: string;
  nome: string;
  categoria: string | null;
  descricao: string | null;
  foto_url: string | null;
  preco_diaria: number | null;
  loja: {
    id: string;
    nome: string;
    cidade: string | null;
    estado: string | null;
    telefone: string | null;
    latitude: number | null;
    longitude: number | null;
  };
  distanciaKm?: number;
};

type LojaComEquipamentos = {
  id: string;
  nome: string;
  descricao: string | null;
  cidade: string | null;
  estado: string | null;
  telefone: string | null;
  endereco: string | null;
  latitude: number | null;
  longitude: number | null;
  equipamentos: { id: string; nome: string; categoria: string | null; foto_url: string | null; preco_diaria: number | null; ativo?: boolean; deletado?: boolean }[];
  distanciaKm?: number;
};

const CATEGORIAS = [
  'Andaime',
  'Betoneira',
  'Gerador',
  'Compactador',
  'Britadeira',
  'Compressor',
  'Plataforma Elevatória',
  'Vibrador',
  'Serra',
  'Bomba',
  'Outro',
];

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

function formatPreco(preco: number | null): string {
  if (preco == null) return '';
  return `R$ ${preco.toFixed(0)}/dia`;
}

function localStr(cidade: string | null, estado: string | null): string {
  return [cidade, estado].filter(Boolean).join(' · ');
}

function normalizar(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function onWhatsApp(tel: string) {
  const num = tel.replace(/\D/g, '');
  Linking.openURL(`https://wa.me/55${num}`).catch(() => Linking.openURL(`tel:${tel}`));
}

type ObraSimples = { id: string; nome: string; endereco: string | null; cidade: string | null; estado: string | null };

export function AluguelEquipamentosScreen(_: TabScreenProps<'Equipamentos'>) {
  const { isOffline } = useNetwork();
  const { pessoa, isAnon } = useAuth();
  const [authWall, setAuthWall] = useState(false);
  const [equipamentos, setEquipamentos] = useState<EquipamentoComLoja[]>([]);
  const [lojas, setLojas] = useState<LojaComEquipamentos[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busca, setBusca] = useState('');
  const [categoriaFiltro, setCategoriaFiltro] = useState<string | null>(null);
  const [aba, setAba] = useState<'equipamentos' | 'lojas'>('equipamentos');
  const [lojaModal, setLojaModal] = useState<LojaComEquipamentos | null>(null);
  const [fotoVisualizando, setFotoVisualizando] = useState<string | null>(null);
  const [minhaLoc, setMinhaLoc] = useState<{ lat: number; lon: number } | null>(null);
  const [semGps, setSemGps] = useState(false);

  // Pedido de aluguel (cliente solicita pelo app)
  const [obras, setObras] = useState<ObraSimples[]>([]);
  const [pedidoEq, setPedidoEq] = useState<EquipamentoComLoja | null>(null);
  const [pedObraId, setPedObraId] = useState<string | null>(null);
  const [pedQtd, setPedQtd] = useState('1');
  const [pedInicio, setPedInicio] = useState('');
  const [pedFim, setPedFim] = useState('');
  const [enviandoPedido, setEnviandoPedido] = useState(false);

  const pedirLocalizacao = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { setSemGps(true); return; }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setMinhaLoc({ lat: pos.coords.latitude, lon: pos.coords.longitude });
    } catch {
      setSemGps(true);
    }
  }, []);

  const carregar = useCallback(async () => {
    const cachedEq = await loadCache<EquipamentoComLoja[]>('aluguel:equipamentos');
    const cachedLojas = await loadCache<LojaComEquipamentos[]>('aluguel:lojas');
    if (cachedEq) setEquipamentos(cachedEq);
    if (cachedLojas) setLojas(cachedLojas);

    const [
      { data: eqData, error: eqError },
      { data: lojaData, error: lojaError },
    ] = await Promise.all([
      supabase
        .from('equipamentos')
        .select('id, nome, categoria, descricao, foto_url, preco_diaria, loja:lojas_equipamentos(id, nome, cidade, estado, telefone, latitude, longitude)')
        .eq('ativo', true)
        .eq('deletado', false)
        .order('nome'),
      supabase
        .from('lojas_equipamentos')
        .select('id, nome, descricao, cidade, estado, telefone, endereco, latitude, longitude, equipamentos(id, nome, categoria, foto_url, preco_diaria, ativo, deletado)')
        .eq('ativo', true)
        .eq('deletado', false)
        .order('nome'),
    ]);
    if (eqError) console.warn('[AluguelEquipamentos] equipamentos error:', JSON.stringify(eqError));
    if (lojaError) console.warn('[AluguelEquipamentos] lojas error:', JSON.stringify(lojaError));
    if (eqData) {
      const eq = eqData as unknown as EquipamentoComLoja[];
      setEquipamentos(eq);
      await saveCache('aluguel:equipamentos', eq);
    }
    if (lojaData) {
      // Filtra equipamentos inativos/deletados que vieram na query aninhada
      const lojasFiltradas = (lojaData as unknown as Array<LojaComEquipamentos & { equipamentos: Array<{ ativo?: boolean; deletado?: boolean } & LojaComEquipamentos['equipamentos'][0]> }>)
        .map(l => ({
          ...l,
          equipamentos: l.equipamentos.filter(e => e.ativo !== false && e.deletado !== true),
        }));
      const result = lojasFiltradas as unknown as LojaComEquipamentos[];
      setLojas(result);
      await saveCache('aluguel:lojas', result);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      // Só os dados controlam o spinner. O GPS roda em paralelo e NÃO trava
      // a tela (o diálogo de permissão pode demorar/ficar pendente).
      await carregar();
      if (mounted) setLoading(false);
    })();
    // GPS desacoplado do loading
    pedirLocalizacao();
    return () => { mounted = false; };
  }, [carregar, pedirLocalizacao]);

  // Carrega as obras do usuário (pro seletor "para qual obra?" no pedido).
  useEffect(() => {
    if (!pessoa?.id) return;
    (async () => {
      const { data } = await supabase
        .from('obras')
        .select('id, nome, endereco, cidade, estado')
        .eq('deletado', false)
        .order('nome');
      setObras((data as ObraSimples[]) ?? []);
    })();
  }, [pessoa?.id]);

  function abrirPedido(eq: EquipamentoComLoja) {
    if (isAnon) { setAuthWall(true); return; }
    setPedidoEq(eq);
    setPedObraId(obras[0]?.id ?? null);
    setPedQtd('1');
    setPedInicio('');
    setPedFim('');
  }

  function enderecoDaObra(o: ObraSimples | undefined): string {
    if (!o) return '';
    return [o.endereco, o.cidade, o.estado].filter(Boolean).join(', ');
  }

  // Valor estimado do pedido = preço/dia × dias × quantidade (estimativa).
  function calcValorPedido(): number {
    if (!pedidoEq) return 0;
    const qtd = parseInt(pedQtd, 10) || 0;
    let dias = 1;
    if (pedInicio && pedFim) {
      const d1 = new Date(pedInicio + 'T00:00:00');
      const d2 = new Date(pedFim + 'T00:00:00');
      dias = Math.max(1, Math.round((d2.getTime() - d1.getTime()) / 86400000) + 1);
    }
    return (Number(pedidoEq.preco_diaria) || 0) * qtd * dias;
  }

  async function enviarPedido() {
    if (!pedidoEq || !pessoa) return;
    const obra = obras.find(o => o.id === pedObraId);
    if (!obra) { Alert.alert('Atenção', 'Selecione a obra para entrega.'); return; }
    const qtd = parseInt(pedQtd, 10) || 0;
    if (qtd < 1) { Alert.alert('Atenção', 'Informe uma quantidade válida.'); return; }
    if (!pedInicio) { Alert.alert('Atenção', 'Escolha a data de início.'); return; }

    const endereco = enderecoDaObra(obra);
    const valor = calcValorPedido();
    setEnviandoPedido(true);
    try {
      const { error } = await supabase.from('alugueis').insert({
        loja_id: pedidoEq.loja.id,
        equipamento_id: pedidoEq.id,
        solicitante_pessoa_id: pessoa.id,
        obra_id: obra.id,
        cliente_nome: pessoa.nome,
        cliente_telefone: pessoa.telefone,
        quantidade: qtd,
        data_inicio: pedInicio,
        data_fim: pedFim || null,
        valor_total: valor || null,
        endereco_entrega: endereco || null,
        status: 'pendente',
      });
      if (error) throw error;

      // Abre o WhatsApp da loja com o resumo do pedido pré-preenchido.
      const tel = pedidoEq.loja?.telefone;
      if (tel) {
        const num = tel.replace(/\D/g, '');
        const fmt = (d: string) => d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : 'a combinar';
        const msg = `Olá! Quero alugar pelo Maestro de Obras:\n\n📦 ${qtd}x ${pedidoEq.nome}\n📅 ${fmt(pedInicio)} → ${fmt(pedFim)}\n📍 Entrega: ${endereco || 'a combinar'}\n\nPode confirmar disponibilidade e valor?`;
        Linking.openURL(`https://wa.me/55${num}?text=${encodeURIComponent(msg)}`).catch(() => {});
      }

      setPedidoEq(null);
      Alert.alert('Pedido enviado!', 'A loja recebeu seu pedido e vai confirmar. Você também pode combinar pelo WhatsApp.');
    } catch (e: unknown) {
      Alert.alert('Erro', e instanceof Error ? e.message : 'Não foi possível enviar o pedido.');
    } finally {
      setEnviandoPedido(false);
    }
  }

  // Adiciona distância e ordena
  function comDistEq(items: EquipamentoComLoja[]): (EquipamentoComLoja & { distanciaKm?: number })[] {
    return items
      .map(item => {
        const lat = item.loja?.latitude ?? null;
        const lon = item.loja?.longitude ?? null;
        const distanciaKm = minhaLoc && lat != null && lon != null
          ? haversineKm(minhaLoc.lat, minhaLoc.lon, lat, lon) : undefined;
        return { ...item, distanciaKm };
      })
      .sort((a, b) => {
        if (a.distanciaKm != null && b.distanciaKm != null) return a.distanciaKm - b.distanciaKm;
        if (a.distanciaKm != null) return -1;
        if (b.distanciaKm != null) return 1;
        return 0;
      });
  }

  function comDistLoja(items: LojaComEquipamentos[]): (LojaComEquipamentos & { distanciaKm?: number })[] {
    return items
      .map(item => {
        const distanciaKm = minhaLoc && item.latitude != null && item.longitude != null
          ? haversineKm(minhaLoc.lat, minhaLoc.lon, item.latitude, item.longitude) : undefined;
        return { ...item, distanciaKm };
      })
      .sort((a, b) => {
        if (a.distanciaKm != null && b.distanciaKm != null) return a.distanciaKm - b.distanciaKm;
        if (a.distanciaKm != null) return -1;
        if (b.distanciaKm != null) return 1;
        return 0;
      });
  }

  const eqFiltrados = comDistEq(equipamentos).filter(e => {
    const q = normalizar(busca);
    const matchBusca = !busca.trim() || (
      normalizar(e.nome).includes(q) ||
      normalizar(e.categoria ?? '').includes(q) ||
      normalizar(e.loja?.nome ?? '').includes(q) ||
      normalizar(e.loja?.cidade ?? '').includes(q)
    );
    const matchCategoria = !categoriaFiltro || e.categoria === categoriaFiltro;
    return matchBusca && matchCategoria;
  });

  const lojasFiltradas = comDistLoja(lojas).filter(l => {
    const q = normalizar(busca);
    return !busca.trim() || (
      normalizar(l.nome).includes(q) ||
      normalizar(l.cidade ?? '').includes(q) ||
      normalizar(l.equipamentos.map(e => e.nome).join(' ')).includes(q)
    );
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([carregar(), pedirLocalizacao()]);
    setRefreshing(false);
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
          placeholder="Buscar equipamento, loja ou cidade..."
          placeholderTextColor={colors.textMuted}
          autoCorrect={false}
          clearButtonMode="while-editing"
        />
      </View>

      {/* Banner GPS */}
      {minhaLoc ? (
        <View style={styles.gpsBanner}>
          <Text style={styles.gpsBannerText}>📍 Ordenado por distância da sua localização</Text>
        </View>
      ) : semGps ? (
        <Pressable style={styles.gpsBannerWarn} onPress={pedirLocalizacao}>
          <Text style={styles.gpsBannerWarnText}>📍 Permitir localização para ordenar por proximidade</Text>
        </Pressable>
      ) : null}

      {/* Abas */}
      <View style={styles.tabRow}>
        <Pressable
          style={[styles.tab, aba === 'equipamentos' && styles.tabAtiva]}
          onPress={() => setAba('equipamentos')}
        >
          <Text style={[styles.tabText, aba === 'equipamentos' && styles.tabTextAtiva]}>🔧 Equipamentos</Text>
        </Pressable>
        <Pressable
          style={[styles.tab, aba === 'lojas' && styles.tabAtiva]}
          onPress={() => setAba('lojas')}
        >
          <Text style={[styles.tabText, aba === 'lojas' && styles.tabTextAtiva]}>🏪 Lojas</Text>
        </Pressable>
      </View>

      {/* Filtro de categorias — só na aba equipamentos */}
      {aba === 'equipamentos' && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.categoriaScroll}
          contentContainerStyle={styles.categoriaRow}
        >
          <Pressable
            style={[styles.categoriaBadge, !categoriaFiltro && styles.categoriaBadgeAtiva]}
            onPress={() => setCategoriaFiltro(null)}
          >
            <Text style={[styles.categoriaBadgeText, !categoriaFiltro && styles.categoriaBadgeTextAtiva]}>
              Todos
            </Text>
          </Pressable>
          {CATEGORIAS.map(c => (
            <Pressable
              key={c}
              style={[styles.categoriaBadge, categoriaFiltro === c && styles.categoriaBadgeAtiva]}
              onPress={() => setCategoriaFiltro(prev => prev === c ? null : c)}
            >
              <Text style={[styles.categoriaBadgeText, categoriaFiltro === c && styles.categoriaBadgeTextAtiva]}>
                {c}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      )}

      {/* Lista de equipamentos */}
      {aba === 'equipamentos' && (
        <FlatList
          data={eqFiltrados}
          keyExtractor={e => e.id}
          contentContainerStyle={styles.lista}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>🔧</Text>
              <Text style={styles.emptyTitle}>{busca || categoriaFiltro ? 'Nenhum resultado' : 'Nenhum equipamento cadastrado'}</Text>
              <Text style={styles.emptyText}>
                {busca || categoriaFiltro ? 'Tente outros termos ou remova o filtro.' : 'As lojas parceiras ainda não cadastraram equipamentos.'}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.eqCard}>
              {/* Foto do produto */}
              {item.foto_url ? (
                <Pressable onPress={() => setFotoVisualizando(item.foto_url!)}>
                  <Image source={{ uri: item.foto_url }} style={styles.eqFoto} resizeMode="cover" />
                  <View style={styles.eqFotoHint}>
                    <Text style={styles.eqFotoHintText}>🔍 toque para ampliar</Text>
                  </View>
                </Pressable>
              ) : null}
              <View style={styles.eqCardBody}>
                <Text style={styles.eqNome}>{item.nome}</Text>
                <View style={styles.badgeRow}>
                  {item.categoria ? (
                    <View style={styles.catBadge}>
                      <Text style={styles.catBadgeText}>{item.categoria}</Text>
                    </View>
                  ) : null}
                  {item.distanciaKm != null && (
                    <View style={styles.distBadge}>
                      <Text style={styles.distBadgeText}>{formatDistancia(item.distanciaKm)}</Text>
                    </View>
                  )}
                  {item.preco_diaria != null && (
                    <View style={styles.precoBadge}>
                      <Text style={styles.precoBadgeText}>{formatPreco(item.preco_diaria)}</Text>
                    </View>
                  )}
                </View>
                {item.descricao ? (
                  <Text style={styles.eqDescricao} numberOfLines={2}>{item.descricao}</Text>
                ) : null}
                <View style={styles.eqLojaRow}>
                  <Text style={styles.eqLojaNome}>🏪 {item.loja?.nome}</Text>
                  {localStr(item.loja?.cidade ?? null, item.loja?.estado ?? null) ? (
                    <Text style={styles.eqLojaLocal}>📍 {localStr(item.loja?.cidade ?? null, item.loja?.estado ?? null)}</Text>
                  ) : null}
                </View>
                <Pressable style={styles.btnSolicitar} onPress={() => abrirPedido(item)}>
                  <Text style={styles.btnSolicitarText}>💬  Solicitar pelo WhatsApp</Text>
                </Pressable>
              </View>
            </View>
          )}
        />
      )}

      {/* Lista de lojas */}
      {aba === 'lojas' && (
        <FlatList
          data={lojasFiltradas}
          keyExtractor={l => l.id}
          contentContainerStyle={styles.lista}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>🏪</Text>
              <Text style={styles.emptyTitle}>{busca ? 'Nenhum resultado' : 'Nenhuma loja cadastrada'}</Text>
              <Text style={styles.emptyText}>
                {busca ? 'Tente outros termos.' : 'As lojas parceiras ainda não foram cadastradas.'}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable style={styles.lojaCard} onPress={() => setLojaModal(item as LojaComEquipamentos & { distanciaKm?: number })}>
              <View style={styles.lojaCardTop}>
                <View style={styles.lojaAvatar}>
                  <Text style={styles.lojaAvatarText}>{item.nome.charAt(0).toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1, marginLeft: spacing.sm }}>
                  <Text style={styles.lojaNome}>{item.nome}</Text>
                  <View style={styles.badgeRow}>
                    {item.distanciaKm != null && (
                      <View style={styles.distBadge}>
                        <Text style={styles.distBadgeText}>{formatDistancia(item.distanciaKm)}</Text>
                      </View>
                    )}
                    <View style={styles.qtdBadge}>
                      <Text style={styles.qtdBadgeText}>{item.equipamentos.length} equipamentos</Text>
                    </View>
                  </View>
                  {localStr(item.cidade, item.estado) ? (
                    <Text style={styles.lojaLocal}>📍 {localStr(item.cidade, item.estado)}</Text>
                  ) : null}
                </View>
                <Text style={styles.chevron}>›</Text>
              </View>
            </Pressable>
          )}
        />
      )}

      {/* Modal de loja */}
      <Modal
        visible={!!lojaModal}
        animationType="slide"
        transparent
        onRequestClose={() => setLojaModal(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setLojaModal(null)} />
        {lojaModal && (
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />

            <Text style={styles.modalNome}>{lojaModal.nome}</Text>
            <View style={styles.badgeRow}>
              {(lojaModal as LojaComEquipamentos & { distanciaKm?: number }).distanciaKm != null && (
                <View style={styles.distBadge}>
                  <Text style={styles.distBadgeText}>
                    {formatDistancia((lojaModal as LojaComEquipamentos & { distanciaKm?: number }).distanciaKm!)}
                  </Text>
                </View>
              )}
            </View>
            {localStr(lojaModal.cidade, lojaModal.estado) ? (
              <Text style={styles.modalLocal}>📍 {localStr(lojaModal.cidade, lojaModal.estado)}</Text>
            ) : null}
            {lojaModal.endereco ? (
              <Text style={styles.modalEndereco}>{lojaModal.endereco}</Text>
            ) : null}
            {lojaModal.descricao ? (
              <Text style={styles.modalDescricao}>{lojaModal.descricao}</Text>
            ) : null}

            <Text style={styles.modalSectionTitle}>Catálogo</Text>
            <ScrollView style={{ maxHeight: 300 }} showsVerticalScrollIndicator={false}>
              {lojaModal.equipamentos.length === 0 ? (
                <Text style={styles.modalVazio}>Nenhum equipamento cadastrado.</Text>
              ) : (
                lojaModal.equipamentos.map(e => (
                  <Pressable
                    key={e.id}
                    style={styles.modalEqItem}
                    onPress={e.foto_url ? () => setFotoVisualizando(e.foto_url!) : undefined}
                  >
                    {e.foto_url ? (
                      <Image source={{ uri: e.foto_url }} style={styles.modalEqThumb} />
                    ) : (
                      <View style={styles.modalEqThumbPlaceholder}>
                        <Text style={{ fontSize: 18 }}>🔧</Text>
                      </View>
                    )}
                    <View style={{ flex: 1, marginLeft: spacing.sm }}>
                      <Text style={styles.modalEqNome}>{e.nome}</Text>
                      {e.categoria ? <Text style={styles.modalEqCategoria}>{e.categoria}</Text> : null}
                    </View>
                    {e.preco_diaria != null ? (
                      <Text style={styles.modalEqPreco}>{formatPreco(e.preco_diaria)}</Text>
                    ) : null}
                  </Pressable>
                ))
              )}
            </ScrollView>

            {lojaModal.telefone ? (
              <Pressable style={styles.btnWhatsApp} onPress={() => onWhatsApp(lojaModal.telefone!)}>
                <Text style={styles.btnWhatsAppText}>💬  Chamar no WhatsApp</Text>
              </Pressable>
            ) : null}

            <Pressable style={styles.btnFechar} onPress={() => setLojaModal(null)}>
              <Text style={styles.btnFecharText}>Fechar</Text>
            </Pressable>
          </View>
        )}
      </Modal>

      {/* Modal: solicitar aluguel */}
      <Modal
        visible={!!pedidoEq}
        animationType="slide"
        transparent
        onRequestClose={() => setPedidoEq(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setPedidoEq(null)} />
        {pedidoEq && (
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalNome}>Solicitar: {pedidoEq.nome}</Text>
            <Text style={styles.eqLojaNome}>🏪 {pedidoEq.loja?.nome}</Text>

            <ScrollView style={{ maxHeight: 400, marginTop: spacing.sm }} keyboardShouldPersistTaps="handled">
              {obras.length === 0 ? (
                <Text style={styles.modalVazio}>
                  Você precisa criar uma obra primeiro (aba Obras) para escolher o endereço de entrega.
                </Text>
              ) : (
                <>
                  <Text style={styles.pedLabel}>Para qual obra? (endereço de entrega)</Text>
                  {obras.map(o => {
                    const end = enderecoDaObra(o);
                    const ativa = pedObraId === o.id;
                    return (
                      <Pressable
                        key={o.id}
                        onPress={() => setPedObraId(o.id)}
                        style={[styles.obraOpt, ativa && styles.obraOptAtiva]}
                      >
                        <Text style={[styles.obraOptNome, ativa && { color: colors.primary }]}>
                          {ativa ? '◉ ' : '○ '}{o.nome}
                        </Text>
                        {end ? <Text style={styles.obraOptEnd}>📍 {end}</Text> : null}
                      </Pressable>
                    );
                  })}

                  <Text style={styles.pedLabel}>Quantidade</Text>
                  <TextInput
                    style={styles.pedInput}
                    value={pedQtd}
                    onChangeText={setPedQtd}
                    keyboardType="number-pad"
                    placeholder="1"
                    placeholderTextColor={colors.textMuted}
                  />

                  <View style={{ height: spacing.sm }} />
                  <DateField label="Data de início" value={pedInicio || null} onChange={d => setPedInicio(d ?? '')} />
                  <DateField label="Devolução prevista" value={pedFim || null} onChange={d => setPedFim(d ?? '')} />

                  {pedidoEq?.preco_diaria != null && (
                    <View style={styles.valorBox}>
                      <Text style={styles.valorLabel}>Valor estimado</Text>
                      <Text style={styles.valorNum}>
                        R$ {calcValorPedido().toFixed(2).replace('.', ',')}
                      </Text>
                    </View>
                  )}
                  <Text style={styles.valorHint}>
                    Estimativa (preço/dia × dias × qtd). A loja confirma o valor final.
                  </Text>
                </>
              )}
            </ScrollView>

            <View style={styles.pedFooter}>
              <Pressable style={[styles.pedBtn, styles.pedBtnCancel]} onPress={() => setPedidoEq(null)}>
                <Text style={styles.pedBtnCancelText}>Cancelar</Text>
              </Pressable>
              <Pressable
                style={[styles.pedBtn, styles.pedBtnSend, { opacity: (obras.length === 0 || enviandoPedido) ? 0.5 : 1 }]}
                disabled={obras.length === 0 || enviandoPedido}
                onPress={enviarPedido}
              >
                <Text style={styles.pedBtnSendText}>{enviandoPedido ? 'Enviando...' : 'Enviar pedido'}</Text>
              </Pressable>
            </View>
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
        titulo="Crie sua conta pra alugar"
        mensagem="Você pode ver os equipamentos à vontade. Pra solicitar um aluguel, crie sua conta — é rápido e grátis."
      />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

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

  // Abas
  tabRow: {
    flexDirection: 'row',
    marginHorizontal: spacing.md,
    marginBottom: spacing.xs,
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 3,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabAtiva: { backgroundColor: colors.primary },
  tabText: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  tabTextAtiva: { color: '#fff' },

  // Filtro categorias
  // flexGrow:0 impede o ScrollView horizontal de esticar na vertical quando a
  // lista abaixo fica vazia (era o que deixava os chips gigantes).
  categoriaScroll: { flexGrow: 0, flexShrink: 0 },
  categoriaRow: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xs,
    gap: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoriaBadge: {
    height: 32,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  categoriaBadgeAtiva: { backgroundColor: colors.primary, borderColor: colors.primary },
  categoriaBadgeText: { fontSize: 12, color: colors.textMuted, fontWeight: '500' },
  categoriaBadgeTextAtiva: { color: '#fff' },

  lista: { padding: spacing.md, paddingBottom: 40 },

  empty: { alignItems: 'center', paddingTop: spacing.xl * 2, paddingHorizontal: spacing.lg },
  emptyIcon: { fontSize: 48, marginBottom: spacing.md },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: colors.text, marginBottom: spacing.sm },
  emptyText: { fontSize: 14, color: colors.textMuted, textAlign: 'center', lineHeight: 20 },

  // Card equipamento
  eqCard: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
    overflow: 'hidden',
  },
  eqCardTop: { flexDirection: 'row', marginBottom: 4 },
  eqNome: { fontSize: 15, fontWeight: '600', color: colors.text, marginBottom: 4 },
  eqDescricao: { fontSize: 13, color: colors.textMuted, lineHeight: 18, marginBottom: spacing.sm },
  eqLojaRow: { marginBottom: spacing.sm },
  eqLojaNome: { fontSize: 13, color: colors.text, fontWeight: '500' },
  eqLojaLocal: { fontSize: 12, color: colors.textMuted, marginTop: 2 },

  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: 4 },

  catBadge: {
    backgroundColor: colors.primary + '18',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  catBadgeText: { fontSize: 11, color: colors.primary, fontWeight: '600' },

  distBadge: {
    backgroundColor: colors.success + '18',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  distBadgeText: { fontSize: 11, color: colors.success, fontWeight: '600' },

  precoBadge: {
    backgroundColor: colors.warning + '18',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  precoBadgeText: { fontSize: 11, color: colors.warning, fontWeight: '600' },

  qtdBadge: {
    backgroundColor: colors.primary + '12',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  qtdBadgeText: { fontSize: 11, color: colors.primary, fontWeight: '500' },

  btnWhatsApp: {
    backgroundColor: '#25D366',
    borderRadius: 8,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  btnWhatsAppText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  // Solicitar aluguel
  btnSolicitar: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  btnSolicitarText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  // Footer do modal de pedido: botões de tamanho idêntico e texto centralizado.
  pedFooter: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  pedBtn: {
    flex: 1,
    height: 50,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pedBtnCancel: { backgroundColor: '#fff', borderColor: colors.borderNeutral },
  pedBtnSend: { backgroundColor: colors.primary, borderColor: colors.primary },
  pedBtnCancelText: { fontSize: 15, fontWeight: '700', color: colors.navy },
  pedBtnSendText: { fontSize: 15, fontWeight: '700', color: '#fff' },

  pedLabel: { fontSize: 13, fontWeight: '700', color: colors.navy, marginTop: spacing.sm, marginBottom: spacing.xs },
  pedInput: {
    borderWidth: 1.5,
    borderColor: colors.borderNeutral,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.background,
  },
  obraOpt: {
    borderWidth: 1.5,
    borderColor: colors.borderNeutral,
    borderRadius: 12,
    padding: spacing.sm + 2,
    marginBottom: spacing.xs,
  },
  obraOptAtiva: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  obraOptNome: { fontSize: 14, fontWeight: '600', color: colors.navy },
  obraOptEnd: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  valorBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    marginTop: spacing.sm,
  },
  valorLabel: { fontSize: 14, fontWeight: '600', color: colors.navy },
  valorNum: { fontSize: 18, fontWeight: '800', color: colors.primary },
  valorHint: { fontSize: 11, color: colors.textMuted, marginTop: spacing.xs },

  // Card loja
  lojaCard: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  lojaCardTop: { flexDirection: 'row', alignItems: 'center' },
  lojaAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lojaAvatarText: { fontSize: 20, color: '#fff', fontWeight: '700' },
  lojaNome: { fontSize: 15, fontWeight: '600', color: colors.text, marginBottom: 4 },
  lojaLocal: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  chevron: { fontSize: 22, color: colors.textMuted },

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
    width: 40,
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  modalNome: { fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: 4 },
  modalLocal: { fontSize: 13, color: colors.textMuted, marginTop: 4 },
  modalEndereco: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  modalDescricao: { fontSize: 13, color: colors.textMuted, lineHeight: 18, marginTop: spacing.sm, marginBottom: spacing.sm },
  modalSectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  modalVazio: { fontSize: 13, color: colors.textMuted, fontStyle: 'italic' },
  modalEqItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  modalEqNome: { fontSize: 14, color: colors.text, fontWeight: '500' },
  modalEqCategoria: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
  modalEqPreco: { fontSize: 13, color: colors.warning, fontWeight: '600' },
  btnFechar: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: spacing.sm + 2,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  btnFecharText: { fontSize: 15, color: colors.text },
  eqFoto: { width: '100%', height: 180 },
  eqFotoHint: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.35)',
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
  },
  eqFotoHintText: { fontSize: 11, color: '#fff' },
  eqCardBody: { padding: spacing.md },
  modalEqThumb: { width: 56, height: 56, borderRadius: 6, backgroundColor: colors.surface },
  modalEqThumbPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 6,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fotoViewer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fotoViewerImg: { width: '100%', height: '80%' },
  fotoViewerClose: { position: 'absolute', top: 52, right: spacing.lg },
});
