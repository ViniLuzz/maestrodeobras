import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { TemplateTipo, TemplateSugestao } from '@/types/database';

export function useTemplateSugestoes(tipo: TemplateTipo) {
  const [sugestoes, setSugestoes] = useState<TemplateSugestao[]>([]);
  const [loading, setLoading] = useState(true);

  const carregar = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('template_sugestoes')
        .select('*')
        .eq('tipo', tipo)
        .eq('deletado', false)
        .order('usos', { ascending: false })
        .limit(50);

      if (error) {
        // Se a tabela não existe ainda, apenas ignora e retorna array vazio
        if (error.code === 'PGRST205' || error.message.includes('Could not find the table')) {
          console.warn('⚠️ Tabela template_sugestoes ainda não foi criada. Execute o SQL no Supabase.');
          setSugestoes([]);
        } else {
          throw error;
        }
      } else {
        setSugestoes((data as TemplateSugestao[]) || []);
      }
    } catch (err) {
      console.error('useTemplateSugestoes error:', err);
      setSugestoes([]);
    } finally {
      setLoading(false);
    }
  }, [tipo]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  // Subscribe para atualizações em tempo real
  useEffect(() => {
    const channel = supabase
      .channel(`templates-${tipo}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'template_sugestoes',
          filter: `tipo=eq.${tipo}`,
        },
        () => {
          console.log('📡 Template alterado - recarregando sugestões...');
          carregar();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tipo, carregar]);

  const registrarNovaSugestao = useCallback(
    async (texto: string, pessoaId: string | null, ehAdmin: boolean = false) => {
      try {
        // Apenas admins podem registrar novas sugestões globais
        if (!ehAdmin) {
          console.log('ℹ️ Apenas admins podem sugerir novos itens');
          return;
        }

        // Verifica se já existe
        const { data: existing, error: selectError } = await supabase
          .from('template_sugestoes')
          .select('id, usos')
          .eq('tipo', tipo)
          .eq('texto', texto)
          .eq('deletado', false)
          .maybeSingle();

        // Se tabela não existe, ignora silenciosamente
        if (selectError?.code === 'PGRST205' || selectError?.message.includes('Could not find the table')) {
          console.warn('⚠️ Tabela template_sugestoes ainda não foi criada.');
          return;
        }

        if (existing) {
          // Incrementa usos
          await supabase
            .from('template_sugestoes')
            .update({ usos: existing.usos + 1 })
            .eq('id', existing.id);
        } else {
          // Insere nova sugestão
          await supabase.from('template_sugestoes').insert({
            tipo,
            texto: texto.trim(),
            usos: 1,
            registrado_por: pessoaId,
          });
        }

        // Recarrega
        await carregar();
      } catch (err) {
        console.error('Erro ao registrar sugestão:', err);
      }
    },
    [tipo, carregar]
  );

  return {
    sugestoes,
    loading,
    registrarNovaSugestao,
  };
}
