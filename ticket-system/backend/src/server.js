/**
 * server.js — Ponto de entrada da aplicação.
 * Liga Express + HTTP server + Socket.io, monta as rotas, arranca o sweeper
 * de libertação automática e (se configurado) as subscrições do Graph.
 */
const http = require('http');
const express = require('express');
const cors = require('cors');
const { Server } = require('socket.io');

const { env } = require('./config/env');
const { pool } = require('./config/db');
const { configurarSockets } = require('./sockets');
const ticketService = require('./services/ticketService');

// Rotas
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const ticketRoutes = require('./routes/ticketRoutes');
const webhookRoutes = require('./routes/webhookRoutes');

const app = express();
app.use(cors({ origin: env.clientUrl, credentials: true }));
app.use(express.json({ limit: '2mb' }));

// Disponibiliza o `io` às rotas via app.get('io').
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: env.clientUrl, methods: ['GET', 'POST'] },
});
app.set('io', io);
configurarSockets(io);

// --- Rotas REST --------------------------------------------------------------
app.get('/api/health', (_req, res) => res.json({ ok: true, ts: new Date().toISOString() }));
app.use('/api/auth', authRoutes);
app.use('/api/usuarios', userRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/webhooks', webhookRoutes);

// --- Rota de DESENVOLVIMENTO: injetar um ticket falso para testar a UI -------
// (desativada em produção). Útil para validar fila/cronómetro sem o Outlook.
if (env.nodeEnv !== 'production') {
  const slaService = require('./services/slaService');
  const triageService = require('./services/triageService');
  const ticketModel = require('./models/ticketModel');

  app.post('/api/dev/mock-ticket', async (req, res) => {
    const exemplos = [
      { assunto: 'Erro ao aceder à plataforma', corpo: 'Não funciona o login, preciso de ajuda.' },
      { assunto: 'Fatura em duplicado', corpo: 'Recebi um recibo errado, pedido de reembolso.' },
      { assunto: 'Orçamento para viagem a Roma', corpo: 'Gostaria de uma proposta e reserva.' },
    ];
    const e = req.body?.assunto ? req.body : exemplos[Math.floor(Math.random() * exemplos.length)];
    const dataRececao = new Date();
    const { categoria } = await triageService.triar({ assunto: e.assunto, corpo: e.corpo });
    const slaLimite = slaService.calcularSlaLimite(dataRececao);
    const ticket = await ticketModel.criar({
      outlookMessageId: `mock-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      remetente: e.remetente || 'cliente.teste@exemplo.pt',
      assunto: e.assunto,
      corpoEmail: e.corpo,
      dataRececao,
      slaLimite,
      categoriaTicket: categoria,
    });
    if (ticket) ticketService.anunciarNovo(io, ticket);
    res.json(ticket);
  });
}

// --- Gestão de subscrições do Microsoft Graph --------------------------------
let subscricaoAtual = null;
async function arrancarGraph() {
  if (!env.graph.clientId || !env.graph.webhookUrl || !env.graph.mailbox) {
    console.warn('[graph] Configuração incompleta — subscrição não iniciada (modo local).');
    return;
  }
  try {
    const graphService = require('./services/graphService');
    subscricaoAtual = await graphService.criarSubscricao();
    // Renovar a cada 24 h (subscrições de mensagens duram ~3 dias).
    setInterval(async () => {
      try {
        if (subscricaoAtual) await graphService.renovarSubscricao(subscricaoAtual.id);
        console.log('[graph] Subscrição renovada.');
      } catch (err) {
        console.error('[graph] Falha na renovação, a recriar…', err.message);
        subscricaoAtual = await graphService.criarSubscricao();
      }
    }, 24 * 60 * 60 * 1000);
  } catch (err) {
    console.error('[graph] Não foi possível iniciar a subscrição:', err.message);
  }
}

// --- Arranque ----------------------------------------------------------------
async function iniciar() {
  try {
    await pool.query('SELECT 1'); // valida ligação à BD
    console.log('[db] Ligação OK.');
  } catch (err) {
    console.error('[db] Falha na ligação à base de dados:', err.message);
    process.exit(1);
  }

  ticketService.iniciarSweeper(io);
  await arrancarGraph();

  server.listen(env.port, () => {
    console.log(`\n  ✅ Backend a correr em http://localhost:${env.port}`);
    console.log(`     Ambiente: ${env.nodeEnv} | Fuso: ${process.env.TZ || '(do sistema)'}\n`);
  });
}

iniciar();

module.exports = { app, server, io };
