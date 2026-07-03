/**
 * auth.js — Autenticação por JWT e autorização.
 *
 * O login valida email + palavra-passe (hash bcrypt — ver `routes/authRoutes.js`
 * e `utils/password.js`) e emite um JWT que inclui a organização do utilizador.
 * Aqui ficam a emissão/verificação do token, os middlewares de autorização
 * (`exigirAutenticacao`, `exigirAdmin`, `exigirSuperAdmin`) e a resolução da
 * organização-alvo do pedido (`resolverOrg`, barreira anti-cross-tenant).
 */
const jwt = require('jsonwebtoken');
const { env } = require('../config/env');
const { ehAdmin, ehSuperAdmin } = require('../utils/papeis');

function emitirToken(utilizador) {
  return jwt.sign(
    {
      sub: utilizador.id,
      email: utilizador.email,
      nome: utilizador.nome,
      categoria: utilizador.categoria,
      funcao: utilizador.funcao,
      organizacao_id: utilizador.organizacao_id ?? null,
    },
    env.jwtSecret,
    { expiresIn: env.jwtExpiry }
  );
}

function verificarToken(token) {
  return jwt.verify(token, env.jwtSecret);
}

/** Middleware Express: exige Authorization: Bearer <token>. */
function exigirAutenticacao(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ erro: 'Token em falta.' });
  try {
    const dados = verificarToken(token);
    req.utilizador = {
      id: dados.sub,
      email: dados.email,
      nome: dados.nome,
      categoria: dados.categoria,
      funcao: dados.funcao,
      organizacaoId: dados.organizacao_id ?? null,
    };
    next();
  } catch {
    return res.status(401).json({ erro: 'Token inválido ou expirado.' });
  }
}

/** Middleware Express: exige função admin OU super_admin. */
function exigirAdmin(req, res, next) {
  if (!ehAdmin(req.utilizador?.funcao)) {
    return res.status(403).json({ erro: 'Acesso restrito a administradores.' });
  }
  next();
}

/** Middleware Express: exige o super administrador do servidor. */
function exigirSuperAdmin(req, res, next) {
  if (!ehSuperAdmin(req.utilizador?.funcao)) {
    return res.status(403).json({ erro: 'Acesso restrito ao super administrador.' });
  }
  next();
}

/**
 * Resolve a organização-alvo do pedido e coloca-a em `req.orgId`.
 *  - admin/operador: SEMPRE a organização do próprio token (barreira
 *    anti-cross-tenant — qualquer valor enviado pelo cliente é ignorado).
 *  - super_admin: a organização indicada no header `x-org-id`, validada
 *    (existe e está ativa). Sem header -> 400; org inexistente/inativa -> 404.
 * Usar depois de `exigirAutenticacao`.
 */
async function resolverOrg(req, res, next) {
  const u = req.utilizador;
  if (!u) return res.status(401).json({ erro: 'Não autenticado.' });

  if (!ehSuperAdmin(u.funcao)) {
    if (!u.organizacaoId) {
      return res.status(403).json({ erro: 'Utilizador sem organização.' });
    }
    req.orgId = u.organizacaoId;
    return next();
  }

  // super_admin: precisa de indicar a organização a operar.
  const orgId = req.headers['x-org-id'];
  if (!orgId) {
    return res.status(400).json({ erro: 'Selecione uma organização (header x-org-id).' });
  }
  try {
    const orgModel = require('../models/orgModel');
    const org = await orgModel.porId(orgId);
    if (!org || !org.ativo) {
      return res.status(404).json({ erro: 'Organização não encontrada ou inativa.' });
    }
    req.orgId = org.id;
    next();
  } catch {
    return res.status(400).json({ erro: 'Organização inválida.' });
  }
}

module.exports = {
  emitirToken,
  verificarToken,
  exigirAutenticacao,
  exigirAdmin,
  exigirSuperAdmin,
  resolverOrg,
};
