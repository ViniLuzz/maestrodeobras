-- =====================================================================
-- Gerenciamento de estoque e aluguéis para lojas de equipamentos (Nível 3)
-- - Cada equipamento ganha "quantidade_total" (quantas unidades a loja tem).
-- - Tabela "alugueis" registra cada locação (cliente, datas, quantidade).
-- - Disponível = quantidade_total - soma das quantidades em aluguéis ativos.
-- =====================================================================

-- 1) Estoque por equipamento
alter table public.equipamentos
  add column if not exists quantidade_total int not null default 1;

-- 2) Tabela de aluguéis
create table if not exists public.alugueis (
  id               uuid primary key default gen_random_uuid(),
  loja_id          uuid not null references public.lojas_equipamentos(id) on delete cascade,
  equipamento_id   uuid not null references public.equipamentos(id) on delete cascade,
  cliente_nome     text not null,
  cliente_telefone text,
  quantidade       int not null default 1 check (quantidade > 0),
  data_inicio      date not null default current_date,
  data_fim         date,
  valor_total      numeric(10,2),
  observacao       text,
  status           text not null default 'ativo' check (status in ('ativo', 'devolvido')),
  deletado         boolean not null default false,
  criado_em        timestamptz not null default now(),
  atualizado_em    timestamptz not null default now()
);

create index if not exists idx_alugueis_loja on public.alugueis(loja_id);
create index if not exists idx_alugueis_equipamento on public.alugueis(equipamento_id);
create index if not exists idx_alugueis_status on public.alugueis(status);

-- 3) RLS — só o dono da loja enxerga/gerencia seus aluguéis
alter table public.alugueis enable row level security;

create policy "alugueis_select_owner" on public.alugueis
  for select to authenticated
  using (
    loja_id in (
      select id from public.lojas_equipamentos
      where auth_user_id = auth.uid()
    )
  );

create policy "alugueis_insert" on public.alugueis
  for insert to authenticated
  with check (
    loja_id in (
      select id from public.lojas_equipamentos
      where auth_user_id = auth.uid()
    )
  );

create policy "alugueis_update" on public.alugueis
  for update to authenticated
  using (
    loja_id in (
      select id from public.lojas_equipamentos
      where auth_user_id = auth.uid()
    )
  )
  with check (
    loja_id in (
      select id from public.lojas_equipamentos
      where auth_user_id = auth.uid()
    )
  );

create policy "alugueis_delete" on public.alugueis
  for delete to authenticated
  using (
    loja_id in (
      select id from public.lojas_equipamentos
      where auth_user_id = auth.uid()
    )
  );
