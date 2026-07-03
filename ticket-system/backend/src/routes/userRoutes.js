/**
 * userRoutes.js — Gestão/consulta de utilizadores.
 */
const express = require('express');
const userModel = require('../models/userModel');
const { exigirAutenticacao, exigirAdmin } = require('../middleware/auth');

const router = express.Router();

// GET /api/usuarios   (admin) — lista todos os funcionários
router.get('/', exigirAutenticacao, exigirAdmin, async (_req, res) => {
  const lista = await userModel.listarTodos();
  res.json(lista);
});

module.exports = router;
