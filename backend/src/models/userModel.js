/**
 * userModel.js — Acesso à tabela `usuarios`.
 *
 * Regra de ouro: o `senha_hash` NUNCA sai deste módulo para as rotas. Só o
 * `porEmailComCredenciais` (usado no login) o devolve, e o valor é descartado
 * imediatamente após a verificação da palavra-passe.
 *
 * Multi-tenant: cada utilizador tem `organizacao_id` (NULL para o super_admin,
 * que é da plataforma). O login continua a resolver-se por email (global); a
 * organização do utilizador segue no perfil e daí para o JWT.
 */
const { pool } = require('../config/db');

// Colunas seguras para expor (sem senha_hash). Usadas em RETURNING (sem join).
const COLS_PUBLICAS = 'id, nome, email, categoria, funcao, ativo, organizacao_id';

// Como acima, mas com o nome da organização (requer join). Prefixo u./o.
const COLS_COM_ORG =
  'u.id, u.nome, u.email, u.categoria, u.funcao, u.ativo, u.organizacao_id, o.nome AS organizacao_nome';
const FROM_COM_ORG = 'FROM usuarios u LEFT JOIN organizacoes o ON o.id = u.organizacao_id';

async function porEmail(email) {
  const { rows } = await pool.query(
    `SELECT ${COLS_COM_ORG} ${FROM_COM_ORG}
      WHERE lower(u.email) = lower($1) AND u.ativo = TRUE`,
    [email]
  );
  return rows[0] || null;
}

/** Como `porEmail`, mas inclui o hash — exclusivo para o fluxo de login. */
async function porEmailComCredenciais(email) {
  const { rows } = await pool.query(
    `SELECT ${COLS_COM_ORG}, u.senha_hash ${FROM_COM_ORG}
      WHERE lower(u.email) = lower($1) AND u.ativo = TRUE`,
    [email]
  );
  return rows[0] || null;
}

async function porId(id) {
  const { rows } = await pool.query(
    `SELECT ${COLS_COM_ORG} ${FROM_COM_ORG} WHERE u.id = $1`,
    [id]
  );
  return rows[0] || null;
}

/** Lista os utilizadores de UMA organização. */
async function listarTodos(orgId) {
  const { rows } = await pool.query(
    `SELECT ${COLS_COM_ORG} ${FROM_COM_ORG}
      WHERE u.organizacao_id = $1
      ORDER BY u.funcao DESC, u.categoria, u.nome`,
    [orgId]
  );
  return rows;
}

/**
 * Cria ou atualiza um utilizador pela chave natural (email).
 * Usado no bootstrap do super admin (org NULL) e na sementeira de perfis demo.
 * Devolve a linha (colunas públicas).
 */
async function upsert({ nome, email, categoria = null, funcao = 'operador', senhaHash = null, ativo = true, organizacaoId = null }) {
  const { rows } = await pool.query(
    `INSERT INTO usuarios (nome, email, categoria, funcao, senha_hash, ativo, organizacao_id)
     VALUES ($1, lower($2), $3, $4, $5, $6, $7)
     ON CONFLICT (lower(email)) DO UPDATE SET
        nome           = EXCLUDED.nome,
        categoria      = EXCLUDED.categoria,
        funcao         = EXCLUDED.funcao,
        senha_hash     = COALESCE(EXCLUDED.senha_hash, usuarios.senha_hash),
        ativo          = EXCLUDED.ativo,
        organizacao_id = EXCLUDED.organizacao_id,
        atualizado_em  = now()
     RETURNING ${COLS_PUBLICAS}`,
    [nome, email, categoria, funcao, senhaHash, ativo, organizacaoId]
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
 * Cria um novo utilizador numa organização. Ao contrário de `upsert`, falha se
 * o email já existir (erro Postgres 23505). Devolve a linha criada.
 */
async function criar({ nome, email, categoria = null, funcao = 'operador', senhaHash = null, ativo = true, organizacaoId = null }) {
  const { rows } = await pool.query(
    `INSERT INTO usuarios (nome, email, categoria, funcao, senha_hash, ativo, organizacao_id)
     VALUES ($1, lower($2), $3, $4, $5, $6, $7)
     RETURNING ${COLS_PUBLICAS}`,
    [nome, email, categoria, funcao, senhaHash, ativo, organizacaoId]
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
