-- =====================================================================
-- Exclusão de conta pelo próprio usuário (exigência de App Store / Play Store
-- e direito da LGPD). Soft-delete + anonimização dos dados pessoais da pessoa.
-- =====================================================================

create or replace function public.excluir_minha_conta()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pessoa_id uuid;
begin
  v_pessoa_id := public.get_pessoa_id_from_auth();
  if v_pessoa_id is null then
    raise exception 'Não autenticado';
  end if;

  update public.pessoas set
    deletado = true,
    deletado_em = now(),
    ativo = false,
    nome = 'Conta excluída',
    email = null,
    telefone = null,
    avatar_url = null,
    disponivel_marketplace = false,
    descricao_marketplace = null,
    push_token = null,
    onesignal_player_id = null
  where id = v_pessoa_id;
end;
$$;

revoke all on function public.excluir_minha_conta() from public;
grant execute on function public.excluir_minha_conta() to authenticated;
