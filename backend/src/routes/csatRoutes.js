/**
 * csatRoutes.js — Inquérito de satisfação (CSAT) — PÚBLICO (sem login).
 * Pensado para o link enviado ao cliente após a viagem/resolução.
 *
 *   GET  /api/csat/:id  -> dados mínimos para mostrar o inquérito
 *   POST /api/csat/:id  -> { nota: 1..5, comentario? }
 *
 * Sem autenticação (o "segredo" é o id do ticket no link). Com rate-limit.
 */
const express = require('express');
const ticketModel = require('../models/ticketModel');
const { limitadorPedidos } = require('../middleware/seguranca');

const router = express.Router();
const limitar = limitadorPedidos({ janelaMs: 60_000, maximo: 20, mensagem: 'Demasiados pedidos. Tente daqui a pouco.' });

// GET — dados mínimos para o ecrã do inquérito.
router.get('/:id', limitar, async (req, res) => {
  try {
    const t = await ticketModel.porId(req.params.id);
    if (!t) return res.status(404).json({ erro: 'Inquérito não encontrado.' });
    res.json({ id: t.id, assunto: t.assunto, status: t.status, ja_respondido: t.csat != null });
  } catch (err) {
    res.status(500).json({ erro: 'Falha ao abrir o inquérito.' });
  }
});

// POST — submeter a avaliação.
router.post('/:id', limitar, async (req, res) => {
  const { nota, comentario } = req.body || {};
  const n = parseInt(nota, 10);
  if (!Number.isFinite(n) || n < 1 || n > 5) {
    return res.status(400).json({ erro: 'Indique uma avaliação de 1 a 5.' });
  }
  try {
    const r = await ticketModel.registarCsat(req.params.id, n, comentario);
    if (!r.ok) {
      if (r.motivo === 'ja_respondido') {
        return res.status(409).json({ erro: 'Este inquérito já foi respondido. Obrigado!' });
      }
      return res.status(404).json({ erro: 'Inquérito não encontrado.' });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('[csat] Erro:', err.message);
    res.status(500).json({ erro: 'Falha ao registar a avaliação.' });
  }
});

module.exports = router;
