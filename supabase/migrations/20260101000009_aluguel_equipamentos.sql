-- ============================================================
-- Maestro de Obras — Aluguel de Equipamentos
-- ============================================================
-- Lojas de aluguel de equipamentos e seus catálogos.
-- O cadastro de lojas é feito externamente (painel Supabase ou
-- formulário web). O app mobile apenas exibe.
-- ============================================================

create table if not exists public.lojas_equipamentos (
  id           uuid primary key default gen_random_uuid(),
  nome         text not null,
  descricao    text,
  cidade       text,
  estado       char(2),
  telefone     text,
  endereco     text,
  avatar_url   text,
  latitude     double precision,
  longitude    double precision,
  ativo        boolean not null default true,
  deletado     boolean not null default false,
  criado_em    timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table if not exists public.equipamentos (
  id           uuid primary key default gen_random_uuid(),
  loja_id      uuid not null references public.lojas_equipamentos(id) on delete cascade,
  nome         text not null,
  categoria    text,
  descricao    text,
  foto_url     text,
  preco_diaria numeric(10,2),
  ativo        boolean not null default true,
  deletado     boolean not null default false,
  criado_em    timestamptz not null default now()
);

-- Índices para busca
create index if not exists idx_equipamentos_loja on public.equipamentos(loja_id);
create index if not exists idx_equipamentos_categoria on public.equipamentos(categoria);
create index if not exists idx_lojas_cidade on public.lojas_equipamentos(cidade, estado);

-- RLS: qualquer usuário autenticado pode consultar
alter table public.lojas_equipamentos enable row level security;
alter table public.equipamentos enable row level security;

create policy "lojas_equipamentos_select" on public.lojas_equipamentos
  for select to authenticated
  using (ativo = true and deletado = false);

create policy "equipamentos_select" on public.equipamentos
  for select to authenticated
  using (ativo = true and deletado = false);
