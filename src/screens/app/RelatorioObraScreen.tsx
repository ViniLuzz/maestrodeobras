import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { supabase } from '@/lib/supabase';
import { colors, spacing } from '@/lib/theme';
import { CATEGORIAS_ATRASO, labelAtraso, corAtraso } from '@/lib/atraso';
import type { AppScreenProps } from '@/navigation/types';

// ─── Tipos ────────────────────────────────────────────────────────────────────
type EtapaRow = {
  id: string; nome: string; status: string;
  descricao: string | null; data_previsao_fim: string | null; data_conclusao: string | null;
  categoria_atraso: string | null; motivo_atraso: string | null;
};
type MaterialRow = {
  id: string; nome: string; status: string;
  obs: string | null; data_previsao: string | null;
  categoria_atraso: string | null; motivo_atraso: string | null;
};
type ContratacaoRow = {
  id: string; nome: string; status: string;
  obs: string | null; data_previsao_fim: string | null;
  especialidade: string | null; valor: number | null;
  categoria_atraso: string | null; motivo_atraso: string | null;
};
type Slice = { label: string; value: number; color: string };

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt(d: string | null): string {
  if (!d) return '—';
  const [y, m, dd] = d.split('-');
  return `${dd}/${m}/${y}`;
}

const DONE = ['concluida', 'concluido', 'entregue', 'cancelada', 'cancelado'];

function atrasado(prazo: string | null, status: string): boolean {
  if (!prazo || DONE.includes(status)) return false;
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  return new Date(prazo) < hoje;
}

function temClima(obs: string | null | undefined): boolean {
  return (obs ?? '').includes('⛈️');
}

// ─── SVG pie para o PDF (gera string HTML) ────────────────────────────────────
function svgPieHtml(slices: Slice[], size = 200): string {
  const active = slices.filter(s => s.value > 0);
  const total = active.reduce((s, sl) => s + sl.value, 0);
  if (!active.length || total === 0) return '';

  const r = (size - 4) / 2;
  const cx = size / 2;
  const cy = size / 2;

  if (active.length === 1) {
    return `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg"><circle cx="${cx}" cy="${cy}" r="${r}" fill="${active[0].color}"/></svg>`;
  }

  let angle = -90;
  const paths = active.map(sl => {
    const sweep = (sl.value / total) * 360;
    const s = (angle * Math.PI) / 180;
    const e = ((angle + sweep) * Math.PI) / 180;
    const x1 = (cx + r * Math.cos(s)).toFixed(2);
    const y1 = (cy + r * Math.sin(s)).toFixed(2);
    const x2 = (cx + r * Math.cos(e)).toFixed(2);
    const y2 = (cy + r * Math.sin(e)).toFixed(2);
    const large = sweep > 180 ? 1 : 0;
    const d = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
    angle += sweep;
    return `<path d="${d}" fill="${sl.color}" stroke="white" stroke-width="2"/>`;
  });

  return `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">${paths.join('')}</svg>`;
}

