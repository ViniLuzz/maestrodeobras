import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export interface Membro {
  pessoa_id: string;
  nome: string;
  email: string | null;
  cor: string;
  avatar_url?: string | null;
}

export function useObraMembros(obraId: string) {
  const [membros, setMembros] = useState<Membro[]>([]);
  const [loading, setLoading] = useState(true);

  const carregar = useCallback(async () => {
    try {
      setLoading(true);

      // 1. Buscar membros da obra via obra_membros
      const { data: membroData, error: membroError } = await supabase
        .from('obra_membros')
        .select(`
          pessoa_id,
          pessoas:pessoa_id (
            id,
            nome,
            email,
            cor,
            avatar_url
          )
        `)
        .eq('obra_id', obraId)
        .eq('ativo', true);

      if (membroError) throw membroError;

      const membrosMap = new Map<string, Membro>();

      // Adicionar membros da obra
      (membroData || [])
        .filter((m: any) => m.pessoas)
        .forEach((m: any) => {
          membrosMap.set(m.pessoas.id, {
            pessoa_id: m.pessoas.id,
            nome: m.pessoas.nome,
            email: m.pessoas.email,
            cor: m.pessoas.cor,
            avatar_url: m.pessoas.avatar_url,
          });
        });

      // 2. Buscar admin da obra
      const { data: obraData, error: obraError } = await supabase
        .from('obras')
        .select(`
          admin_id,
          pessoas:admin_id (
            id,
            nome,
            email,
            cor,
            avatar_url
          )
        `)
        .eq('id', obraId)
        .maybeSingle();

      if (obraError) throw obraError;

      // Adicionar admin se não estiver duplicado.
      // O embed (pessoas:admin_id) é tipado como array pelo Supabase, mas a
      // relação é 1:1 — normalizamos pra objeto.
      const adminRaw = (obraData as { pessoas?: unknown } | null)?.pessoas;
      const admin = (Array.isArray(adminRaw) ? adminRaw[0] : adminRaw) as
        | { id: string; nome: string; email: string | null; cor: string; avatar_url?: string | null }
        | undefined;
      if (admin && !membrosMap.has(admin.id)) {
        membrosMap.set(admin.id, {
          pessoa_id: admin.id,
          nome: admin.nome,
          email: admin.email,
          cor: admin.cor,
          avatar_url: admin.avatar_url,
        });
      }

      const lista = Array.from(membrosMap.values());
      setMembros(lista);
    } catch (err) {
      console.error('useObraMembros error:', err);
    } finally {
      setLoading(false);
    }
  }, [obraId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  // Subscribe to real-time changes.
  // Nome único por instância do hook: o mesmo obraId pode estar montado em mais
  // de uma tela ao mesmo tempo, e canais com nome igual colidem ("cannot add
  // postgres_changes callbacks ... after subscribe()").
  useEffect(() => {
    const membroChannel = supabase
      .channel(`membros-${obraId}-${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'obra_membros',
          filter: `obra_id=eq.${obraId}`,
        },
        () => {
          console.log('📡 Membro alterado - recarregando membros...');
          carregar();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(membroChannel);
    };
  }, [obraId, carregar]);

  return { membros, loading, refetch: carregar };
}
