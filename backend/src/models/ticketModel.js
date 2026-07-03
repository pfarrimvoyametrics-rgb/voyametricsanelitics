/**
 * ticketModel.js — Acesso à tabela `tickets`.
 * Concentra todo o SQL para manter as rotas/serviços limpos.
 *
 * Multi-tenant: todas as leituras/escritas são filtradas por `organizacao_id`.
 * O `orgId` é sempre resolvido no middleware (nunca vem cru do cliente).
 */
const { pool } = require('../config/db');
const { ehAdmin } = require('../utils/papeis');

/**
 * Insere um ticket novo (idempotente em relação ao outlook_message_id).
 * Devolve a linha inserida, ou null se já existia (email duplicado).
 */
async function criar({
  organizacaoId,
  outlookMessageId,
  conversationId = null,
  remetente,
  assunto,
  corpoEmail,
  dataRececao,
  slaLimite,
  categoriaTicket,
}) {
  const { rows } = await pool.query(
    `INSERT INTO tickets
        (organizacao_id, outlook_message_id, conversation_id, remetente, assunto, corpo_email,
         data_rececao, sla_limite, categoria_ticket, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pendente')
     ON CONFLICT (outlook_message_id) DO NOTHING
     RETURNING *`,
    [organizacaoId, outlookMessageId, conversationId, remetente, assunto, corpoEmail, dataRececao, slaLimite, categoriaTicket]
  );
  return rows[0] || null;
}

/**
 * Lista tickets visíveis para um utilizador, dentro de `orgId`.
 *  - Admin/super_admin: todas as categorias da organização (com filtro opcional).
 *  - Operador: apenas a sua categoria.
 * Ordenação: SLA mais urgente primeiro; resolvidos por último.
 */
async function listarParaUtilizador(utilizador, orgId, { status, categoria, apenasAtivos, limite } = {}) {
  const where = [`t.organizacao_id = $1`];
  const params = [orgId];
  let i = 2;

  if (!ehAdmin(utilizador.funcao)) {
    where.push(`categoria_ticket = $${i++}`);
    params.push(utilizador.categoria);
  } else if (categoria) {
    where.push(`categoria_ticket = $${i++}`);
    params.push(categoria);
  }

  if (status) {
    where.push(`status = $${i++}`);
    params.push(status);
  } else if (apenasAtivos) {
    where.push(`status <> 'resolvido'`);
  }

  const whereSql = `WHERE ${where.join(' AND ')}`;

  // Para a vista de resolvidos, ordenar pelos mais recentes e limitar.
  const ehResolvidos = status === 'resolvido';
  const ordem = ehResolvidos
    ? `ORDER BY t.data_resolucao DESC NULLS LAST`
    : `ORDER BY
        CASE WHEN t.status = 'resolvido' THEN 1 ELSE 0 END ASC,
        t.sla_limite ASC`;

  let limitSql = '';
  if (ehResolvidos) {
    const n = Math.min(parseInt(limite, 10) || 100, 500);
    limitSql = `LIMIT ${n}`;
  }

  const { rows } = await pool.query(
    `SELECT t.*, u.nome AS operador_nome
       FROM tickets t
       LEFT JOIN usuarios u ON u.id = t.operador_atribuido_id
       ${whereSql}
      ${ordem}
      ${limitSql}`,
    params
  );
  return rows;
}

/** Lê um ticket por id, restrito à organização (bloqueia leitura cross-tenant). */
async function porId(id, orgId) {
  const { rows } = await pool.query(
    `SELECT * FROM tickets WHERE id = $1 AND organizacao_id = $2`,
    [id, orgId]
  );
  return rows[0] || null;
}

/**
 * Atribui um ticket a um operador de forma ATÓMICA, dentro da organização.
 * Só tem sucesso se o ticket ainda estiver 'pendente' (evita corrida
 * entre dois operadores a clicar ao mesmo tempo).
 * Devolve a linha atualizada ou null se já estava tomado / fora da org.
 */
async function atribuirSeLivre(ticketId, operadorId, orgId) {
  const { rows } = await pool.query(
    `UPDATE tickets
        SET status = 'em_andamento',
            operador_atribuido_id = $2,
            data_bloqueio = now()
      WHERE id = $1 AND organizacao_id = $3 AND status = 'pendente'
      RETURNING *`,
    [ticketId, operadorId, orgId]
  );
  return rows[0] || null;
}

