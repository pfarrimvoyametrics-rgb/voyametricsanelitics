/**
 * userModel.js — Acesso à tabela `usuarios`.
 */
const { pool } = require('../config/db');

async function porEmail(email) {
  const { rows } = await pool.query(
    `SELECT id, nome, email, categoria, funcao, ativo
       FROM usuarios WHERE email = $1 AND ativo = TRUE`,
    [email]
  );
  return rows[0] || null;
}

async function porId(id) {
  const { rows } = await pool.query(
    `SELECT id, nome, email, categoria, funcao, ativo
       FROM usuarios WHERE id = $1`,
    [id]
  );
  return rows[0] || null;
}

async function listarTodos() {
  const { rows } = await pool.query(
    `SELECT id, nome, email, categoria, funcao, ativo
       FROM usuarios ORDER BY funcao DESC, categoria, nome`
  );
  return rows;
}

module.exports = { porEmail, porId, listarTodos };
