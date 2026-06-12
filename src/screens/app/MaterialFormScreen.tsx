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
import { TEMPLATES_MATERIAIS } from '@/lib/templates';
import { useTemplateSugestoes } from '@/hooks/useTemplateSugestoes';
import type { Material, MaterialStatus } from '@/types/database';
import type { AppScreenProps } from '@/navigation/types';

const STATUSES: { value: MaterialStatus; label: string }[] = [
  { value: 'pendente', label: 'Pendente' },
  { value: 'entregue', label: 'Entregue' },
  { value: 'faltando', label: 'Faltando' },
  { value: 'pausada', label: 'Pausada' },
  { value: 'cancelado', label: 'Cancelado' },
];

export function MaterialFormScreen({ route, navigation }: AppScreenProps<'MaterialForm'>) {
  const { obraId, materialId } = route.params;
  const isEdit = !!materialId;
  const weatherAlert = useWeatherAlert();
  const { pessoa } = useAuth();
  const { sugestoes: sugestoesMateriais, registrarNovaSugestao: registrarMaterial } = useTemplateSugestoes('material');

  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [quantidade, setQuantidade] = useState('');
  const [unidade, setUnidade] = useState('');
  const [dataPrevisao, setDataPrevisao] = useState('');
  const [obs, setObs] = useState('');
  const [status, setStatus] = useState<MaterialStatus>('pendente');
  const [fotos, setFotos] = useState<ImagePicker.ImagePickerAsset[]>([]);
  const [categoriaAtraso, setCategoriaAtraso] = useState<CategoriaAtraso | null>(null);
  const [motivoAtraso, setMotivoAtraso] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingInitial, setLoadingInitial] = useState(isEdit);

  useEffect(() => {
    navigation.setOptions({ title: isEdit ? 'Editar material' : 'Novo material' });
  }, [navigation, isEdit]);

  useEffect(() => {
    if (!materialId) return;
    (async () => {
      const { data, error } = await supabase
        .from('materiais')
        .select('*')
        .eq('id', materialId)
        .single();
      if (error || !data) { navigation.goBack(); return; }
      const m = data as Material;
      setNome(m.nome);
      setDescricao(m.descricao ?? '');
      setQuantidade(m.quantidade != null ? String(m.quantidade) : '');
      setUnidade(m.unidade ?? '');
      setDataPrevisao(m.data_previsao ?? '');
      setObs(m.obs ?? '');
      setStatus(m.status);
      setCategoriaAtraso(((m as Material & { categoria_atraso?: string | null }).categoria_atraso as CategoriaAtraso) ?? null);
      setMotivoAtraso((m as Material & { motivo_atraso?: string | null }).motivo_atraso ?? '');
      setLoadingInitial(false);
    })();
  }, [materialId, navigation]);

  const onSalvar = async () => {
    if (!nome.trim()) {
      Alert.alert('Atenção', 'O nome do material é obrigatório.');
      return;
    }

    // Material atrasado → exige o motivo (fica gravado no relatório executivo).
    const hojeStr = new Date().toISOString().slice(0, 10);
    const estaAtrasada = !!dataPrevisao.trim() && dataPrevisao.trim() < hojeStr && status !== 'cancelado';
    if (estaAtrasada) {
      if (!categoriaAtraso) {
        Alert.alert('Motivo do atraso', 'Este material está atrasado. Informe a causa antes de salvar.');
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
      const statusFinal: MaterialStatus = bloqueadaPeloChuva ? 'pausada' : status;
      const notaClima = bloqueadaPeloChuva
        ? `⛈️ Pausada em ${new Date().toLocaleDateString('pt-BR')} — condições climáticas (chuva)`
        : '';
      const obsFinal = [obs.trim(), notaClima].filter(Boolean).join('\n') || null;

      const payload = {
        obra_id: obraId,
        nome: nome.trim(),
        descricao: descricao.trim() || null,
        quantidade: quantidade.trim() ? parseFloat(quantidade.replace(',', '.')) : null,
        unidade: unidade.trim() || null,
        data_previsao: dataPrevisao.trim() || null,
        obs: obsFinal,
        status: statusFinal,
        data_conclusao: statusFinal === 'entregue' ? hoje : null,
        categoria_atraso: estaAtrasada ? categoriaAtraso : null,
        motivo_atraso: estaAtrasada ? (motivoAtraso.trim() || null) : null,
      };
      let savedId: string;
      if (isEdit) {
        const { error } = await supabase.from('materiais').update(payload).eq('id', materialId!);
        if (error) throw error;
        savedId = materialId!;
      } else {
        const { data: novo, error } = await supabase.from('materiais').insert(payload).select('id').single();
        if (error) throw error;
        savedId = novo.id;
      }

      if (fotos.length > 0) {
        await Promise.allSettled(
          fotos.map(asset => uploadMidiaAsset(obraId, 'material', savedId, asset, pessoa?.id ?? null))
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
    Alert.alert('Excluir material', 'O material será ocultado. Continuar?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          setLoading(true);
          try {
            const { error } = await supabase
              .from('materiais')
              .update({ deletado: true, deletado_em: new Date().toISOString() })
              .eq('id', materialId!);
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
    !!dataPrevisao.trim() && dataPrevisao.trim() < hojeStrRender && status !== 'cancelado';

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <SuggestionField
        label="Nome do material *"
        value={nome}
        onChangeText={setNome}
        placeholder="Selecione ou digite..."
        suggestions={TEMPLATES_MATERIAIS}
        customSuggestions={sugestoesMateriais.map(s => s.texto)}
        onNewValueEntered={(novoValor) => registrarMaterial(novoValor, pessoa?.id ?? null, pessoa?.is_admin ?? false)}
      />
      <TextField
        label="Descrição"
        value={descricao}
        onChangeText={setDescricao}
        placeholder="Detalhes..."
        multiline
        numberOfLines={2}
        style={{ height: 64, textAlignVertical: 'top' }}
      />
      <View style={styles.row}>
        <View style={styles.rowItem}>
          <TextField
            label="Quantidade"
            value={quantidade}
            onChangeText={setQuantidade}
            placeholder="Ex: 50"
            keyboardType="decimal-pad"
          />
        </View>
        <View style={[styles.rowItem, styles.rowItemLast]}>
          <TextField
            label="Unidade"
            value={unidade}
            onChangeText={setUnidade}
            placeholder="Ex: sacos"
          />
        </View>
      </View>
      <DateField
        label="Prazo de entrega"
        value={dataPrevisao || null}
        onChange={d => setDataPrevisao(d ?? '')}
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
          titulo="⚠️ Material atrasado — qual o motivo?"
          categoria={categoriaAtraso}
          motivo={motivoAtraso}
          onChangeCategoria={setCategoriaAtraso}
          onChangeMotivo={setMotivoAtraso}
        />
      )}

      {isEdit && status === 'entregue' && (
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
          <PrimaryButton title="Excluir material" variant="danger" onPress={onExcluir} loading={loading} />
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
  row: { flexDirection: 'row', gap: spacing.sm },
  rowItem: { flex: 1 },
  rowItemLast: {},
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
  pillActive: { backgroundColor: colors.warning, borderColor: colors.warning },
  pillText: { fontSize: 13, color: colors.text },
  pillTextActive: { color: '#fff', fontWeight: '600' },
  gap: { height: spacing.md },
  gapSm: { marginTop: spacing.sm },
});
