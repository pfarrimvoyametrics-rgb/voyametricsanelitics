/**
 * ticketService.js — Orquestra as ações sobre tickets e emite os eventos
 * de tempo real. É usado tanto pelas rotas HTTP como pelos handlers de
 * WebSocket, para haver uma única fonte de verdade.
 *
 * Multi-tenant: as salas de tempo real são por ORGANIZAÇÃO + categoria, para
 * que um evento de um cliente nunca chegue a outro:
 *   org:<orgId>:cat:<categoria>   — operadores dessa categoria/organização
 *   org:<orgId>:admins            — admins dessa organização (e super_admin a observar)
 *
 * Eventos emitidos:
 *   ticket:novo · ticket:bloqueado · ticket:libertado · ticket:resolvido
 *   metricas:atualizar — sinal para o painel admin recarregar números
 */

const { pool } = require('../config/db');
const ticketModel = require('../models/ticketModel');
const { env } = require('../config/env');
const { ehAdmin } = require('../utils/papeis');

const salaCategoria = (orgId, cat) => `org:${orgId}:cat:${cat}`;
const salaAdmins = (orgId) => `org:${orgId}:admins`;

/** Emite um evento para a categoria do ticket e para os admins da organização. */
function emitir(io, evento, ticket, extra = {}) {
  const payload = { ticket, ...extra };
  const org = ticket.organizacao_id;
  io.to(salaCategoria(org, ticket.categoria_ticket)).emit(evento, payload);
  io.to(salaAdmins(org)).emit(evento, payload);
  // Qualquer alteração mexe nas métricas do supervisor dessa organização.
  io.to(salaAdmins(org)).emit('metricas:atualizar');
}

/** Anuncia um ticket recém-criado (chamado pelo webhook/mock após triagem). */
function anunciarNovo(io, ticket) {
  emitir(io, 'ticket:novo', ticket);
}

/**
 * Operador assume um ticket. Atómico: só funciona se ainda 'pendente'.
 * Escopado à organização (`orgId`).
 * @returns {{ok: boolean, ticket?: object, motivo?: string}}
 */
async function assumir(io, ticketId, operador, orgId) {
  const ticket = await ticketModel.porId(ticketId, orgId);
  if (!ticket) return { ok: false, motivo: 'inexistente' };

  // Operador só pode assumir tickets da sua categoria (admin/super pode tudo).
  if (!ehAdmin(operador.funcao) && ticket.categoria_ticket !== operador.categoria) {
    return { ok: false, motivo: 'categoria_errada' };
  }

  const atualizado = await ticketModel.atribuirSeLivre(ticketId, operador.id, orgId);
  if (!atualizado) return { ok: false, motivo: 'ja_tomado' };

  emitir(io, 'ticket:bloqueado', atualizado, { operadorNome: operador.nome });
  return { ok: true, ticket: atualizado };
}

/** Liberta um ticket (pelo próprio operador, por admin, ou pelo sweeper). */
async function libertar(io, ticketId, { operadorId = null, porSistema = false, orgId } = {}) {
  const liberto = await ticketModel.libertar(ticketId, porSistema ? null : operadorId, orgId);
  if (!liberto) return { ok: false, motivo: 'nao_estava_em_andamento' };
  emitir(io, 'ticket:libertado', liberto, { porSistema });
  return { ok: true, ticket: liberto };
}

/** Marca como resolvido e (opcional) já respondeu pelo Outlook. */
async function resolver(io, ticketId, operadorId, orgId) {
  const resolvido = await ticketModel.resolver(ticketId, operadorId, orgId);
  if (!resolvido) return { ok: false, motivo: 'nao_resolvavel' };
  emitir(io, 'ticket:resolvido', resolvido);
  return { ok: true, ticket: resolvido };
}

/**
 * Batimento (heartbeat): enquanto o operador tem o ticket aberto, o cliente
 * envia pings periódicos que refrescam data_bloqueio. Escopado à organização.
 */
async function registarBatimento(ticketId, operadorId, orgId) {
  await pool.query(
    `UPDATE tickets SET data_bloqueio = now()
      WHERE id = $1 AND operador_atribuido_id = $2 AND organizacao_id = $3
        AND status = 'em_andamento'`,
    [ticketId, operadorId, orgId]
  );
}

/**
 * Sweeper: a cada 30 s liberta tickets cujo bloqueio expirou (sem batimento
 * há mais de LOCK_RELEASE_MINUTES), em TODAS as organizações. Robusto a
 * reinícios (baseia-se no estado persistido). Emite à sala da org de cada ticket.
 */
function iniciarSweeper(io) {
  const intervaloMs = 30 * 1000;
  setInterval(async () => {
    try {
      const expirados = await ticketModel.bloqueiosExpirados(env.lockReleaseMinutes);
      for (const t of expirados) {
        await libertar(io, t.id, { porSistema: true, orgId: t.organizacao_id });
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
  salaAdmins,
};
