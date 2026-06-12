import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useObraMembros } from '@/hooks/useObraMembros';
import { ImageViewerModal } from '@/components/ImageViewerModal';
import { uploadRdoFoto, midiaPublicUrl } from '@/lib/midias';
import { DateField } from '@/components/DateField';
import { colors, radius, spacing } from '@/lib/theme';
import type { Rdo, RdoClima, RdoCondicao, RdoExterno, RdoItem } from '@/types/database';
import type { AppScreenProps } from '@/navigation/types';

type ItemObra = { tipo: RdoItem['tipo']; id: string; nome: string; descricao: string | null; dataConclusao: string | null };

const TIPO_LABEL: Record<RdoItem['tipo'], string> = {
  etapa: 'Etapas',
  material: 'Materiais',
  contratacao: 'Contratações',
};

const CLIMAS: { key: RdoClima; label: string; emoji: string }[] = [
  { key: 'bom', label: 'Bom', emoji: '☀️' },
  { key: 'nublado', label: 'Nublado', emoji: '☁️' },
  { key: 'chuva', label: 'Chuva', emoji: '🌧️' },
];

function hojeISO() { return new Date().toISOString().slice(0, 10); }
function formatData(d: string | null): string {
  if (!d) return '—';
  return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR');
}
function climaLabel(c: RdoClima | null) {
  const x = CLIMAS.find(k => k.key === c);
  return x ? `${x.emoji} ${x.label}` : '—';
}
function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function DiarioObraScreen({ route }: AppScreenProps<'DiarioObra'>) {
  const { obraId, obraNome } = route.params;
  const { pessoa } = useAuth();
  const { membros } = useObraMembros(obraId);

  const [rdos, setRdos] = useState<Rdo[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [vendo, setVendo] = useState<Rdo | null>(null);
  const [imagemAberta, setImagemAberta] = useState<string | null>(null);

  // Formulário
  const [editId, setEditId] = useState<string | null>(null);
  const [data, setData] = useState(hojeISO());
  const [clima, setClima] = useState<RdoClima | null>('bom');
  const [condicao, setCondicao] = useState<RdoCondicao | null>('trabalhou');
  const [presentes, setPresentes] = useState<string[]>([]);
  const [externos, setExternos] = useState<RdoExterno[]>([]);
  const [extNome, setExtNome] = useState('');
  const [extFuncao, setExtFuncao] = useState('');
  const [atividades, setAtividades] = useState('');
  const [ocorrencias, setOcorrencias] = useState('');
  const [itensSel, setItensSel] = useState<RdoItem[]>([]);
  const [fotos, setFotos] = useState<string[]>([]);
  const [uploadingFoto, setUploadingFoto] = useState(false);

  // Itens da obra (etapas/materiais/contratações) pro checklist do dia
  const [itensObra, setItensObra] = useState<ItemObra[]>([]);
  // Fotos já anexadas a cada item (chave `${tipo}:${id}`) — puxadas pro RDO.
  const [fotosPorItem, setFotosPorItem] = useState<Record<string, string[]>>({});

  const carregar = useCallback(async () => {
    const { data: d, error } = await supabase
      .from('rdo')
      .select('*')
      .eq('obra_id', obraId)
      .eq('deletado', false)
      .order('data', { ascending: false });
    if (!error && d) setRdos(d as Rdo[]);
    setLoading(false);
  }, [obraId]);

  const carregarItens = useCallback(async () => {
    const [eRes, mRes, cRes] = await Promise.all([
      supabase.from('etapas').select('id, nome, descricao, concluida, data_conclusao_real').eq('obra_id', obraId).eq('deletado', false),
      supabase.from('materiais').select('id, nome, descricao, recebido, data_recebimento_real').eq('obra_id', obraId).eq('deletado', false),
      supabase.from('contratacoes').select('id, nome, descricao, data_conclusao_real').eq('obra_id', obraId).eq('deletado', false),
    ]);
    const lista: ItemObra[] = [
      ...((eRes.data ?? []) as any[]).map(x => ({ tipo: 'etapa' as const, id: x.id, nome: x.nome, descricao: x.descricao ?? null, dataConclusao: x.concluida ? x.data_conclusao_real : null })),
      ...((mRes.data ?? []) as any[]).map(x => ({ tipo: 'material' as const, id: x.id, nome: x.nome, descricao: x.descricao ?? null, dataConclusao: x.recebido ? x.data_recebimento_real : null })),
      ...((cRes.data ?? []) as any[]).map(x => ({ tipo: 'contratacao' as const, id: x.id, nome: x.nome, descricao: x.descricao ?? null, dataConclusao: x.data_conclusao_real })),
    ];
    setItensObra(lista);

    // Fotos já anexadas aos itens (pra puxar pro RDO sem reupload).
    const { data: mid } = await supabase
      .from('midias')
      .select('item_tipo, item_id, storage_path, tipo')
      .eq('obra_id', obraId)
      .eq('tipo', 'foto');
    const mapa: Record<string, string[]> = {};
    ((mid ?? []) as any[]).forEach(m => {
      const key = `${m.item_tipo}:${m.item_id}`;
      (mapa[key] ??= []).push(midiaPublicUrl(m.storage_path));
    });
    setFotosPorItem(mapa);
  }, [obraId]);

  function fotosDoItem(i: { tipo: string; id: string }): string[] {
    return fotosPorItem[`${i.tipo}:${i.id}`] ?? [];
  }

  useEffect(() => { carregar(); carregarItens(); }, [carregar, carregarItens]);

  function nomeMembro(id: string): string {
    return membros.find(m => m.pessoa_id === id)?.nome ?? 'Membro';
  }

  // Itens cuja conclusão caiu nesta data (pré-marcados automaticamente).
  function itensConcluidosEm(dia: string): RdoItem[] {
    return itensObra
      .filter(i => i.dataConclusao && i.dataConclusao.slice(0, 10) === dia)
      .map(i => ({ tipo: i.tipo, id: i.id, nome: i.nome, descricao: i.descricao }));
  }

  function abrirNovo() {
    const hoje = hojeISO();
    setEditId(null);
    setData(hoje);
    setClima('bom');
    setCondicao('trabalhou');
    setPresentes([]);
    setExternos([]);
    setExtNome('');
    setExtFuncao('');
    setAtividades('');
    setOcorrencias('');
    setItensSel(itensConcluidosEm(hoje)); // já marca o que foi concluído hoje
    setFotos([]);
    setModalAberto(true);
  }

  function abrirEdicao(r: Rdo) {
    setEditId(r.id);
    setData(r.data);
    setClima(r.clima);
    setCondicao(r.condicao);
    setPresentes(r.membros_presentes ?? []);
    setExternos(r.externos ?? []);
    setExtNome('');
    setExtFuncao('');
    setAtividades(r.atividades ?? '');
    setOcorrencias(r.ocorrencias ?? '');
    setItensSel(r.itens ?? []);
    setFotos(r.fotos ?? []);
    setModalAberto(true);
  }

  function isItemSel(i: ItemObra) {
    return itensSel.some(s => s.tipo === i.tipo && s.id === i.id);
  }

  function toggleItem(i: ItemObra) {
    setItensSel(sel =>
      sel.some(s => s.tipo === i.tipo && s.id === i.id)
        ? sel.filter(s => !(s.tipo === i.tipo && s.id === i.id))
        : [...sel, { tipo: i.tipo, id: i.id, nome: i.nome, descricao: i.descricao }],
    );
  }

  async function adicionarFoto() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== 'granted') {
      Alert.alert('Permissão', 'Permita o acesso às fotos pra anexar.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', quality: 0.6 });
    if (res.canceled || !res.assets?.[0]) return;
    setUploadingFoto(true);
    try {
      const url = await uploadRdoFoto(obraId, res.assets[0]);
      setFotos(f => [...f, url]);
    } catch (e: unknown) {
      Alert.alert('Erro', e instanceof Error ? e.message : 'Não foi possível enviar a foto.');
    } finally {
      setUploadingFoto(false);
    }
  }

  function removerFoto(url: string) {
    setFotos(f => f.filter(x => x !== url));
  }

  function togglePresente(id: string) {
    setPresentes(p => (p.includes(id) ? p.filter(x => x !== id) : [...p, id]));
  }

  function addExterno() {
    const nome = extNome.trim();
    if (!nome) return;
    setExternos(e => [...e, { nome, funcao: extFuncao.trim() || null }]);
    setExtNome('');
    setExtFuncao('');
  }

  function removeExterno(i: number) {
    setExternos(e => e.filter((_, idx) => idx !== i));
  }

  async function salvar() {
    setSalvando(true);
    try {
      // Junta as fotos do dia (manuais) com as já anexadas aos itens marcados.
      const fotosItens = itensSel.flatMap(s => fotosDoItem(s));
      const fotosFinal = Array.from(new Set([...fotos, ...fotosItens]));

      const payload = {
        obra_id: obraId,
        data,
        clima,
        condicao,
        membros_presentes: presentes,
        externos,
        itens: itensSel,
        fotos: fotosFinal,
        atividades: atividades.trim() || null,
        ocorrencias: ocorrencias.trim() || null,
        atualizado_em: new Date().toISOString(),
      };
      let error;
      if (editId) {
        ({ error } = await supabase.from('rdo').update(payload).eq('id', editId));
      } else {
        ({ error } = await supabase.from('rdo').insert({ ...payload, criado_por: pessoa?.id ?? null }));
      }
      if (error) throw error;
      setModalAberto(false);
      await carregar();
    } catch (e: unknown) {
      Alert.alert('Erro', e instanceof Error ? e.message : 'Não foi possível salvar o RDO.');
    } finally {
      setSalvando(false);
    }
  }

  function excluir(r: Rdo) {
    Alert.alert('Excluir RDO', `Excluir o relatório de ${formatData(r.data)}?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('rdo').update({ deletado: true }).eq('id', r.id);
          carregar();
        },
      },
    ]);
  }

  async function exportarPdf(r: Rdo) {
    try {
      const html = montarHtmlRdo(r, obraNome, presentesNomes(r), r.externos ?? []);
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: `RDO ${formatData(r.data)}` });
      }
    } catch (e: unknown) {
      Alert.alert('Erro', e instanceof Error ? e.message : 'Não foi possível gerar o PDF.');
    }
  }

  function presentesNomes(r: Rdo): string[] {
    return (r.membros_presentes ?? []).map(nomeMembro);
  }

  const totalEfetivo = (r: Rdo) => (r.membros_presentes?.length ?? 0) + (r.externos?.length ?? 0);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <ScrollView contentContainerStyle={styles.list}>
        <Pressable style={styles.btnNovo} onPress={abrirNovo}>
          <Text style={styles.btnNovoText}>➕  Novo RDO (hoje)</Text>
        </Pressable>

        {rdos.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>📒</Text>
            <Text style={styles.emptyTitle}>Nenhum diário ainda</Text>
            <Text style={styles.emptyText}>
              Registre o dia a dia da obra: clima, equipe presente, atividades e ocorrências.
            </Text>
          </View>
        ) : (
          rdos.map(r => (
            <View key={r.id} style={styles.card}>
              <View style={styles.cardTop}>
                <Text style={styles.cardData}>{formatData(r.data)}</Text>
                <View style={styles.badgeRow}>
                  <View style={styles.badge}><Text style={styles.badgeText}>{climaLabel(r.clima)}</Text></View>
                  <View style={[styles.badge, r.condicao === 'parou' ? styles.badgeWarn : styles.badgeOk]}>
                    <Text style={[styles.badgeText, { color: r.condicao === 'parou' ? colors.warning : colors.success }]}>
                      {r.condicao === 'parou' ? 'Parou' : 'Trabalhou'}
                    </Text>
                  </View>
                </View>
              </View>

              <Text style={styles.cardMeta}>👷 Efetivo: {totalEfetivo(r)} pessoa(s)</Text>
              {(r.itens?.length ?? 0) > 0 ? <Text style={styles.cardMeta}>✅ {r.itens.length} item(ns) marcado(s)</Text> : null}
              {(r.fotos?.length ?? 0) > 0 ? <Text style={styles.cardMeta}>📷 {r.fotos.length} foto(s)</Text> : null}
              {r.atividades ? <Text style={styles.cardAtiv} numberOfLines={2}>📋 {r.atividades}</Text> : null}
              {r.ocorrencias ? <Text style={styles.cardOcor} numberOfLines={2}>⚠️ {r.ocorrencias}</Text> : null}

              <View style={styles.cardActions}>
                <Pressable style={styles.actBtn} onPress={() => setVendo(r)}>
                  <Text style={styles.actBtnText}>👁 Ver</Text>
                </Pressable>
                <Pressable style={styles.actBtn} onPress={() => abrirEdicao(r)}>
                  <Text style={styles.actBtnText}>✏️ Editar</Text>
                </Pressable>
                <Pressable style={styles.actBtn} onPress={() => exportarPdf(r)}>
                  <Text style={styles.actBtnText}>📄 PDF</Text>
                </Pressable>
                <Pressable style={styles.actBtn} onPress={() => excluir(r)}>
                  <Text style={[styles.actBtnText, { color: colors.danger }]}>🗑️</Text>
                </Pressable>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* Modal de formulário */}
      <Modal visible={modalAberto} animationType="slide" transparent onRequestClose={() => setModalAberto(false)}>
        <Pressable style={styles.overlay} onPress={() => setModalAberto(false)} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.sheetTitle}>{editId ? 'Editar RDO' : 'Novo RDO'}</Text>

          <ScrollView style={{ maxHeight: '88%' }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <DateField label="Data" value={data || null} onChange={d => setData(d ?? hojeISO())} />

            <Text style={styles.label}>Clima</Text>
            <View style={styles.toggleRow}>
              {CLIMAS.map(c => (
                <Pressable
                  key={c.key}
                  style={[styles.toggle, clima === c.key && styles.toggleAtivo]}
                  onPress={() => setClima(c.key)}
                >
                  <Text style={[styles.toggleText, clima === c.key && styles.toggleTextAtivo]}>{c.emoji} {c.label}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.label}>A obra hoje</Text>
            <View style={styles.toggleRow}>
              <Pressable style={[styles.toggle, condicao === 'trabalhou' && styles.toggleAtivo]} onPress={() => setCondicao('trabalhou')}>
                <Text style={[styles.toggleText, condicao === 'trabalhou' && styles.toggleTextAtivo]}>✅ Trabalhou</Text>
              </Pressable>
              <Pressable style={[styles.toggle, condicao === 'parou' && styles.toggleAtivo]} onPress={() => setCondicao('parou')}>
                <Text style={[styles.toggleText, condicao === 'parou' && styles.toggleTextAtivo]}>🛑 Parou</Text>
              </Pressable>
            </View>

            <Text style={styles.label}>Equipe presente</Text>
            {membros.length === 0 ? (
              <Text style={styles.hint}>Nenhum membro cadastrado nesta obra ainda.</Text>
            ) : (
              membros.map(m => {
                const on = presentes.includes(m.pessoa_id);
                return (
                  <Pressable key={m.pessoa_id} style={styles.memberRow} onPress={() => togglePresente(m.pessoa_id)}>
                    <View style={[styles.checkbox, on && styles.checkboxOn]}>
                      {on ? <Text style={styles.checkboxMark}>✓</Text> : null}
                    </View>
                    <Text style={styles.memberNome}>{m.nome}</Text>
                  </Pressable>
                );
              })
            )}

            <Text style={styles.label}>Trabalhadores fora do app</Text>
            <Text style={styles.hint}>Adicione quem trabalhou hoje e não tem cadastro.</Text>
            {externos.map((ex, i) => (
              <View key={`${ex.nome}-${i}`} style={styles.extRow}>
                <Text style={styles.extNome}>
                  {ex.nome}{ex.funcao ? ` · ${ex.funcao}` : ''}
                </Text>
                <Pressable onPress={() => removeExterno(i)} hitSlop={8}>
                  <Text style={styles.extRemover}>✕</Text>
                </Pressable>
              </View>
            ))}
            <View style={styles.extAddRow}>
              <TextInput
                style={[styles.input, { flex: 2 }]}
                value={extNome}
                onChangeText={setExtNome}
                placeholder="Nome"
                placeholderTextColor={colors.textMuted}
              />
              <TextInput
                style={[styles.input, { flex: 1.5 }]}
                value={extFuncao}
                onChangeText={setExtFuncao}
                placeholder="Função"
                placeholderTextColor={colors.textMuted}
              />
              <Pressable style={styles.extAddBtn} onPress={addExterno}>
                <Text style={styles.extAddBtnText}>＋</Text>
              </Pressable>
            </View>

            <Text style={styles.label}>O que foi feito hoje</Text>
            <Text style={styles.hint}>Marque o que avançou. O que foi concluído nesta data já vem marcado.</Text>
            {itensObra.length === 0 ? (
              <Text style={styles.hint}>Nenhuma etapa, material ou contratação cadastrada ainda.</Text>
            ) : (
              (['etapa', 'material', 'contratacao'] as const).map(tipo => {
                const doTipo = itensObra.filter(i => i.tipo === tipo);
                if (!doTipo.length) return null;
                return (
                  <View key={tipo}>
                    <Text style={styles.grupoLabel}>{TIPO_LABEL[tipo]}</Text>
                    {doTipo.map(i => {
                      const on = isItemSel(i);
                      return (
                        <Pressable key={i.id} style={styles.itemRow} onPress={() => toggleItem(i)}>
                          <View style={[styles.checkbox, on && styles.checkboxOn]}>
                            {on ? <Text style={styles.checkboxMark}>✓</Text> : null}
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.memberNome}>
                              {i.nome}
                              {fotosDoItem(i).length > 0 ? <Text style={styles.itemFotoTag}>  📷 {fotosDoItem(i).length}</Text> : null}
                            </Text>
                            {i.descricao ? <Text style={styles.itemDesc} numberOfLines={2}>{i.descricao}</Text> : null}
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                );
              })
            )}

            <Text style={styles.label}>Anotações livres (opcional)</Text>
            <TextInput
              style={[styles.input, styles.textarea]}
              value={atividades}
              onChangeText={setAtividades}
              placeholder="Detalhes do que foi executado, além dos itens marcados..."
              placeholderTextColor={colors.textMuted}
              multiline
            />

            <Text style={styles.label}>Ocorrências / observações</Text>
            <TextInput
              style={[styles.input, styles.textarea]}
              value={ocorrencias}
              onChangeText={setOcorrencias}
              placeholder="Atrasos, visitas, problemas... (opcional)"
              placeholderTextColor={colors.textMuted}
              multiline
            />

            <Text style={styles.label}>Fotos do dia</Text>
            <Text style={styles.hint}>As fotos já anexadas às tarefas marcadas (📷) entram automaticamente. Adicione abaixo só fotos extras.</Text>
            <View style={styles.fotosWrap}>
              {fotos.map(url => (
                <View key={url} style={styles.fotoThumbWrap}>
                  <Pressable onPress={() => setImagemAberta(url)}>
                    <Image source={{ uri: url }} style={styles.fotoThumb} />
                  </Pressable>
                  <Pressable style={styles.fotoRemover} onPress={() => removerFoto(url)} hitSlop={6}>
                    <Text style={styles.fotoRemoverText}>✕</Text>
                  </Pressable>
                </View>
              ))}
              <Pressable style={styles.fotoAdd} onPress={adicionarFoto} disabled={uploadingFoto}>
                {uploadingFoto ? <ActivityIndicator color={colors.primary} /> : <Text style={styles.fotoAddText}>＋</Text>}
              </Pressable>
            </View>

            <View style={styles.footer}>
              <Pressable style={[styles.footerBtn, styles.footerCancel]} onPress={() => setModalAberto(false)}>
                <Text style={styles.footerCancelText}>Cancelar</Text>
              </Pressable>
              <Pressable
                style={[styles.footerBtn, styles.footerSave, { opacity: salvando ? 0.5 : 1 }]}
                disabled={salvando}
                onPress={salvar}
              >
                <Text style={styles.footerSaveText}>{salvando ? 'Salvando...' : 'Salvar RDO'}</Text>
              </Pressable>
            </View>
            <View style={{ height: spacing.lg }} />
          </ScrollView>
        </View>
      </Modal>

      {/* Modal de visualização (somente leitura) */}
      <Modal visible={!!vendo} animationType="slide" transparent onRequestClose={() => setVendo(null)}>
        <Pressable style={styles.overlay} onPress={() => setVendo(null)} />
        {vendo && (
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>RDO — {formatData(vendo.data)}</Text>

            <ScrollView style={{ maxHeight: '84%' }} showsVerticalScrollIndicator={false}>
              <View style={styles.badgeRow}>
                <View style={styles.badge}><Text style={styles.badgeText}>{climaLabel(vendo.clima)}</Text></View>
                <View style={[styles.badge, vendo.condicao === 'parou' ? styles.badgeWarn : styles.badgeOk]}>
                  <Text style={[styles.badgeText, { color: vendo.condicao === 'parou' ? colors.warning : colors.success }]}>
                    {vendo.condicao === 'parou' ? '🛑 Parou' : '✅ Trabalhou'}
                  </Text>
                </View>
              </View>

              <Text style={styles.label}>Equipe presente</Text>
              {(vendo.membros_presentes ?? []).length === 0 && (vendo.externos ?? []).length === 0 ? (
                <Text style={styles.viewText}>—</Text>
              ) : (
                <>
                  {(vendo.membros_presentes ?? []).map(id => (
                    <Text key={id} style={styles.viewText}>• {nomeMembro(id)}</Text>
                  ))}
                  {(vendo.externos ?? []).map((ex, i) => (
                    <Text key={`e-${i}`} style={styles.viewText}>• {ex.nome}{ex.funcao ? ` — ${ex.funcao}` : ''} (fora do app)</Text>
                  ))}
                </>
              )}

              <Text style={styles.label}>O que foi feito hoje</Text>
              {(vendo.itens ?? []).length === 0 ? (
                <Text style={styles.viewText}>—</Text>
              ) : (
                (vendo.itens ?? []).map((it, i) => (
                  <View key={`it-${i}`} style={{ marginBottom: spacing.xs }}>
                    <Text style={styles.viewText}>✅ {it.nome}</Text>
                    {it.descricao ? <Text style={styles.itemDesc}>{it.descricao}</Text> : null}
                  </View>
                ))
              )}

              <Text style={styles.label}>Anotações</Text>
              <Text style={styles.viewText}>{vendo.atividades || '—'}</Text>

              <Text style={styles.label}>Ocorrências / observações</Text>
              <Text style={styles.viewText}>{vendo.ocorrencias || '—'}</Text>

              <Text style={styles.label}>Fotos do dia</Text>
              {(vendo.fotos ?? []).length === 0 ? (
                <Text style={styles.viewText}>Sem fotos.</Text>
              ) : (
                <View style={styles.fotosWrap}>
                  {(vendo.fotos ?? []).map(url => (
                    <Pressable key={url} onPress={() => setImagemAberta(url)}>
                      <Image source={{ uri: url }} style={styles.fotoThumb} />
                    </Pressable>
                  ))}
                </View>
              )}

              <View style={styles.footer}>
                <Pressable style={[styles.footerBtn, styles.footerCancel]} onPress={() => setVendo(null)}>
                  <Text style={styles.footerCancelText}>Fechar</Text>
                </Pressable>
                <Pressable style={[styles.footerBtn, styles.footerSave]} onPress={() => exportarPdf(vendo)}>
                  <Text style={styles.footerSaveText}>📄 Gerar PDF</Text>
                </Pressable>
              </View>
              <View style={{ height: spacing.lg }} />
            </ScrollView>
          </View>
        )}
      </Modal>

      {/* Visualizador de imagem em tela cheia */}
      <ImageViewerModal uri={imagemAberta} onClose={() => setImagemAberta(null)} />
    </View>
  );
}

function montarHtmlRdo(r: Rdo, obraNome: string, membrosNomes: string[], externos: RdoExterno[]): string {
  const efetivoMembros = membrosNomes.map(n => `<li>${escapeHtml(n)}</li>`).join('') || '<li style="color:#888">Nenhum membro marcado</li>';
  const efetivoExternos = externos.map(e => `<li>${escapeHtml(e.nome)}${e.funcao ? ` — ${escapeHtml(e.funcao)}` : ''}</li>`).join('') || '<li style="color:#888">Nenhum</li>';
  const total = membrosNomes.length + externos.length;
  const itensHtml = (r.itens ?? []).length
    ? (r.itens ?? []).map(i =>
        `<li><strong>${escapeHtml(i.nome)}</strong> <span style="color:#888;font-size:11px">(${i.tipo})</span>` +
        `${i.descricao ? `<div style="color:#444;font-size:12px;margin-top:2px">${escapeHtml(i.descricao)}</div>` : ''}</li>`,
      ).join('')
    : '<li style="color:#888">Nenhum item marcado</li>';
  const fotosHtml = (r.fotos ?? []).length
    ? `<div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:8px">${(r.fotos ?? []).map(u => `<img src="${u}" style="width:170px;height:170px;object-fit:cover;border-radius:8px;border:1px solid #EAE0D5" />`).join('')}</div>`
    : '<p style="color:#888">Sem fotos.</p>';
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8" />
<style>
  body { font-family: -apple-system, Roboto, sans-serif; color: #1A2B5E; padding: 32px; }
  .hdr { border-bottom: 3px solid #F07000; padding-bottom: 12px; margin-bottom: 20px; }
  .hdr h1 { margin: 0; font-size: 22px; }
  .hdr p { margin: 4px 0 0; color: #6B7280; font-size: 13px; }
  .row { display: flex; gap: 24px; margin-bottom: 16px; }
  .box { background: #FAFAF8; border: 1px solid #EAE0D5; border-radius: 10px; padding: 12px 16px; flex: 1; }
  .box .lbl { font-size: 11px; color: #6B7280; text-transform: uppercase; font-weight: 700; }
  .box .val { font-size: 16px; font-weight: 700; margin-top: 2px; }
  h2 { font-size: 14px; text-transform: uppercase; color: #6B7280; border-bottom: 1px solid #EAE0D5; padding-bottom: 4px; margin-top: 22px; }
  ul { margin: 8px 0; padding-left: 20px; }
  p.txt { white-space: pre-wrap; line-height: 1.5; }
</style></head><body>
  <div class="hdr">
    <h1>📒 Relatório Diário de Obra</h1>
    <p>${escapeHtml(obraNome)} — ${formatData(r.data)}</p>
  </div>
  <div class="row">
    <div class="box"><div class="lbl">Clima</div><div class="val">${climaLabel(r.clima)}</div></div>
    <div class="box"><div class="lbl">Condição</div><div class="val">${r.condicao === 'parou' ? '🛑 Parou' : '✅ Trabalhou'}</div></div>
    <div class="box"><div class="lbl">Efetivo</div><div class="val">${total} pessoa(s)</div></div>
  </div>
  <h2>Equipe presente (app)</h2>
  <ul>${efetivoMembros}</ul>
  <h2>Trabalhadores fora do app</h2>
  <ul>${efetivoExternos}</ul>
  <h2>O que foi feito hoje</h2>
  <ul>${itensHtml}</ul>
  <h2>Anotações</h2>
  <p class="txt">${r.atividades ? escapeHtml(r.atividades) : '—'}</p>
  <h2>Ocorrências / observações</h2>
  <p class="txt">${r.ocorrencias ? escapeHtml(r.ocorrencias) : '—'}</p>
  <h2>Fotos do dia</h2>
  ${fotosHtml}
</body></html>`;
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.surface },
  list: { padding: spacing.md, paddingBottom: 60 },

  btnNovo: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  btnNovoText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  empty: { alignItems: 'center', paddingTop: spacing.xl * 2, paddingHorizontal: spacing.lg },
  emptyEmoji: { fontSize: 52, marginBottom: spacing.md },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.navy, marginBottom: spacing.sm },
  emptyText: { fontSize: 14, color: colors.textMuted, textAlign: 'center', lineHeight: 20 },

  card: {
    backgroundColor: colors.background,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderNeutral,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs },
  cardData: { fontSize: 16, fontWeight: '800', color: colors.navy },
  badgeRow: { flexDirection: 'row', gap: spacing.xs },
  badge: { backgroundColor: colors.surface, borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 3 },
  badgeOk: { backgroundColor: colors.success + '18' },
  badgeWarn: { backgroundColor: colors.warning + '22' },
  badgeText: { fontSize: 12, fontWeight: '700', color: colors.navy },
  cardMeta: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  cardAtiv: { fontSize: 13, color: colors.text, marginTop: 4 },
  cardOcor: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  cardActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.borderNeutral, paddingTop: spacing.sm },
  actBtn: { paddingVertical: 4, paddingHorizontal: 8 },
  actBtnText: { fontSize: 14, fontWeight: '600', color: colors.navy },

  // Modal
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    maxHeight: '92%',
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.borderNeutral, alignSelf: 'center', marginBottom: spacing.md },
  sheetTitle: { fontSize: 20, fontWeight: '800', color: colors.navy, marginBottom: spacing.sm },

  label: { fontSize: 13, fontWeight: '700', color: colors.navy, marginTop: spacing.md, marginBottom: spacing.xs },
  hint: { fontSize: 12, color: colors.textMuted, marginBottom: spacing.xs },
  viewText: { fontSize: 15, color: colors.text, lineHeight: 21 },

  toggleRow: { flexDirection: 'row', gap: spacing.sm },
  toggle: {
    flex: 1,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.borderNeutral,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  toggleAtivo: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  toggleText: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  toggleTextAtivo: { color: colors.primary },

  grupoLabel: { fontSize: 12, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: spacing.sm, marginBottom: 2 },
  fotosWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xs },
  fotoThumbWrap: { position: 'relative' },
  fotoThumb: { width: 80, height: 80, borderRadius: radius.sm, backgroundColor: colors.surface },
  fotoRemover: { position: 'absolute', top: -6, right: -6, width: 22, height: 22, borderRadius: 11, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center' },
  fotoRemoverText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  fotoAdd: { width: 80, height: 80, borderRadius: radius.sm, borderWidth: 1.5, borderColor: colors.primary, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primaryLight },
  fotoAddText: { fontSize: 30, color: colors.primary, fontWeight: '300' },
  memberRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, gap: spacing.sm },
  itemRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: spacing.sm, gap: spacing.sm },
  itemDesc: { fontSize: 12, color: colors.textMuted, marginTop: 2, lineHeight: 16 },
  itemFotoTag: { fontSize: 12, color: colors.primary, fontWeight: '700' },
  checkbox: { width: 24, height: 24, borderRadius: 6, borderWidth: 1.5, borderColor: colors.borderNeutral, alignItems: 'center', justifyContent: 'center' },
  checkboxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkboxMark: { color: '#fff', fontSize: 14, fontWeight: '800' },
  memberNome: { fontSize: 15, color: colors.navy },

  extRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.surface, borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: spacing.sm, marginBottom: spacing.xs },
  extNome: { fontSize: 14, color: colors.navy, flex: 1 },
  extRemover: { fontSize: 16, color: colors.danger, fontWeight: '700', paddingHorizontal: 6 },
  extAddRow: { flexDirection: 'row', gap: spacing.xs, alignItems: 'center', marginTop: spacing.xs },
  extAddBtn: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  extAddBtnText: { color: '#fff', fontSize: 24, fontWeight: '700', lineHeight: 26 },

  input: {
    borderWidth: 1.5,
    borderColor: colors.borderNeutral,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontSize: 15,
    color: colors.text,
    backgroundColor: '#fff',
  },
  textarea: { height: 80, textAlignVertical: 'top' },

  footer: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  footerBtn: { flex: 1, height: 50, borderRadius: radius.md, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  footerCancel: { backgroundColor: '#fff', borderColor: colors.borderNeutral },
  footerSave: { backgroundColor: colors.primary, borderColor: colors.primary },
  footerCancelText: { fontSize: 15, fontWeight: '700', color: colors.navy },
  footerSaveText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
