-- =====================================================================
-- Fase 1 — Pedidos de aluguel iniciados pelo cliente (app)
-- - O cliente solicita um aluguel pelo app escolhendo a OBRA (endereço exato).
-- - O pedido entra como status 'pendente'; o dono aceita ('ativo') ou recusa.
-- - Endereço de entrega é copiado da obra no momento do pedido.
-- =====================================================================

-- 1) Novos campos
alter table public.alugueis
  add column if not exists solicitante_pessoa_id uuid references public.pessoas(id),
  add column if not exists obra_id               uuid references public.obras(id),
  add column if not exists endereco_entrega      text;

-- 2) Ampliar os status permitidos: pendente / ativo / devolvido / recusado
alter table public.alugueis drop constraint if exists alugueis_status_check;
alter table public.alugueis
  add constraint alugueis_status_check
  check (status in ('pendente', 'ativo', 'devolvido', 'recusado'));

create index if not exists idx_alugueis_solicitante on public.alugueis(solicitante_pessoa_id);

-- 3) RLS — o CLIENTE pode criar o próprio pedido (pendente) e ver os seus.
--    (As policies do dono, por loja_id, continuam valendo e somam via OR.)
create policy "alugueis_insert_cliente" on public.alugueis
  for insert to authenticated
  with check (
    solicitante_pessoa_id = public.get_pessoa_id_from_auth()
    and status = 'pendente'
  );

create policy "alugueis_select_cliente" on public.alugueis
  for select to authenticated
  using (solicitante_pessoa_id = public.get_pessoa_id_from_auth());

-- O cliente pode cancelar (recusar) o próprio pedido enquanto pendente.
create policy "alugueis_update_cliente" on public.alugueis
  for update to authenticated
  using (solicitante_pessoa_id = public.get_pessoa_id_from_auth())
  with check (solicitante_pessoa_id = public.get_pessoa_id_from_auth());
