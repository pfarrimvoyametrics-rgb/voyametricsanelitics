/**
 * canalModel.js — Configuração de SLA por canal/categoria (`canais_sla`),
 * POR ORGANIZAÇÃO. Alvo informativo de SLA por categoria, usado nos relatórios.
 * Mantém um cache curto em memória, por organização.
 */
const { pool } = require('../config/db');

const CACHE_TTL_MS = parseInt(process.env.CANAIS_CACHE_TTL_MS || '60000', 10);
// organizacao_id -> { mapa: {categoria: sla_minutos}, ts }
const cachePorOrg = new Map();

/** Mapa { categoria: sla_minutos } de uma organização, com cache. */
async function mapaSla(orgId) {
  const agora = Date.now();
  const entrada = cachePorOrg.get(orgId);
  if (entrada && agora - entrada.ts < CACHE_TTL_MS) return entrada.mapa;
  const { rows } = await pool.query(
    `SELECT categoria, sla_minutos FROM canais_sla WHERE organizacao_id = $1`,
    [orgId]
  );
  const mapa = {};
  for (const r of rows) mapa[r.categoria] = r.sla_minutos;
  cachePorOrg.set(orgId, { mapa, ts: agora });
  return mapa;
}

/** Lista os canais configurados da organização (rótulo + SLA). */
async function listar(orgId) {
  const { rows } = await pool.query(
    `SELECT categoria, rotulo, sla_minutos FROM canais_sla
      WHERE organizacao_id = $1
      ORDER BY sla_minutos ASC NULLS LAST, categoria ASC`,
    [orgId]
  );
  return rows;
}

/**
 * Cria/atualiza o canal (organizacao_id, categoria) e invalida o cache da org.
 * Devolve a linha resultante.
 */
async function upsert(orgId, categoria, { rotulo = null, slaMinutos }) {
  const v = Math.max(1, Math.min(parseInt(slaMinutos, 10) || 0, 100000));
  const { rows } = await pool.query(
    `INSERT INTO canais_sla (organizacao_id, categoria, rotulo, sla_minutos)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (organizacao_id, categoria) DO UPDATE SET
        rotulo        = COALESCE(EXCLUDED.rotulo, canais_sla.rotulo),
        sla_minutos   = EXCLUDED.sla_minutos,
        atualizado_em = now()
     RETURNING categoria, rotulo, sla_minutos`,
    [orgId, categoria, rotulo, v]
  );
  cachePorOrg.delete(orgId);
  return rows[0] || null;
}

function invalidarCache(orgId) {
  if (orgId === undefined) cachePorOrg.clear();
  else cachePorOrg.delete(orgId);
}

module.exports = { mapaSla, listar, upsert, invalidarCache };
