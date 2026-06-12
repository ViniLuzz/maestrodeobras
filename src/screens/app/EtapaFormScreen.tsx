import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { TextField } from '@/components/TextField';
import { DateField } from '@/components/DateField';
import { SuggestionField } from '@/components/SuggestionField';
import { PrimaryButton } from '@/components/PrimaryButton';
import { FotoConclusao } from '@/components/FotoConclusao';
import { supabase } from '@/lib/supabase';
import { requireOnline } from '@/lib/network';
import { uploadMidiaAsset } from '@/lib/midias';
import { useAuth } from '@/contexts/AuthContext';
import { colors, spacing } from '@/lib/theme';
import { type CategoriaAtraso } from '@/lib/atraso';
import { MotivoAtrasoField } from '@/components/MotivoAtrasoField';
import { useWeatherAlert } from '@/hooks/useWeatherAlert';
import { WeatherAlertModal } from '@/components/WeatherAlertModal';
import { TEMPLATES_ETAPAS } from '@/lib/templates';
import { useTemplateSugestoes } from '@/hooks/useTemplateSugestoes';
import type { Etapa, EtapaStatus } from '@/types/database';
import type { AppScreenProps } from '@/navigation/types';

const STATUSES: { value: EtapaStatus; label: string }[] = [
  { value: 'pendente', label: 'Pendente' },
  { value: 'em_andamento', label: 'Em andamento' },
  { value: 'concluida', label: 'Concluída' },
  { value: 'pausada', label: 'Pausada' },
  { value: 'cancelada', label: 'Cancelada' },
];

const STATUS_COLOR: Record<string, string> = {
  pendente: colors.textMuted,
  em_andamento: colors.primary,
  concluida: colors.success,
  cancelada: colors.danger,
};

type EtapaSimples = { id: string; nome: string; status: EtapaStatus };

