/**
 * triageService.js — Triagem automática de categoria.
 *
 * Lê as regras da tabela `regras_triagem` (configuráveis pelo gestor),
 * normaliza o texto do email e devolve a categoria da primeira regra que
 * casar, por ordem de prioridade ASC.
 *
 * Multi-tenant: as regras e a cache são POR ORGANIZAÇÃO. A cache é um mapa
 * organizacao_id -> { regras, ts }, revalidado a cada CACHE_TTL_MS. Quando o
 * gestor altera regras de uma organização, chama-se invalidarCache(orgId).
 */

const { pool } = require('../config/db');

const CACHE_TTL_MS = parseInt(process.env.TRIAGEM_CACHE_TTL_MS || '60000', 10); // 60 s
const CATEGORIA_PADRAO = process.env.TRIAGEM_CATEGORIA_PADRAO || 'comercial';

// organizacao_id -> { regras: [...], ts: number }
const cachePorOrg = new Map();

/** Remove acentos e baixa para minúsculas — comparação robusta. */
function normalizar(texto) {
  return (texto || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // diacríticos
    .toLowerCase();
}

/** Carrega (com cache) as regras ativas de UMA organização, por prioridade ASC. */
async function obterRegras(orgId) {
  const agora = Date.now();
  const entrada = cachePorOrg.get(orgId);
  if (entrada && agora - entrada.ts < CACHE_TTL_MS) {
    return entrada.regras;
  }
  const { rows } = await pool.query(
    `SELECT palavra_chave, categoria, campo_alvo, prioridade
       FROM regras_triagem
      WHERE organizacao_id = $1 AND ativa = TRUE
      ORDER BY prioridade ASC, id ASC`,
    [orgId]
  );
  const regras = rows.map((r) => ({
    palavra: normalizar(r.palavra_chave),
    categoria: r.categoria,
    campo: r.campo_alvo,
    prioridade: r.prioridade,
  }));
  cachePorOrg.set(orgId, { regras, ts: agora });
  return regras;
}

/** Força recarregamento na próxima triagem. Sem argumento, limpa tudo. */
function invalidarCache(orgId) {
  if (orgId === undefined) cachePorOrg.clear();
  else cachePorOrg.delete(orgId);
}

/**
 * Classifica um email numa categoria, dentro de uma organização.
 * @param {{assunto?: string, corpo?: string}} email
 * @param {string} orgId
 * @returns {Promise<{categoria: string, regra: object|null}>}
 */
async function triar(email, orgId) {
  const regras = await obterRegras(orgId);
  const assunto = normalizar(email.assunto);
  const corpo = normalizar(email.corpo);

  for (const regra of regras) {
    let alvo = '';
    if (regra.campo === 'assunto') alvo = assunto;
    else if (regra.campo === 'corpo') alvo = corpo;
    else alvo = `${assunto} ${corpo}`; // 'ambos'

    if (alvo.includes(regra.palavra)) {
      return { categoria: regra.categoria, regra };
    }
  }
  // Nenhuma regra casou -> categoria por omissão.
  return { categoria: CATEGORIA_PADRAO, regra: null };
}

module.exports = { triar, invalidarCache, normalizar, _CATEGORIA_PADRAO: CATEGORIA_PADRAO };
