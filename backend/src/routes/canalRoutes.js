/**
 * canalRoutes.js — Configuração do SLA por canal/categoria (apenas admin),
 * escopada por organização (`resolverOrg`).
 *   GET  /api/canais            -> canais configurados da organização
 *   PUT  /api/canais/:categoria -> cria/atualiza o SLA do canal { slaMinutos, rotulo? }
 */
const express = require('express');
const canalModel = require('../models/canalModel');
const { exigirAutenticacao, exigirAdmin, resolverOrg } = require('../middleware/auth');

const router = express.Router();

router.get('/', exigirAutenticacao, exigirAdmin, resolverOrg, async (req, res) => {
  try {
    res.json(await canalModel.listar(req.orgId));
  } catch (err) {
    console.error('[canais] Erro a listar:', err.message);
    res.status(500).json({ erro: 'Falha ao obter os canais.' });
  }
});

router.put('/:categoria', exigirAutenticacao, exigirAdmin, resolverOrg, async (req, res) => {
  const categoria = String(req.params.categoria || '').trim();
  const { slaMinutos, rotulo } = req.body || {};
  if (!categoria) return res.status(400).json({ erro: 'Categoria inválida.' });
  const n = parseInt(slaMinutos, 10);
  if (!Number.isFinite(n) || n < 1) return res.status(400).json({ erro: 'SLA (minutos) inválido.' });
  try {
    const canal = await canalModel.upsert(req.orgId, categoria, { slaMinutos: n, rotulo });
    res.json(canal);
  } catch (err) {
    console.error('[canais] Erro a atualizar:', err.message);
    res.status(500).json({ erro: 'Falha ao atualizar o canal.' });
  }
});

module.exports = router;
