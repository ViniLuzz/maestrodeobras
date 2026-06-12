-- ============================================================
-- Maestro de Obras — Token de convite por obra
-- ============================================================
-- token_convite na tabela obras: um código único por obra.
-- Trabalhadores digitam o código → login anônimo → entram na obra.
-- Admin gera/regenera o token a qualquer momento.
-- ============================================================

-- Coluna de token na tabela obras
alter table public.obras add column token_convite text unique;

create index idx_obras_token_convite
  on public.obras (upper(token_convite))
  where token_convite is not null and deletado = false;

-- =====================
-- gerar_token_obra
-- Admin gera ou regenera o token de convite da obra.
-- Retorna o token gerado (8 chars hex maiúsculos, ex: "A1B2C3D4").
-- =====================
create or replace function public.gerar_token_obra(_obra_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  _token text;
  _pessoa_id uuid;
begin
  _pessoa_id := public.get_pessoa_id_from_auth();
  if not public.is_admin_of_obra(_obra_id, _pessoa_id) then
    raise exception 'Apenas o administrador pode gerar o token da obra';
  end if;
  _token := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
  update public.obras set token_convite = _token where id = _obra_id;
  return _token;
end;
$$;

-- =====================
-- validar_token_obra
-- Pública (role anon) — valida token e retorna dados básicos da obra.
-- Chamada antes de qualquer autenticação para mostrar o nome da obra.
-- =====================
create or replace function public.validar_token_obra(_token text)
returns table(obra_id uuid, obra_nome text, obra_cidade text, obra_estado text)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select o.id, o.nome, o.cidade, o.estado
  from public.obras o
  where upper(o.token_convite) = upper(trim(_token))
    and o.deletado = false
    and o.status != 'cancelada';
end;
$$;

grant execute on function public.validar_token_obra(text) to anon;
grant execute on function public.validar_token_obra(text) to authenticated;

-- =====================
-- entrar_na_obra_por_token
-- Requer usuário autenticado (inclusive anônimo via signInAnonymously).
-- Vincula o usuário logado à obra como trabalhador.
-- Pré-requisito: pessoa já deve existir (criar_pessoa_para_auth foi chamado).
-- Não rebaixa um admin para trabalhador.
-- =====================
create or replace function public.entrar_na_obra_por_token(_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  _obra_id uuid;
  _pessoa_id uuid;
begin
  select id into _obra_id
  from public.obras
  where upper(token_convite) = upper(trim(_token))
    and deletado = false
    and status != 'cancelada';

  if _obra_id is null then
    raise exception 'Token inválido ou obra não encontrada';
  end if;

  _pessoa_id := public.get_pessoa_id_from_auth();
  if _pessoa_id is null then
    raise exception 'Usuário não autenticado';
  end if;

  insert into public.obra_membros (obra_id, pessoa_id, role, ativo)
  values (_obra_id, _pessoa_id, 'trabalhador', true)
  on conflict (obra_id, pessoa_id) do update
    set ativo = true,
        atualizado_em = now()
    where obra_membros.role != 'admin';

  return _obra_id;
end;
$$;
