import { useState } from 'react';
import { Alert, ScrollView, StyleSheet } from 'react-native';
import { TextField } from '@/components/TextField';
import { DateField } from '@/components/DateField';
import { PrimaryButton } from '@/components/PrimaryButton';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { requireOnline } from '@/lib/network';
import { colors, spacing } from '@/lib/theme';
import type { AppScreenProps } from '@/navigation/types';

export function CriarObraScreen({ navigation }: AppScreenProps<'CriarObra'>) {
  const { pessoa } = useAuth();
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [endereco, setEndereco] = useState('');
  const [cidade, setCidade] = useState('');
  const [estado, setEstado] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataPrevTermino, setDataPrevTermino] = useState('');
  const [orcamento, setOrcamento] = useState('');
  const [loading, setLoading] = useState(false);

  const onCriar = async () => {
    if (!nome.trim()) {
      Alert.alert('Atenção', 'O nome da obra é obrigatório.');
      return;
    }
    if (!pessoa) {
      Alert.alert('Erro', 'Usuário não encontrado. Faça login novamente.');
      return;
    }
    setLoading(true);
    try {
      await requireOnline();
      const { data, error } = await supabase
        .from('obras')
        .insert({
          nome: nome.trim(),
          descricao: descricao.trim() || null,
          endereco: endereco.trim() || null,
          cidade: cidade.trim() || null,
          estado: estado.trim() || null,
          data_inicio: dataInicio.trim() || null,
          data_previsao_termino: dataPrevTermino.trim() || null,
          admin_id: pessoa.id,
          status: 'em_andamento',
        })
        .select('id, nome')
        .single();
      if (error) throw error;

      // Criar orçamento inicial se informado
      if (orcamento.trim()) {
        try {
          const valorOrcamento = parseFloat(orcamento.replace(/[^\d,.-]/g, '').replace(',', '.'));
          console.log('Valor parseado:', valorOrcamento);

          if (isNaN(valorOrcamento) || valorOrcamento <= 0) {
            console.warn('Valor de orçamento inválido:', orcamento);
            Alert.alert('Aviso', 'O orçamento informado é inválido e não foi salvo.');
          } else {
            const { error: orcError, data: orcData } = await supabase
              .from('orcamento_obra')
              .insert({
                obra_id: data.id,
                orcamento_total: valorOrcamento,
              })
              .select();

            if (orcError) {
              console.error('Erro ao criar orçamento:', orcError);
              Alert.alert('⚠️ Erro', `Erro ao salvar orçamento: ${orcError.message}`);
            } else {
              console.log('✅ Orçamento criado:', orcData);
              Alert.alert('✅ Sucesso', `Orçamento de R$ ${valorOrcamento.toFixed(2)} registrado!`);
            }
          }
        } catch (err) {
          console.error('Erro ao processar orçamento:', err);
        }
      }

      navigation.replace('ObraDetalhe', { obraId: data.id, obraNome: data.nome });
    } catch (e: unknown) {
      Alert.alert('Erro', e instanceof Error ? e.message : 'Erro ao criar obra.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.container}>
      <TextField
        label="Nome da obra *"
        value={nome}
        onChangeText={setNome}
        placeholder="Ex: Casa da família Silva"
      />
      <TextField
        label="Descrição"
        value={descricao}
        onChangeText={setDescricao}
        placeholder="Descrição opcional"
        multiline
        numberOfLines={3}
        style={{ height: 80, textAlignVertical: 'top' }}
      />
      <TextField
        label="Endereço da obra"
        value={endereco}
        onChangeText={setEndereco}
        placeholder="Ex: Rua das Flores, 123 - Bairro"
      />
      <TextField
        label="Cidade"
        value={cidade}
        onChangeText={setCidade}
        placeholder="Ex: São Paulo"
      />
      <TextField
        label="Estado (UF)"
        value={estado}
        onChangeText={setEstado}
        placeholder="Ex: SP"
        autoCapitalize="characters"
        maxLength={2}
      />
      <DateField
        label="Data de início"
        value={dataInicio || null}
        onChange={d => setDataInicio(d ?? '')}
      />
      <DateField
        label="Previsão de término"
        value={dataPrevTermino || null}
        onChange={d => setDataPrevTermino(d ?? '')}
      />
      <TextField
        label="Orçamento inicial (opcional)"
        value={orcamento}
        onChangeText={setOrcamento}
        placeholder="Ex: 50000,00"
        keyboardType="decimal-pad"
      />
      <PrimaryButton title="Criar obra" onPress={onCriar} loading={loading} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg },
});
