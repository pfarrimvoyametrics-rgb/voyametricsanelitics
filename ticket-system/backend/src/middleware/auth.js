/**
 * auth.js — Autenticação por JWT.
 *
 * Login é simplificado conforme pedido ("simples, para o funcionário entrar
 * com o seu perfil"): valida-se o email contra a tabela `usuarios` e emite-se
 * um JWT. Em produção, acrescentar palavra-passe/SSO (ver README › Segurança).
 */
const jwt = require('jsonwebtoken');
const { env } = require('../config/env');

function emitirToken(utilizador) {
  return jwt.sign(
    {
      sub: utilizador.id,
      email: utilizador.email,
      nome: utilizador.nome,
      categoria: utilizador.categoria,
      funcao: utilizador.funcao,
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
    };
    next();
  } catch {
    return res.status(401).json({ erro: 'Token inválido ou expirado.' });
  }
}

/** Middleware Express: exige função admin. */
function exigirAdmin(req, res, next) {
  if (req.utilizador?.funcao !== 'admin') {
    return res.status(403).json({ erro: 'Acesso restrito a administradores.' });
  }
  next();
}

module.exports = { emitirToken, verificarToken, exigirAutenticacao, exigirAdmin };
