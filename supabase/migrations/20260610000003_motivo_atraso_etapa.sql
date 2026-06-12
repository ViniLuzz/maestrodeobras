-- =====================================================================
-- Motivo de atraso das etapas — fica REGISTRADO no relatório executivo,
-- mesmo depois que a etapa é concluída (histórico da obra do início ao fim).
--   categoria_atraso: causa programada (clima, material, mao_obra, acidente,
--                     projeto, financeiro, outro)
--   motivo_atraso:    detalhe livre (obrigatório quando categoria = 'outro')
-- =====================================================================

alter table public.etapas
  add column if not exists categoria_atraso text,
  add column if not exists motivo_atraso text;
