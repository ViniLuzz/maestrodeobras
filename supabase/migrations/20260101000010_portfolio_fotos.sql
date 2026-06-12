-- ============================================================
-- Maestro de Obras — Portfólio de fotos de serviços
-- ============================================================
-- Permite que prestadores de serviço publiquem fotos de obras
-- anteriores no seu perfil do marketplace.
-- ============================================================

create table if not exists public.portfolio_fotos (
  id          uuid primary key default gen_random_uuid(),
  pessoa_id   uuid not null references public.pessoas(id) on delete cascade,
  storage_path text not null,
  url         text not null,
  descricao   text,
  ordem       integer not null default 0,
  criado_em   timestamptz not null default now()
);

create index if not exists idx_portfolio_pessoa on public.portfolio_fotos(pessoa_id, ordem);

-- RLS
alter table public.portfolio_fotos enable row level security;

-- Qualquer usuário autenticado pode ver fotos de portfólio
create policy "portfolio_select" on public.portfolio_fotos
  for select to authenticated using (true);

-- Apenas o dono pode inserir/deletar suas fotos
create policy "portfolio_insert" on public.portfolio_fotos
  for insert to authenticated
  with check (
    pessoa_id = (
      select id from public.pessoas
      where auth_user_id = auth.uid()
      limit 1
    )
  );

create policy "portfolio_delete" on public.portfolio_fotos
  for delete to authenticated
  using (
    pessoa_id = (
      select id from public.pessoas
      where auth_user_id = auth.uid()
      limit 1
    )
  );

-- Storage: bucket público para fotos de portfólio
insert into storage.buckets (id, name, public)
values ('portfolio', 'portfolio', true)
on conflict do nothing;

-- Dono pode fazer upload/delete na sua pasta
create policy "portfolio_storage_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'portfolio' and
    (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "portfolio_storage_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'portfolio' and
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Leitura pública (bucket já é public, mas por garantia)
create policy "portfolio_storage_select" on storage.objects
  for select using (bucket_id = 'portfolio');
