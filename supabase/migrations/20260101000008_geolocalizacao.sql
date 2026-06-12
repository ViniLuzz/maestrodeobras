-- ============================================================
-- Maestro de Obras — Geolocalização de prestadores
-- ============================================================
-- Adiciona latitude/longitude à tabela pessoas para ordenação
-- por distância no marketplace.
-- ============================================================

alter table public.pessoas
  add column if not exists latitude double precision,
  add column if not exists longitude double precision;
