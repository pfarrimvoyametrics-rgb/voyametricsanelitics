/**
 * triageService.js — Triagem automática de categoria.
 *
 * Lê as regras da tabela `regras_triagem` (configuráveis pelo gestor),
 * normaliza o texto do email e devolve a categoria da primeira regra que
 * casar, por ordem de prioridade ASC.
 *
 * Desempenho: a 10 000 emails/dia não queremos uma query por email. As
 * regras são lidas para memória e revalidadas a cada CACHE_TTL_MS. Quando
 * o gestor altera regras, pode chamar invalidarCache() (a rota de gestão
 * de regras fá-lo automaticamente).
 */

const { pool } = require('../config/db');

const CACHE_TTL_MS = parseInt(process.env.TRIAGEM_CACHE_TTL_MS || '60000', 10); // 60 s
const CATEGORIA_PADRAO = process.env.TRIAGEM_CATEGORIA_PADRAO || 'comercial';

let cacheRegras = null;
let cacheTimestamp = 0;

/** Remove acentos e baixa para minúsculas — comparação robusta. */
function normalizar(texto) {
  return (texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // diacríticos
    .toLowerCase();
}

/** Carrega (com cache) as regras ativas, ordenadas por prioridade ASC. */
async function obterRegras() {
  const agora = Date.now();
  if (cacheRegras && agora - cacheTimestamp < CACHE_TTL_MS) {
    return cacheRegras;
  }
  const { rows } = await pool.query(
    `SELECT palavra_chave, categoria, campo_alvo, prioridade
       FROM regras_triagem
      WHERE ativa = TRUE
      ORDER BY prioridade ASC, id ASC`
  );
  cacheRegras = rows.map((r) => ({
    palavra: normalizar(r.palavra_chave),
    categoria: r.categoria,
    campo: r.campo_alvo,
    prioridade: r.prioridade,
  }));
  cacheTimestamp = agora;
  return cacheRegras;
}

/** Força recarregamento das regras na próxima triagem. */
function invalidarCache() {
  cacheRegras = null;
  cacheTimestamp = 0;
}

/**
 * Classifica um email numa categoria.
 * @param {{assunto?: string, corpo?: string}} email
 * @returns {Promise<{categoria: string, regra: object|null}>}
 */
async function triar(email) {
  const regras = await obterRegras();
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
