/**
 * authRoutes.js — Login por email + palavra-passe e consulta do utilizador atual.
 */
const express = require('express');
const userModel = require('../models/userModel');
const { verificar } = require('../utils/password');
const { emitirToken, exigirAutenticacao } = require('../middleware/auth');

const router = express.Router();

// Mensagem genérica: não revela se falhou o email ou a palavra-passe
// (evita enumeração de utilizadores).
const ERRO_CREDENCIAIS = 'Credenciais inválidas.';

// POST /api/auth/login   { email, senha }
router.post('/login', async (req, res) => {
  const { email, senha } = req.body || {};
  if (!email || !senha) {
    return res.status(400).json({ erro: 'Indique o email e a palavra-passe.' });
  }

  const utilizador = await userModel.porEmailComCredenciais(
    String(email).toLowerCase().trim()
  );
  if (!utilizador || !utilizador.senha_hash) {
    return res.status(401).json({ erro: ERRO_CREDENCIAIS });
  }

  const ok = await verificar(String(senha), utilizador.senha_hash);
  if (!ok) return res.status(401).json({ erro: ERRO_CREDENCIAIS });

  // Nunca devolver o hash ao cliente.
  delete utilizador.senha_hash;

  const token = emitirToken(utilizador);
  res.json({ token, utilizador });
});

// GET /api/auth/me — perfil completo e atual (inclui organizacao_nome).
router.get('/me', exigirAutenticacao, async (req, res) => {
  const utilizador = await userModel.porId(req.utilizador.id);
  if (!utilizador || !utilizador.ativo) {
    return res.status(401).json({ erro: 'Sessão inválida.' });
  }
  res.json({ utilizador });
});

module.exports = router;
