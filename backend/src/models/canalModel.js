/**
 * canalModel.js — Acesso à configuração de SLA por canal (canais_sla).
 * Mantém um cache curto em memória para o cálculo de SLA não ir à BD a cada email.
 */
const { pool } = require('../config/db');

const CACHE_TTL_MS = parseInt(process.env.CANAIS_CACHE_TTL_MS || '60000', 10);
let cache = null;
let cacheTs = 0;

/** Mapa { categoria: sla_minutos } com cache. */
async function mapaSla() {
  const agora = Date.now();
  if (cache && agora - cacheTs < CACHE_TTL_MS) return cache;
  const { rows } = await pool.query('SELECT categoria, sla_minutos FROM canais_sla');
  const m = {};
  for (const r of rows) m[r.categoria] = r.sla_minutos;
  cache = m;
  cacheTs = agora;
  return m;
}

/** Lista os canais ACTIVOS (de viagem) com rótulo e SLA (ecrã de administração). */
async function listar() {
  const { rows } = await pool.query(
    `SELECT categoria, rotulo, sla_minutos FROM canais_sla
      WHERE categoria IN ('emergencias','alteracoes','cotacoes','reclamacoes')
      ORDER BY sla_minutos ASC`
  );
  return rows;
}

/** Atualiza o SLA (minutos) de um canal e invalida o cache. */
async function atualizar(categoria, slaMinutos) {
  const v = Math.max(1, Math.min(parseInt(slaMinutos, 10) || 0, 100000));
  const { rows } = await pool.query(
    'UPDATE canais_sla SET sla_minutos = $2, atualizado_em = now() WHERE categoria = $1 RETURNING categoria, rotulo, sla_minutos',
    [categoria, v]
  );
  cache = null;
  return rows[0] || null;
}

function invalidarCache() { cache = null; cacheTs = 0; }

module.exports = { mapaSla, listar, atualizar, invalidarCache };
