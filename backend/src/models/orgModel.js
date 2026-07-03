/**
 * orgModel.js — Acesso à tabela `organizacoes` (clientes da plataforma).
 * Gerido exclusivamente pelo super_admin.
 */
const { pool } = require('../config/db');

const COLS =
  'id, nome, slug, ativo, criado_em, sla_hora_inicio, sla_hora_fim, sla_minutos_uteis, feriados_extra, email_dominios';

/** Lista todas as organizações (ativas e inativas). */
async function listar() {
  const { rows } = await pool.query(
    `SELECT ${COLS} FROM organizacoes ORDER BY ativo DESC, nome ASC`
  );
  return rows;
}

async function porId(id) {
  const { rows } = await pool.query(
    `SELECT ${COLS} FROM organizacoes WHERE id = $1`,
    [id]
  );
  return rows[0] || null;
}

async function porSlug(slug) {
  const { rows } = await pool.query(
    `SELECT ${COLS} FROM organizacoes WHERE lower(slug) = lower($1)`,
    [slug]
  );
  return rows[0] || null;
}

/** Cria uma organização. Falha (23505) se o slug já existir. */
async function criar({ nome, slug, email_dominios = null }) {
  const { rows } = await pool.query(
    `INSERT INTO organizacoes (nome, slug, email_dominios) VALUES ($1, lower($2), $3) RETURNING ${COLS}`,
    [nome, slug, email_dominios || null]
  );
  return rows[0];
}

/** Ativa/desativa uma organização. Devolve a linha atualizada (ou null). */
async function definirAtivo(id, ativo) {
  const { rows } = await pool.query(
    `UPDATE organizacoes SET ativo = $2 WHERE id = $1 RETURNING ${COLS}`,
    [id, ativo]
  );
  return rows[0] || null;
}

/**
 * Atualiza a configuração de SLA de uma organização. Cada campo aceita null
 * (= usar o valor global). Devolve a linha atualizada (ou null).
 */
async function atualizarSla(id, { sla_hora_inicio, sla_hora_fim, sla_minutos_uteis, feriados_extra }) {
  const { rows } = await pool.query(
    `UPDATE organizacoes SET
        sla_hora_inicio   = $2,
        sla_hora_fim      = $3,
        sla_minutos_uteis = $4,
        feriados_extra    = $5
      WHERE id = $1 RETURNING ${COLS}`,
    [id, sla_hora_inicio, sla_hora_fim, sla_minutos_uteis, feriados_extra]
  );
  return rows[0] || null;
}

/** Atualiza os domínios/endereços de email que roteiam para a organização. */
async function atualizarEmailDominios(id, valor) {
  const { rows } = await pool.query(
    `UPDATE organizacoes SET email_dominios = $2 WHERE id = $1 RETURNING ${COLS}`,
    [id, valor && String(valor).trim() ? String(valor).trim() : null]
  );
  return rows[0] || null;
}

// --- Roteamento da ingestão (funções PURAS, testáveis sem BD) ----------------

function normalizarEndereco(e) {
  return String(e || '').trim().toLowerCase();
}
function dominioDe(endereco) {
  const s = normalizarEndereco(endereco);
  const i = s.lastIndexOf('@');
  return i >= 0 ? s.slice(i + 1) : s;
}
/** Tokens (endereços completos ou domínios) declarados por uma organização. */
function tokensDaOrg(org) {
  return String(org.email_dominios || '')
    .split(',')
    .map((t) => t.trim().toLowerCase().replace(/^@/, ''))
    .filter(Boolean);
}
/** Um endereço casa uma org se bate certo com um alias completo, o domínio ou um subdomínio. */
function orgCasaEndereco(org, endereco) {
  const addr = normalizarEndereco(endereco);
  if (!addr) return false;
  const dom = dominioDe(addr);
  return tokensDaOrg(org).some((t) => t === addr || t === dom || dom.endsWith('.' + t));
}
/**
 * Escolhe a organização-alvo de um email a partir de uma lista de endereços
 * (destinatários primeiro, remetente depois). Só considera organizações ativas
 * com domínios declarados. Devolve null se nada casar (o chamador aplica a org
 * por omissão). PURA — não toca na BD.
 */
function escolherOrgPorEnderecos(orgs, enderecos) {
  const candidatas = (orgs || []).filter((o) => o.ativo && o.email_dominios);
  for (const e of enderecos || []) {
    const m = candidatas.find((o) => orgCasaEndereco(o, e));
    if (m) return m;
  }
  return null;
}

module.exports = {
  listar,
  porId,
  porSlug,
  criar,
  definirAtivo,
  atualizarSla,
  atualizarEmailDominios,
  escolherOrgPorEnderecos,
};
