# Revisão de segurança — RLS (Row Level Security)

_Revisão das policies do Supabase antes do lançamento. Data: jun/2026._

## Veredito

**Sólido.** Não foram encontrados furos de isolamento entre obras/usuários. Toda
leitura/escrita das tabelas de domínio passa por checagem de pertencimento à obra.

## O que está certo

- **RLS habilitado** em todas as tabelas sensíveis: `pessoas`, `obras`,
  `obra_membros`, `etapas`, `etapa_dependencias`, `materiais`, `contratacoes`,
  `despesas`, `orcamento_obra`, `rdo`, `user_roles`, `licencas`.
- **Funções de apoio com `SECURITY DEFINER` + `set search_path = public`** em
  todas (`get_pessoa_id_from_auth`, `is_member_of_obra`, `is_admin_of_obra`,
  `criar_pessoa_para_auth`, `criar_membro_obra`, `excluir_minha_conta`, etc.).
  O `search_path` fixo é a proteção contra _search_path injection_ — está correto.
- **Core (etapas/materiais/contratações)**: SELECT/INSERT/UPDATE todos exigem
  `is_member_of_obra(obra_id, get_pessoa_id_from_auth())`. Sem DELETE direto
  (soft delete via UPDATE). ✔
- **`obras`**: SELECT/UPDATE exigem ser admin ou membro; INSERT força
  `admin_id = get_pessoa_id_from_auth()` (não dá pra criar obra no nome de outro). ✔
- **`obra_membros`**: admin gerencia; cada um vê o próprio vínculo. ✔
- **`pessoas`**: vê a si mesmo + quem compartilha obra (cross-membership). INSERT/UPDATE
  só do próprio registro. Sem DELETE (anonimização via `excluir_minha_conta`). ✔
- **Admin sempre é membro**: trigger no `initial_schema` insere o admin em
  `obra_membros` (role `admin`, ativo) ao criar a obra. Por isso as policies de
  `despesas`/`orcamento_obra` (que checam `obra_membros`) **não travam o admin**. ✔
- **`despesas`**: lê quem é membro; insere se admin OU responsável de etapa;
  edita/exclui só quem registrou. ✔
- **`user_roles`/`licencas`**: escrita só via service_role/edge function. ✔

## Observações menores (não bloqueiam o lançamento)

1. **Inconsistência de estilo** nas policies de `despesas`/`orcamento_obra`: usam
   `(SELECT id FROM pessoas WHERE auth_user_id = auth.uid())` inline em vez do
   helper `get_pessoa_id_from_auth()`. Funciona igual; padronizar deixa mais limpo
   e evita divergência futura.
2. **Storage (bucket `midias`/`avatars`)**: a RLS de tabelas está ok, mas as
   **policies de Storage** (quem pode ler/escrever objetos) merecem uma conferida
   à parte no painel do Supabase — não ficam nas migrations revisadas aqui.

> Conferido: `is_member_of_obra` respeita `ativo = true` **e**
> `expira_em > now()`, então membros expirados perdem o acesso ao core
> (etapas/materiais/contratações) também. ✔

## Recomendação

Pode lançar do ponto de vista de RLS. Antes, um clique de verificação no painel:
- Conferir as policies do Storage dos buckets de mídia (`midias`, `avatars`).

## Teste rápido de isolamento (faça uma vez)

Com dois usuários A e B em obras diferentes:
1. B tenta `select` em etapa/material/despesa da obra de A → deve vir vazio.
2. B tenta `update` numa etapa da obra de A (via id) → deve falhar/0 linhas.
3. Membro comum (não-admin) tenta editar orçamento → deve falhar.
