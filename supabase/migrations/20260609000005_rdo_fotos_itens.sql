-- =====================================================================
-- RDO: fotos do dia + itens vinculados (etapas/materiais/contratações)
-- - itens: o que foi feito hoje, puxado das etapas/materiais/contratações
--   marcados na obra. Ex.: [{ tipo:'etapa', id, nome }]
-- - fotos: URLs públicas das fotos do dia (bucket "midias").
-- =====================================================================

alter table public.rdo
  add column if not exists itens jsonb  not null default '[]'::jsonb,
  add column if not exists fotos text[] not null default '{}';
