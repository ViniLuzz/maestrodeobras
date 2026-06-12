// Causas de atraso pré-programadas (usadas no formulário da etapa e no
// relatório executivo). 'outro' exige um motivo livre digitado.
export type CategoriaAtraso =
  | 'clima' | 'material' | 'mao_obra' | 'acidente' | 'projeto' | 'financeiro' | 'outro';

export const CATEGORIAS_ATRASO: { value: CategoriaAtraso; label: string; emoji: string; color: string }[] = [
  { value: 'clima',      label: 'Clima / chuva',        emoji: '🌧️', color: '#06b6d4' },
  { value: 'material',   label: 'Falta de material',    emoji: '📦', color: '#d97706' },
  { value: 'mao_obra',   label: 'Falta de mão de obra', emoji: '👷', color: '#8b5cf6' },
  { value: 'acidente',   label: 'Acidente / segurança', emoji: '🚑', color: '#dc2626' },
  { value: 'projeto',    label: 'Alteração de projeto', emoji: '📐', color: '#2563eb' },
  { value: 'financeiro', label: 'Financeiro',           emoji: '💰', color: '#16a34a' },
  { value: 'outro',      label: 'Outro',                emoji: '📝', color: '#64748b' },
];

export function labelAtraso(cat: string | null | undefined): string {
  const c = CATEGORIAS_ATRASO.find(x => x.value === cat);
  return c ? `${c.emoji} ${c.label}` : '📝 Não informado';
}

export function corAtraso(cat: string | null | undefined): string {
  return CATEGORIAS_ATRASO.find(x => x.value === cat)?.color ?? '#94a3b8';
}
