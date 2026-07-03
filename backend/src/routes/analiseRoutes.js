/**
 * analiseRoutes.js — Análise de tickets por IA (Claude).
 */
const express = require('express');
const {
  analisarVolumeEquipas,
  analisarVolumeEquipasStream,
} = require('../services/analiseIaService');
const { exigirAutenticacao, exigirAdmin, resolverOrg } = require('../middleware/auth');

const router = express.Router();

/**
 * POST /api/analise/volume-equipas   (admin)
 * Corpo (todos opcionais):
 *   { desde?: ISO, ate?: ISO, status?: 'pendente'|'em_andamento'|'resolvido', pergunta?: string }
 * Devolve: { analise, modelo, uso }
 */
router.post('/volume-equipas', exigirAutenticacao, exigirAdmin, resolverOrg, async (req, res) => {
  try {
    const { desde, ate, status, pergunta } = req.body || {};
    const resultado = await analisarVolumeEquipas({ desde, ate, status, pergunta, orgId: req.orgId });
    res.json(resultado);
  } catch (err) {
    console.error('[analise] Falha:', err.message);
    res.status(500).json({ erro: 'Falha ao gerar a análise.', detalhe: err.message });
  }
});

/**
 * POST /api/analise/volume-equipas/stream   (admin)
 * Igual ao anterior, mas devolve a análise em STREAMING (Server-Sent Events).
 * Eventos: `status` (a consultar dados), `delta` (fragmento de texto),
 *          `fim` (metadados finais), `erro`.
 */
router.post('/volume-equipas/stream', exigirAutenticacao, exigirAdmin, resolverOrg, async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // evita buffering em proxies (nginx)
  if (res.flushHeaders) res.flushHeaders();

  let fechado = false;
  // NB: usar res.on('close') e não req.on('close') — no Node 18+ o 'close' do
  // request dispara assim que o corpo é lido, o que faria saltar toda a escrita
  // e o res.end(). O 'close' da RESPOSTA só dispara quando o cliente desliga.
  res.on('close', () => { fechado = true; });

  const enviar = (evento, dados) => {
    if (fechado) return;
    res.write(`event: ${evento}\ndata: ${JSON.stringify(dados)}\n\n`);
  };

  try {
    const { desde, ate, status, pergunta } = req.body || {};
    const fim = await analisarVolumeEquipasStream(
      { desde, ate, status, pergunta, orgId: req.orgId },
      {
        onDelta: (texto) => enviar('delta', { texto }),
        onFerramenta: (ferramenta) => enviar('status', { ferramenta }),
      }
    );
    enviar('fim', fim);
  } catch (err) {
    console.error('[analise/stream] Falha:', err.message);
    enviar('erro', { mensagem: err.message });
  } finally {
    if (!fechado) res.end();
  }
});

module.exports = router;