/**
 * Liberta um ticket de volta para 'pendente', dentro da organização.
 * @param {string} ticketId
 * @param {string|null} apenasSeOperador — se fornecido, só liberta se o
 *        ticket pertencer a este operador (segurança).
 * @param {string} orgId
 */
async function libertar(ticketId, apenasSeOperador, orgId) {
  const params = [ticketId, orgId];
  let condOperador = '';
  if (apenasSeOperador) {
    condOperador = `AND operador_atribuido_id = $3`;
    params.push(apenasSeOperador);
  }
  const { rows } = await pool.query(
    `UPDATE tickets
        SET status = 'pendente',
            operador_atribuido_id = NULL,
            data_bloqueio = NULL
      WHERE id = $1 AND organizacao_id = $2 AND status = 'em_andamento' ${condOperador}
      RETURNING *`,
    params
  );
  return rows[0] || null;
}

/** Marca como resolvido (regista data_resolucao), dentro da organização. */
async function resolver(ticketId, operadorId, orgId) {
  const { rows } = await pool.query(
    `UPDATE tickets
        SET status = 'resolvido',
            data_resolucao = now()
      WHERE id = $1 AND organizacao_id = $3
        AND operador_atribuido_id = $2 AND status = 'em_andamento'
      RETURNING *`,
    [ticketId, operadorId, orgId]
  );
  return rows[0] || null;
}

/**
 * Devolve tickets 'em_andamento' cujo bloqueio expirou há > X minutos.
 * Global (o sweeper corre para todas as organizações); devolve `organizacao_id`
 * para o serviço poder emitir o evento à sala certa.
 */
async function bloqueiosExpirados(minutos) {
  const { rows } = await pool.query(
    `SELECT id, categoria_ticket, organizacao_id
       FROM tickets
      WHERE status = 'em_andamento'
        AND data_bloqueio IS NOT NULL
        AND data_bloqueio < now() - ($1 || ' minutes')::interval`,
    [String(minutos)]
  );
  return rows;
}

/** Carga por operador da organização (nº de tickets em_andamento/resolvidos). */
async function cargaPorOperador(orgId) {
  const { rows } = await pool.query(
    `SELECT u.id, u.nome, u.categoria,
            COUNT(t.id) FILTER (WHERE t.status = 'em_andamento') AS em_andamento,
            COUNT(t.id) FILTER (WHERE t.status = 'resolvido')    AS resolvidos
       FROM usuarios u
       LEFT JOIN tickets t ON t.operador_atribuido_id = u.id
                          AND t.organizacao_id = $1
      WHERE u.funcao = 'operador' AND u.organizacao_id = $1
      GROUP BY u.id, u.nome, u.categoria
      ORDER BY u.categoria, u.nome`,
    [orgId]
  );
  return rows;
}

/** Métricas de SLA da organização. */
async function metricasSla(orgId) {
  const { rows } = await pool.query(
    `SELECT
        COUNT(*)                                                              AS total,
        COUNT(*) FILTER (WHERE status = 'pendente')                           AS pendentes,
        COUNT(*) FILTER (WHERE status = 'em_andamento')                       AS em_andamento,
        COUNT(*) FILTER (WHERE status = 'resolvido')                          AS resolvidos,
        -- cumpridos: resolvidos dentro do prazo
        COUNT(*) FILTER (WHERE status = 'resolvido' AND data_resolucao <= sla_limite) AS cumpridos,
        -- em risco/violados ainda abertos
        COUNT(*) FILTER (WHERE status <> 'resolvido' AND sla_limite < now())  AS violados_abertos
       FROM tickets
      WHERE organizacao_id = $1`,
    [orgId]
  );
  const m = rows[0];
  const resolvidos = parseInt(m.resolvidos, 10);
  const cumpridos = parseInt(m.cumpridos, 10);
  const taxa = resolvidos > 0 ? Math.round((cumpridos / resolvidos) * 1000) / 10 : 100;
  return { ...m, taxa_cumprimento: taxa };
}

// --- CSAT (inquérito público por UUID do ticket) ----------------------------

