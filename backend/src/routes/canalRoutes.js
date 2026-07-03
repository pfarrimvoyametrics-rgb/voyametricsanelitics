/**
 * canalRoutes.js — Configuração do SLA por canal (apenas admin).
 *   GET  /api/canais            -> lista canais com rótulo e SLA (minutos)
 *   PUT  /api/canais/:categoria -> atualiza o SLA do canal { slaMinutos }
 */
const express = require('express');
const canalModel = require('../models/canalModel');
const { exigirAutenticacao, exigirAdmin } = require('../middleware/auth');

const router = express.Router();
const CATEGORIAS = ['emergencias', 'alteracoes', 'cotacoes', 'reclamacoes', 'suporte_tecnico', 'faturacao', 'comercial'];

router.get('/', exigirAutenticacao, exigirAdmin, async (_req, res) => {
  try {
    res.json(await canalModel.listar());
  } catch (err) {
    console.error('[canais] Erro a listar:', err.message);
    res.status(500).json({ erro: 'Falha ao obter os canais.' });
  }
});

router.put('/:categoria', exigirAutenticacao, exigirAdmin, async (req, res) => {
  const { categoria } = req.params;
  const { slaMinutos } = req.body || {};
  if (!CATEGORIAS.includes(categoria)) return res.status(400).json({ erro: 'Canal inválido.' });
  const n = parseInt(slaMinutos, 10);
  if (!Number.isFinite(n) || n < 1) return res.status(400).json({ erro: 'SLA (minutos) inválido.' });
  try {
    const canal = await canalModel.atualizar(categoria, n);
    if (!canal) return res.status(404).json({ erro: 'Canal não encontrado.' });
    res.json(canal);
  } catch (err) {
    console.error('[canais] Erro a atualizar:', err.message);
    res.status(500).json({ erro: 'Falha ao atualizar o canal.' });
  }
});

module.exports = router;
