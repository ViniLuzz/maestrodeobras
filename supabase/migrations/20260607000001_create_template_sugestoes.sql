-- Criar tabela de sugestões de templates (aprendizado)
CREATE TABLE template_sugestoes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo text NOT NULL CHECK (tipo IN ('etapa', 'material', 'especialidade', 'contratacao')),
  texto text NOT NULL,
  usos integer DEFAULT 1,
  registrado_por uuid REFERENCES pessoas(id),
  deletado boolean DEFAULT false,
  criado_em timestamptz DEFAULT now(),

  UNIQUE(tipo, texto)
);

-- Índices para performance
CREATE INDEX idx_template_sugestoes_tipo ON template_sugestoes(tipo);
CREATE INDEX idx_template_sugestoes_usos ON template_sugestoes(usos DESC);

-- Habilitar RLS
ALTER TABLE template_sugestoes ENABLE ROW LEVEL SECURITY;

-- Políticas de segurança
CREATE POLICY "Qualquer autenticado pode ler"
  ON template_sugestoes FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Qualquer autenticado pode inserir"
  ON template_sugestoes FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Pode atualizar uso"
  ON template_sugestoes FOR UPDATE
  USING (auth.role() = 'authenticated');
