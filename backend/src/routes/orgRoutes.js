/**
 * orgRoutes.js — Gestão das organizações (clientes). Exclusivo do super_admin.
 *
 *  - GET   /api/organizacoes                   — listar
 *  - POST  /api/organizacoes                   — criar (opc. admin inicial)
 *  - PATCH /api/organizacoes/:id/ativo         — ativar/desativar
 *  - PATCH /api/organizacoes/:id/email-dominios — domínios de roteamento de email
 */
const express = require('express');
const orgModel = require('../models/orgModel');
const userService = require('../services/userService');
const { exigirAutenticacao, exigirSuperAdmin } = require('../middleware/auth');

const router = express.Router();

const RE_SLUG = /^[a-z0-9-]+$/;

function tratar(res, err) {
  const status = err.status || 500;
  if (status >= 500) console.error('[organizacoes]', err);
  res.status(status).json({ erro: err.message || 'Erro interno.' });
}

// GET /api/organizacoes — lista todas.
router.get('/', exigirAutenticacao, exigirSuperAdmin, async (_req, res) => {
  res.json(await orgModel.listar());
});

// POST /api/organizacoes — cria organização (+ admin inicial opcional).
router.post('/', exigirAutenticacao, exigirSuperAdmin, async (req, res) => {
  const erro = (msg, status = 400) => Object.assign(new Error(msg), { status });
  try {
    const nome = String(req.body?.nome ?? '').trim();
    const slug = String(req.body?.slug ?? '').trim().toLowerCase();
    const emailDominios = req.body?.email_dominios != null ? String(req.body.email_dominios).trim() : null;
    if (!nome) throw erro('Nome da organização em falta.');
    if (!RE_SLUG.test(slug)) throw erro('Slug inválido (apenas minúsculas, números e hífen).');

    let org;
    try {
      org = await orgModel.criar({ nome, slug, email_dominios: emailDominios || null });
    } catch (e) {
      if (e.code === '23505') throw erro('Já existe uma organização com esse slug.', 409);
      throw e;
    }

    // Admin inicial (opcional).
    let admin = null;
    const a = req.body?.admin;
    if (a && (a.email || a.nome || a.password)) {
      admin = await userService.criarUtilizador({
        nome: a.nome,
        email: a.email,
        password: a.password,
        funcao: 'admin',
        organizacaoId: org.id,
      });
    }

    res.status(201).json({ organizacao: org, admin });
  } catch (err) {
    tratar(res, err);
  }
});

// PATCH /api/organizacoes/:id/ativo — ativa/desativa.
router.patch('/:id/ativo', exigirAutenticacao, exigirSuperAdmin, async (req, res) => {
  try {
    const org = await orgModel.definirAtivo(req.params.id, !!req.body?.ativo);
    if (!org) return res.status(404).json({ erro: 'Organização não encontrada.' });
    res.json(org);
  } catch (err) {
    tratar(res, err);
  }
});

// PATCH /api/organizacoes/:id/email-dominios — roteamento de email por org.
router.patch('/:id/email-dominios', exigirAutenticacao, exigirSuperAdmin, async (req, res) => {
  try {
    const valor = req.body?.email_dominios != null ? String(req.body.email_dominios) : null;
    const org = await orgModel.atualizarEmailDominios(req.params.id, valor);
    if (!org) return res.status(404).json({ erro: 'Organização não encontrada.' });
    res.json(org);
  } catch (err) {
    tratar(res, err);
  }
});

module.exports = router;
