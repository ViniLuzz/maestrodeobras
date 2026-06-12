-- =====================================================================
-- Controle financeiro simples dos aluguéis
-- - "pago": marca se o valor do aluguel já foi recebido pela loja.
--   Permite separar "recebido" de "em aberto" no painel financeiro.
-- =====================================================================

alter table public.alugueis
  add column if not exists pago boolean not null default false;
