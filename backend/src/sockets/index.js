/**
 * sockets/index.js — Camada de tempo real (Socket.io), multi-tenant.
 *
 * Cada socket autentica-se com o JWT (que inclui a organização). Depois entra
 * nas salas da SUA organização:
 *   - operador  -> org:<orgId>:cat:<categoria>   (a sua fila)
 *   - admin     -> org:<orgId>:admins            (tudo + métricas da sua org)
 * O super_admin (sem organização própria) não entra em nada ao ligar; quando
 * observa um cliente no painel, emite `org:entrar` e passa a receber a sala de
 * admins dessa organização.
 *
 * Assim, um evento de um cliente nunca chega aos operadores/admins de outro.
 */
const { verificarToken } = require('../middleware/auth');
const { ehAdmin, ehSuperAdmin } = require('../utils/papeis');
const ticketService = require('../services/ticketService');
const orgModel = require('../models/orgModel');

function configurarSockets(io) {
  // Middleware de autenticação do handshake.
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Token em falta no handshake.'));
    try {
      const dados = verificarToken(token);
      socket.utilizador = {
        id: dados.sub,
        nome: dados.nome,
        categoria: dados.categoria,
        funcao: dados.funcao,
        organizacaoId: dados.organizacao_id ?? null,
      };
      next();
    } catch {
      next(new Error('Token inválido.'));
    }
  });

  io.on('connection', (socket) => {
    const u = socket.utilizador;

    if (!ehSuperAdmin(u.funcao) && u.organizacaoId) {
      if (u.categoria) socket.join(ticketService.salaCategoria(u.organizacaoId, u.categoria));
      if (ehAdmin(u.funcao)) socket.join(ticketService.salaAdmins(u.organizacaoId));
    }

    console.log(`[socket] Ligado: ${u.nome} (${u.funcao}/${u.categoria || '—'})`);

    /** Organização em que este socket está a operar. */
    const orgDoSocket = () => (ehSuperAdmin(u.funcao) ? socket.orgObservada : u.organizacaoId);

    // --- Super admin: observar uma organização (entra na sala de admins) ----
    socket.on('org:entrar', async ({ orgId }, ack) => {
      if (!ehSuperAdmin(u.funcao)) {
        if (typeof ack === 'function') ack({ ok: false, motivo: 'nao_autorizado' });
        return;
      }
      const org = orgId ? await orgModel.porId(orgId) : null;
      if (!org) {
        if (typeof ack === 'function') ack({ ok: false, motivo: 'org_inexistente' });
        return;
      }
      if (socket.orgObservada) socket.leave(ticketService.salaAdmins(socket.orgObservada));
      socket.orgObservada = org.id;
      socket.join(ticketService.salaAdmins(org.id));
      if (typeof ack === 'function') ack({ ok: true });
    });

    // --- Assumir ticket -----------------------------------------------------
    socket.on('ticket:assumir', async ({ ticketId }, ack) => {
      const orgId = orgDoSocket();
      if (!orgId) return typeof ack === 'function' && ack({ ok: false, motivo: 'sem_organizacao' });
      const r = await ticketService.assumir(io, ticketId, u, orgId);
      if (typeof ack === 'function') ack(r);
    });

    // --- Libertar ticket (pelo próprio) ------------------------------------
    socket.on('ticket:libertar', async ({ ticketId }, ack) => {
      const orgId = orgDoSocket();
      if (!orgId) return typeof ack === 'function' && ack({ ok: false, motivo: 'sem_organizacao' });
      const r = await ticketService.libertar(io, ticketId, { operadorId: u.id, orgId });
      if (typeof ack === 'function') ack(r);
    });

    // --- Resolver ticket ----------------------------------------------------
    socket.on('ticket:resolver', async ({ ticketId }, ack) => {
      const orgId = orgDoSocket();
      if (!orgId) return typeof ack === 'function' && ack({ ok: false, motivo: 'sem_organizacao' });
      const r = await ticketService.resolver(io, ticketId, u.id, orgId);
      if (typeof ack === 'function') ack(r);
    });

    // --- Batimento (mantém o ticket aberto vivo) ---------------------------
    socket.on('ticket:heartbeat', async ({ ticketId }) => {
      const orgId = orgDoSocket();
      if (orgId) await ticketService.registarBatimento(ticketId, u.id, orgId);
    });

    socket.on('disconnect', () => {
      // Não libertamos já: o sweeper trata, dando os minutos de tolerância.
      console.log(`[socket] Desligado: ${u.nome}`);
    });
  });
}

module.exports = { configurarSockets };
