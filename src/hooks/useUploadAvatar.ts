import { useState, useCallback } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { supabase, SUPABASE_URL } from '@/lib/supabase';

export function useUploadAvatar() {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pickImage = useCallback(async () => {
    try {
      setError(null);
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (result.canceled) return null;

      const file = result.assets[0];
      return {
        uri: file.uri,
        name: `avatar-${Date.now()}.jpg`,
        type: 'image/jpeg',
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao selecionar imagem';
      setError(message);
      return null;
    }
  }, []);

  const uploadAvatar = useCallback(
    async (pessoaId: string, imageFile: { uri: string; name: string; type: string }) => {
      try {
        setUploading(true);
        setError(null);

        // Verificar autenticação
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;

        console.log('🔐 Sessão:', {
          temUser: !!sessionData.session?.user,
          userId: sessionData.session?.user?.id,
          temToken: !!token
        });

        if (!token) {
          throw new Error('Usuário não autenticado');
        }

        console.log('📸 Iniciando upload:', { pessoaId, fileName: imageFile.name });

        // Ler arquivo
        const response = await fetch(imageFile.uri);
        const blob = await response.blob();
        console.log('✓ Blob criado:', { size: blob.size, type: blob.type });

        // Upload para Supabase Storage via REST API
        const path = `${pessoaId}-${Date.now()}.jpg`;
        console.log('📤 Enviando para:', path);

        const storageUrl = `${SUPABASE_URL}/storage/v1/object/avatars/${path}`;
        console.log('🔌 URL de upload:', storageUrl);

        const uploadResponse = await fetch(storageUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'x-upsert': 'true'
          },
          body: blob
        });

        console.log('📊 Status:', uploadResponse.status);

        if (!uploadResponse.ok) {
          const errorText = await uploadResponse.text();
          console.error('❌ Erro no upload:', uploadResponse.status, errorText);
          throw new Error(`Upload falhou: ${uploadResponse.status} - ${errorText}`);
        }

        console.log('✓ Upload sucesso');

        // Obter URL pública
        const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/avatars/${path}`;
        console.log('✓ URL pública:', publicUrl);

        // Atualizar pessoa com nova URL
        const { error: updateError } = await supabase
          .from('pessoas')
          .update({ avatar_url: publicUrl })
          .eq('id', pessoaId);

        if (updateError) {
          console.error('❌ Erro ao atualizar banco:', updateError);
          throw new Error(`Falha ao salvar URL: ${updateError.message}`);
        }

        console.log('✓ Perfil atualizado com sucesso');
        return publicUrl;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao fazer upload';
        console.error('❌ Erro final:', message);
        setError(message);
        throw err;
      } finally {
        setUploading(false);
      }
    },
    []
  );

  return { pickImage, uploadAvatar, uploading, error };
}
