import { useEffect, useState } from 'react';
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
import { TEMPLATES_ESPECIALIDADES, TEMPLATES_CONTRATACOES } from '@/lib/templates';
import { useTemplateSugestoes } from '@/hooks/useTemplateSugestoes';
import type { Contratacao, ContratacaoStatus } from '@/types/database';
import type { AppScreenProps } from '@/navigation/types';

const STATUSES: { value: ContratacaoStatus; label: string }[] = [
  { value: 'pendente', label: 'Pendente' },
  { value: 'em_andamento', label: 'Em andamento' },
  { value: 'concluida', label: 'Concluída' },
  { value: 'pausada', label: 'Pausada' },
  { value: 'cancelada', label: 'Cancelada' },
];

export function ContratacaoFormScreen({ route, navigation }: AppScreenProps<'ContratacaoForm'>) {
  const { obraId, contratacaoId } = route.params;
  const isEdit = !!contratacaoId;
  const weatherAlert = useWeatherAlert();
  const { pessoa } = useAuth();
  const { sugestoes: sugestoesContratacao, registrarNovaSugestao: registrarContratacao } = useTemplateSugestoes('contratacao');
  const { sugestoes: sugestoesEspecialidade, registrarNovaSugestao: registrarEspecialidade } = useTemplateSugestoes('especialidade');

  const [nome, setNome] = useState('');
  const [especialidade, setEspecialidade] = useState('');
  const [pessoaNome, setPessoaNome] = useState('');
  const [pessoaContato, setPessoaContato] = useState('');
  const [dataPrevisaoFim, setDataPrevisaoFim] = useState('');
  const [valor, setValor] = useState('');
  const [obs, setObs] = useState('');
  const [status, setStatus] = useState<ContratacaoStatus>('pendente');
  const [fotos, setFotos] = useState<ImagePicker.ImagePickerAsset[]>([]);
  const [categoriaAtraso, setCategoriaAtraso] = useState<CategoriaAtraso | null>(null);
  const [motivoAtraso, setMotivoAtraso] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingInitial, setLoadingInitial] = useState(isEdit);

  useEffect(() => {
    navigation.setOptions({ title: isEdit ? 'Editar contratação' : 'Nova contratação' });
  }, [navigation, isEdit]);

  useEffect(() => {
    if (!contratacaoId) return;
    (async () => {
      const { data, error } = await supabase
        .from('contratacoes')
        .select('*')
        .eq('id', contratacaoId)
        .single();
      if (error || !data) { navigation.goBack(); return; }
      const c = data as Contratacao;
      setNome(c.nome);
      setEspecialidade(c.especialidade ?? '');
      setPessoaNome(c.pessoa_nome ?? '');
      setPessoaContato(c.pessoa_contato ?? '');
      setDataPrevisaoFim(c.data_previsao_fim ?? '');
      setValor(c.valor != null ? String(c.valor) : '');
      setObs(c.obs ?? '');
      setStatus(c.status);
      setCategoriaAtraso(((c as Contratacao & { categoria_atraso?: string | null }).categoria_atraso as CategoriaAtraso) ?? null);
      setMotivoAtraso((c as Contratacao & { motivo_atraso?: string | null }).motivo_atraso ?? '');
      setLoadingInitial(false);
    })();
  }, [contratacaoId, navigation]);

  const onSalvar = async () => {
    if (!nome.trim()) {
      Alert.alert('Atenção', 'O nome da contratação é obrigatório.');
      return;
    }

    // Contratação atrasada → exige o motivo (fica gravado no relatório executivo).
    const hojeStr = new Date().toISOString().slice(0, 10);
    const estaAtrasada = !!dataPrevisaoFim.trim() && dataPrevisaoFim.trim() < hojeStr && status !== 'cancelada';
    if (estaAtrasada) {
      if (!categoriaAtraso) {
        Alert.alert('Motivo do atraso', 'Esta contratação está atrasada. Informe a causa antes de salvar.');
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

      const weatherResult = await weatherAlert.checkAndPrompt(nome, especialidade || null);
      const bloqueadaPeloChuva = weatherResult === 'blocked';

      const hoje = new Date().toISOString().slice(0, 10);
      const statusFinal: ContratacaoStatus = bloqueadaPeloChuva ? 'pausada' : status;
      const notaClima = bloqueadaPeloChuva
        ? `⛈️ Pausada em ${new Date().toLocaleDateString('pt-BR')} — condições climáticas (chuva)`
        : '';
      const obsFinal = [obs.trim(), notaClima].filter(Boolean).join('\n') || null;

      const payload = {
        obra_id: obraId,
        nome: nome.trim(),
        especialidade: especialidade.trim() || null,
        pessoa_nome: pessoaNome.trim() || null,
        pessoa_contato: pessoaContato.trim() || null,
        data_previsao_fim: dataPrevisaoFim.trim() || null,
        valor: valor.trim() ? parseFloat(valor.replace(',', '.')) : null,
        obs: obsFinal,
        status: statusFinal,
        data_conclusao: statusFinal === 'concluida' ? hoje : null,
        categoria_atraso: estaAtrasada ? categoriaAtraso : null,
        motivo_atraso: estaAtrasada ? (motivoAtraso.trim() || null) : null,
      };
      let savedId: string;
      if (isEdit) {
        const { error } = await supabase.from('contratacoes').update(payload).eq('id', contratacaoId!);
        if (error) throw error;
        savedId = contratacaoId!;
      } else {
        const { data: nova, error } = await supabase.from('contratacoes').insert(payload).select('id').single();
        if (error) throw error;
        savedId = nova.id;
      }

      if (fotos.length > 0) {
        await Promise.allSettled(
          fotos.map(asset => uploadMidiaAsset(obraId, 'contratacao', savedId, asset, pessoa?.id ?? null))
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
    Alert.alert('Excluir contratação', 'A contratação será ocultada. Continuar?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          setLoading(true);
          try {
            const { error } = await supabase
              .from('contratacoes')
              .update({ deletado: true, deletado_em: new Date().toISOString() })
              .eq('id', contratacaoId!);
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
        label="O que contratar *"
        value={nome}
        onChangeText={setNome}
        placeholder="Selecione ou digite..."
        suggestions={TEMPLATES_CONTRATACOES}
        customSuggestions={sugestoesContratacao.map(s => s.texto)}
        onNewValueEntered={(novoValor) => registrarContratacao(novoValor, pessoa?.id ?? null, pessoa?.is_admin ?? false)}
      />
      <SuggestionField
        label="Especialidade"
        value={especialidade}
        onChangeText={setEspecialidade}
        placeholder="Selecione ou digite..."
        suggestions={TEMPLATES_ESPECIALIDADES}
        customSuggestions={sugestoesEspecialidade.map(s => s.texto)}
        onNewValueEntered={(novoValor) => registrarEspecialidade(novoValor, pessoa?.id ?? null, pessoa?.is_admin ?? false)}
      />
      <TextField label="Nome do prestador" value={pessoaNome} onChangeText={setPessoaNome} placeholder="Ex: João Silva" />
      <TextField
        label="Contato"
        value={pessoaContato}
        onChangeText={setPessoaContato}
        placeholder="Ex: (11) 99999-9999"
        keyboardType="phone-pad"
      />
      <DateField
        label="Prazo de conclusão"
        value={dataPrevisaoFim || null}
        onChange={d => setDataPrevisaoFim(d ?? '')}
      />
      <TextField
        label="Valor (R$)"
        value={valor}
        onChangeText={setValor}
        placeholder="Ex: 3500.00"
        keyboardType="decimal-pad"
      />
      <TextField
        label="Observações"
        value={obs}
        onChangeText={setObs}
        placeholder="Observações opcionais..."
        multiline
        numberOfLines={2}
        style={{ height: 64, textAlignVertical: 'top' }}
      />

      {isEdit && (
        <View style={styles.statusWrap}>
          <Text style={styles.statusLabel}>Status</Text>
          <View style={styles.statusRow}>
            {STATUSES.map(s => (
              <Pressable
                key={s.value}
                style={[styles.pill, status === s.value && styles.pillActive]}
                onPress={() => setStatus(s.value)}
              >
                <Text style={[styles.pillText, status === s.value && styles.pillTextActive]}>
                  {s.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {estaAtrasadaRender && (
        <MotivoAtrasoField
          titulo="⚠️ Contratação atrasada — qual o motivo?"
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
          <PrimaryButton title="Excluir contratação" variant="danger" onPress={onExcluir} loading={loading} />
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
  pillActive: { backgroundColor: '#8b5cf6', borderColor: '#8b5cf6' },
  pillText: { fontSize: 13, color: colors.text },
  pillTextActive: { color: '#fff', fontWeight: '600' },
  gap: { height: spacing.md },
  gapSm: { marginTop: spacing.sm },
});
