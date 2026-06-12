-- =====================================================================
-- Motivo de atraso para MATERIAIS e CONTRATAÇÕES — mesma lógica das etapas.
-- Tudo que atrasa fica REGISTRADO no relatório executivo da obra, com a causa.
--   categoria_atraso: clima, material, mao_obra, acidente, projeto,
--                     financeiro, outro
--   motivo_atraso:    detalhe livre (obrigatório quando categoria = 'outro')
-- =====================================================================

alter table public.materiais
  add column if not exists categoria_atraso text,
  add column if not exists motivo_atraso text;

alter table public.contratacoes
  add column if not exists categoria_atraso text,
  add column if not exists motivo_atraso text;
