-- ============================================================
-- Maestro de Obras — Fase 2 — Etapas, Materiais, Contratações
-- ============================================================
-- Novas tabelas do core de gestão:
--   etapas, etapa_dependencias, materiais, contratacoes
-- Todos com soft delete e triggers atualizado_em.
-- RLS: membros ativos da obra têm acesso read/write.
-- ============================================================

-- =====================
-- ENUMS
-- =====================
create type public.etapa_status as enum ('pendente', 'em_andamento', 'concluida', 'cancelada');
create type public.material_status as enum ('pendente', 'entregue', 'faltando', 'cancelado');
create type public.contratacao_status as enum ('pendente', 'em_andamento', 'concluida', 'cancelada');

-- =====================
-- TABLE: etapas
-- =====================
create table public.etapas (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references public.obras(id) on delete cascade,
  nome text not null,
  descricao text,
  ordem int not null default 0,
  status etapa_status not null default 'pendente',
  responsavel_id uuid references public.pessoas(id) on delete set null,
  data_inicio date,
  data_previsao_fim date,
  data_conclusao date,
  deletado boolean not null default false,
  deletado_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index idx_etapas_obra on public.etapas(obra_id) where deletado = false;
create index idx_etapas_status on public.etapas(obra_id, status) where deletado = false;

-- =====================
-- TABLE: etapa_dependencias
-- Etapa B depende de etapa A — A deve ser concluída antes de B.
-- =====================
create table public.etapa_dependencias (
  id uuid primary key default gen_random_uuid(),
  etapa_id uuid not null references public.etapas(id) on delete cascade,
  depende_de_id uuid not null references public.etapas(id) on delete cascade,
  criado_em timestamptz not null default now(),
  unique (etapa_id, depende_de_id),
  check (etapa_id != depende_de_id)
);

create index idx_etapa_dep_etapa on public.etapa_dependencias(etapa_id);
create index idx_etapa_dep_depende on public.etapa_dependencias(depende_de_id);

-- =====================
-- TABLE: materiais
-- =====================
create table public.materiais (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references public.obras(id) on delete cascade,
  etapa_id uuid references public.etapas(id) on delete set null,
  nome text not null,
  descricao text,
  quantidade numeric(12,3),
  unidade text,
  status material_status not null default 'pendente',
  responsavel_id uuid references public.pessoas(id) on delete set null,
  data_previsao date,
  data_conclusao date,
  obs text,
  deletado boolean not null default false,
  deletado_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index idx_materiais_obra on public.materiais(obra_id) where deletado = false;

-- =====================
-- TABLE: contratacoes
-- =====================
create table public.contratacoes (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references public.obras(id) on delete cascade,
  etapa_id uuid references public.etapas(id) on delete set null,
  nome text not null,
  descricao text,
  especialidade text,
  pessoa_nome text,
  pessoa_contato text,
  status contratacao_status not null default 'pendente',
  data_inicio date,
  data_previsao_fim date,
  data_conclusao date,
  valor numeric(12,2),
  obs text,
  deletado boolean not null default false,
  deletado_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index idx_contratacoes_obra on public.contratacoes(obra_id) where deletado = false;

-- =====================
-- TRIGGERS: atualizado_em
-- =====================
create trigger etapas_atualizado_em before update on public.etapas
  for each row execute function public.tg_atualizado_em();

create trigger materiais_atualizado_em before update on public.materiais
  for each row execute function public.tg_atualizado_em();

create trigger contratacoes_atualizado_em before update on public.contratacoes
  for each row execute function public.tg_atualizado_em();

-- =====================
-- RLS: etapas
-- Todos os membros ativos da obra podem ler e escrever.
-- Soft delete via UPDATE (nunca DELETE direto).
-- =====================
alter table public.etapas enable row level security;

create policy "etapas_select" on public.etapas
  for select to authenticated
  using (
    deletado = false
    and public.is_member_of_obra(obra_id, public.get_pessoa_id_from_auth())
  );

create policy "etapas_insert" on public.etapas
  for insert to authenticated
  with check (public.is_member_of_obra(obra_id, public.get_pessoa_id_from_auth()));

create policy "etapas_update" on public.etapas
  for update to authenticated
  using (public.is_member_of_obra(obra_id, public.get_pessoa_id_from_auth()))
  with check (public.is_member_of_obra(obra_id, public.get_pessoa_id_from_auth()));

-- =====================
-- RLS: etapa_dependencias
-- =====================
alter table public.etapa_dependencias enable row level security;

create policy "etapa_dep_select" on public.etapa_dependencias
  for select to authenticated
  using (
    exists (
      select 1 from public.etapas e
      where e.id = etapa_id
        and e.deletado = false
        and public.is_member_of_obra(e.obra_id, public.get_pessoa_id_from_auth())
    )
  );

create policy "etapa_dep_insert" on public.etapa_dependencias
  for insert to authenticated
  with check (
    exists (
      select 1 from public.etapas e
      where e.id = etapa_id
        and e.deletado = false
        and public.is_member_of_obra(e.obra_id, public.get_pessoa_id_from_auth())
    )
  );

create policy "etapa_dep_delete" on public.etapa_dependencias
  for delete to authenticated
  using (
    exists (
      select 1 from public.etapas e
      where e.id = etapa_id
        and e.deletado = false
        and public.is_member_of_obra(e.obra_id, public.get_pessoa_id_from_auth())
    )
  );

-- =====================
-- RLS: materiais
-- =====================
alter table public.materiais enable row level security;

create policy "materiais_select" on public.materiais
  for select to authenticated
  using (
    deletado = false
    and public.is_member_of_obra(obra_id, public.get_pessoa_id_from_auth())
  );

create policy "materiais_insert" on public.materiais
  for insert to authenticated
  with check (public.is_member_of_obra(obra_id, public.get_pessoa_id_from_auth()));

create policy "materiais_update" on public.materiais
  for update to authenticated
  using (public.is_member_of_obra(obra_id, public.get_pessoa_id_from_auth()))
  with check (public.is_member_of_obra(obra_id, public.get_pessoa_id_from_auth()));

-- =====================
-- RLS: contratacoes
-- =====================
alter table public.contratacoes enable row level security;

create policy "contratacoes_select" on public.contratacoes
  for select to authenticated
  using (
    deletado = false
    and public.is_member_of_obra(obra_id, public.get_pessoa_id_from_auth())
  );

create policy "contratacoes_insert" on public.contratacoes
  for insert to authenticated
  with check (public.is_member_of_obra(obra_id, public.get_pessoa_id_from_auth()));

create policy "contratacoes_update" on public.contratacoes
  for update to authenticated
  using (public.is_member_of_obra(obra_id, public.get_pessoa_id_from_auth()))
  with check (public.is_member_of_obra(obra_id, public.get_pessoa_id_from_auth()));
