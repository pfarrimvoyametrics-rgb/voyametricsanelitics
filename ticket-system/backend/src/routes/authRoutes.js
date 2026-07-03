/**
 * authRoutes.js — Login simplificado por perfil e consulta do utilizador atual.
 */
const express = require('express');
const userModel = require('../models/userModel');
const { emitirToken, exigirAutenticacao } = require('../middleware/auth');

const router = express.Router();

// POST /api/auth/login   { email }
router.post('/login', async (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ erro: 'Indique o email.' });

  const utilizador = await userModel.porEmail(String(email).toLowerCase().trim());
  if (!utilizador) return res.status(401).json({ erro: 'Perfil não encontrado.' });

  const token = emitirToken(utilizador);
  res.json({ token, utilizador });
});

// GET /api/auth/me
router.get('/me', exigirAutenticacao, (req, res) => {
  res.json({ utilizador: req.utilizador });
});

module.exports = router;
