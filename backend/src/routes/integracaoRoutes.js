/**
 * integracaoRoutes.js — Integração servidor-a-servidor com um sistema externo
 * (ex.: reservas/faturação) para preencher o RESULTADO e o VALOR da venda
 * automaticamente, sem o operador ter de o introduzir à mão.
 *
 * Autenticação: header `x-api-key: <INTEGRACAO_API_KEY>`.
 *
 * POST /api/integracoes/venda
 *   Body (JSON) — uma referência + o resultado:
 *     { "ticketId": "uuid" }            // OU
 *     { "outlookMessageId": "AAible..." } // OU
 *     { "conversationId": "AAQk..." }
 *     + "resultado": "ganho" | "perdido"
 *     + "valor": 1234.50   (só quando ganho)
 *
 * GET /api/integracoes/ticket?conversationId=... (ou ticketId / outlookMessageId)
 *   Consulta um ticket por referência (para o sistema externo confirmar o alvo).
 */
const express = require('express');
const ticketModel = require('../models/ticketModel');
const ticketService = require('../services/ticketService');
const { exigirApiKey } = require('../middleware/apiKey');

const router = express.Router();
const RESULTADOS = ['ganho', 'perdido', 'nao_aplicavel'];

// Todas as rotas exigem a chave de API.
router.use(exigirApiKey);

// POST /api/integracoes/venda
router.post('/venda', async (req, res) => {
  const { ticketId, outlookMessageId, conversationId, resultado, valor } = req.body || {};

  if (!ticketId && !outlookMessageId && !conversationId) {
    return res.status(400).json({ erro: 'Indique uma referência: ticketId, outlookMessageId ou conversationId.' });
  }
  if (!RESULTADOS.includes(resultado)) {
    return res.status(400).json({ erro: `resultado inválido (use ${RESULTADOS.join(' | ')}).` });
  }

  try {
    const ticket = await ticketModel.definirResultadoVenda({ ticketId, outlookMessageId, conversationId, resultado, valor });
    if (!ticket) return res.status(404).json({ erro: 'Ticket não encontrado para a referência indicada.' });

    // Atualiza os painéis em tempo real.
    const io = req.app.get('io');
    if (io) io.to(ticketService.salaAdmins(ticket.organizacao_id)).emit('metricas:atualizar');

    res.json({
      ok: true,
      ticket: { id: ticket.id, resultado_venda: ticket.resultado_venda, valor_venda: ticket.valor_venda },
    });
  } catch (err) {
    console.error('[integracao] Erro ao definir venda:', err.message);
    res.status(500).json({ erro: 'Falha ao registar a venda.' });
  }
});

// POST /api/integracoes/emissao
//   Body: { ticketId|outlookMessageId|conversationId, emitidos, comErro }
router.post('/emissao', async (req, res) => {
  const { ticketId, outlookMessageId, conversationId, emitidos, comErro } = req.body || {};

  if (!ticketId && !outlookMessageId && !conversationId) {
    return res.status(400).json({ erro: 'Indique uma referência: ticketId, outlookMessageId ou conversationId.' });
  }
  if (!Number.isFinite(Number(emitidos)) || Number(emitidos) < 0) {
    return res.status(400).json({ erro: 'emitidos inválido (inteiro >= 0).' });
  }

  try {
    const ticket = await ticketModel.registarEmissao({ ticketId, outlookMessageId, conversationId, emitidos, comErro });
    if (!ticket) return res.status(404).json({ erro: 'Ticket não encontrado para a referência indicada.' });

    const io = req.app.get('io');
    if (io) io.to(ticketService.salaAdmins(ticket.organizacao_id)).emit('metricas:atualizar');

    res.json({ ok: true, ticket });
  } catch (err) {
    console.error('[integracao] Erro ao registar emissão:', err.message);
    res.status(500).json({ erro: 'Falha ao registar a emissão.' });
  }
});

// GET /api/integracoes/ticket
router.get('/ticket', async (req, res) => {
  const { ticketId, outlookMessageId, conversationId } = req.query;
  if (!ticketId && !outlookMessageId && !conversationId) {
    return res.status(400).json({ erro: 'Indique uma referência: ticketId, outlookMessageId ou conversationId.' });
  }
  try {
    // Integração S2S (chave global, sem contexto de organização): resolve a
    // referência e lê o ticket sem filtro de org.
    const id = await ticketModel.resolverReferencia({ ticketId, outlookMessageId, conversationId });
    const ticket = id ? await ticketModel.porIdGlobal(id) : null;
    if (!ticket) return res.status(404).json({ erro: 'Ticket não encontrado.' });
    res.json(ticket);
  } catch (err) {
    console.error('[integracao] Erro na consulta:', err.message);
    res.status(500).json({ erro: 'Falha na consulta.' });
  }
});

module.exports = router;
