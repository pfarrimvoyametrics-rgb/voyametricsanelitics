/**
 * ticketRoutes.js — Operações sobre tickets via HTTP.
 * Espelham as ações do WebSocket, partilhando ticketService.
 *
 * Multi-tenant: `resolverOrg` coloca `req.orgId` (a org do token para
 * admin/operador; a do header x-org-id para o super_admin). Tudo é escopado.
 */
const express = require('express');
const ticketModel = require('../models/ticketModel');
const ticketService = require('../services/ticketService');
const graphService = require('../services/graphService');
const { exigirAutenticacao, exigirAdmin, resolverOrg } = require('../middleware/auth');
const { ehAdmin } = require('../utils/papeis');

const router = express.Router();

// GET /api/tickets?status=&categoria=&ativos=1&limite=
router.get('/', exigirAutenticacao, resolverOrg, async (req, res) => {
  const { status, categoria, ativos, limite } = req.query;
  const lista = await ticketModel.listarParaUtilizador(req.utilizador, req.orgId, {
    status,
    categoria,
    apenasAtivos: ativos === '1' || ativos === 'true',
    limite,
  });
  res.json(lista);
});

// GET /api/tickets/metricas   (admin) — carga por operador + SLA
router.get('/metricas', exigirAutenticacao, exigirAdmin, resolverOrg, async (req, res) => {
  const [carga, sla] = await Promise.all([
    ticketModel.cargaPorOperador(req.orgId),
    ticketModel.metricasSla(req.orgId),
  ]);
  res.json({ carga, sla });
});

// POST /api/tickets/:id/assumir
router.post('/:id/assumir', exigirAutenticacao, resolverOrg, async (req, res) => {
  const io = req.app.get('io');
  const r = await ticketService.assumir(io, req.params.id, req.utilizador, req.orgId);
  if (!r.ok) return res.status(409).json({ erro: r.motivo });
  res.json(r.ticket);
});

// POST /api/tickets/:id/libertar
router.post('/:id/libertar', exigirAutenticacao, resolverOrg, async (req, res) => {
  const io = req.app.get('io');
  // Admin pode libertar qualquer; operador só os seus.
  const opts = ehAdmin(req.utilizador.funcao)
    ? { porSistema: true, orgId: req.orgId }
    : { operadorId: req.utilizador.id, orgId: req.orgId };
  const r = await ticketService.libertar(io, req.params.id, opts);
  if (!r.ok) return res.status(409).json({ erro: r.motivo });
  res.json(r.ticket);
});

// POST /api/tickets/:id/resolver   { resposta? }
// Se vier `resposta`, envia-a pelo Outlook (Graph) antes de resolver.
router.post('/:id/resolver', exigirAutenticacao, resolverOrg, async (req, res) => {
  const io = req.app.get('io');
  const { resposta } = req.body || {};

  const ticket = await ticketModel.porId(req.params.id, req.orgId);
  if (!ticket) return res.status(404).json({ erro: 'Ticket inexistente.' });

  if (resposta) {
    // Tickets de teste (mock-*) não existem no Outlook: em desenvolvimento,
    // saltamos o envio real para a interface funcionar sem o Microsoft Graph.
    const ehMock = String(ticket.outlook_message_id).startsWith('mock-');
    if (ehMock && process.env.NODE_ENV !== 'production') {
      console.log(`[tickets] (dev) resposta simulada para ticket mock ${ticket.id}`);
    } else {
      try {
        await graphService.responderMensagem(ticket.outlook_message_id, resposta);
      } catch (err) {
        console.error('[tickets] Falha ao enviar resposta:', err.message);
        return res.status(502).json({ erro: 'Falha ao enviar email pelo Outlook.' });
      }
    }
  }

  const r = await ticketService.resolver(io, req.params.id, req.utilizador.id, req.orgId);
  if (!r.ok) return res.status(409).json({ erro: r.motivo });
  res.json(r.ticket);
});

module.exports = router;
