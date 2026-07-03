/**
 * userRoutes.js — Consulta e gestão de utilizadores.
 *
 *  - GET  /api/usuarios          (admin)        — listar
 *  - POST /api/usuarios          (super admin)  — criar operador/admin
 *  - PATCH /api/usuarios/:id/ativo (super admin) — ativar/desativar
 *  - POST /api/usuarios/:id/senha  (super admin) — redefinir palavra-passe
 */
const express = require('express');
const userModel = require('../models/userModel');
const userService = require('../services/userService');
const { exigirAutenticacao, exigirAdmin, exigirSuperAdmin } = require('../middleware/auth');

const router = express.Router();

/** Mapeia erros de negócio (com `.status`) para respostas HTTP. */
function tratar(res, err) {
  const status = err.status || 500;
  if (status >= 500) console.error('[usuarios]', err);
  res.status(status).json({ erro: err.message || 'Erro interno.' });
}

// GET /api/usuarios — lista todos os funcionários (admins e super admin).
router.get('/', exigirAutenticacao, exigirAdmin, async (_req, res) => {
  const lista = await userModel.listarTodos();
  res.json(lista);
});

// POST /api/usuarios — cria um operador ou admin (só super admin).
router.post('/', exigirAutenticacao, exigirSuperAdmin, async (req, res) => {
  try {
    const criado = await userService.criarUtilizador(req.body || {});
    res.status(201).json(criado);
  } catch (err) {
    tratar(res, err);
  }
});

// PATCH /api/usuarios/:id/ativo — ativa/desativa (só super admin).
router.patch('/:id/ativo', exigirAutenticacao, exigirSuperAdmin, async (req, res) => {
  try {
    const atualizado = await userService.definirAtivoUtilizador(req.params.id, req.body?.ativo);
    if (!atualizado) return res.status(404).json({ erro: 'Utilizador não encontrado.' });
    res.json(atualizado);
  } catch (err) {
    tratar(res, err);
  }
});

// POST /api/usuarios/:id/senha — redefine a palavra-passe (só super admin).
router.post('/:id/senha', exigirAutenticacao, exigirSuperAdmin, async (req, res) => {
  try {
    const alvo = await userService.redefinirSenha(req.params.id, req.body?.password);
    if (!alvo) return res.status(404).json({ erro: 'Utilizador não encontrado.' });
    res.json({ ok: true });
  } catch (err) {
    tratar(res, err);
  }
});

module.exports = router;
