/**
 * regraRoutes.js — Gestão das regras de triagem (parametrização), por organização.
 *
 *  - GET    /api/regras            (admin) — listar as da organização
 *  - POST   /api/regras            (admin) — criar
 *  - PATCH  /api/regras/:id        (admin) — atualizar (parcial)
 *  - DELETE /api/regras/:id        (admin) — remover
 *  - POST   /api/regras/testar     (admin) — pré-visualizar a categoria
 *
 * `resolverOrg` fixa `req.orgId`. Qualquer mutação invalida a cache do
 * triageService DESSA organização, para efeito imediato na triagem seguinte.
 */
const express = require('express');
const regraModel = require('../models/regraModel');
const triageService = require('../services/triageService');
const { exigirAutenticacao, exigirAdmin, resolverOrg } = require('../middleware/auth');

const router = express.Router();

const CAMPOS_ALVO = ['assunto', 'corpo', 'ambos'];

/** Valida e normaliza o corpo de uma regra. `parcial` permite campos ausentes (update). */
function validar(body, { parcial = false } = {}) {
  const erro = (msg) => Object.assign(new Error(msg), { status: 400 });
  const out = {};

  if (body.palavra_chave !== undefined || !parcial) {
    const p = String(body.palavra_chave ?? '').trim();
    if (!p) throw erro('Palavra-chave em falta.');
    out.palavra_chave = p;
  }
  if (body.categoria !== undefined || !parcial) {
    const c = String(body.categoria ?? '').trim();
    if (!c) throw erro('Categoria em falta.');
    out.categoria = c;
  }
  if (body.campo_alvo !== undefined || !parcial) {
    const ca = String(body.campo_alvo ?? 'ambos').trim();
    if (!CAMPOS_ALVO.includes(ca)) throw erro("Campo-alvo inválido (assunto, corpo ou ambos).");
    out.campo_alvo = ca;
  }
  if (body.prioridade !== undefined || !parcial) {
    const n = Number(body.prioridade ?? 100);
    if (!Number.isInteger(n) || n < 0) throw erro('Prioridade deve ser um inteiro ≥ 0.');
    out.prioridade = n;
  }
  if (body.ativa !== undefined) out.ativa = !!body.ativa;
  return out;
}

function tratar(res, err) {
  const status = err.status || 500;
  if (status >= 500) console.error('[regras]', err);
  res.status(status).json({ erro: err.message || 'Erro interno.' });
}

// GET /api/regras — lista as regras da organização.
router.get('/', exigirAutenticacao, exigirAdmin, resolverOrg, async (req, res) => {
  res.json(await regraModel.listarTodas(req.orgId));
});

// POST /api/regras/testar — pré-visualiza a categoria para um texto de exemplo.
router.post('/testar', exigirAutenticacao, exigirAdmin, resolverOrg, async (req, res) => {
  const { assunto = '', corpo = '' } = req.body || {};
  const r = await triageService.triar({ assunto, corpo }, req.orgId);
  res.json({ categoria: r.categoria, regra: r.regra });
});

// POST /api/regras — cria uma regra na organização.
router.post('/', exigirAutenticacao, exigirAdmin, resolverOrg, async (req, res) => {
  try {
    const dados = validar(req.body || {});
    const criada = await regraModel.criar({ ...dados, organizacaoId: req.orgId });
    triageService.invalidarCache(req.orgId);
    res.status(201).json(criada);
  } catch (err) {
    tratar(res, err);
  }
});

// PATCH /api/regras/:id — atualiza (dentro da organização).
router.patch('/:id', exigirAutenticacao, exigirAdmin, resolverOrg, async (req, res) => {
  try {
    const dados = validar(req.body || {}, { parcial: true });
    const atualizada = await regraModel.atualizar(req.params.id, dados, req.orgId);
    if (!atualizada) return res.status(404).json({ erro: 'Regra não encontrada.' });
    triageService.invalidarCache(req.orgId);
    res.json(atualizada);
  } catch (err) {
    tratar(res, err);
  }
});

// DELETE /api/regras/:id — remove (dentro da organização).
router.delete('/:id', exigirAutenticacao, exigirAdmin, resolverOrg, async (req, res) => {
  try {
    const ok = await regraModel.remover(req.params.id, req.orgId);
    if (!ok) return res.status(404).json({ erro: 'Regra não encontrada.' });
    triageService.invalidarCache(req.orgId);
    res.status(204).end();
  } catch (err) {
    tratar(res, err);
  }
});

module.exports = router;
