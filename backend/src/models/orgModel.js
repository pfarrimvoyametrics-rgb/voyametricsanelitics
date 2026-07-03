/**
 * orgModel.js — Acesso à tabela `organizacoes` (clientes da plataforma).
 * Gerido exclusivamente pelo super_admin.
 */
const { pool } = require('../config/db');

const COLS =
  'id, nome, slug, ativo, criado_em, sla_hora_inicio, sla_hora_fim, sla_minutos_uteis, feriados_extra';

/** Lista todas as organizações (ativas e inativas). */
async function listar() {
  const { rows } = await pool.query(
    `SELECT ${COLS} FROM organizacoes ORDER BY ativo DESC, nome ASC`
  );
  return rows;
}

async function porId(id) {
  const { rows } = await pool.query(
    `SELECT ${COLS} FROM organizacoes WHERE id = $1`,
    [id]
  );
  return rows[0] || null;
}

async function porSlug(slug) {
  const { rows } = await pool.query(
    `SELECT ${COLS} FROM organizacoes WHERE lower(slug) = lower($1)`,
    [slug]
  );
  return rows[0] || null;
}

/** Cria uma organização. Falha (23505) se o slug já existir. */
async function criar({ nome, slug }) {
  const { rows } = await pool.query(
    `INSERT INTO organizacoes (nome, slug) VALUES ($1, lower($2)) RETURNING ${COLS}`,
    [nome, slug]
  );
  return rows[0];
}

/** Ativa/desativa uma organização. Devolve a linha atualizada (ou null). */
async function definirAtivo(id, ativo) {
  const { rows } = await pool.query(
    `UPDATE organizacoes SET ativo = $2 WHERE id = $1 RETURNING ${COLS}`,
    [id, ativo]
  );
  return rows[0] || null;
}

/**
 * Atualiza a configuração de SLA de uma organização. Cada campo aceita null
 * (= usar o valor global). Devolve a linha atualizada (ou null).
 */
async function atualizarSla(id, { sla_hora_inicio, sla_hora_fim, sla_minutos_uteis, feriados_extra }) {
  const { rows } = await pool.query(
    `UPDATE organizacoes SET
        sla_hora_inicio   = $2,
        sla_hora_fim      = $3,
        sla_minutos_uteis = $4,
        feriados_extra    = $5
      WHERE id = $1 RETURNING ${COLS}`,
    [id, sla_hora_inicio, sla_hora_fim, sla_minutos_uteis, feriados_extra]
  );
  return rows[0] || null;
}

module.exports = { listar, porId, porSlug, criar, definirAtivo, atualizarSla };
