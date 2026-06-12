-- ============================================================
-- Maestro de Obras — Fase 1 — Funções de segurança
-- ============================================================
-- Funções SECURITY DEFINER usadas pelas policies RLS e pelo cliente
-- via .rpc(). Toda função sensível roda com search_path travado em public
-- pra evitar hijacking via search_path manipulation.
-- ============================================================

-- =====================
-- get_pessoa_id_from_auth
-- Retorna o id da pessoa associada ao auth.uid() atual.
-- Usado por todas as policies que cruzam pessoas <-> auth.users.
-- =====================
create or replace function public.get_pessoa_id_from_auth()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.pessoas
  where auth_user_id = auth.uid()
    and deletado = false
    and ativo = true
  limit 1;
$$;

-- =====================
-- has_role
-- Checa se um auth user tem um role global do sistema.
-- =====================
create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  );
$$;

-- =====================
-- is_admin_of_obra
-- Pessoa _pessoa_id é o admin (dono) da obra _obra_id?
-- =====================
create or replace function public.is_admin_of_obra(_obra_id uuid, _pessoa_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.obras
    where id = _obra_id
      and admin_id = _pessoa_id
      and deletado = false
  );
$$;

-- =====================
-- is_member_of_obra
-- Pessoa tem acesso ativo (não-expirado) à obra?
-- =====================
create or replace function public.is_member_of_obra(_obra_id uuid, _pessoa_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.obra_membros
    where obra_id = _obra_id
      and pessoa_id = _pessoa_id
      and ativo = true
      and (expira_em is null or expira_em > now())
  );
$$;

-- =====================
-- criar_pessoa_para_auth
-- Chamada via RPC pelo cliente após sign up bem-sucedido.
-- Cria registro de pessoa pro auth.uid() atual (idempotente).
-- =====================
create or replace function public.criar_pessoa_para_auth(_nome text, _email text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pessoa_id uuid;
  v_auth_user_id uuid;
begin
  v_auth_user_id := auth.uid();
  if v_auth_user_id is null then
    raise exception 'Não autenticado';
  end if;

  select id into v_pessoa_id
  from public.pessoas
  where auth_user_id = v_auth_user_id
  limit 1;

  if v_pessoa_id is not null then
    return v_pessoa_id;
  end if;

  insert into public.pessoas (nome, email, auth_user_id, ativo, is_admin)
  values (_nome, _email, v_auth_user_id, true, false)
  returning id into v_pessoa_id;

  return v_pessoa_id;
end;
$$;

-- =====================
-- ativar_licenca
-- Aplica um código de ativação à pessoa logada.
-- =====================
create or replace function public.ativar_licenca(_codigo text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_licenca_id uuid;
  v_pessoa_id uuid;
  v_expira timestamptz;
begin
  v_pessoa_id := public.get_pessoa_id_from_auth();
  if v_pessoa_id is null then
    raise exception 'Pessoa não encontrada';
  end if;

  select id, expira_em into v_licenca_id, v_expira
  from public.licencas
  where codigo_ativacao = _codigo
    and usado = false
    and (expira_em is null or expira_em > now())
  limit 1
  for update;

  if v_licenca_id is null then
    raise exception 'Código inválido ou já utilizado';
  end if;

  update public.licencas
  set usado = true,
      usado_por = v_pessoa_id,
      usado_em = now()
  where id = v_licenca_id;

  update public.pessoas
  set plano_ativo = true,
      plano_expira_em = coalesce(v_expira, now() + interval '1 year')
  where id = v_pessoa_id;

  return true;
end;
$$;

-- =====================
-- gerar_token_acesso
-- Token aleatório (48 chars hex) pra usar em obra_membros.token_acesso.
-- =====================
create or replace function public.gerar_token_acesso()
returns text
language sql
volatile
as $$
  select encode(gen_random_bytes(24), 'hex');
$$;

-- =====================
-- criar_membro_obra
-- Admin convida pessoa pra obra. Gera token opcionalmente.
-- Idempotente: se já existe vínculo, atualiza role/token/expira.
-- =====================
create or replace function public.criar_membro_obra(
  _obra_id uuid,
  _pessoa_id uuid,
  _role obra_role default 'trabalhador',
  _gerar_token boolean default true,
  _expira_em timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_pessoa_id uuid;
  v_membro_id uuid;
  v_token text;
begin
  v_caller_pessoa_id := public.get_pessoa_id_from_auth();
  if v_caller_pessoa_id is null then
    raise exception 'Não autenticado';
  end if;

  if not public.is_admin_of_obra(_obra_id, v_caller_pessoa_id) then
    raise exception 'Apenas o admin da obra pode adicionar membros';
  end if;

  if _gerar_token then
    v_token := public.gerar_token_acesso();
  end if;

  insert into public.obra_membros (
    obra_id, pessoa_id, role, token_acesso, ativo, expira_em, convidado_por
  ) values (
    _obra_id, _pessoa_id, _role, v_token, true, _expira_em, v_caller_pessoa_id
  )
  on conflict (obra_id, pessoa_id) do update set
    role = excluded.role,
    token_acesso = coalesce(excluded.token_acesso, obra_membros.token_acesso),
    ativo = true,
    expira_em = excluded.expira_em,
    convidado_por = excluded.convidado_por,
    atualizado_em = now()
  returning id into v_membro_id;

  return v_membro_id;
end;
$$;

-- =====================
-- regenerar_token_membro
-- Admin regenera token de um membro existente.
-- =====================
create or replace function public.regenerar_token_membro(_membro_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_pessoa_id uuid;
  v_obra_id uuid;
  v_token text;
begin
  v_caller_pessoa_id := public.get_pessoa_id_from_auth();
  if v_caller_pessoa_id is null then
    raise exception 'Não autenticado';
  end if;

  select obra_id into v_obra_id from public.obra_membros where id = _membro_id;
  if v_obra_id is null then
    raise exception 'Membro não encontrado';
  end if;

  if not public.is_admin_of_obra(v_obra_id, v_caller_pessoa_id) then
    raise exception 'Apenas o admin da obra pode regenerar tokens';
  end if;

  v_token := public.gerar_token_acesso();
  update public.obra_membros
  set token_acesso = v_token, atualizado_em = now()
  where id = _membro_id;

  return v_token;
end;
$$;
