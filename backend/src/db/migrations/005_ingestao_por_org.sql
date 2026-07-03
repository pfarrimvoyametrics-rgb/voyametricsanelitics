-- =====================================================================
--  005_ingestao_por_org.sql — Roteamento da ingestão de email por org.
--  Idempotente: reaplicável em cada arranque.
--
--  Cada organização pode declarar os domínios/endereços de email que a
--  identificam (lista separada por vírgulas, ex.: "acme.pt, suporte@acme.pt").
--  Um email recebido é atribuído à organização cujo domínio/endereço casa com
--  um dos DESTINATÁRIOS (ou, em último caso, com o REMETENTE). Sem
--  correspondência, cai na organização por omissão (INGESTAO_ORG_PADRAO, 'demo')
--  — comportamento retrocompatível com a caixa partilhada única.
-- =====================================================================

ALTER TABLE organizacoes ADD COLUMN IF NOT EXISTS email_dominios TEXT;
