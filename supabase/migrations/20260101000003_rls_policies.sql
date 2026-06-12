-- ============================================================
-- Maestro de Obras — Fase 1 — Row Level Security
-- ============================================================
-- Habilita RLS em todas as tabelas e define policies pro role
-- 'authenticated'. Operações administrativas (criar licenças via
-- webhook Stripe, criar user_roles) ficam restritas ao service_role
-- usado em edge functions.
-- ============================================================

alter table public.pessoas enable row level security;
alter table public.user_roles enable row level security;
alter table public.licencas enable row level security;
alter table public.obras enable row level security;
alter table public.obra_membros enable row level security;

-- =====================
-- pessoas
-- =====================
-- SELECT:
--   - Própria pessoa
--   - Pessoa que compartilha alguma obra com você (cross-membership)
create policy "pessoas_select" on public.pessoas
  for select to authenticated
  using (
    deletado = false
    and (
      auth_user_id = auth.uid()
      or exists (
        select 1
        from public.obra_membros om_target
        join public.obra_membros om_self on om_self.obra_id = om_target.obra_id
        where om_target.pessoa_id = pessoas.id
          and om_self.pessoa_id = public.get_pessoa_id_from_auth()
          and om_target.ativo = true
          and om_self.ativo = true
      )
    )
  );

-- INSERT: própria pessoa (auth_user_id = auth.uid())
create policy "pessoas_insert_self" on public.pessoas
  for insert to authenticated
  with check (auth_user_id = auth.uid());

-- UPDATE: própria pessoa
create policy "pessoas_update_self" on public.pessoas
  for update to authenticated
  using (auth_user_id = auth.uid())
  with check (auth_user_id = auth.uid());

-- DELETE direto: nunca. Soft delete via UPDATE.

-- =====================
-- user_roles
-- =====================
create policy "user_roles_select_self" on public.user_roles
  for select to authenticated
  using (user_id = auth.uid());

-- INSERT/UPDATE/DELETE: somente service_role (sem policy = bloqueado).

-- =====================
-- licencas
-- =====================
-- SELECT: pessoa que ativou
create policy "licencas_select_owner" on public.licencas
  for select to authenticated
  using (usado_por = public.get_pessoa_id_from_auth());

-- INSERT/UPDATE: somente service_role / função SECURITY DEFINER `ativar_licenca`.

-- =====================
-- obras
-- =====================
-- SELECT: admin da obra OU membro ativo
create policy "obras_select_member" on public.obras
  for select to authenticated
  using (
    deletado = false
    and (
      admin_id = public.get_pessoa_id_from_auth()
      or public.is_member_of_obra(id, public.get_pessoa_id_from_auth())
    )
  );

-- INSERT: pessoa cria sua própria obra como admin
create policy "obras_insert_self_admin" on public.obras
  for insert to authenticated
  with check (admin_id = public.get_pessoa_id_from_auth());

-- UPDATE: somente o admin da obra
create policy "obras_update_admin" on public.obras
  for update to authenticated
  using (admin_id = public.get_pessoa_id_from_auth())
  with check (admin_id = public.get_pessoa_id_from_auth());

-- DELETE direto: nunca. Soft delete via UPDATE.

-- =====================
-- obra_membros
-- =====================
-- SELECT: a própria pessoa OU admin da obra
create policy "obra_membros_select" on public.obra_membros
  for select to authenticated
  using (
    pessoa_id = public.get_pessoa_id_from_auth()
    or public.is_admin_of_obra(obra_id, public.get_pessoa_id_from_auth())
  );

-- INSERT: admin da obra (preferencial: usar função criar_membro_obra)
create policy "obra_membros_insert_admin" on public.obra_membros
  for insert to authenticated
  with check (public.is_admin_of_obra(obra_id, public.get_pessoa_id_from_auth()));

-- UPDATE: admin da obra
create policy "obra_membros_update_admin" on public.obra_membros
  for update to authenticated
  using (public.is_admin_of_obra(obra_id, public.get_pessoa_id_from_auth()))
  with check (public.is_admin_of_obra(obra_id, public.get_pessoa_id_from_auth()));

-- DELETE: admin da obra (geralmente não usado — preferir desativar via update)
create policy "obra_membros_delete_admin" on public.obra_membros
  for delete to authenticated
  using (public.is_admin_of_obra(obra_id, public.get_pessoa_id_from_auth()));
