-- =====================================================================
-- RDO — Relatório Diário de Obra
-- Um registro por dia, por obra: clima, condição (trabalhou/parou),
-- efetivo (membros do app presentes + trabalhadores externos), atividades
-- e ocorrências. Vira o diário oficial da obra (exportável em PDF).
-- =====================================================================

create table if not exists public.rdo (
  id                uuid primary key default gen_random_uuid(),
  obra_id           uuid not null references public.obras(id) on delete cascade,
  data              date not null default current_date,
  clima             text,   -- 'bom' | 'nublado' | 'chuva'
  condicao          text,   -- 'trabalhou' | 'parou'
  membros_presentes uuid[] not null default '{}',          -- pessoa_ids presentes
  externos          jsonb  not null default '[]'::jsonb,    -- [{ nome, funcao }]
  atividades        text,
  ocorrencias       text,
  criado_por        uuid references public.pessoas(id),
  deletado          boolean not null default false,
  criado_em         timestamptz not null default now(),
  atualizado_em     timestamptz not null default now()
);

create index if not exists idx_rdo_obra on public.rdo(obra_id);
create index if not exists idx_rdo_data on public.rdo(obra_id, data desc);

alter table public.rdo enable row level security;

-- Qualquer membro da obra pode ver e registrar RDOs (mesmo padrão de etapas).
create policy "rdo_select" on public.rdo
  for select to authenticated
  using (
    deletado = false
    and public.is_member_of_obra(obra_id, public.get_pessoa_id_from_auth())
  );

create policy "rdo_insert" on public.rdo
  for insert to authenticated
  with check (public.is_member_of_obra(obra_id, public.get_pessoa_id_from_auth()));

create policy "rdo_update" on public.rdo
  for update to authenticated
  using (public.is_member_of_obra(obra_id, public.get_pessoa_id_from_auth()))
  with check (public.is_member_of_obra(obra_id, public.get_pessoa_id_from_auth()));
