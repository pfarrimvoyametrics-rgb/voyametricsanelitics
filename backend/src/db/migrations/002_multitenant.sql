-- =====================================================================
--  002_multitenant.sql — Multi-tenant (organizações/clientes).
--  Idempotente: reaplicável em cada arranque sem erro nem duplicação.
--
--  Introduz a tabela `organizacoes` e a coluna `organizacao_id` em cada
--  tabela viva (usuarios, tickets, regras_triagem). Os dados existentes são
--  atribuídos a uma organização por omissão ('demo'); o super_admin fica sem
--  organização (NULL), pois é da plataforma.
-- =====================================================================

-- ---------------------------------------------------------------------
--  organizacoes — cada cliente do produto.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS organizacoes (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  nome       TEXT        NOT NULL,
  slug       TEXT        NOT NULL,
  ativo      BOOLEAN     NOT NULL DEFAULT TRUE,
  criado_em  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Slug único (case-insensitive) — identificador curto e estável.
CREATE UNIQUE INDEX IF NOT EXISTS idx_org_slug ON organizacoes (lower(slug));

-- Organização por omissão para acolher os dados pré-existentes.
INSERT INTO organizacoes (nome, slug)
SELECT 'Empresa Demo', 'demo'
WHERE NOT EXISTS (SELECT 1 FROM organizacoes WHERE lower(slug) = 'demo');

-- ---------------------------------------------------------------------
--  Coluna organizacao_id nas tabelas vivas (nullable primeiro, para backfill).
-- ---------------------------------------------------------------------
ALTER TABLE usuarios       ADD COLUMN IF NOT EXISTS organizacao_id UUID;
ALTER TABLE tickets        ADD COLUMN IF NOT EXISTS organizacao_id UUID;
ALTER TABLE regras_triagem ADD COLUMN IF NOT EXISTS organizacao_id UUID;

-- Backfill: tudo o que ainda não tem organização passa para a 'demo'.
-- Exceção: o super_admin é da plataforma e fica com NULL.
UPDATE usuarios
   SET organizacao_id = (SELECT id FROM organizacoes WHERE lower(slug) = 'demo')
 WHERE organizacao_id IS NULL AND funcao <> 'super_admin';

UPDATE tickets
   SET organizacao_id = (SELECT id FROM organizacoes WHERE lower(slug) = 'demo')
 WHERE organizacao_id IS NULL;

UPDATE regras_triagem
   SET organizacao_id = (SELECT id FROM organizacoes WHERE lower(slug) = 'demo')
 WHERE organizacao_id IS NULL;

-- ---------------------------------------------------------------------
--  Chaves estrangeiras (idempotentes via guarda em pg_constraint).
-- ---------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_usuarios_org') THEN
    ALTER TABLE usuarios ADD CONSTRAINT fk_usuarios_org
      FOREIGN KEY (organizacao_id) REFERENCES organizacoes (id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_tickets_org') THEN
    ALTER TABLE tickets ADD CONSTRAINT fk_tickets_org
      FOREIGN KEY (organizacao_id) REFERENCES organizacoes (id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_regras_org') THEN
    ALTER TABLE regras_triagem ADD CONSTRAINT fk_regras_org
      FOREIGN KEY (organizacao_id) REFERENCES organizacoes (id) ON DELETE CASCADE;
  END IF;
END $$;

-- tickets e regras têm SEMPRE organização (NOT NULL). usuarios não (super_admin).
-- SET NOT NULL é idempotente (não falha se já estiver NOT NULL).
ALTER TABLE tickets        ALTER COLUMN organizacao_id SET NOT NULL;
ALTER TABLE regras_triagem ALTER COLUMN organizacao_id SET NOT NULL;

-- ---------------------------------------------------------------------
--  Índices reconstruídos para começarem pela organização.
-- ---------------------------------------------------------------------
DROP INDEX IF EXISTS idx_tickets_fila;
CREATE INDEX IF NOT EXISTS idx_tickets_fila
  ON tickets (organizacao_id, categoria_ticket, status, sla_limite);

DROP INDEX IF EXISTS idx_regras_ativas;
CREATE INDEX IF NOT EXISTS idx_regras_ativas
  ON regras_triagem (organizacao_id, ativa, prioridade);

CREATE INDEX IF NOT EXISTS idx_usuarios_org ON usuarios (organizacao_id);