// ─── Template HTML do relatório PDF ──────────────────────────────────────────
function montarHtml(p: {
  obraNome: string;
  dataGeracao: string;
  progresso: number;
  corProgresso: string;
  totalEt: number;
  etConcluidas: EtapaRow[];
  etAndamento: EtapaRow[];
  etPendentes: EtapaRow[];
  etPausaClima: EtapaRow[];
  etPausaOutros: EtapaRow[];
  matComprar: MaterialRow[];
  matEntregues: MaterialRow[];
  totalMat: number;
  conFazer: ContratacaoRow[];
  conConcluidas: ContratacaoRow[];
  totalCon: number;
  valorTotalPendente: number;
  totalProblemas: number;
  delaySlices: Slice[];
  itensComAtraso: { nome: string; tipo: string; categoria: string; motivo: string | null; concluida: boolean }[];
}): string {
  const pieSvg = svgPieHtml(p.delaySlices, 200);
  const totalPie = p.totalProblemas;

  const listaEtapas = (list: EtapaRow[], showConc = false) =>
    list.length === 0
      ? '<li style="color:#94a3b8;font-style:italic;">Nenhum item.</li>'
      : list.map(e => {
          const atr = atrasado(e.data_previsao_fim, e.status);
          const prazoStr = e.data_previsao_fim ? `Prazo: ${fmt(e.data_previsao_fim)}` : '';
          const concStr  = showConc && e.data_conclusao ? `Concluída: ${fmt(e.data_conclusao)}` : '';
          const badge = atr ? '<span style="background:#fee2e2;color:#dc2626;padding:1px 6px;border-radius:4px;font-size:11px;margin-left:4px;">⚠ ATRASADA</span>' : '';
          const meta = [prazoStr, concStr].filter(Boolean).join(' · ');
          return `<li>${e.nome}${badge}${meta ? `<br/><span style="font-size:12px;color:#64748b;">${meta}</span>` : ''}</li>`;
        }).join('');

  const listaMateriais = p.matComprar.length === 0
    ? '<li style="color:#94a3b8;font-style:italic;">Nenhum material pendente.</li>'
    : p.matComprar.map(m => {
        const urgente = m.status === 'faltando';
        const badge = urgente ? '<span style="background:#fee2e2;color:#dc2626;padding:1px 6px;border-radius:4px;font-size:11px;margin-left:4px;">⚠ FALTANDO</span>' : '';
        return `<li>${m.nome}${badge}</li>`;
      }).join('');

  const listaContratacoes = p.conFazer.length === 0
    ? '<li style="color:#94a3b8;font-style:italic;">Nenhuma contratação pendente.</li>'
    : p.conFazer.map(c => {
        const atr = atrasado(c.data_previsao_fim, c.status);
        const badge = atr ? '<span style="background:#fee2e2;color:#dc2626;padding:1px 6px;border-radius:4px;font-size:11px;margin-left:4px;">⚠ ATRASADA</span>' : '';
        const esp = c.especialidade ? `${c.especialidade} · ` : '';
        const prazo = c.data_previsao_fim ? `Prazo: ${fmt(c.data_previsao_fim)}` : '';
        const valor = c.valor != null ? `R$ ${c.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '';
        const meta = [esp + prazo, valor].filter(Boolean).join(' · ');
        return `<li>${c.nome}${badge}${meta ? `<br/><span style="font-size:12px;color:#64748b;">${meta}</span>` : ''}</li>`;
      }).join('');

  const legendaSlices = p.delaySlices.map(sl =>
    `<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
       <div style="width:14px;height:14px;border-radius:50%;background:${sl.color};flex-shrink:0;"></div>
       <div>
         <div style="font-size:13px;font-weight:600;color:#1e293b;">${sl.label}</div>
         <div style="font-size:12px;color:#64748b;">${sl.value} item${sl.value !== 1 ? 's' : ''} · ${Math.round((sl.value / Math.max(totalPie, 1)) * 100)}%</div>
       </div>
     </div>`
  ).join('');

  const secaoPausadas = (p.etPausaClima.length + p.etPausaOutros.length) > 0 ? `
    <div class="section">
      <div class="section-title" style="color:#f59e0b;">⏸ Etapas Pausadas</div>
      <div class="section-count">${p.etPausaClima.length + p.etPausaOutros.length} etapa(s)</div>
      <ul>
        ${p.etPausaClima.map(e => `<li>${e.nome}<br/><span style="font-size:12px;color:#0891b2;">Pausada por condições climáticas</span></li>`).join('')}
        ${p.etPausaOutros.map(e => `<li>${e.nome}<br/><span style="font-size:12px;color:#64748b;">Pausada — outros motivos</span></li>`).join('')}
      </ul>
    </div>` : '';

  const secaoPendentes = p.etPendentes.length > 0 ? `
    <div class="section">
      <div class="section-title" style="color:#64748b;">📋 Próximas Etapas</div>
      <div class="section-count">${p.etPendentes.length} etapa(s) não iniciadas</div>
      <ul>${listaEtapas(p.etPendentes)}</ul>
    </div>` : '';

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8"/>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 14px; color: #1e293b; background: #f8fafc; padding: 32px; }
  .header { background: #3b82f6; color: white; border-radius: 12px; padding: 24px 28px; margin-bottom: 20px; }
  .header h1 { font-size: 22px; font-weight: 800; margin-bottom: 4px; }
  .header .subtitle { font-size: 12px; color: rgba(255,255,255,0.75); margin-bottom: 14px; }
  .progress-bar-bg { background: rgba(255,255,255,0.25); border-radius: 6px; height: 10px; margin-bottom: 6px; }
  .progress-bar-fill { background: ${p.corProgresso === colors.success ? '#4ade80' : p.corProgresso === colors.warning ? '#fbbf24' : '#f87171'}; height: 10px; border-radius: 6px; width: ${p.progresso}%; }
  .progress-label { font-size: 12px; color: rgba(255,255,255,0.85); }
  .kpi-row { display: flex; gap: 12px; margin-bottom: 12px; }
  .kpi { flex: 1; background: white; border-radius: 10px; border: 1px solid #e2e8f0; border-left: 4px solid; padding: 14px 16px; }
  .kpi-value { font-size: 26px; font-weight: 800; line-height: 1.1; }
  .kpi-label { font-size: 12px; font-weight: 600; color: #1e293b; margin-top: 3px; }
  .kpi-sub { font-size: 11px; color: #94a3b8; margin-top: 2px; }
  .section { background: white; border-radius: 10px; border: 1px solid #e2e8f0; padding: 16px 18px; margin-bottom: 12px; }
  .section-title { font-size: 14px; font-weight: 700; color: #1e293b; margin-bottom: 2px; }
  .section-count { font-size: 12px; color: #94a3b8; margin-bottom: 10px; }
  ul { list-style: none; padding: 0; }
  ul li { padding: 7px 0; border-bottom: 1px solid #f1f5f9; font-size: 13px; color: #334155; }
  ul li:last-child { border-bottom: none; }
  .pie-row { display: flex; align-items: center; gap: 24px; padding-top: 4px; }
  .sem-atraso { background: #f0fdf4; border-radius: 8px; padding: 12px; text-align: center; color: #16a34a; font-weight: 600; font-size: 13px; }
  .footer { text-align: center; font-size: 11px; color: #94a3b8; margin-top: 24px; padding-top: 12px; border-top: 1px solid #e2e8f0; }
</style>
</head>
<body>

  <!-- Cabeçalho -->
  <div class="header">
    <h1>${p.obraNome}</h1>
    <div class="subtitle">Relatório Executivo — gerado em ${p.dataGeracao}</div>
    <div class="progress-bar-bg"><div class="progress-bar-fill"></div></div>
    <div class="progress-label">${p.progresso}% concluído · ${p.etConcluidas.length} de ${p.totalEt} etapas</div>
  </div>

  <!-- KPIs -->
  <div class="kpi-row">
    <div class="kpi" style="border-left-color:${p.corProgresso};">
      <div class="kpi-value" style="color:${p.corProgresso};">${p.progresso}%</div>
      <div class="kpi-label">Progresso</div>
      <div class="kpi-sub">${p.etConcluidas.length} de ${p.totalEt} etapas</div>
    </div>
    <div class="kpi" style="border-left-color:${p.totalProblemas > 0 ? colors.danger : colors.success};">
      <div class="kpi-value" style="color:${p.totalProblemas > 0 ? colors.danger : colors.success};">${p.totalProblemas}</div>
      <div class="kpi-label">Problemas</div>
      <div class="kpi-sub">atrasos + bloqueios</div>
    </div>
    <div class="kpi" style="border-left-color:${colors.warning};">
      <div class="kpi-value" style="color:${colors.warning};">${p.matComprar.length}</div>
      <div class="kpi-label">A comprar</div>
      <div class="kpi-sub">materiais pendentes</div>
    </div>
    <div class="kpi" style="border-left-color:#8b5cf6;">
      <div class="kpi-value" style="color:#8b5cf6;">${p.conFazer.length}</div>
      <div class="kpi-label">Contratar</div>
      <div class="kpi-sub">serviços pendentes</div>
    </div>
  </div>

  <!-- Gráfico: Causas dos Atrasos -->
  <div class="section">
    <div class="section-title" style="color:#dc2626;">⚠ Causas dos Atrasos</div>
    <div class="section-count">
      ${p.totalProblemas === 0 ? 'Nenhum item com problema' : `${p.totalProblemas} item(s) com atraso ou bloqueio`}
    </div>
    ${p.delaySlices.length > 0
      ? `<div class="pie-row">
           <div>${pieSvg}</div>
           <div style="flex:1;">${legendaSlices}</div>
         </div>`
      : '<div class="sem-atraso">✅ Nenhum atraso ou bloqueio registrado</div>'}
  </div>

  <!-- Detalhe dos atrasos (com motivo) -->
  ${p.itensComAtraso.length > 0 ? `
  <div class="section">
    <div class="section-title" style="color:#dc2626;">📋 Detalhe dos Atrasos</div>
    <div class="section-count">${p.itensComAtraso.length} item(s) com atraso (etapas, materiais e contratações)</div>
    <ul>
      ${p.itensComAtraso.map(e => `<li><span style="font-size:11px;color:#94a3b8;font-weight:700;text-transform:uppercase;">${e.tipo}</span> <strong>${e.nome}</strong> ${e.concluida
        ? '<span style="background:#dcfce7;color:#16a34a;padding:1px 6px;border-radius:4px;font-size:11px;">✓ resolvido com atraso</span>'
        : '<span style="background:#fee2e2;color:#dc2626;padding:1px 6px;border-radius:4px;font-size:11px;">em atraso</span>'}<br/><span style="font-size:12px;color:#64748b;">Causa: ${labelAtraso(e.categoria)}${e.motivo ? ` — ${e.motivo}` : ''}</span></li>`).join('')}
    </ul>
  </div>` : ''}

  <!-- Materiais a comprar -->
  <div class="section">
    <div class="section-title" style="color:#d97706;">🛒 Materiais a Comprar</div>
    <div class="section-count">${p.matComprar.length} item(s) · ${p.matEntregues.length}/${p.totalMat} entregues</div>
    <ul>${listaMateriais}</ul>
  </div>

  <!-- Contratações a fazer -->
  <div class="section">
    <div class="section-title" style="color:#7c3aed;">👷 Contratações a Fazer</div>
    <div class="section-count">
      ${p.conFazer.length} item(s)${p.valorTotalPendente > 0 ? ` · Total: R$ ${p.valorTotalPendente.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : ''}
    </div>
    <ul>${listaContratacoes}</ul>
  </div>

  <!-- Etapas em andamento -->
  <div class="section">
    <div class="section-title" style="color:#2563eb;">🏗 Etapas em Andamento</div>
    <div class="section-count">${p.etAndamento.length} etapa(s)</div>
    <ul>${listaEtapas(p.etAndamento)}</ul>
  </div>

  <!-- Próximas etapas -->
  ${secaoPendentes}

  <!-- Etapas concluídas -->
  <div class="section">
    <div class="section-title" style="color:#16a34a;">✅ Etapas Concluídas</div>
    <div class="section-count">${p.etConcluidas.length} de ${p.totalEt}</div>
    <ul>${listaEtapas(p.etConcluidas, true)}</ul>
  </div>

  <!-- Etapas pausadas -->
  ${secaoPausadas}

  <div class="footer">
    Maestro de Obras · Relatório Executivo · ${p.dataGeracao}
  </div>

</body>
</html>`;
}

// ─── Gráfico de pizza (tela) ──────────────────────────────────────────────────
function PieChart({ slices, size = 160 }: { slices: Slice[]; size?: number }) {
  const active = slices.filter(s => s.value > 0);
  const total = active.reduce((s, sl) => s + sl.value, 0);
  if (!active.length || total === 0) return null;

  const r = (size - 4) / 2;
  const cx = size / 2;
  const cy = size / 2;

  if (active.length === 1) {
    return (
      <Svg width={size} height={size}>
        <Circle cx={cx} cy={cy} r={r} fill={active[0].color} />
      </Svg>
    );
  }

  let angle = -90;
  const paths = active.map(sl => {
    const sweep = (sl.value / total) * 360;
    const s = (angle * Math.PI) / 180;
    const e = ((angle + sweep) * Math.PI) / 180;
    const x1 = cx + r * Math.cos(s);
    const y1 = cy + r * Math.sin(s);
    const x2 = cx + r * Math.cos(e);
    const y2 = cy + r * Math.sin(e);
    const large = sweep > 180 ? 1 : 0;
    const d = `M ${cx} ${cy} L ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z`;
    angle += sweep;
    return { d, color: sl.color };
  });

  return (
    <Svg width={size} height={size}>
      {paths.map((p, i) => (
        <Path key={i} d={p.d} fill={p.color} stroke="#fff" strokeWidth={2} />
      ))}
    </Svg>
  );
}

// ─── Barra de progresso (tela) ────────────────────────────────────────────────
function ProgressBar({ percent, color }: { percent: number; color: string }) {
  return (
    <View style={styles.progressBg}>
      <View style={[styles.progressFill, { width: `${Math.min(percent, 100)}%` as any, backgroundColor: color }]} />
    </View>
  );
}

// ─── KPI card (tela) ──────────────────────────────────────────────────────────
function KpiCard({ label, value, cor, sub }: { label: string; value: string; cor: string; sub: string }) {
  return (
    <View style={[styles.kpiCard, { borderLeftColor: cor }]}>
      <Text style={[styles.kpiValue, { color: cor }]}>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
      <Text style={styles.kpiSub}>{sub}</Text>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export function RelatorioObraScreen({ route, navigation }: AppScreenProps<'RelatorioObra'>) {
  const { obraId, obraNome } = route.params;
  const [loading, setLoading] = useState(true);
  const [gerandoPdf, setGerandoPdf] = useState(false);
  const [etapas, setEtapas] = useState<EtapaRow[]>([]);
  const [materiais, setMateriais] = useState<MaterialRow[]>([]);
  const [contratacoes, setContratacoes] = useState<ContratacaoRow[]>([]);

  useEffect(() => { navigation.setOptions({ title: 'Relatório Executivo' }); }, [navigation]);

  const carregar = useCallback(async () => {
    const [et, mat, con] = await Promise.all([
      supabase.from('etapas')
        .select('id, nome, status, descricao, data_previsao_fim, data_conclusao, categoria_atraso, motivo_atraso')
        .eq('obra_id', obraId).eq('deletado', false),
      supabase.from('materiais')
        .select('id, nome, status, obs, data_previsao, categoria_atraso, motivo_atraso')
        .eq('obra_id', obraId).eq('deletado', false),
      supabase.from('contratacoes')
        .select('id, nome, status, obs, data_previsao_fim, especialidade, valor, categoria_atraso, motivo_atraso')
        .eq('obra_id', obraId).eq('deletado', false),
    ]);
    if (et.data)  setEtapas(et.data as EtapaRow[]);
    if (mat.data) setMateriais(mat.data as MaterialRow[]);
    if (con.data) setContratacoes(con.data as ContratacaoRow[]);
  }, [obraId]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      await carregar();
      if (mounted) setLoading(false);
    })();
    return () => { mounted = false; };
  }, [carregar]);

  // ── Cálculos ──
  const etConcluidas  = etapas.filter(e => e.status === 'concluida');
  const etAndamento   = etapas.filter(e => e.status === 'em_andamento');
  const etPendentes   = etapas.filter(e => e.status === 'pendente');
  const etPausaClima  = etapas.filter(e => e.status === 'pausada' && temClima(e.descricao));
  const etPausaOutros = etapas.filter(e => e.status === 'pausada' && !temClima(e.descricao));
  const totalEt       = etapas.filter(e => e.status !== 'cancelada').length;
  const progresso     = totalEt > 0 ? Math.round((etConcluidas.length / totalEt) * 100) : 0;
  const corProgresso  = progresso >= 75 ? colors.success : progresso >= 40 ? colors.warning : colors.danger;
  const corBarra      = progresso >= 75 ? '#4ade80' : progresso >= 40 ? '#fbbf24' : '#f87171';

  const matComprar   = materiais.filter(m => ['pendente', 'faltando', 'pausada'].includes(m.status));
  const matEntregues = materiais.filter(m => m.status === 'entregue');
  const totalMat     = materiais.filter(m => m.status !== 'cancelado').length;

  const conFazer           = contratacoes.filter(c => ['pendente', 'em_andamento', 'pausada'].includes(c.status));
  const conConcluidas      = contratacoes.filter(c => c.status === 'concluida');
  const totalCon           = contratacoes.filter(c => c.status !== 'cancelada').length;
  const valorTotalPendente = conFazer.reduce((sum, c) => sum + (c.valor ?? 0), 0);

  // Atraso "histórico": item (etapa/material/contratação) com motivo registrado
  // OU atualmente atrasado. Fica no relatório mesmo depois de concluído —
  // a obra do começo ao fim, com TUDO que atrasou e a causa.
  const itensComAtraso = [
    ...etapas
      .filter(e => !!e.categoria_atraso || atrasado(e.data_previsao_fim, e.status))
      .map(e => ({
        id: e.id, nome: e.nome, tipo: 'Etapa' as const,
        categoria: e.categoria_atraso ?? 'nao_informado',
        motivo: e.motivo_atraso, concluida: e.status === 'concluida',
      })),
    ...materiais
      .filter(m => !!m.categoria_atraso || atrasado(m.data_previsao, m.status))
      .map(m => ({
        id: m.id, nome: m.nome, tipo: 'Material' as const,
        categoria: m.categoria_atraso ?? 'nao_informado',
        motivo: m.motivo_atraso, concluida: m.status === 'entregue',
      })),
    ...contratacoes
      .filter(c => !!c.categoria_atraso || atrasado(c.data_previsao_fim, c.status))
      .map(c => ({
        id: c.id, nome: c.nome, tipo: 'Contratação' as const,
        categoria: c.categoria_atraso ?? 'nao_informado',
        motivo: c.motivo_atraso, concluida: c.status === 'concluida',
      })),
  ];

  const contagemAtraso: Record<string, number> = {};
  itensComAtraso.forEach(i => { contagemAtraso[i.categoria] = (contagemAtraso[i.categoria] || 0) + 1; });

  const totalProblemas = itensComAtraso.length;

  const delaySlices: Slice[] = [
    ...CATEGORIAS_ATRASO.map(c => ({ label: c.label, value: contagemAtraso[c.value] || 0, color: c.color })),
    { label: 'Não informado', value: contagemAtraso.nao_informado || 0, color: '#94a3b8' },
  ].filter(s => s.value > 0);

  // ── Gerar PDF ──
  const gerarPdf = async () => {
    setGerandoPdf(true);
    try {
      const html = montarHtml({
        obraNome,
        dataGeracao: new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }),
        progresso,
        corProgresso,
        totalEt,
        etConcluidas,
        etAndamento,
        etPendentes,
        etPausaClima,
        etPausaOutros,
        matComprar,
        matEntregues,
        totalMat,
        conFazer,
        conConcluidas,
        totalCon,
        valorTotalPendente,
        totalProblemas,
        delaySlices,
        itensComAtraso,
      });

      const { uri } = await Print.printToFileAsync({ html, base64: false });
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: `Relatório — ${obraNome}`,
        UTI: 'com.adobe.pdf',
      });
    } catch (e) {
      console.warn('Erro ao gerar PDF', e);
    } finally {
      setGerandoPdf(false);
    }
  };

  // ── Compartilhar texto ──
  const onShare = async () => {
    const lines = [
      `RELATÓRIO EXECUTIVO — ${obraNome}`,
      `Gerado em: ${new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}`,
      '',
      '📊 RESUMO',
      `• Progresso: ${progresso}% (${etConcluidas.length}/${totalEt} etapas)`,
      `• Materiais: ${matEntregues.length}/${totalMat} entregues`,
      `• Contratações: ${conConcluidas.length}/${totalCon} concluídas`,
      `• Itens com problema: ${totalProblemas}`,
      '',
      `🛒 MATERIAIS A COMPRAR (${matComprar.length})`,
      ...matComprar.map(m => `• ${m.nome}${m.status === 'faltando' ? ' ⚠️ FALTANDO' : ''}`),
      matComprar.length === 0 ? '• Nenhum pendente.' : '',
      '',
      `👷 CONTRATAÇÕES A FAZER (${conFazer.length})`,
      ...conFazer.map(c =>
        `• ${c.nome}${c.especialidade ? ` (${c.especialidade})` : ''} · Prazo: ${fmt(c.data_previsao_fim)}${atrasado(c.data_previsao_fim, c.status) ? ' ⚠️' : ''}`
      ),
      conFazer.length === 0 ? '• Nenhuma pendente.' : '',
      '',
      `🏗️ ETAPAS EM ANDAMENTO (${etAndamento.length})`,
      ...etAndamento.map(e => `• ${e.nome} · ${fmt(e.data_previsao_fim)}${atrasado(e.data_previsao_fim, e.status) ? ' ⚠️' : ''}`),
      etAndamento.length === 0 ? '• Nenhuma.' : '',
      '',
      `✅ CONCLUÍDAS (${etConcluidas.length}/${totalEt})`,
      '',
      '⚠️ CAUSAS DOS ATRASOS',
      totalProblemas === 0
        ? '• Nenhum problema!'
        : delaySlices.map(s => `• ${s.label}: ${s.value}`).join('\n'),
      ...itensComAtraso.map(e =>
        `   ↳ [${e.tipo}] ${e.nome}${e.concluida ? ' (resolvido c/ atraso)' : ''} — ${labelAtraso(e.categoria)}${e.motivo ? `: ${e.motivo}` : ''}`
      ),
    ];
    await Share.share({ message: lines.filter(Boolean).join('\n') });
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>;
  }

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.container}>

      {/* ── Cabeçalho ── */}
      <View style={styles.header}>
        <Text style={styles.headerNome}>{obraNome}</Text>
        <Text style={styles.headerData}>
          Relatório gerado em {new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
        </Text>
        <View style={styles.progressRow}>
          <ProgressBar percent={progresso} color={corBarra} />
          <Text style={styles.progressLabel}>{progresso}%</Text>
        </View>
        <Text style={styles.progressSub}>{etConcluidas.length} de {totalEt} etapas concluídas</Text>
      </View>

      {/* ── KPIs ── */}
      <View style={styles.kpiRow}>
        <KpiCard label="Progresso" value={`${progresso}%`} cor={corProgresso} sub={`${etConcluidas.length} de ${totalEt} etapas`} />
        <KpiCard label="Problemas" value={String(totalProblemas)} cor={totalProblemas > 0 ? colors.danger : colors.success} sub="atrasos + bloqueios" />
      </View>
      <View style={styles.kpiRow}>
        <KpiCard label="A comprar" value={String(matComprar.length)} cor={colors.warning} sub="materiais pendentes" />
        <KpiCard label="Contratar"  value={String(conFazer.length)}   cor="#8b5cf6"        sub="serviços pendentes" />
      </View>

      {/* ── Causas dos Atrasos (gráfico de pizza) ── */}
      <View style={styles.secao}>
        <Text style={styles.secaoTitulo}>⚠️ Causas dos Atrasos</Text>
        <Text style={styles.secaoCount}>
          {totalProblemas === 0
            ? 'Nenhum item com problema'
            : `${totalProblemas} item${totalProblemas !== 1 ? 's' : ''} com atraso ou bloqueio`}
        </Text>
        {delaySlices.length > 0 ? (
          <View style={styles.pieWrapper}>
            <PieChart slices={delaySlices} size={160} />
            <View style={styles.legendaCol}>
              {delaySlices.map(sl => (
                <View key={sl.label} style={styles.legendaItem}>
                  <View style={[styles.legendaDot, { backgroundColor: sl.color }]} />
                  <Text style={styles.legendaTexto}>
                    {sl.label}{'\n'}
                    <Text style={styles.legendaPct}>
                      {sl.value} item{sl.value !== 1 ? 's' : ''} ({Math.round((sl.value / totalProblemas) * 100)}%)
                    </Text>
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ) : (
          <View style={styles.vazioBom}>
            <Text style={styles.vazioBomText}>✅ Nenhum atraso ou bloqueio registrado</Text>
          </View>
        )}
      </View>

      {/* ── Detalhe dos Atrasos (com motivo, fica gravado) ── */}
      {itensComAtraso.length > 0 && (
        <View style={styles.secao}>
          <Text style={styles.secaoTitulo}>📋 Detalhe dos Atrasos</Text>
          <Text style={styles.secaoCount}>{itensComAtraso.length} item{itensComAtraso.length !== 1 ? 's' : ''} com atraso (etapas, materiais e contratações)</Text>
          {itensComAtraso.map(e => (
            <View key={`${e.tipo}-${e.id}`} style={[styles.item, !e.concluida && styles.itemUrgente]}>
              <View style={[styles.itemDot, { backgroundColor: corAtraso(e.categoria) }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.itemNome}>
                  <Text style={styles.atrasoTipo}>{e.tipo.toUpperCase()}  </Text>
                  {e.nome}{'  '}
                  <Text style={{ fontSize: 11, color: e.concluida ? colors.success : colors.danger }}>
                    {e.concluida ? '✓ resolvido c/ atraso' : 'em atraso'}
                  </Text>
                </Text>
                <Text style={styles.itemMeta}>{labelAtraso(e.categoria)}{e.motivo ? ` — ${e.motivo}` : ''}</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* ── Materiais a comprar ── */}
      <View style={styles.secao}>
        <Text style={styles.secaoTitulo}>🛒 Materiais a Comprar</Text>
        <Text style={styles.secaoCount}>
          {matComprar.length} item{matComprar.length !== 1 ? 's' : ''} · {matEntregues.length}/{totalMat} entregues
        </Text>
        {matComprar.length === 0 ? (
          <View style={styles.vazioBom}><Text style={styles.vazioBomText}>✅ Nenhum material pendente</Text></View>
        ) : (
          matComprar.map(m => (
            <View key={m.id} style={[styles.item, m.status === 'faltando' && styles.itemUrgente]}>
              <View style={[styles.itemDot, { backgroundColor: m.status === 'faltando' ? colors.danger : colors.warning }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.itemNome}>{m.nome}</Text>
                <Text style={styles.itemMeta}>
                  {m.status === 'faltando' ? '⚠️ Faltando' : m.status === 'pausada' ? '⏸️ Pausado' : 'Pendente'}
                </Text>
              </View>
            </View>
          ))
        )}
      </View>

      {/* ── Contratações a fazer ── */}
      <View style={styles.secao}>
        <Text style={styles.secaoTitulo}>👷 Contratações a Fazer</Text>
        <Text style={styles.secaoCount}>
          {conFazer.length} item{conFazer.length !== 1 ? 's' : ''}
          {valorTotalPendente > 0 ? ` · R$ ${valorTotalPendente.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : ''}
        </Text>
        {conFazer.length === 0 ? (
          <View style={styles.vazioBom}><Text style={styles.vazioBomText}>✅ Nenhuma contratação pendente</Text></View>
        ) : (
          conFazer.map(c => {
            const atr = atrasado(c.data_previsao_fim, c.status);
            return (
              <View key={c.id} style={[styles.item, atr && styles.itemUrgente]}>
                <View style={[styles.itemDot, { backgroundColor: atr ? colors.danger : '#8b5cf6' }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemNome}>{c.nome}</Text>
                  <Text style={styles.itemMeta}>
                    {c.especialidade ?? 'Sem especialidade'}
                    {c.data_previsao_fim ? ` · Prazo: ${fmt(c.data_previsao_fim)}` : ''}
                    {atr ? ' ⚠️ ATRASADA' : ''}
                  </Text>
                  {c.valor != null && (
                    <Text style={styles.itemValor}>R$ {c.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</Text>
                  )}
                </View>
              </View>
            );
          })
        )}
      </View>

      {/* ── Etapas em andamento ── */}
      <View style={styles.secao}>
        <Text style={styles.secaoTitulo}>🏗️ Etapas em Andamento</Text>
        <Text style={styles.secaoCount}>{etAndamento.length} etapa{etAndamento.length !== 1 ? 's' : ''}</Text>
        {etAndamento.length === 0 ? (
          <Text style={styles.vazio}>Nenhuma etapa em andamento.</Text>
        ) : (
          etAndamento.map(e => {
            const atr = atrasado(e.data_previsao_fim, e.status);
            return (
              <View key={e.id} style={[styles.item, atr && styles.itemUrgente]}>
                <View style={[styles.itemDot, { backgroundColor: atr ? colors.danger : colors.primary }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemNome}>{e.nome}</Text>
                  {e.data_previsao_fim && (
                    <Text style={[styles.itemMeta, atr && { color: colors.danger, fontWeight: '600' }]}>
                      {atr ? '⚠️ Atrasada · ' : ''}Prazo: {fmt(e.data_previsao_fim)}
                    </Text>
                  )}
                </View>
              </View>
            );
          })
        )}
      </View>

      {/* ── Próximas etapas ── */}
      {etPendentes.length > 0 && (
        <View style={styles.secao}>
          <Text style={styles.secaoTitulo}>📋 Próximas Etapas</Text>
          <Text style={styles.secaoCount}>{etPendentes.length} etapa{etPendentes.length !== 1 ? 's' : ''} não iniciadas</Text>
          {etPendentes.map(e => (
            <View key={e.id} style={styles.item}>
              <View style={[styles.itemDot, { backgroundColor: colors.textMuted }]} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.itemNome, { color: colors.textMuted }]}>{e.nome}</Text>
                {e.data_previsao_fim && (
                  <Text style={styles.itemMeta}>Previsto: {fmt(e.data_previsao_fim)}</Text>
                )}
              </View>
            </View>
          ))}
        </View>
      )}

      {/* ── Etapas concluídas ── */}
      <View style={styles.secao}>
        <Text style={styles.secaoTitulo}>✅ Etapas Concluídas</Text>
        <Text style={styles.secaoCount}>{etConcluidas.length} de {totalEt}</Text>
        {etConcluidas.length === 0 ? (
          <Text style={styles.vazio}>Nenhuma etapa concluída ainda.</Text>
        ) : (
          etConcluidas.map(e => (
            <View key={e.id} style={styles.item}>
              <View style={[styles.itemDot, { backgroundColor: colors.success }]} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.itemNome, { color: colors.textMuted }]}>{e.nome}</Text>
                {e.data_conclusao && (
                  <Text style={styles.itemMeta}>Concluída em {fmt(e.data_conclusao)}</Text>
                )}
              </View>
            </View>
          ))
        )}
      </View>

      {/* ── Pausadas ── */}
      {(etPausaClima.length > 0 || etPausaOutros.length > 0) && (
        <View style={styles.secao}>
          <Text style={styles.secaoTitulo}>⏸️ Etapas Pausadas</Text>
          <Text style={styles.secaoCount}>{etPausaClima.length + etPausaOutros.length} etapa{etPausaClima.length + etPausaOutros.length !== 1 ? 's' : ''}</Text>
          {etPausaClima.map(e => (
            <View key={e.id} style={styles.item}>
              <View style={[styles.itemDot, { backgroundColor: '#06b6d4' }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.itemNome}>{e.nome}</Text>
                <Text style={styles.itemMeta}>⛈️ Pausada por condições climáticas</Text>
              </View>
            </View>
          ))}
          {etPausaOutros.map(e => (
            <View key={e.id} style={styles.item}>
              <View style={[styles.itemDot, { backgroundColor: colors.warning }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.itemNome}>{e.nome}</Text>
                <Text style={styles.itemMeta}>Pausada — outros motivos</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* ── Botões ── */}
      <Pressable
        style={[styles.btnPdf, gerandoPdf && styles.btnDisabled]}
        onPress={gerarPdf}
        disabled={gerandoPdf}
      >
        {gerandoPdf
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.btnPdfText}>📄  Exportar como PDF</Text>}
      </Pressable>

      <Pressable style={styles.btnShare} onPress={onShare}>
        <Text style={styles.btnShareText}>📤  Compartilhar Resumo</Text>
      </Pressable>

      <View style={{ height: spacing.xl * 2 }} />
    </ScrollView>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  container: { padding: spacing.md },

  header: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  headerNome: { fontSize: 20, fontWeight: '800', color: '#fff', marginBottom: 4 },
  headerData: { fontSize: 12, color: 'rgba(255,255,255,0.75)', marginBottom: spacing.sm },

  progressRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  progressBg: {
    flex: 1, height: 7,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: { height: 7, borderRadius: 4 },
  progressLabel: { fontSize: 13, color: '#fff', fontWeight: '800', minWidth: 36, textAlign: 'right' },
  progressSub: { fontSize: 11, color: 'rgba(255,255,255,0.65)', marginTop: 5 },

  kpiRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  kpiCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 4,
    padding: spacing.md,
  },
  kpiValue: { fontSize: 26, fontWeight: '800', lineHeight: 30 },
  kpiLabel: { fontSize: 13, fontWeight: '600', color: colors.text, marginTop: 2 },
  kpiSub: { fontSize: 11, color: colors.textMuted, marginTop: 1 },

  secao: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  secaoTitulo: { fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 2 },
  secaoCount: { fontSize: 12, color: colors.textMuted, marginBottom: spacing.sm },

  pieWrapper: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.xs },
  legendaCol: { flex: 1, gap: spacing.sm },
  legendaItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  legendaDot: { width: 10, height: 10, borderRadius: 5, marginTop: 3 },
  legendaTexto: { fontSize: 12, color: colors.text, lineHeight: 16, flex: 1 },
  legendaPct: { fontSize: 11, color: colors.textMuted },

  item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: spacing.xs + 2,
    borderBottomWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  itemUrgente: { backgroundColor: '#fff5f5', marginHorizontal: -spacing.md, paddingHorizontal: spacing.md },
  itemDot: { width: 8, height: 8, borderRadius: 4, marginTop: 5 },
  itemNome: { fontSize: 14, color: colors.text, fontWeight: '500', flex: 1 },
  atrasoTipo: { fontSize: 10, color: colors.textMuted, fontWeight: '800' },
  itemMeta: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
  itemValor: { fontSize: 12, color: colors.success, fontWeight: '600', marginTop: 1 },

  vazioBom: {
    backgroundColor: colors.success + '18',
    borderRadius: 8,
    padding: spacing.sm,
    alignItems: 'center',
  },
  vazioBomText: { fontSize: 13, color: colors.success, fontWeight: '600' },
  vazio: { fontSize: 13, color: colors.textMuted, fontStyle: 'italic', textAlign: 'center', paddingVertical: spacing.sm },

  btnPdf: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
    minHeight: 50,
    justifyContent: 'center',
  },
  btnDisabled: { opacity: 0.6 },
  btnPdfText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  btnShare: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  btnShareText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
