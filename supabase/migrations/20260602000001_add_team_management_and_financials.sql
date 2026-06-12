-- Migration: Adicionar Gestão de Equipe e Controle Financeiro
-- Data: 2026-06-02
-- Objetivo: Refatorar etapas, materiais, contratações e adicionar despesas + orçamento

-- ====================================================================
-- 1. REFATORAR TABELA: ETAPAS
-- ====================================================================

ALTER TABLE etapas
ADD COLUMN pessoa_id uuid REFERENCES pessoas(id),
ADD COLUMN concluida boolean DEFAULT false,
ADD COLUMN data_conclusao_real timestamptz;

COMMENT ON COLUMN etapas.pessoa_id IS 'Pessoa responsável/atribuída à etapa';
COMMENT ON COLUMN etapas.concluida IS 'Status de conclusão da etapa';
COMMENT ON COLUMN etapas.data_conclusao_real IS 'Data real de conclusão (quando marcada como concluída)';

-- ====================================================================
-- 2. REFATORAR TABELA: MATERIAIS
-- ====================================================================

ALTER TABLE materiais
ADD COLUMN pessoa_id uuid REFERENCES pessoas(id),
ADD COLUMN recebido boolean DEFAULT false,
ADD COLUMN data_recebimento_real timestamptz;

COMMENT ON COLUMN materiais.pessoa_id IS 'Pessoa responsável/atribuída ao material';
COMMENT ON COLUMN materiais.recebido IS 'Flag: material foi recebido?';
COMMENT ON COLUMN materiais.data_recebimento_real IS 'Data real de recebimento';

-- ====================================================================
-- 3. REFATORAR TABELA: CONTRATACOES
-- ====================================================================

ALTER TABLE contratacoes
ADD COLUMN pessoa_id uuid REFERENCES pessoas(id),
ADD COLUMN iniciada boolean DEFAULT false,
ADD COLUMN data_inicio_real timestamptz,
ADD COLUMN data_conclusao_real timestamptz,
ADD COLUMN valor_acordado numeric(12, 2),
ADD COLUMN valor_pago numeric(12, 2) DEFAULT 0;

COMMENT ON COLUMN contratacoes.pessoa_id IS 'Pessoa/empresa contratada (vinculação com tabela pessoas)';
COMMENT ON COLUMN contratacoes.iniciada IS 'Flag: serviço foi iniciado?';
COMMENT ON COLUMN contratacoes.data_inicio_real IS 'Data real de início do serviço';
COMMENT ON COLUMN contratacoes.data_conclusao_real IS 'Data real de conclusão do serviço';
COMMENT ON COLUMN contratacoes.valor_acordado IS 'Valor negociado do serviço';
COMMENT ON COLUMN contratacoes.valor_pago IS 'Quanto já foi pago do serviço';

-- ====================================================================
-- 4. CRIAR TABELA: DESPESAS
-- ====================================================================

CREATE TABLE IF NOT EXISTS despesas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id uuid NOT NULL REFERENCES obras(id) ON DELETE CASCADE,

  categoria text NOT NULL CHECK (categoria IN ('material', 'mao_obra', 'aluguel', 'servicos', 'outro')),
  descricao text NOT NULL,
  valor numeric(12, 2) NOT NULL CHECK (valor > 0),
  data date NOT NULL,

  registrado_por uuid NOT NULL REFERENCES pessoas(id),

  -- Vinculação (opcional)
  vinculado_a text CHECK (vinculado_a IN ('material', 'contratacao', 'nenhum')),
  vinculado_id uuid,

  deletado boolean DEFAULT false,
  criado_em timestamptz DEFAULT now(),
  atualizado_em timestamptz DEFAULT now()
);

CREATE INDEX idx_despesas_obra_id ON despesas(obra_id);
CREATE INDEX idx_despesas_registrado_por ON despesas(registrado_por);
CREATE INDEX idx_despesas_categoria ON despesas(categoria);
CREATE INDEX idx_despesas_deletado ON despesas(deletado);

COMMENT ON TABLE despesas IS 'Rastreamento de despesas/custos de uma obra';
COMMENT ON COLUMN despesas.categoria IS 'Categoria da despesa: material, mao_obra, aluguel, servicos, outro';
COMMENT ON COLUMN despesas.vinculado_a IS 'Tipo de entidade relacionada (material/contratacao/nenhum)';
COMMENT ON COLUMN despesas.vinculado_id IS 'ID da entidade relacionada';

-- ====================================================================
-- 5. CRIAR TABELA: ORCAMENTO_OBRA
-- ====================================================================

CREATE TABLE IF NOT EXISTS orcamento_obra (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id uuid NOT NULL UNIQUE REFERENCES obras(id) ON DELETE CASCADE,

  orcamento_total numeric(14, 2) NOT NULL CHECK (orcamento_total > 0),
  orcamento_materiais numeric(14, 2),
  orcamento_mao_obra numeric(14, 2),
  orcamento_aluguel numeric(14, 2),
  orcamento_servicos numeric(14, 2),

  criado_em timestamptz DEFAULT now(),
  atualizado_em timestamptz DEFAULT now()
);

