import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export interface MembroProgresso {
  pessoa_id: string;
  nome: string;
  cor: string;
  email: string | null;
  telefone: string | null;
  etapas_completas: number;
  etapas_total: number;
  materiais_recebidos: number;
  materiais_total: number;
  contratos_finalizados: number;
  contratos_total: number;
  score: number; // percentual 0-100
  rank: number;
}

export interface ProgressoEquipeData {
  membros: MembroProgresso[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useProgressoEquipe(obraId: string): ProgressoEquipeData {
  const [membros, setMembros] = useState<MembroProgresso[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // 1. Buscar todos os membros da obra
      const { data: membroData, error: membroError } = await supabase
        .from('obra_membros')
        .select(`
          pessoa_id,
          pessoas:pessoa_id (
            id,
            nome,
            cor,
            email,
            telefone
          )
        `)
        .eq('obra_id', obraId)
        .eq('ativo', true);

      if (membroError) throw membroError;

      const pessoasMap = new Map();
      (membroData || []).forEach((m: any) => {
        if (m.pessoas) {
          pessoasMap.set(m.pessoas.id, m.pessoas);
        }
      });

      // 2. Para cada pessoa, contar tarefas completadas vs total
      const progressoList: MembroProgresso[] = [];

      for (const [pessoaId, pessoa] of pessoasMap) {
        // Etapas
        const { data: etapasData } = await supabase
          .from('etapas')
          .select('id, concluida')
          .eq('obra_id', obraId)
          .eq('pessoa_id', pessoaId)
          .eq('deletado', false);

        const etapasTotal = (etapasData || []).length;
        const etapasCompletas = (etapasData || []).filter((e: any) => e.concluida).length;

        // Materiais
        const { data: materiaisData } = await supabase
          .from('materiais')
          .select('id, recebido')
          .eq('obra_id', obraId)
          .eq('pessoa_id', pessoaId)
          .eq('deletado', false);

        const materiaisTotal = (materiaisData || []).length;
        const materiaisRecebidos = (materiaisData || []).filter((m: any) => m.recebido).length;

        // Contratações
        const { data: contratacoesData } = await supabase
          .from('contratacoes')
          .select('id, data_conclusao_real')
          .eq('obra_id', obraId)
          .eq('pessoa_id', pessoaId)
          .eq('deletado', false);

        const contratacoesTotal = (contratacoesData || []).length;
        const contratosFinalizados = (contratacoesData || []).filter((c: any) => c.data_conclusao_real).length;

        // Calcular score
        const totalTarefas = etapasTotal + materiaisTotal + contratacoesTotal;
        const totalCompletas = etapasCompletas + materiaisRecebidos + contratosFinalizados;
        const score = totalTarefas === 0 ? 0 : Math.round((totalCompletas / totalTarefas) * 100);

        progressoList.push({
          pessoa_id: pessoaId,
          nome: pessoa.nome,
          cor: pessoa.cor,
          email: pessoa.email,
          telefone: pessoa.telefone,
          etapas_completas: etapasCompletas,
          etapas_total: etapasTotal,
          materiais_recebidos: materiaisRecebidos,
          materiais_total: materiaisTotal,
          contratos_finalizados: contratosFinalizados,
          contratos_total: contratacoesTotal,
          score,
          rank: 0, // será atualizado abaixo
        });
      }

      // 3. Ordenar por score (decrescente) e atribuir rank
      progressoList.sort((a, b) => b.score - a.score);
      progressoList.forEach((m, idx) => {
        m.rank = idx + 1;
      });

      setMembros(progressoList);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar progresso';
      setError(message);
      console.error('useProgressoEquipe error:', err);
    } finally {
      setLoading(false);
    }
  }, [obraId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  // Subscribe to real-time changes
  useEffect(() => {
    const etapasChannel = supabase
      .channel(`etapas-${obraId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'etapas',
          filter: `obra_id=eq.${obraId}`,
        },
        () => {
          console.log('📡 Etapa alterada - recarregando progresso...');
          carregar();
        }
      )
      .subscribe();

    const materiaisChannel = supabase
      .channel(`materiais-${obraId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'materiais',
          filter: `obra_id=eq.${obraId}`,
        },
        () => {
          console.log('📡 Material alterado - recarregando progresso...');
          carregar();
        }
      )
      .subscribe();

    const contratosChannel = supabase
      .channel(`contratos-${obraId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'contratacoes',
          filter: `obra_id=eq.${obraId}`,
        },
        () => {
          console.log('📡 Contratação alterada - recarregando progresso...');
          carregar();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(etapasChannel);
      supabase.removeChannel(materiaisChannel);
      supabase.removeChannel(contratosChannel);
    };
  }, [obraId, carregar]);

  return {
    membros,
    loading,
    error,
    refetch: carregar,
  };
}