/** Dados mínimos para a página pública de CSAT (só por id, sem organização). */
async function porIdPublico(id) {
  const { rows } = await pool.query(
    `SELECT id, assunto, status, csat FROM tickets WHERE id = $1`,
    [id]
  );
  return rows[0] || null;
}

/**
 * Regista a avaliação de CSAT. Público (o id do ticket é a credencial).
 * Só grava se ainda não houver resposta (csat IS NULL).
 * @returns {{ok:boolean, motivo?:'inexistente'|'ja_respondido'}}
 */
async function registarCsat(id, nota, comentario = null) {
  const alvo = await pool.query(`SELECT csat FROM tickets WHERE id = $1`, [id]);
  if (!alvo.rows[0]) return { ok: false, motivo: 'inexistente' };
  if (alvo.rows[0].csat != null) return { ok: false, motivo: 'ja_respondido' };
  await pool.query(
    `UPDATE tickets SET csat = $2, csat_em = now(), comentario_csat = $3 WHERE id = $1`,
    [id, nota, comentario || null]
  );
  return { ok: true };
}

// --- Integração servidor-a-servidor (resultado de venda / emissão) ----------

/** Resolve o id do ticket por uma das referências (id > outlook > conversa aberta). */
async function resolverReferencia({ ticketId, outlookMessageId, conversationId }) {
  if (ticketId) return ticketId;
  if (outlookMessageId) {
    const { rows } = await pool.query(
      `SELECT id FROM tickets WHERE outlook_message_id = $1 LIMIT 1`,
      [outlookMessageId]
    );
    if (rows[0]) return rows[0].id;
  }
  if (conversationId) {
    const t = await porConversaAberta(conversationId);
    if (t) return t.id;
  }
  return null;
}

/** Define o resultado/valor da venda de um ticket (via integração). */
async function definirResultadoVenda({ ticketId, outlookMessageId, conversationId, resultado, valor }) {
  const id = await resolverReferencia({ ticketId, outlookMessageId, conversationId });
  if (!id) return null;
  const val = resultado === 'ganho' && valor != null ? Number(valor) : null;
  const { rows } = await pool.query(
    `UPDATE tickets SET resultado_venda = $2, valor_venda = $3 WHERE id = $1 RETURNING *`,
    [id, resultado, val]
  );
  return rows[0] || null;
}

/** Regista a emissão de bilhetes/vouchers de um ticket (via integração). */
async function registarEmissao({ ticketId, outlookMessageId, conversationId, emitidos, comErro }) {
  const id = await resolverReferencia({ ticketId, outlookMessageId, conversationId });
  if (!id) return null;
  const { rows } = await pool.query(
    `UPDATE tickets
        SET bilhetes_emitidos = $2, bilhetes_com_erro = $3, emissao_em = now()
      WHERE id = $1 RETURNING *`,
    [id, parseInt(emitidos, 10) || 0, parseInt(comErro, 10) || 0]
  );
  return rows[0] || null;
}

// --- Seguimentos de conversa (ingestão de emails) ---------------------------

/** Ticket ABERTO (não resolvido) de uma conversa, se existir. */
async function porConversaAberta(conversationId) {
  const { rows } = await pool.query(
    `SELECT * FROM tickets
      WHERE conversation_id = $1 AND status <> 'resolvido'
      ORDER BY criado_em DESC LIMIT 1`,
    [conversationId]
  );
  return rows[0] || null;
}

/** Anexa o corpo de um email de seguimento a um ticket aberto. */
async function adicionarSeguimento(id, email) {
  const trecho = `\n\n--- Seguimento (${email.remetente || 'cliente'}) ---\n${email.corpoEmail || ''}`;
  const { rows } = await pool.query(
    `UPDATE tickets SET corpo_email = COALESCE(corpo_email, '') || $2 WHERE id = $1 RETURNING *`,
    [id, trecho]
  );
  return rows[0] || null;
}

module.exports = {
  criar,
  listarParaUtilizador,
  porId,
  porIdPublico,
  atribuirSeLivre,
  libertar,
  resolver,
  bloqueiosExpirados,
  cargaPorOperador,
  metricasSla,
  registarCsat,
  definirResultadoVenda,
  registarEmissao,
  porConversaAberta,
  adicionarSeguimento,
};
