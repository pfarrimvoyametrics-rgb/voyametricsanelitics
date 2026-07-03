-- =====================================================================
--  003_sla_por_org.sql — Configuração de SLA por organização.
--  Idempotente: reaplicável em cada arranque.
--
--  Cada organização pode ter a sua janela de horas úteis, o seu prazo de SLA
--  e feriados extra. Todas as colunas são NULL por omissão — e NULL significa
--  "usar o valor global do ambiente" (compatibilidade retroativa total).
-- =====================================================================

-- Janela útil (formato "HH:MM"). NULL -> SLA_HORA_INICIO / SLA_HORA_FIM globais.
ALTER TABLE organizacoes ADD COLUMN IF NOT EXISTS sla_hora_inicio TEXT;
ALTER TABLE organizacoes ADD COLUMN IF NOT EXISTS sla_hora_fim    TEXT;

-- Prazo em minutos úteis. NULL -> SLA_MINUTOS_UTEIS global (120).
ALTER TABLE organizacoes ADD COLUMN IF NOT EXISTS sla_minutos_uteis INTEGER;

-- Feriados extra da organização (além dos nacionais), formato "MM-DD"
-- separados por vírgula (ex.: "06-13,12-24"). NULL/"" -> nenhum extra.
ALTER TABLE organizacoes ADD COLUMN IF NOT EXISTS feriados_extra TEXT;
