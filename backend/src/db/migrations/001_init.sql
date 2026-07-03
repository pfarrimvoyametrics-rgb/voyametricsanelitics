-- =====================================================================
--  001_init.sql — Esquema inicial da Central de Tickets
--  Idempotente: pode ser reaplicado sem erro (IF NOT EXISTS).
-- =====================================================================

-- gen_random_uuid() — nativo no PG13+, mas garantimos via pgcrypto.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------
--  usuarios — operadores, administradores e o super administrador.
--    funcao: 'operador' | 'admin' | 'super_admin'
--    categoria: fila do operador (NULL para admin/super_admin).
--    senha_hash: bcrypt (autenticação por palavra-passe para todos os perfis).
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS usuarios (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  nome          TEXT        NOT NULL,
  email         TEXT        NOT NULL,
  categoria     TEXT,
  funcao        TEXT        NOT NULL DEFAULT 'operador'
                            CHECK (funcao IN ('operador', 'admin', 'super_admin')),
  senha_hash    TEXT,
  ativo         BOOLEAN     NOT NULL DEFAULT TRUE,
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Email único (case-insensitive: guardamos sempre em minúsculas na aplicação).
CREATE UNIQUE INDEX IF NOT EXISTS idx_usuarios_email ON usuarios (lower(email));

-- ---------------------------------------------------------------------
--  tickets — um por email recebido na caixa partilhada.
--    status: 'pendente' | 'em_andamento' | 'resolvido'
--    data_bloqueio: usada pelo locking/sweeper.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tickets (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  outlook_message_id    TEXT        NOT NULL,
  remetente             TEXT        NOT NULL,
  assunto               TEXT,
  corpo_email           TEXT,
  data_rececao          TIMESTAMPTZ NOT NULL,
  sla_limite            TIMESTAMPTZ NOT NULL,
  categoria_ticket      TEXT        NOT NULL,
  status                TEXT        NOT NULL DEFAULT 'pendente'
                                    CHECK (status IN ('pendente', 'em_andamento', 'resolvido')),
  operador_atribuido_id UUID        REFERENCES usuarios (id) ON DELETE SET NULL,
  data_bloqueio         TIMESTAMPTZ,
  data_resolucao        TIMESTAMPTZ,
  criado_em             TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Idempotência de ingestão: um email nunca gera dois tickets (ON CONFLICT).
CREATE UNIQUE INDEX IF NOT EXISTS idx_tickets_outlook_msg
  ON tickets (outlook_message_id);

-- Fila por categoria + estado, ordenada por SLA (acesso mais quente).
CREATE INDEX IF NOT EXISTS idx_tickets_fila
  ON tickets (categoria_ticket, status, sla_limite);

-- Carga por operador (métricas do supervisor).
CREATE INDEX IF NOT EXISTS idx_tickets_operador
  ON tickets (operador_atribuido_id);

-- Deteção de bloqueios expirados (sweeper).
CREATE INDEX IF NOT EXISTS idx_tickets_bloqueio
  ON tickets (status, data_bloqueio);

-- Vista de resolvidos: mais recentes primeiro.
CREATE INDEX IF NOT EXISTS idx_tickets_resolvidos
  ON tickets (status, data_resolucao DESC);

-- ---------------------------------------------------------------------
--  regras_triagem — palavra-chave -> categoria (configurável pelo gestor).
--    campo_alvo: 'assunto' | 'corpo' | 'ambos'
--    prioridade: ASC (menor casa primeiro).
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS regras_triagem (
  id           BIGSERIAL   PRIMARY KEY,
  palavra_chave TEXT       NOT NULL,
  categoria    TEXT        NOT NULL,
  campo_alvo   TEXT        NOT NULL DEFAULT 'ambos'
                           CHECK (campo_alvo IN ('assunto', 'corpo', 'ambos')),
  prioridade   INTEGER     NOT NULL DEFAULT 100,
  ativa        BOOLEAN     NOT NULL DEFAULT TRUE,
  criado_em    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Leitura das regras ativas por prioridade.
CREATE INDEX IF NOT EXISTS idx_regras_ativas
  ON regras_triagem (ativa, prioridade);
