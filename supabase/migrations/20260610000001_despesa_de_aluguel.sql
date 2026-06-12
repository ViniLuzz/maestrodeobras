-- =====================================================================
-- Integração Aluguel → Financeiro da obra
-- Quando o dono da loja ACEITA um pedido (alugueis.status = 'ativo') com um
-- valor definido e vinculado a uma obra, o banco cria automaticamente uma
-- DESPESA (categoria 'aluguel') naquela obra — abatendo o orçamento.
--
-- Feito via trigger (SECURITY DEFINER) porque o dono da loja NÃO é membro da
-- obra, então não conseguiria escrever em "despesas" pela RLS normal.
-- =====================================================================

-- Liga a despesa ao aluguel que a originou (idempotência: 1 despesa por aluguel).
alter table public.despesas
  add column if not exists aluguel_id uuid references public.alugueis(id) on delete cascade;

create unique index if not exists uq_despesas_aluguel on public.despesas(aluguel_id);

create or replace function public.sync_despesa_aluguel()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nome text;
begin
  -- Só gera despesa quando o aluguel está ATIVO, ligado a uma obra, com valor
  -- e com um solicitante (quem pediu pelo app) — que é membro da obra.
  if NEW.status = 'ativo'
     and NEW.obra_id is not null
     and NEW.valor_total is not null
     and NEW.valor_total > 0
     and NEW.solicitante_pessoa_id is not null then

    select nome into v_nome from public.equipamentos where id = NEW.equipamento_id;

    insert into public.despesas (
      obra_id, categoria, descricao, valor, data,
      registrado_por, aluguel_id
    ) values (
      NEW.obra_id,
      'aluguel',
      'Aluguel: ' || coalesce(v_nome, 'equipamento') || ' (' || NEW.quantidade || 'x)',
      NEW.valor_total,
      coalesce(NEW.data_inicio, current_date),
      NEW.solicitante_pessoa_id,
      NEW.id
    )
    on conflict (aluguel_id) do update set
      valor     = excluded.valor,
      descricao = excluded.descricao,
      data      = excluded.data;

  elsif NEW.status = 'recusado' then
    -- Se foi recusado depois de ter virado despesa (raro), remove a despesa.
    delete from public.despesas where aluguel_id = NEW.id;
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_sync_despesa_aluguel on public.alugueis;
create trigger trg_sync_despesa_aluguel
  after insert or update on public.alugueis
  for each row execute function public.sync_despesa_aluguel();
