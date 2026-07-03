/**
 * ticketModel.js — Acesso à tabela `tickets`.
 * Concentra todo o SQL para manter as rotas/serviços limpos.
 */
const { pool } = require('../config/db');

/**
 * Insere um ticket novo (idempotente em relação ao outlook_message_id).
 * Devolve a linha inserida, ou null se já existia (email duplicado).
 */
async function criar({
  outlookMessageId,
  remetente,
  assunto,
  corpoEmail,
  dataRececao,
  slaLimite,
  categoriaTicket,
}) {
  const { rows } = await pool.query(
    `INSERT INTO tickets
        (outlook_message_id, remetente, assunto, corpo_email,
         data_rececao, sla_limite, categoria_ticket, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'pendente')
     ON CONFLICT (outlook_message_id) DO NOTHING
     RETURNING *`,
    [outlookMessageId, remetente, assunto, corpoEmail, dataRececao, slaLimite, categoriaTicket]
  );
  return rows[0] || null;
}

/**
 * Lista tickets visíveis para um utilizador.
 *  - Admin: todas as categorias (com filtro opcional).
 *  - Operador: apenas a sua categoria.
 * Ordenação: SLA mais urgente primeiro; resolvidos por último.
 *
 * Opções de escala (para volumes elevados):
 *  - apenasAtivos: exclui 'resolvido' (a carga de trabalho corrente).
 *  - status='resolvido': devolve os mais recentes primeiro, com LIMIT.
 */
async function listarParaUtilizador(utilizador, { status, categoria, apenasAtivos, limite } = {}) {
  const where = [];
  const params = [];
  let i = 1;

  if (utilizador.funcao !== 'admin') {
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

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

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

async function porId(id) {
  const { rows } = await pool.query(`SELECT * FROM tickets WHERE id = $1`, [id]);
  return rows[0] || null;
}

/**
 * Atribui um ticket a um operador de forma ATÓMICA.
 * Só tem sucesso se o ticket ainda estiver 'pendente' (evita corrida
 * entre dois operadores a clicar ao mesmo tempo).
 * Devolve a linha atualizada ou null se já estava tomado.
 */
async function atribuirSeLivre(ticketId, operadorId) {
  const { rows } = await pool.query(
    `UPDATE tickets
        SET status = 'em_andamento',
            operador_atribuido_id = $2,
            data_bloqueio = now()
      WHERE id = $1 AND status = 'pendente'
      RETURNING *`,
    [ticketId, operadorId]
  );
  return rows[0] || null;
}

/**
 * Liberta um ticket de volta para 'pendente'.
 * @param {string} ticketId
 * @param {string|null} apenasSeOperador — se fornecido, só liberta se o
 *        ticket pertencer a este operador (segurança).
 */
async function libertar(ticketId, apenasSeOperador = null) {
  const params = [ticketId];
  let condOperador = '';
  if (apenasSeOperador) {
    condOperador = `AND operador_atribuido_id = $2`;
    params.push(apenasSeOperador);
  }
  const { rows } = await pool.query(
    `UPDATE tickets
        SET status = 'pendente',
            operador_atribuido_id = NULL,
            data_bloqueio = NULL
      WHERE id = $1 AND status = 'em_andamento' ${condOperador}
      RETURNING *`,
    params
  );
  return rows[0] || null;
}

/** Marca como resolvido (regista data_resolucao). */
async function resolver(ticketId, operadorId) {
  const { rows } = await pool.query(
    `UPDATE tickets
        SET status = 'resolvido',
            data_resolucao = now()
      WHERE id = $1 AND operador_atribuido_id = $2 AND status = 'em_andamento'
      RETURNING *`,
    [ticketId, operadorId]
  );
  return rows[0] || null;
}

/** Devolve tickets 'em_andamento' cujo bloqueio expirou há > X minutos. */
async function bloqueiosExpirados(minutos) {
  const { rows } = await pool.query(
    `SELECT id, categoria_ticket
       FROM tickets
      WHERE status = 'em_andamento'
        AND data_bloqueio IS NOT NULL
        AND data_bloqueio < now() - ($1 || ' minutes')::interval`,
    [String(minutos)]
  );
  return rows;
}

/**
 * Métricas para o painel do supervisor:
 *  - carga por operador (nº de tickets em_andamento)
 *  - taxa de cumprimento de SLA global
 */
async function cargaPorOperador() {
  const { rows } = await pool.query(
    `SELECT u.id, u.nome, u.categoria,
            COUNT(t.id) FILTER (WHERE t.status = 'em_andamento') AS em_andamento,
            COUNT(t.id) FILTER (WHERE t.status = 'resolvido')    AS resolvidos
       FROM usuarios u
       LEFT JOIN tickets t ON t.operador_atribuido_id = u.id
      WHERE u.funcao = 'operador'
      GROUP BY u.id, u.nome, u.categoria
      ORDER BY u.categoria, u.nome`
  );
  return rows;
}

async function metricasSla() {
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
       FROM tickets`
  );
  const m = rows[0];
  const resolvidos = parseInt(m.resolvidos, 10);
  const cumpridos = parseInt(m.cumpridos, 10);
  const taxa = resolvidos > 0 ? Math.round((cumpridos / resolvidos) * 1000) / 10 : 100;
  return { ...m, taxa_cumprimento: taxa };
}

module.exports = {
  criar,
  listarParaUtilizador,
  porId,
  atribuirSeLivre,
  libertar,
  resolver,
  bloqueiosExpirados,
  cargaPorOperador,
  metricasSla,
};
