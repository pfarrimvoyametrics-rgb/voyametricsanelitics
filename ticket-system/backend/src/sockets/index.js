/**
 * sockets/index.js — Camada de tempo real (Socket.io).
 *
 * Cada socket autentica-se com o JWT. Depois entra:
 *   - na sala da sua categoria  (cat:<categoria>)  -> recebe os eventos da sua fila
 *   - operadores admin entram ainda na sala 'admins' -> recebem tudo + métricas
 *
 * Assim, o evento de bloqueio de um ticket de 'faturacao' só chega aos
 * operadores de faturação (e aos admins), cumprindo o requisito de
 * isolamento por categoria.
 */
const { verificarToken } = require('../middleware/auth');
const ticketService = require('../services/ticketService');

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
      };
      next();
    } catch {
      next(new Error('Token inválido.'));
    }
  });

  io.on('connection', (socket) => {
    const u = socket.utilizador;
    socket.join(ticketService.salaCategoria(u.categoria));
    if (u.funcao === 'admin') socket.join(ticketService.SALA_ADMINS);

    console.log(`[socket] Ligado: ${u.nome} (${u.funcao}/${u.categoria})`);

    // --- Assumir ticket -----------------------------------------------------
    socket.on('ticket:assumir', async ({ ticketId }, ack) => {
      const r = await ticketService.assumir(io, ticketId, u);
      if (typeof ack === 'function') ack(r);
    });

    // --- Libertar ticket (pelo próprio) ------------------------------------
    socket.on('ticket:libertar', async ({ ticketId }, ack) => {
      const r = await ticketService.libertar(io, ticketId, { operadorId: u.id });
      if (typeof ack === 'function') ack(r);
    });

    // --- Resolver ticket ----------------------------------------------------
    socket.on('ticket:resolver', async ({ ticketId }, ack) => {
      const r = await ticketService.resolver(io, ticketId, u.id);
      if (typeof ack === 'function') ack(r);
    });

    // --- Batimento (mantém o ticket aberto vivo) ---------------------------
    socket.on('ticket:heartbeat', async ({ ticketId }) => {
      await ticketService.registarBatimento(ticketId, u.id);
    });

    socket.on('disconnect', () => {
      // Não libertamos já: o sweeper trata, dando os 5 min de tolerância.
      console.log(`[socket] Desligado: ${u.nome}`);
    });
  });
}

module.exports = { configurarSockets };
