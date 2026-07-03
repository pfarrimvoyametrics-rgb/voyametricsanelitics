/**
 * regraModel.js — Acesso à tabela `regras_triagem`.
 *
 * Multi-tenant: cada regra pertence a uma organização; todas as operações são
 * filtradas por `organizacao_id`.
 */
const { pool } = require('../config/db');

const COLS = 'id, palavra_chave, categoria, campo_alvo, prioridade, ativa, criado_em';

/** Lista TODAS as regras da organização (ativas e inativas). */
async function listarTodas(orgId) {
  const { rows } = await pool.query(
    `SELECT ${COLS} FROM regras_triagem
      WHERE organizacao_id = $1
      ORDER BY prioridade ASC, id ASC`,
    [orgId]
  );
  return rows;
}

async function porId(id, orgId) {
  const { rows } = await pool.query(
    `SELECT ${COLS} FROM regras_triagem WHERE id = $1 AND organizacao_id = $2`,
    [id, orgId]
  );
  return rows[0] || null;
}

async function criar({ organizacaoId, palavra_chave, categoria, campo_alvo = 'ambos', prioridade = 100, ativa = true }) {
  const { rows } = await pool.query(
    `INSERT INTO regras_triagem (organizacao_id, palavra_chave, categoria, campo_alvo, prioridade, ativa)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING ${COLS}`,
    [organizacaoId, palavra_chave, categoria, campo_alvo, prioridade, ativa]
  );
  return rows[0];
}

/** Atualiza os campos indicados (parcial), dentro da organização. */
async function atualizar(id, campos, orgId) {
  const permitidos = ['palavra_chave', 'categoria', 'campo_alvo', 'prioridade', 'ativa'];
  const sets = [];
  const vals = [];
  for (const c of permitidos) {
    if (campos[c] !== undefined) {
      vals.push(campos[c]);
      sets.push(`${c} = $${vals.length}`);
    }
  }
  if (!sets.length) return porId(id, orgId);
  vals.push(id);
  const iId = vals.length;
  vals.push(orgId);
  const iOrg = vals.length;
  const { rows } = await pool.query(
    `UPDATE regras_triagem SET ${sets.join(', ')}
      WHERE id = $${iId} AND organizacao_id = $${iOrg} RETURNING ${COLS}`,
    vals
  );
  return rows[0] || null;
}

async function remover(id, orgId) {
  const { rowCount } = await pool.query(
    `DELETE FROM regras_triagem WHERE id = $1 AND organizacao_id = $2`,
    [id, orgId]
  );
  return rowCount > 0;
}

module.exports = { listarTodas, porId, criar, atualizar, remover };
