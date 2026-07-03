/**
 * relatorioRoutes.js — Relatórios analíticos (apenas admin).
 *
 * GET /api/relatorios
 *   ?de=YYYY-MM-DD&ate=YYYY-MM-DD&granularidade=dia|semana|mes
 *   &cliente=<remetente>&operador=<uuid>&equipa=<categoria>
 */
const express = require('express');
const relatorioModel = require('../models/relatorioModel');
const insightsService = require('../services/insightsService');
const pdfRelatorio = require('../services/pdfRelatorio');
const pdfLideranca = require('../services/pdfLideranca');
const { exigirAutenticacao, exigirAdmin, resolverOrg } = require('../middleware/auth');

const router = express.Router();

const RE_DATA = /^\d{4}-\d{2}-\d{2}$/;
const CATEGORIAS = ['emergencias', 'alteracoes', 'cotacoes', 'reclamacoes', 'suporte_tecnico', 'faturacao', 'comercial'];

function periodoPorOmissao(dias = 30) {
  const hoje = new Date();
  const inicio = new Date();
  inicio.setDate(hoje.getDate() - dias);
  const f = (d) => d.toISOString().slice(0, 10);
  return { de: f(inicio), ate: f(hoje) };
}

/** Reúne todos os dados do relatório (período, âmbito, agregações e insights). */
async function obterDados(req) {
  const def = periodoPorOmissao(30);
  let de = RE_DATA.test(req.query.de || '') ? req.query.de : def.de;
  let ate = RE_DATA.test(req.query.ate || '') ? req.query.ate : def.ate;
  if (de > ate) [de, ate] = [ate, de];

  const granularidade = ['dia', 'semana', 'mes'].includes(req.query.granularidade)
    ? req.query.granularidade : 'dia';

  const f = {
    orgId: req.orgId, // isolamento multi-tenant
    de, ate,
    cliente: req.query.cliente ? String(req.query.cliente).trim() : null,
    operador: req.query.operador ? String(req.query.operador).trim() : null,
    equipa: CATEGORIAS.includes(req.query.equipa) ? req.query.equipa : null,
  };

  // Período homólogo anterior (mesma duração, imediatamente antes).
  const fp = (s) => new Date(s + 'T00:00:00Z');
  const MS = 86400000;
  const dur = Math.round((fp(ate) - fp(de)) / MS) + 1;
  const prevAteD = new Date(fp(de).getTime() - MS);
  const prevDeD = new Date(prevAteD.getTime() - (dur - 1) * MS);
  const iso = (d) => d.toISOString().slice(0, 10);
  const fAnterior = { ...f, de: iso(prevDeD), ate: iso(prevAteD) };

  const [geral, clientes, operadores, categorias, estados, diaSemana, hora, evolucao, geralAnterior] = await Promise.all([
    relatorioModel.geral(f),
    relatorioModel.porCliente(f, req.query.limiteClientes),
    relatorioModel.porOperador(f),
    relatorioModel.porCategoria(f),
    relatorioModel.porEstado(f),
    relatorioModel.porDiaSemana(f),
    relatorioModel.porHora(f),
    relatorioModel.evolucao(f, granularidade),
    relatorioModel.geral(fAnterior),
  ]);

  const insights = insightsService.gerarInsights(
    { geral, categorias, operadores, clientes, diaSemana, hora, dias: dur },
    { geral: geralAnterior }
  );

  return {
    periodo: { de, ate, granularidade },
    periodoAnterior: { de: fAnterior.de, ate: fAnterior.ate },
    ambito: { cliente: f.cliente, operador: f.operador, equipa: f.equipa },
    geral, clientes, operadores, categorias, estados, diaSemana, hora, evolucao,
    comparativo: insights.comparativo,
    insights: { meta: insights.meta, destaque: insights.destaque, conclusoes: insights.conclusoes, recomendacoes: insights.recomendacoes, focos: insights.focos },
  };
}

router.get('/', exigirAutenticacao, exigirAdmin, resolverOrg, async (req, res) => {
  try {
    res.json(await obterDados(req));
  } catch (err) {
    console.error('[relatorios] Erro:', err.message);
    res.status(500).json({ erro: 'Falha ao gerar o relatório.' });
  }
});

// GET /api/relatorios/pdf — relatório de marca, gerado no servidor.
router.get('/pdf', exigirAutenticacao, exigirAdmin, resolverOrg, async (req, res) => {
  try {
    const dados = await obterDados(req);
    const buffer = await pdfRelatorio.gerar(dados);
    const nome = `relatorio_${dados.periodo.de}_a_${dados.periodo.ate}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${nome}"`);
    res.send(buffer);
  } catch (err) {
    console.error('[relatorios] Erro no PDF:', err.message);
    res.status(500).json({ erro: 'Falha ao gerar o PDF.' });
  }
});

// GET /api/relatorios/lideranca/pdf — Balanço de Liderança de um operador.
router.get('/lideranca/pdf', exigirAutenticacao, exigirAdmin, resolverOrg, async (req, res) => {
  try {
    const dados = await obterDados(req);
    const buffer = await pdfLideranca.gerar(dados);
    const a = dados.ambito || {};
    let base = 'Global';
    if (a.operador) base = (dados.operadores && dados.operadores[0] && dados.operadores[0].nome) || 'Operador';
    else if (a.cliente) base = a.cliente;
    else if (a.equipa) base = a.equipa;
    const slug = String(base).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'Lideranca';
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Balanco_Lideranca_${slug}.pdf"`);
    res.send(buffer);
  } catch (err) {
    console.error('[relatorios] Erro no PDF de liderança:', err.message);
    res.status(500).json({ erro: 'Falha ao gerar o PDF de liderança.' });
  }
});

module.exports = router;
