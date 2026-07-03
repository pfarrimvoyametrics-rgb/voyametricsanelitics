/**
 * ticketService.js — Orquestra as ações sobre tickets e emite os eventos
 * de tempo real. É usado tanto pelas rotas HTTP como pelos handlers de
 * WebSocket, para haver uma única fonte de verdade.
 *
 * Eventos emitidos (por sala de categoria + sala 'admins'):
 *   ticket:novo       — chegou um ticket novo (após triagem)
 *   ticket:bloqueado  — um operador assumiu (esconder/bloquear nos outros)
 *   ticket:libertado  — voltou a 'pendente' (mostrar de novo)
 *   ticket:resolvido  — foi resolvido
 *   metricas:atualizar— sinal para o painel admin recarregar números
 */

const { pool } = require('../config/db');
const ticketModel = require('../models/ticketModel');
const { env } = require('../config/env');

const salaCategoria = (cat) => `cat:${cat}`;
const SALA_ADMINS = 'admins';

/** Emite um evento para a categoria do ticket e para os admins. */
function emitir(io, evento, ticket, extra = {}) {
  const payload = { ticket, ...extra };
  io.to(salaCategoria(ticket.categoria_ticket)).emit(evento, payload);
  io.to(SALA_ADMINS).emit(evento, payload);
  // Qualquer alteração mexe nas métricas do supervisor.
  io.to(SALA_ADMINS).emit('metricas:atualizar');
}

/** Anuncia um ticket recém-criado (chamado pelo webhook após triagem). */
function anunciarNovo(io, ticket) {
  emitir(io, 'ticket:novo', ticket);
}

/**
 * Operador assume um ticket. Atómico: só funciona se ainda 'pendente'.
 * @returns {{ok: boolean, ticket?: object, motivo?: string}}
 */
async function assumir(io, ticketId, operador) {
  const ticket = await ticketModel.porId(ticketId);
  if (!ticket) return { ok: false, motivo: 'inexistente' };

  // Operador só pode assumir tickets da sua categoria (admin pode tudo).
  if (operador.funcao !== 'admin' && ticket.categoria_ticket !== operador.categoria) {
    return { ok: false, motivo: 'categoria_errada' };
  }

  const atualizado = await ticketModel.atribuirSeLivre(ticketId, operador.id);
  if (!atualizado) return { ok: false, motivo: 'ja_tomado' };

  emitir(io, 'ticket:bloqueado', atualizado, { operadorNome: operador.nome });
  return { ok: true, ticket: atualizado };
}

/** Liberta um ticket (pelo próprio operador, por admin, ou pelo sweeper). */
async function libertar(io, ticketId, { operadorId = null, porSistema = false } = {}) {
  const liberto = await ticketModel.libertar(ticketId, porSistema ? null : operadorId);
  if (!liberto) return { ok: false, motivo: 'nao_estava_em_andamento' };
  emitir(io, 'ticket:libertado', liberto, { porSistema });
  return { ok: true, ticket: liberto };
}

/** Marca como resolvido e (opcional) já respondeu pelo Outlook. */
async function resolver(io, ticketId, operadorId) {
  const resolvido = await ticketModel.resolver(ticketId, operadorId);
  if (!resolvido) return { ok: false, motivo: 'nao_resolvavel' };
  emitir(io, 'ticket:resolvido', resolvido);
  return { ok: true, ticket: resolvido };
}

/**
 * Batimento (heartbeat): enquanto o operador tem o ticket aberto, o cliente
 * envia pings periódicos que refrescam data_bloqueio. Assim um ticket
 * ATIVO nunca é libertado pelo sweeper; só os de páginas fechadas expiram.
 */
async function registarBatimento(ticketId, operadorId) {
  await pool.query(
    `UPDATE tickets SET data_bloqueio = now()
      WHERE id = $1 AND operador_atribuido_id = $2 AND status = 'em_andamento'`,
    [ticketId, operadorId]
  );
}

/**
 * Sweeper: a cada 30 s liberta tickets cujo bloqueio expirou (sem batimento
 * há mais de LOCK_RELEASE_MINUTES). Robusto a reinícios do servidor, pois
 * baseia-se no estado persistido (data_bloqueio), não em timers em memória.
 */
function iniciarSweeper(io) {
  const intervaloMs = 30 * 1000;
  setInterval(async () => {
    try {
      const expirados = await ticketModel.bloqueiosExpirados(env.lockReleaseMinutes);
      for (const t of expirados) {
        await libertar(io, t.id, { porSistema: true });
        console.log(`[sweeper] Ticket ${t.id} libertado por inatividade.`);
      }
    } catch (err) {
      console.error('[sweeper] Erro:', err.message);
    }
  }, intervaloMs);
  console.log(`[sweeper] Ativo (liberta após ${env.lockReleaseMinutes} min de inatividade).`);
}

module.exports = {
  anunciarNovo,
  assumir,
  libertar,
  resolver,
  registarBatimento,
  iniciarSweeper,
  salaCategoria,
  SALA_ADMINS,
};
