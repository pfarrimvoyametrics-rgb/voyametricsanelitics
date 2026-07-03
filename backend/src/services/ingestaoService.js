/**
 * ingestaoService.js — Ponto ÚNICO de ingestão de emails -> tickets.
 *
 * É usado por:
 *   - o webhook (notificações em tempo real da Graph), e
 *   - a sincronização de arranque (catch-up de emails recebidos enquanto o
 *     servidor esteve em baixo).
 *
 * Mantém uma só fonte de verdade para: triagem -> cálculo de SLA -> gravação
 * idempotente -> anúncio em tempo real. A idempotência (em `outlook_message_id`)
 * garante que o mesmo email nunca gera dois tickets, mesmo que chegue pelas
 * duas vias ou seja reentregue pela Graph.
 */

const triageService = require('./triageService');
const slaService = require('./slaService');
const ticketModel = require('../models/ticketModel');
const canalModel = require('../models/canalModel');
const ticketService = require('./ticketService');

/**
 * Cria (se ainda não existir) o ticket a partir de um email já lido da Graph.
 * @param {object} io — instância Socket.io (pode ser null em contextos sem RT)
 * @param {{outlookMessageId,assunto,remetente,dataRececao,corpoEmail}} email
 * @returns {Promise<object|null>} o ticket criado, ou null se já existia
 */
async function processarEmail(io, email) {
  // 1) Seguimento: se a conversa já tem um ticket ABERTO, anexa-se a esse
  //    (em vez de criar outro). Independe do assunto — usa o conversationId.
  if (email.conversationId) {
    const aberto = await ticketModel.porConversaAberta(email.conversationId);
    if (aberto) {
      const atualizado = await ticketModel.adicionarSeguimento(aberto.id, email);
      if (atualizado && io) ticketService.anunciarNovo(io, atualizado);
      console.log(`[ingestao] Seguimento anexado ao ticket ${aberto.id} (${email.remetente})`);
      return { ticket: atualizado, criado: false };
    }
  }

  // 2) Email novo -> triagem, SLA (do canal) e criação (idempotente).
  const { categoria } = await triageService.triar({ assunto: email.assunto, corpo: email.corpoEmail });
  const mapaSla = await canalModel.mapaSla();
  const slaLimite = slaService.calcularSlaLimite(email.dataRececao, mapaSla[categoria]);

  const ticket = await ticketModel.criar({
    outlookMessageId: email.outlookMessageId,
    conversationId: email.conversationId,
    remetente: email.remetente,
    assunto: email.assunto,
    corpoEmail: email.corpoEmail,
    dataRececao: email.dataRececao,
    slaLimite,
    categoriaTicket: categoria,
  });

  if (ticket && io) {
    ticketService.anunciarNovo(io, ticket);
    console.log(`[ingestao] Ticket criado [${categoria}] de ${email.remetente}`);
  }
  return { ticket, criado: !!ticket };
}

module.exports = { processarEmail };
