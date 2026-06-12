-- ============================================================
-- Maestro de Obras — Fase 1 — Schema inicial
-- ============================================================
-- Cria as tabelas-base do sistema:
--   pessoas, user_roles, licencas, obras, obra_membros
-- Soft delete em todas as tabelas de domínio (deletado/deletado_em).
-- Triggers de atualizado_em e auto-vincular admin como obra_membros.
-- ============================================================

-- =====================
-- ENUMS
-- =====================
create type public.app_role as enum ('admin');
create type public.obra_role as enum ('admin', 'trabalhador');
create type public.obra_status as enum ('em_andamento', 'concluida', 'pausada', 'cancelada');

-- =====================
-- TABLE: pessoas
-- Qualquer humano do sistema (admin de obra, prestador autônomo, trabalhador convidado).
-- Pode ou não ter auth_user_id (workers convidados podem existir sem login direto).
-- =====================
create table public.pessoas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  email text,
  telefone text,
  cor text not null default '#3b82f6',
  is_admin boolean not null default false,
  auth_user_id uuid references auth.users(id) on delete set null unique,
  ativo boolean not null default true,
  ultimo_acesso timestamptz,
  -- assinatura (Stripe — Fase 7)
  plano_ativo boolean not null default false,
  plano_expira_em timestamptz,
  stripe_customer_id text,
  stripe_subscription_id text,
  -- notificações (Fase 5)
  notificacoes_ativas boolean not null default true,
  notificacao_2_dias boolean not null default true,
  notificacao_3_dias boolean not null default true,
  push_token text,
  onesignal_player_id text,
  -- soft delete
  deletado boolean not null default false,
  deletado_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index idx_pessoas_auth_user on public.pessoas(auth_user_id) where deletado = false;
create index idx_pessoas_email on public.pessoas(lower(email)) where email is not null and deletado = false;

-- =====================
-- TABLE: user_roles
-- Roles globais do sistema (não confundir com obra_membros.role).
-- Hoje só tem 'admin' (super-admin do sistema). Pode crescer no futuro.
-- =====================
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role app_role not null,
  criado_em timestamptz not null default now(),
  unique (user_id, role)
);

-- =====================
-- TABLE: licencas
-- Códigos de ativação (Stripe paga → licença gerada → admin ativa)
-- =====================
create table public.licencas (
  id uuid primary key default gen_random_uuid(),
  codigo_ativacao text not null unique,
  email_comprador text,
  stripe_payment_id text,
  usado boolean not null default false,
  usado_por uuid references public.pessoas(id) on delete set null,
  usado_em timestamptz,
  expira_em timestamptz,
  criado_em timestamptz not null default now()
);

create index idx_licencas_codigo on public.licencas(codigo_ativacao) where usado = false;

-- =====================
-- TABLE: obras
-- Projeto de construção. Um admin pode ter N obras simultâneas.
-- =====================
create table public.obras (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  descricao text,
  endereco text,
  cidade text,
  estado text,
  data_inicio date,
  data_previsao_termino date,
  data_termino_real date,
  status obra_status not null default 'em_andamento',
  admin_id uuid not null references public.pessoas(id) on delete restrict,
  -- soft delete
  deletado boolean not null default false,
  deletado_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index idx_obras_admin on public.obras(admin_id) where deletado = false;
create index idx_obras_status on public.obras(status) where deletado = false;

-- =====================
-- TABLE: obra_membros
-- Quem tem acesso a qual obra e em que papel.
-- token_acesso: opcional, gerado pra trabalhadores que entram via link sem login direto.
-- expira_em: quando obra termina, admin pode setar pra invalidar acesso.
-- =====================
create table public.obra_membros (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references public.obras(id) on delete cascade,
  pessoa_id uuid not null references public.pessoas(id) on delete cascade,
  role obra_role not null,
  token_acesso text unique,
  ativo boolean not null default true,
  expira_em timestamptz,
  convidado_por uuid references public.pessoas(id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (obra_id, pessoa_id)
);

create index idx_obra_membros_obra on public.obra_membros(obra_id) where ativo = true;
create index idx_obra_membros_pessoa on public.obra_membros(pessoa_id) where ativo = true;
create index idx_obra_membros_token on public.obra_membros(token_acesso) where token_acesso is not null and ativo = true;

-- =====================
-- FUNCTION + TRIGGER: atualizado_em
-- =====================
create or replace function public.tg_atualizado_em()
returns trigger
language plpgsql
as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$;

create trigger pessoas_atualizado_em before update on public.pessoas
  for each row execute function public.tg_atualizado_em();
create trigger obras_atualizado_em before update on public.obras
  for each row execute function public.tg_atualizado_em();
create trigger obra_membros_atualizado_em before update on public.obra_membros
  for each row execute function public.tg_atualizado_em();

-- =====================
-- TRIGGER: ao criar obra, vincular admin como obra_membro automaticamente
-- e marcar pessoa.is_admin = true
-- =====================
create or replace function public.tg_obra_criar_admin_membro()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.obra_membros (obra_id, pessoa_id, role, ativo)
  values (new.id, new.admin_id, 'admin', true)
  on conflict (obra_id, pessoa_id) do nothing;

  update public.pessoas set is_admin = true where id = new.admin_id and is_admin = false;

  return new;
end;
$$;

create trigger obras_auto_admin_membro after insert on public.obras
  for each row execute function public.tg_obra_criar_admin_membro();