CREATE INDEX idx_orcamento_obra_obra_id ON orcamento_obra(obra_id);

COMMENT ON TABLE orcamento_obra IS 'Orçamento inicial/estimado para uma obra';
COMMENT ON COLUMN orcamento_obra.orcamento_total IS 'Valor total estimado da obra';

-- ====================================================================
-- 6. ATUALIZAR RLS POLICIES (ETAPAS)
-- ====================================================================

-- A coluna pessoa_id pode ser atualizada por:
-- - Admin da obra
-- - A própria pessoa (se auto-atribuindo)

ALTER POLICY "etapas_insert" ON etapas
USING (
  EXISTS (
    SELECT 1 FROM obra_membros
    WHERE obra_membros.obra_id = etapas.obra_id
    AND obra_membros.pessoa_id = (SELECT id FROM pessoas WHERE auth_user_id = auth.uid())
    AND obra_membros.ativo = true
    AND (obra_membros.expira_em IS NULL OR obra_membros.expira_em > now())
  )
);

ALTER POLICY "etapas_update" ON etapas
USING (
  EXISTS (
    SELECT 1 FROM obra_membros
    WHERE obra_membros.obra_id = etapas.obra_id
    AND obra_membros.pessoa_id = (SELECT id FROM pessoas WHERE auth_user_id = auth.uid())
    AND obra_membros.ativo = true
    AND (obra_membros.expira_em IS NULL OR obra_membros.expira_em > now())
  )
);

-- ====================================================================
-- 7. CRIAR RLS POLICIES (DESPESAS)
-- ====================================================================

CREATE POLICY "despesas_select" ON despesas
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM obra_membros
    WHERE obra_membros.obra_id = despesas.obra_id
    AND obra_membros.pessoa_id = (SELECT id FROM pessoas WHERE auth_user_id = auth.uid())
    AND obra_membros.ativo = true
    AND (obra_membros.expira_em IS NULL OR obra_membros.expira_em > now())
  )
  AND despesas.deletado = false
);

CREATE POLICY "despesas_insert" ON despesas
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM obra_membros om
    WHERE om.obra_id = despesas.obra_id
    AND om.pessoa_id = (SELECT id FROM pessoas WHERE auth_user_id = auth.uid())
    AND om.ativo = true
    AND (om.expira_em IS NULL OR om.expira_em > now())
    AND (
      -- Admin ou responsável de etapa
      om.role = 'admin'
      OR EXISTS (
        SELECT 1 FROM etapas e
        WHERE e.obra_id = despesas.obra_id
        AND e.pessoa_id = om.pessoa_id
      )
    )
  )
);

CREATE POLICY "despesas_update" ON despesas
FOR UPDATE
USING (
  registrado_por = (SELECT id FROM pessoas WHERE auth_user_id = auth.uid())
);

CREATE POLICY "despesas_delete" ON despesas
FOR DELETE
USING (
  registrado_por = (SELECT id FROM pessoas WHERE auth_user_id = auth.uid())
);

ALTER TABLE despesas ENABLE ROW LEVEL SECURITY;

-- ====================================================================
-- 8. CRIAR RLS POLICIES (ORCAMENTO_OBRA)
-- ====================================================================

CREATE POLICY "orcamento_select" ON orcamento_obra
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM obra_membros
    WHERE obra_membros.obra_id = orcamento_obra.obra_id
    AND obra_membros.pessoa_id = (SELECT id FROM pessoas WHERE auth_user_id = auth.uid())
    AND obra_membros.ativo = true
    AND (obra_membros.expira_em IS NULL OR obra_membros.expira_em > now())
  )
);

CREATE POLICY "orcamento_insert" ON orcamento_obra
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM obra_membros om
    WHERE om.obra_id = orcamento_obra.obra_id
    AND om.pessoa_id = (SELECT id FROM pessoas WHERE auth_user_id = auth.uid())
    AND om.role = 'admin'
    AND om.ativo = true
  )
);

CREATE POLICY "orcamento_update" ON orcamento_obra
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM obra_membros om
    WHERE om.obra_id = orcamento_obra.obra_id
    AND om.pessoa_id = (SELECT id FROM pessoas WHERE auth_user_id = auth.uid())
    AND om.role = 'admin'
    AND om.ativo = true
  )
);

ALTER TABLE orcamento_obra ENABLE ROW LEVEL SECURITY;

-- ====================================================================
-- 9. GRANT PERMISSIONS (se usar RLS com service_role)
-- ====================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON despesas TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON orcamento_obra TO authenticated;
GRANT SELECT, UPDATE ON etapas TO authenticated;
GRANT SELECT, UPDATE ON materiais TO authenticated;
GRANT SELECT, UPDATE ON contratacoes TO authenticated;
