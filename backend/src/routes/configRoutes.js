/**
 * configRoutes.js — Configuração por organização (SLA).
 *
 *  - GET   /api/config/sla  (admin) — lê a config da organização + defaults globais
 *  - PATCH /api/config/sla  (admin) — atualiza a config de SLA da organização
 *
 * `resolverOrg` fixa `req.orgId` (org do token para admin; header x-org-id para
 * super_admin). Cada campo aceita vazio/null = "usar o valor global".
 */
const express = require('express');
const orgModel = require('../models/orgModel');
const slaService = require('../services/slaService');
const { exigirAutenticacao, exigirAdmin, resolverOrg } = require('../middleware/auth');

const router = express.Router();

const RE_HORA = /^(\d{1,2}):(\d{2})$/;
const RE_MMDD = /^\d{2}-\d{2}$/;

function tratar(res, err) {
  const status = err.status || 500;
  if (status >= 500) console.error('[config]', err);
  res.status(status).json({ erro: err.message || 'Erro interno.' });
}

/** Minutos desde a meia-noite -> "HH:MM". */
function paraHora(min) {
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
}

// GET /api/config/sla — config da organização + defaults globais (para placeholders).
router.get('/sla', exigirAutenticacao, exigirAdmin, resolverOrg, async (req, res) => {
  const org = await orgModel.porId(req.orgId);
  if (!org) return res.status(404).json({ erro: 'Organização não encontrada.' });
  const d = slaService._config;
  res.json({
    sla_hora_inicio: org.sla_hora_inicio,
    sla_hora_fim: org.sla_hora_fim,
    sla_minutos_uteis: org.sla_minutos_uteis,
    feriados_extra: org.feriados_extra,
    defaults: {
      sla_hora_inicio: paraHora(d.INICIO_MIN),
      sla_hora_fim: paraHora(d.FIM_MIN),
      sla_minutos_uteis: d.SLA_MINUTOS_UTEIS,
    },
  });
});

// PATCH /api/config/sla — atualiza a config de SLA (campos vazios = usar global).
router.patch('/sla', exigirAutenticacao, exigirAdmin, resolverOrg, async (req, res) => {
  const erro = (msg) => Object.assign(new Error(msg), { status: 400 });
  try {
    const b = req.body || {};

    const hora = (v, nome) => {
      const s = String(v ?? '').trim();
      if (!s) return null;
      const m = RE_HORA.exec(s);
      if (!m) throw erro(`${nome} inválida (use HH:MM).`);
      const hh = parseInt(m[1], 10);
      const mm = parseInt(m[2], 10);
      if (hh > 23 || mm > 59) throw erro(`${nome} fora do intervalo.`);
      return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
    };

    const inicio = hora(b.sla_hora_inicio, 'Hora de início');
    const fim = hora(b.sla_hora_fim, 'Hora de fim');
    if (inicio && fim && slaService.parseHoraParaMinutos(inicio, 0) >= slaService.parseHoraParaMinutos(fim, 0)) {
      throw erro('A hora de início deve ser anterior à de fim.');
    }

    let minutos = null;
    if (b.sla_minutos_uteis !== undefined && b.sla_minutos_uteis !== null && String(b.sla_minutos_uteis).trim() !== '') {
      const n = Number(b.sla_minutos_uteis);
      if (!Number.isInteger(n) || n <= 0) throw erro('Minutos de SLA devem ser um inteiro positivo.');
      minutos = n;
    }

    let feriados = null;
    const fer = String(b.feriados_extra ?? '').trim();
    if (fer) {
      const partes = fer.split(',').map((s) => s.trim()).filter(Boolean);
      for (const p of partes) {
        if (!RE_MMDD.test(p)) throw erro(`Feriado inválido "${p}" (use MM-DD, ex.: 06-13).`);
        const [mm, dd] = p.split('-').map(Number);
        if (mm < 1 || mm > 12 || dd < 1 || dd > 31) throw erro(`Feriado fora do intervalo: ${p}.`);
      }
      feriados = partes.join(',');
    }

    const atualizada = await orgModel.atualizarSla(req.orgId, {
      sla_hora_inicio: inicio,
      sla_hora_fim: fim,
      sla_minutos_uteis: minutos,
      feriados_extra: feriados,
    });
    if (!atualizada) return res.status(404).json({ erro: 'Organização não encontrada.' });
    res.json(atualizada);
  } catch (err) {
    tratar(res, err);
  }
});

module.exports = router;
