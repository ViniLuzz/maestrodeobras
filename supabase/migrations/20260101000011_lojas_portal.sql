-- ============================================================
-- Maestro de Obras — Portal web das lojas de equipamentos
-- ============================================================
-- Vincula lojas a usuários autenticados e adiciona políticas
-- de escrita para que donos gerenciem seu cadastro pelo portal.
-- ============================================================

-- Vincula a loja ao usuário que a cadastrou
alter table public.lojas_equipamentos
  add column if not exists auth_user_id uuid references auth.users(id);

-- Donos podem cadastrar sua loja
create policy "lojas_equipamentos_insert" on public.lojas_equipamentos
  for insert to authenticated
  with check (auth_user_id = auth.uid());

-- Donos podem editar somente sua loja
create policy "lojas_equipamentos_update" on public.lojas_equipamentos
  for update to authenticated
  using  (auth_user_id = auth.uid())
  with check (auth_user_id = auth.uid());

-- Donos podem excluir somente sua loja
create policy "lojas_equipamentos_delete" on public.lojas_equipamentos
  for delete to authenticated
  using (auth_user_id = auth.uid());

-- SELECT existente: inclui lojas inativas do próprio dono (para o portal)
create policy "lojas_equipamentos_select_owner" on public.lojas_equipamentos
  for select to authenticated
  using (auth_user_id = auth.uid());

-- Equipamentos: dono pode inserir em suas lojas
create policy "equipamentos_insert" on public.equipamentos
  for insert to authenticated
  with check (
    loja_id in (
      select id from public.lojas_equipamentos
      where auth_user_id = auth.uid()
    )
  );

-- Equipamentos: dono pode editar
create policy "equipamentos_update" on public.equipamentos
  for update to authenticated
  using (
    loja_id in (
      select id from public.lojas_equipamentos
      where auth_user_id = auth.uid()
    )
  );

-- Equipamentos: dono pode excluir
create policy "equipamentos_delete" on public.equipamentos
  for delete to authenticated
  using (
    loja_id in (
      select id from public.lojas_equipamentos
      where auth_user_id = auth.uid()
    )
  );

-- SELECT existente: inclui equipamentos inativos do dono
create policy "equipamentos_select_owner" on public.equipamentos
  for select to authenticated
  using (
    loja_id in (
      select id from public.lojas_equipamentos
      where auth_user_id = auth.uid()
    )
  );

-- Bucket público para fotos de equipamentos
insert into storage.buckets (id, name, public)
values ('equipamentos', 'equipamentos', true)
on conflict do nothing;

create policy "equipamentos_storage_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'equipamentos' and
    (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "equipamentos_storage_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'equipamentos' and
    (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "equipamentos_storage_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'equipamentos' and
    (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "equipamentos_storage_select" on storage.objects
  for select using (bucket_id = 'equipamentos');
