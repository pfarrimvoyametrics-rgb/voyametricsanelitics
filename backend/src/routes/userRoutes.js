/**
 * userRoutes.js — Consulta e gestão de utilizadores (escopada por organização).
 *
 *  - GET   /api/usuarios           (admin) — listar os da organização
 *  - POST  /api/usuarios           (admin) — criar operador/admin na organização
 *  - PATCH /api/usuarios/:id/ativo  (admin) — ativar/desativar
 *  - POST  /api/usuarios/:id/senha  (admin) — redefinir palavra-passe
 *
 * `resolverOrg` fixa `req.orgId`: para admin de organização é a sua própria
 * (do token); para super_admin é a org selecionada (header x-org-id).
 */
const express = require('express');
const userModel = require('../models/userModel');
const userService = require('../services/userService');
const { exigirAutenticacao, exigirAdmin, resolverOrg } = require('../middleware/auth');

const router = express.Router();

/** Mapeia erros de negócio (com `.status`) para respostas HTTP. */
function tratar(res, err) {
  const status = err.status || 500;
  if (status >= 500) console.error('[usuarios]', err);
  res.status(status).json({ erro: err.message || 'Erro interno.' });
}

// GET /api/usuarios — lista os utilizadores da organização.
router.get('/', exigirAutenticacao, exigirAdmin, resolverOrg, async (req, res) => {
  const lista = await userModel.listarTodos(req.orgId);
  res.json(lista);
});

// POST /api/usuarios — cria um operador ou admin na organização.
router.post('/', exigirAutenticacao, exigirAdmin, resolverOrg, async (req, res) => {
  try {
    const criado = await userService.criarUtilizador({ ...(req.body || {}), organizacaoId: req.orgId });
    res.status(201).json(criado);
  } catch (err) {
    tratar(res, err);
  }
});

// PATCH /api/usuarios/:id/ativo — ativa/desativa (dentro da organização).
router.patch('/:id/ativo', exigirAutenticacao, exigirAdmin, resolverOrg, async (req, res) => {
  try {
    const atualizado = await userService.definirAtivoUtilizador(req.params.id, req.body?.ativo, req.orgId);
    if (!atualizado) return res.status(404).json({ erro: 'Utilizador não encontrado.' });
    res.json(atualizado);
  } catch (err) {
    tratar(res, err);
  }
});

// POST /api/usuarios/:id/senha — redefine a palavra-passe (dentro da organização).
router.post('/:id/senha', exigirAutenticacao, exigirAdmin, resolverOrg, async (req, res) => {
  try {
    const alvo = await userService.redefinirSenha(req.params.id, req.body?.password, req.orgId);
    if (!alvo) return res.status(404).json({ erro: 'Utilizador não encontrado.' });
    res.json({ ok: true });
  } catch (err) {
    tratar(res, err);
  }
});

module.exports = router;
