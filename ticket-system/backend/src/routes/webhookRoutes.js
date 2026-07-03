/**
 * webhookRoutes.js — Recebe as notificações da Microsoft Graph.
 *
 * Dois caminhos:
 *  1) VALIDAÇÃO: ao criar a subscrição, a Graph faz um POST com
 *     ?validationToken=... e espera que devolvamos o token em texto simples
 *     (HTTP 200) em menos de 10 s.
 *  2) NOTIFICAÇÃO: para cada email novo, a Graph envia um corpo JSON com
 *     value[]. Validamos o clientState, respondemos 202 IMEDIATAMENTE e
 *     processamos em segundo plano (ler msg -> triar -> calcular SLA ->
 *     gravar -> anunciar por socket).
 */
const express = require('express');
const { env } = require('../config/env');
const graphService = require('../services/graphService');
const triageService = require('../services/triageService');
const slaService = require('../services/slaService');
const ticketModel = require('../models/ticketModel');
const ticketService = require('../services/ticketService');

const router = express.Router();

// Processa uma notificação individual (assíncrono, fora do ciclo de resposta).
async function processarNotificacao(io, notificacao) {
  try {
    if (notificacao.clientState !== env.graph.clientState) {
      console.warn('[webhook] clientState inválido — notificação ignorada.');
      return;
    }
    const messageId = notificacao.resourceData?.id;
    if (!messageId) return;

    // 1) Ler o email completo
    const email = await graphService.obterMensagem(messageId);

    // 2) Triagem -> categoria
    const { categoria } = await triageService.triar({
      assunto: email.assunto,
      corpo: email.corpoEmail,
    });

    // 3) Calcular SLA (2h úteis)
    const slaLimite = slaService.calcularSlaLimite(email.dataRececao);

    // 4) Gravar (idempotente)
    const ticket = await ticketModel.criar({
      outlookMessageId: email.outlookMessageId,
      remetente: email.remetente,
      assunto: email.assunto,
      corpoEmail: email.corpoEmail,
      dataRececao: email.dataRececao,
      slaLimite,
      categoriaTicket: categoria,
    });

    // 5) Anunciar em tempo real (se era novo)
    if (ticket) {
      ticketService.anunciarNovo(io, ticket);
      console.log(`[webhook] Ticket criado [${categoria}] de ${email.remetente}`);
    }
  } catch (err) {
    console.error('[webhook] Erro a processar notificação:', err.message);
  }
}

// POST /api/webhooks/graph
router.post('/graph', (req, res) => {
  // 1) Pedido de validação da subscrição
  if (req.query.validationToken) {
    res.set('Content-Type', 'text/plain');
    return res.status(200).send(req.query.validationToken);
  }

  // 2) Notificações reais — responder já e processar depois
  const io = req.app.get('io');
  const notificacoes = req.body?.value || [];
  res.sendStatus(202);

  for (const n of notificacoes) {
    // não aguardamos (fire-and-forget) para libertar o socket da Graph
    processarNotificacao(io, n);
  }
});

module.exports = router;