export function EtapaFormScreen({ route, navigation }: AppScreenProps<'EtapaForm'>) {
  const { obraId, etapaId } = route.params;
  const isEdit = !!etapaId;
  const { pessoa } = useAuth();
  const weatherAlert = useWeatherAlert();
  const { sugestoes: sugestoesEtapas, registrarNovaSugestao: registrarEtapa } = useTemplateSugestoes('etapa');

  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [dataPrevisaoFim, setDataPrevisaoFim] = useState('');
  const [status, setStatus] = useState<EtapaStatus>('pendente');
  const [fotos, setFotos] = useState<ImagePicker.ImagePickerAsset[]>([]);
  const [categoriaAtraso, setCategoriaAtraso] = useState<CategoriaAtraso | null>(null);
  const [motivoAtraso, setMotivoAtraso] = useState('');

  // Pré-requisitos
  const [outrasEtapas, setOutrasEtapas] = useState<EtapaSimples[]>([]);
  const [selectedDeps, setSelectedDeps] = useState<string[]>([]);

  const [loading, setLoading] = useState(false);
  const [loadingInitial, setLoadingInitial] = useState(true);

  useEffect(() => {
    navigation.setOptions({ title: isEdit ? 'Editar etapa' : 'Nova etapa' });
  }, [navigation, isEdit]);

  const carregarDados = useCallback(async () => {
    const [etapasRes, etapaRes, depsRes] = await Promise.all([
      // Todas as outras etapas da obra (para selecionar como pré-requisito)
      supabase
        .from('etapas')
        .select('id, nome, status')
        .eq('obra_id', obraId)
        .eq('deletado', false)
        .neq('id', etapaId ?? '00000000-0000-0000-0000-000000000000')
        .order('ordem', { ascending: true })
        .order('criado_em', { ascending: true }),
      // Dados da etapa atual (edit mode)
      etapaId
        ? supabase.from('etapas').select('*').eq('id', etapaId).single()
        : Promise.resolve({ data: null, error: null }),
      // Dependências atuais (edit mode)
      etapaId
        ? supabase.from('etapa_dependencias').select('depende_de_id').eq('etapa_id', etapaId)
        : Promise.resolve({ data: [], error: null }),
    ]);

    setOutrasEtapas((etapasRes.data as EtapaSimples[]) ?? []);

    if (etapaId && etapaRes.data) {
      const e = etapaRes.data as Etapa;
      setNome(e.nome);
      setDescricao(e.descricao ?? '');
      setDataPrevisaoFim(e.data_previsao_fim ?? '');
      setStatus(e.status);
      setCategoriaAtraso(((e as Etapa & { categoria_atraso?: string | null }).categoria_atraso as CategoriaAtraso) ?? null);
      setMotivoAtraso((e as Etapa & { motivo_atraso?: string | null }).motivo_atraso ?? '');
    } else if (etapaId && etapaRes.error) {
      navigation.goBack();
      return;
    }

    if (depsRes.data) {
      setSelectedDeps((depsRes.data as { depende_de_id: string }[]).map(d => d.depende_de_id));
    }

    setLoadingInitial(false);
  }, [obraId, etapaId, navigation]);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  const toggleDep = (id: string) => {
    setSelectedDeps(prev =>
      prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id]
    );
  };

  // Valida se as dependências selecionadas estão todas concluídas
  const getBloqueadores = (): string[] => {
    return outrasEtapas
      .filter(e => selectedDeps.includes(e.id) && e.status !== 'concluida')
      .map(e => e.nome);
  };

  const onChangeStatus = (novoStatus: EtapaStatus) => {
    if (novoStatus === 'em_andamento' || novoStatus === 'concluida') {
      const bloqueadores = getBloqueadores();
      if (bloqueadores.length > 0) {
        Alert.alert(
          'Etapa bloqueada',
          `Para ${novoStatus === 'em_andamento' ? 'iniciar' : 'concluir'} esta etapa, os seguintes pré-requisitos precisam ser concluídos:\n\n• ${bloqueadores.join('\n• ')}`
        );
        return;
      }
    }
    setStatus(novoStatus);
  };

  const sincronizarDeps = async (etapaIdAlvo: string) => {
    // Busca deps atuais do banco
    const { data: currentDeps } = await supabase
      .from('etapa_dependencias')
      .select('id, depende_de_id')
      .eq('etapa_id', etapaIdAlvo);

    const currentMap = new Map((currentDeps ?? []).map(d => [d.depende_de_id, d.id]));
    const newSet = new Set(selectedDeps);

    // Deletar deps removidas
    const idsParaDeletar = [...currentMap.entries()]
      .filter(([depId]) => !newSet.has(depId))
      .map(([, rowId]) => rowId);

    if (idsParaDeletar.length > 0) {
      await supabase.from('etapa_dependencias').delete().in('id', idsParaDeletar);
    }

    // Inserir deps novas
    const depsParaInserir = selectedDeps
      .filter(depId => !currentMap.has(depId))
      .map(depId => ({ etapa_id: etapaIdAlvo, depende_de_id: depId }));

    if (depsParaInserir.length > 0) {
      await supabase.from('etapa_dependencias').insert(depsParaInserir);
    }
  };

  const onSalvar = async () => {
    if (!nome.trim()) {
      Alert.alert('Atenção', 'O nome da etapa é obrigatório.');
      return;
    }

    // Validação de pré-requisitos antes de salvar
    if (status === 'em_andamento' || status === 'concluida') {
      const bloqueadores = getBloqueadores();
      if (bloqueadores.length > 0) {
        Alert.alert(
          'Etapa bloqueada',
          `Não é possível salvar com este status. Os seguintes pré-requisitos precisam ser concluídos:\n\n• ${bloqueadores.join('\n• ')}`
        );
        return;
      }
    }

    // Etapa atrasada → exige o motivo (fica gravado no relatório executivo).
    const hojeStr = new Date().toISOString().slice(0, 10);
    const estaAtrasada = !!dataPrevisaoFim.trim() && dataPrevisaoFim.trim() < hojeStr && status !== 'cancelada';
    if (estaAtrasada) {
      if (!categoriaAtraso) {
        Alert.alert('Motivo do atraso', 'Esta etapa está atrasada. Informe a causa do atraso antes de salvar.');
        return;
      }
      if (categoriaAtraso === 'outro' && !motivoAtraso.trim()) {
        Alert.alert('Motivo do atraso', 'Você escolheu "Outro" — descreva o motivo do atraso.');
        return;
      }
    }

    setLoading(true);
    try {
      await requireOnline();

      const weatherResult = await weatherAlert.checkAndPrompt(nome, descricao || null);
      const bloqueadaPeloChuva = weatherResult === 'blocked';

      const hoje = new Date().toISOString().slice(0, 10);
      const statusFinal: EtapaStatus = bloqueadaPeloChuva ? 'pausada' : status;
      const notaClima = bloqueadaPeloChuva
        ? `\n⛈️ Pausada em ${new Date().toLocaleDateString('pt-BR')} — condições climáticas (chuva)`
        : '';
      const descricaoFinal = ((descricao.trim() || '') + notaClima).trim() || null;

      const payload = {
        obra_id: obraId,
        nome: nome.trim(),
        descricao: descricaoFinal,
        data_previsao_fim: dataPrevisaoFim.trim() || null,
        status: statusFinal,
        data_conclusao: statusFinal === 'concluida' ? hoje : null,
        categoria_atraso: estaAtrasada ? categoriaAtraso : null,
        motivo_atraso: estaAtrasada ? (motivoAtraso.trim() || null) : null,
      };

      let savedId: string;
      if (isEdit) {
        const { error } = await supabase.from('etapas').update(payload).eq('id', etapaId!);
        if (error) throw error;
        await sincronizarDeps(etapaId!);
        savedId = etapaId!;
      } else {
        const { data: nova, error } = await supabase
          .from('etapas')
          .insert(payload)
          .select('id')
          .single();
        if (error) throw error;
        if (selectedDeps.length > 0) {
          await supabase.from('etapa_dependencias').insert(
            selectedDeps.map(depId => ({ etapa_id: nova.id, depende_de_id: depId }))
          );
        }
        savedId = nova.id;
      }

      if (fotos.length > 0) {
        await Promise.allSettled(
          fotos.map(asset => uploadMidiaAsset(obraId, 'etapa', savedId, asset, pessoa?.id ?? null))
        );
      }
      navigation.goBack();
    } catch (e: unknown) {
      Alert.alert('Erro', e instanceof Error ? e.message : 'Erro ao salvar.');
    } finally {
      setLoading(false);
    }
  };

  const onExcluir = () => {
    Alert.alert('Excluir etapa', 'A etapa será ocultada. Continuar?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          setLoading(true);
          try {
            const { error } = await supabase
              .from('etapas')
              .update({ deletado: true, deletado_em: new Date().toISOString() })
              .eq('id', etapaId!);
            if (error) throw error;
            navigation.goBack();
          } catch (e: unknown) {
            Alert.alert('Erro', e instanceof Error ? e.message : 'Erro ao excluir.');
          } finally {
            setLoading(false);
          }
        },
      },
    ]);
  };

  if (loadingInitial) return <View style={styles.center}><ActivityIndicator /></View>;

  const bloqueadores = getBloqueadores();
  const estaBloqueada = bloqueadores.length > 0;
  const hojeStrRender = new Date().toISOString().slice(0, 10);
  const estaAtrasadaRender =
    !!dataPrevisaoFim.trim() && dataPrevisaoFim.trim() < hojeStrRender && status !== 'cancelada';

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <SuggestionField
        label="Nome da etapa *"
        value={nome}
        onChangeText={setNome}
        placeholder="Selecione ou digite..."
        suggestions={TEMPLATES_ETAPAS}
        customSuggestions={sugestoesEtapas.map(s => s.texto)}
        onNewValueEntered={(novoValor) => registrarEtapa(novoValor, pessoa?.id ?? null, pessoa?.is_admin ?? false)}
      />
      <TextField
        label="Descrição"
        value={descricao}
        onChangeText={setDescricao}
        placeholder="Detalhes da etapa..."
        multiline
        numberOfLines={3}
        style={{ height: 80, textAlignVertical: 'top' }}
      />
      <DateField
        label="Previsão de conclusão"
        value={dataPrevisaoFim || null}
        onChange={d => setDataPrevisaoFim(d ?? '')}
      />

      {/* Pré-requisitos */}
      <View style={styles.sectionWrap}>
        <Text style={styles.sectionLabel}>Pré-requisitos (depende de)</Text>
        <Text style={styles.sectionHint}>
          Etapas que devem ser concluídas antes desta poder ser iniciada.
        </Text>

        {outrasEtapas.length === 0 ? (
          <Text style={styles.depsEmpty}>
            Nenhuma outra etapa cadastrada nesta obra ainda.
          </Text>
        ) : (
          outrasEtapas.map(e => {
            const selecionada = selectedDeps.includes(e.id);
            const bloqueante = selecionada && e.status !== 'concluida';
            return (
              <Pressable key={e.id} style={styles.depRow} onPress={() => toggleDep(e.id)}>
                <View style={[styles.checkbox, selecionada && styles.checkboxChecked]}>
                  {selecionada && <Text style={styles.checkmark}>✓</Text>}
                </View>
                <View style={styles.depInfo}>
                  <Text style={styles.depNome}>{e.nome}</Text>
                  <Text style={[styles.depStatus, { color: STATUS_COLOR[e.status] }]}>
                    {e.status === 'concluida' ? '✓ Concluída' : e.status === 'em_andamento' ? 'Em andamento' : e.status === 'cancelada' ? 'Cancelada' : 'Pendente'}
                    {bloqueante ? ' · bloqueante' : ''}
                  </Text>
                </View>
              </Pressable>
            );
          })
        )}
      </View>

      {/* Aviso de bloqueio */}
      {estaBloqueada && (
        <View style={styles.avisoWrap}>
          <Text style={styles.avisoText}>
            Esta etapa está bloqueada. Conclua primeiro:{'\n'}• {bloqueadores.join('\n• ')}
          </Text>
        </View>
      )}

      {/* Status (edit mode) */}
      {isEdit && (
        <View style={styles.statusWrap}>
          <Text style={styles.statusLabel}>Status</Text>
          <View style={styles.statusRow}>
            {STATUSES.map(s => {
              const bloqueado =
                estaBloqueada &&
                (s.value === 'em_andamento' || s.value === 'concluida');
              return (
                <Pressable
                  key={s.value}
                  style={[
                    styles.pill,
                    status === s.value && styles.pillActive,
                    bloqueado && styles.pillBloqueado,
                  ]}
                  onPress={() => onChangeStatus(s.value)}
                >
                  <Text
                    style={[
                      styles.pillText,
                      status === s.value && styles.pillTextActive,
                      bloqueado && styles.pillTextBloqueado,
                    ]}
                  >
                    {s.label}
                    {bloqueado ? ' 🔒' : ''}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}

      {/* Motivo do atraso — aparece quando a etapa está atrasada; fica gravado no relatório */}
      {estaAtrasadaRender && (
        <MotivoAtrasoField
          titulo="⚠️ Etapa atrasada — qual o motivo?"
          categoria={categoriaAtraso}
          motivo={motivoAtraso}
          onChangeCategoria={setCategoriaAtraso}
          onChangeMotivo={setMotivoAtraso}
        />
      )}

      {isEdit && status === 'concluida' && (
        <FotoConclusao
          fotos={fotos}
          onAdd={asset => setFotos(prev => [...prev, asset])}
          onRemove={i => setFotos(prev => prev.filter((_, idx) => idx !== i))}
        />
      )}

      <View style={styles.gap} />
      <PrimaryButton title="Salvar" onPress={onSalvar} loading={loading} />
      {isEdit && (
        <View style={styles.gapSm}>
          <PrimaryButton title="Excluir etapa" variant="danger" onPress={onExcluir} loading={loading} />
        </View>
      )}
      <WeatherAlertModal
        visible={weatherAlert.visible}
        taskName={weatherAlert.taskName}
        climaDesc={weatherAlert.climaDesc}
        onConfirm={weatherAlert.onConfirm}
        onBlock={weatherAlert.onBlock}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  container: { padding: spacing.lg },

  // Seção de pré-requisitos
  sectionWrap: { marginBottom: spacing.md },
  sectionLabel: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 4 },
  sectionHint: { fontSize: 12, color: colors.textMuted, marginBottom: spacing.sm },
  depsEmpty: { fontSize: 13, color: colors.textMuted, fontStyle: 'italic' },
  depRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  checkboxChecked: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkmark: { color: '#fff', fontSize: 13, fontWeight: '700' },
  depInfo: { flex: 1 },
  depNome: { fontSize: 14, color: colors.text, fontWeight: '500' },
  depStatus: { fontSize: 12, marginTop: 1 },

  // Aviso de bloqueio
  avisoWrap: {
    backgroundColor: '#fef3c7',
    borderRadius: 8,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  avisoText: { fontSize: 13, color: '#92400e', lineHeight: 20 },

  // Status pills
  statusWrap: { marginBottom: spacing.md },
  statusLabel: { fontSize: 14, fontWeight: '500', color: colors.text, marginBottom: spacing.sm },
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  pill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  pillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  pillBloqueado: { backgroundColor: colors.surface, borderColor: colors.border, opacity: 0.5 },
  pillText: { fontSize: 13, color: colors.text },
  pillTextActive: { color: '#fff', fontWeight: '600' },
  pillTextBloqueado: { color: colors.textMuted },

  gap: { height: spacing.md },
  gapSm: { marginTop: spacing.sm },
});
