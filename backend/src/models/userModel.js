/**
 * userModel.js — Acesso à tabela `usuarios`.
 *
 * Regra de ouro: o `senha_hash` NUNCA sai deste módulo para as rotas. Só o
 * `porEmailComCredenciais` (usado no login) o devolve, e o valor é descartado
 * imediatamente após a verificação da palavra-passe.
 */
const { pool } = require('../config/db');

// Colunas seguras para expor à aplicação/cliente (sem senha_hash).
const COLS_PUBLICAS = 'id, nome, email, categoria, funcao, ativo';

async function porEmail(email) {
  const { rows } = await pool.query(
    `SELECT ${COLS_PUBLICAS}
       FROM usuarios WHERE lower(email) = lower($1) AND ativo = TRUE`,
    [email]
  );
  return rows[0] || null;
}

/** Como `porEmail`, mas inclui o hash — exclusivo para o fluxo de login. */
async function porEmailComCredenciais(email) {
  const { rows } = await pool.query(
    `SELECT ${COLS_PUBLICAS}, senha_hash
       FROM usuarios WHERE lower(email) = lower($1) AND ativo = TRUE`,
    [email]
  );
  return rows[0] || null;
}

async function porId(id) {
  const { rows } = await pool.query(
    `SELECT ${COLS_PUBLICAS} FROM usuarios WHERE id = $1`,
    [id]
  );
  return rows[0] || null;
}

async function listarTodos() {
  const { rows } = await pool.query(
    `SELECT ${COLS_PUBLICAS}
       FROM usuarios ORDER BY funcao DESC, categoria, nome`
  );
  return rows;
}

/**
 * Cria ou atualiza um utilizador pela chave natural (email).
 * Usado no bootstrap do super admin e na sementeira de perfis demo.
 * Devolve a linha (colunas públicas).
 */
async function upsert({ nome, email, categoria = null, funcao = 'operador', senhaHash = null, ativo = true }) {
  const { rows } = await pool.query(
    `INSERT INTO usuarios (nome, email, categoria, funcao, senha_hash, ativo)
     VALUES ($1, lower($2), $3, $4, $5, $6)
     ON CONFLICT (lower(email)) DO UPDATE SET
        nome          = EXCLUDED.nome,
        categoria     = EXCLUDED.categoria,
        funcao        = EXCLUDED.funcao,
        senha_hash    = COALESCE(EXCLUDED.senha_hash, usuarios.senha_hash),
        ativo         = EXCLUDED.ativo,
        atualizado_em = now()
     RETURNING ${COLS_PUBLICAS}`,
    [nome, email, categoria, funcao, senhaHash, ativo]
  );
  return rows[0];
}

/** Define/atualiza apenas a palavra-passe de um utilizador. */
async function definirSenha(id, senhaHash) {
  await pool.query(
    `UPDATE usuarios SET senha_hash = $2, atualizado_em = now() WHERE id = $1`,
    [id, senhaHash]
  );
}

/**
 * Cria um novo utilizador. Ao contrário de `upsert`, falha se o email já
 * existir (erro Postgres 23505), para que a gestão distinga "criar" de
 * "atualizar". Devolve a linha criada (colunas públicas).
 */
async function criar({ nome, email, categoria = null, funcao = 'operador', senhaHash = null, ativo = true }) {
  const { rows } = await pool.query(
    `INSERT INTO usuarios (nome, email, categoria, funcao, senha_hash, ativo)
     VALUES ($1, lower($2), $3, $4, $5, $6)
     RETURNING ${COLS_PUBLICAS}`,
    [nome, email, categoria, funcao, senhaHash, ativo]
  );
  return rows[0];
}

/** Ativa/desativa um utilizador. Devolve a linha atualizada (ou null). */
async function definirAtivo(id, ativo) {
  const { rows } = await pool.query(
    `UPDATE usuarios SET ativo = $2, atualizado_em = now()
      WHERE id = $1 RETURNING ${COLS_PUBLICAS}`,
    [id, ativo]
  );
  return rows[0] || null;
}

module.exports = {
  porEmail,
  porEmailComCredenciais,
  porId,
  listarTodos,
  upsert,
  criar,
  definirSenha,
  definirAtivo,
};
