-- =====================================================================
--  seed.sql — Dados iniciais NÃO sensíveis (regras de triagem).
--
--  Os utilizadores (operadores demo e super admin) são semeados por código
--  (Node) para poderem ter a palavra-passe cifrada com bcrypt — ver
--  src/db/seed.js e src/services/userService.js.
--
--  Idempotente: as regras só são inseridas se a tabela estiver vazia, para
--  não sobrepor a afinação feita pelo gestor.
-- =====================================================================

INSERT INTO regras_triagem (palavra_chave, categoria, campo_alvo, prioridade)
SELECT v.palavra_chave, v.categoria, v.campo_alvo, v.prioridade
FROM (
  VALUES
    -- Suporte técnico (prioridade alta: problemas a resolver já)
    ('erro',          'suporte_tecnico', 'ambos', 10),
    ('avaria',        'suporte_tecnico', 'ambos', 10),
    ('nao funciona',  'suporte_tecnico', 'ambos', 10),
    ('bug',           'suporte_tecnico', 'ambos', 10),
    ('login',         'suporte_tecnico', 'ambos', 15),
    ('acesso',        'suporte_tecnico', 'ambos', 15),
    ('palavra-passe', 'suporte_tecnico', 'ambos', 15),
    ('password',      'suporte_tecnico', 'ambos', 15),
    ('instalar',      'suporte_tecnico', 'ambos', 20),
    ('configurar',    'suporte_tecnico', 'ambos', 20),

    -- Faturação
    ('fatura',        'faturacao',  'ambos', 30),
    ('factura',       'faturacao',  'ambos', 30),
    ('recibo',        'faturacao',  'ambos', 30),
    ('reembolso',     'faturacao',  'ambos', 30),
    ('pagamento',     'faturacao',  'ambos', 35),
    ('cobranca',      'faturacao',  'ambos', 35),
    ('nif',           'faturacao',  'ambos', 40),
    ('iban',          'faturacao',  'ambos', 40),

    -- Comercial (também é a categoria por omissão da triagem)
    ('orcamento',     'comercial',  'ambos', 50),
    ('proposta',      'comercial',  'ambos', 50),
    ('reserva',       'comercial',  'ambos', 55),
    ('viagem',        'comercial',  'ambos', 55),
    ('contrato',      'comercial',  'ambos', 60),
    ('comprar',       'comercial',  'ambos', 60)
) AS v(palavra_chave, categoria, campo_alvo, prioridade)
WHERE NOT EXISTS (SELECT 1 FROM regras_triagem);
