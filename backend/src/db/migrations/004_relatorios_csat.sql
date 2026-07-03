-- =====================================================================
--  004_relatorios_csat.sql — Esquema para Relatórios, CSAT, Emissão e Canais.
--  Idempotente: reaplicável em cada arranque.
--
--  Acrescenta a `tickets` as colunas que os relatórios e as integrações
--  consomem (venda, CSAT, emissão, conversa) e cria a tabela `canais_sla`
--  (alvo de SLA por categoria) POR ORGANIZAÇÃO.
-- =====================================================================

-- --- Colunas adicionais em tickets -----------------------------------
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS conversation_id          TEXT;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS data_primeira_atribuicao TIMESTAMPTZ;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS resultado_venda          TEXT DEFAULT 'nao_aplicavel';
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS valor_venda              NUMERIC(12, 2);
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS minutos_uteis_resolucao  INTEGER;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS csat                     SMALLINT;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS csat_em                  TIMESTAMPTZ;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS comentario_csat          TEXT;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS bilhetes_emitidos        INTEGER;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS bilhetes_com_erro        INTEGER;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS emissao_em               TIMESTAMPTZ;

-- CHECKs idempotentes (guardados em pg_constraint).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_tickets_resultado_venda') THEN
    ALTER TABLE tickets ADD CONSTRAINT chk_tickets_resultado_venda
      CHECK (resultado_venda IN ('ganho', 'perdido', 'nao_aplicavel'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_tickets_csat') THEN
    ALTER TABLE tickets ADD CONSTRAINT chk_tickets_csat
      CHECK (csat IS NULL OR (csat BETWEEN 1 AND 5));
  END IF;
END $$;

-- Deteção do ticket aberto de uma conversa (seguimentos / integração).
CREATE INDEX IF NOT EXISTS idx_tickets_conversa
  ON tickets (organizacao_id, conversation_id);

-- --- canais_sla — alvo de SLA por categoria, POR ORGANIZAÇÃO ----------
CREATE TABLE IF NOT EXISTS canais_sla (
  organizacao_id UUID        NOT NULL REFERENCES organizacoes (id) ON DELETE CASCADE,
  categoria      TEXT        NOT NULL,
  rotulo         TEXT,
  sla_minutos    INTEGER,
  atualizado_em  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (organizacao_id, categoria)
);
