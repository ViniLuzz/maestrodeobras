import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export interface CategoriaGasto {
  categoria: 'material' | 'mao_obra' | 'aluguel' | 'servicos' | 'outro';
  label: string;
  gasto: number;
  orcado: number;
  percentual: number;
}

export interface Despesa {
  id: string;
  categoria: 'material' | 'mao_obra' | 'aluguel' | 'servicos' | 'outro';
  descricao: string;
  valor: number;
  data: string;
  registrado_por: string;
}

export interface DadosFinanceiros {
  orcamento_total: number;
  gasto_total: number;
  restante: number;
  percentual_gasto: number;
  categorias: CategoriaGasto[];
  despesas_recentes: Despesa[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

const CATEGORIAS_PADRAO = [
  { categoria: 'material' as const, label: 'Materiais', icon: '🛒' },
  { categoria: 'mao_obra' as const, label: 'Mão de Obra', icon: '👷' },
  { categoria: 'aluguel' as const, label: 'Aluguel', icon: '🚗' },
  { categoria: 'servicos' as const, label: 'Serviços', icon: '🔧' },
  { categoria: 'outro' as const, label: 'Outro', icon: '📋' },
];

export function useFinanceiro(obraId: string): DadosFinanceiros {
  const [orcamento_total, setOrcamentoTotal] = useState(0);
  const [gasto_total, setGastoTotal] = useState(0);
  const [restante, setRestante] = useState(0);
  const [percentual_gasto, setPercentualGasto] = useState(0);
  const [categorias, setCategorias] = useState<CategoriaGasto[]>([]);
  const [despesas_recentes, setDespesasRecentes] = useState<Despesa[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // 1. Buscar orçamento da obra
      const { data: orcamentoData, error: orcError } = await supabase
        .from('orcamento_obra')
        .select('*')
        .eq('obra_id', obraId)
        .maybeSingle();

      console.log('🔍 Orçamento query - obraId:', obraId);
      console.log('🔍 Orçamento resultado:', orcamentoData);
      console.log('🔍 Orçamento erro:', orcError);

      const totalOrcado = orcamentoData?.orcamento_total || 0;
      setOrcamentoTotal(totalOrcado);

      // 2. Buscar todas as despesas
      const { data: despesasData } = await supabase
        .from('despesas')
        .select('*')
        .eq('obra_id', obraId)
        .order('data', { ascending: false });

      const despesas = (despesasData || []) as Despesa[];

      // 3. Calcular totais por categoria
      const totaisPorCategoria: Record<string, number> = {};
      CATEGORIAS_PADRAO.forEach(c => {
        totaisPorCategoria[c.categoria] = 0;
      });

      let totalGasto = 0;
      despesas.forEach(d => {
        totaisPorCategoria[d.categoria] = (totaisPorCategoria[d.categoria] || 0) + d.valor;
        totalGasto += d.valor;
      });

      setGastoTotal(totalGasto);
      setRestante(totalOrcado - totalGasto);

      const percentual = totalOrcado === 0 ? 0 : Math.round((totalGasto / totalOrcado) * 100);
      setPercentualGasto(percentual);

      // 4. Montar lista de categorias com breakdown
      const categoriasData: CategoriaGasto[] = CATEGORIAS_PADRAO.map(cat => {
        const gastoCategoria = totaisPorCategoria[cat.categoria];
        // Calcula percentual do gasto total por categoria
        const percentualDoTotal = totalGasto === 0 ? 0 : Math.round((gastoCategoria / totalGasto) * 100);
        return {
          categoria: cat.categoria,
          label: cat.label,
          gasto: gastoCategoria,
          orcado: 0, // Não temos orcamento por categoria, apenas total
          percentual: percentualDoTotal,
        };
      });

      setCategorias(categoriasData);

      // 5. Despesas recentes (últimas 10)
      setDespesasRecentes(despesas.slice(0, 10));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar financeiro';
      setError(message);
      console.error('useFinanceiro error:', err);
    } finally {
      setLoading(false);
    }
  }, [obraId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  // Subscribe to real-time changes
  useEffect(() => {
    const despesasChannel = supabase
      .channel(`despesas-${obraId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'despesas',
          filter: `obra_id=eq.${obraId}`,
        },
        () => {
          console.log('📡 Despesa alterada - recarregando...');
          carregar();
        }
      )
      .subscribe();

    const orcamentoChannel = supabase
      .channel(`orcamento-${obraId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orcamento_obra',
          filter: `obra_id=eq.${obraId}`,
        },
        () => {
          console.log('📡 Orçamento alterado - recarregando...');
          carregar();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(despesasChannel);
      supabase.removeChannel(orcamentoChannel);
    };
  }, [obraId, carregar]);

  return {
    orcamento_total,
    gasto_total,
    restante,
    percentual_gasto,
    categorias,
    despesas_recentes,
    loading,
    error,
    refetch: carregar,
  };
}
