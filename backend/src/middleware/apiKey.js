/**
 * apiKey.js — Autenticação por chave de API para integrações servidor-a-servidor
 * (sistema externo de reservas/faturação a preencher o valor da venda).
 *
 * A chave vem do header `x-api-key` e é comparada com INTEGRACAO_API_KEY.
 * Se a variável não estiver definida, o endpoint fica desactivado (503).
 */
const crypto = require('crypto');
const { env } = require('../config/env');

/** Comparação em tempo constante (evita ataques por temporização). */
function igual(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

function exigirApiKey(req, res, next) {
  const chave = env.integracao.apiKey;
  if (!chave) {
    return res.status(503).json({ erro: 'Integração desactivada. Defina INTEGRACAO_API_KEY no servidor.' });
  }
  const recebida = req.headers['x-api-key'];
  if (!recebida || !igual(recebida, chave)) {
    return res.status(401).json({ erro: 'Chave de API inválida.' });
  }
  next();
}

module.exports = { exigirApiKey };
