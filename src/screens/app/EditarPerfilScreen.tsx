import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { EditarPerfilModal } from '@/components/EditarPerfilModal';
import { colors } from '@/lib/theme';
import type { AppScreenProps } from '@/navigation/types';
import type { Pessoa } from '@/types/database';

export function EditarPerfilScreen({ navigation }: AppScreenProps<'EditarPerfil'>) {
  const { pessoa, refreshPessoa } = useAuth();
  const [modalVisible, setModalVisible] = useState(true);

  useEffect(() => {
    navigation.setOptions({
      title: 'Editar Perfil',
      headerShown: false,
    });
  }, [navigation]);

  if (!pessoa) {
    return <View style={{ flex: 1, backgroundColor: colors.background }} />;
  }

  const handleSave = async (pessoaAtualizada: Pessoa) => {
    try {
      const { error } = await supabase
        .from('pessoas')
        .update({
          nome: pessoaAtualizada.nome,
          avatar_url: pessoaAtualizada.avatar_url,
        })
        .eq('id', pessoaAtualizada.id);

      if (error) throw error;
      await refreshPessoa();
    } catch (err) {
      console.error('Erro ao atualizar perfil:', err);
      throw err;
    }
  };

  return (
    <EditarPerfilModal
      visible={modalVisible}
      pessoa={pessoa}
      onClose={() => {
        setModalVisible(false);
        navigation.goBack();
      }}
      onSave={handleSave}
    />
  );
}
