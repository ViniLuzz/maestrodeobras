-- ============================================================
-- Maestro de Obras — Marketplace de Prestadores
-- ============================================================
-- Adiciona campos de marketplace à tabela pessoas.
-- Cria bucket público "avatares" para fotos de perfil.
-- RLS: qualquer usuário autenticado vê perfis visíveis no marketplace.
-- ============================================================

-- Campos de marketplace na tabela pessoas
alter table public.pessoas
  add column if not exists disponivel_marketplace boolean not null default false,
  add column if not exists especialidade text,
  add column if not exists descricao_marketplace text,
  add column if not exists cidade text,
  add column if not exists estado text,
  add column if not exists avatar_url text;

-- Índice para filtro no marketplace
create index if not exists idx_pessoas_marketplace
  on public.pessoas (especialidade, cidade, estado)
  where disponivel_marketplace = true and deletado = false and ativo = true;

-- RLS: qualquer autenticado pode ver perfis ativos no marketplace
create policy "pessoas_select_marketplace" on public.pessoas
  for select to authenticated
  using (
    deletado = false
    and ativo = true
    and disponivel_marketplace = true
  );

-- Bucket público para avatares de perfil
insert into storage.buckets (id, name, public)
values ('avatares', 'avatares', true)
on conflict (id) do nothing;

-- Storage RLS: leitura pública
create policy "avatares_public_read" on storage.objects
  for select using (bucket_id = 'avatares');

-- Storage RLS: usuário autenticado gerencia própria pasta (auth_user_id/)
create policy "avatares_auth_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatares'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatares_auth_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'avatares'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatares_auth_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'avatares'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
