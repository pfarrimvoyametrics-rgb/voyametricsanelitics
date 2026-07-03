/**
 * slaService.js — Cálculo do prazo de SLA em HORAS ÚTEIS.
 *
 * Regras de negócio (confirmadas com o cliente):
 *   • Dias úteis: Segunda a Sexta.
 *   • Janela útil: 09:30 → 19:00, CONTÍNUA (sem pausa de almoço) => 9,5 h/dia.
 *   • Feriados nacionais portugueses EXCLUÍDOS (ver utils/feriados.js).
 *   • SLA = data_rececao + N minutos úteis (120 por omissão).
 *
 * Multi-tenant: os parâmetros (janela, minutos, feriados extra) podem variar
 * POR ORGANIZAÇÃO. As funções aceitam uma `config`; quando um campo é omitido
 * (null), usa-se o valor GLOBAL do ambiente (SLA_HORA_INICIO/FIM, etc.). Sem
 * `config`, o comportamento é exatamente o global — retrocompatível.
 *
 * IMPORTANTE — fuso horário: a janela é hora local; o processo DEVE correr com
 * TZ=Europe/Lisbon (ver docker-compose.yml e .env.example).
 */

const { isFeriado } = require('../utils/feriados');

/** Converte "HH:MM" em minutos desde a meia-noite. */
function parseHoraParaMinutos(hhmm, fallback) {
  const m = /^(\d{1,2}):(\d{2})$/.exec((hhmm || '').trim());
  if (!m) return fallback;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

// Valores GLOBAIS por omissão (do ambiente).
const DEFAULT_INICIO = parseHoraParaMinutos(process.env.SLA_HORA_INICIO, 9 * 60 + 30); // 09:30
const DEFAULT_FIM = parseHoraParaMinutos(process.env.SLA_HORA_FIM, 19 * 60); // 19:00
const DEFAULT_MINUTOS = parseInt(process.env.SLA_MINUTOS_UTEIS || '120', 10);

/**
 * Constrói a configuração efetiva, com fallback para os valores globais.
 * @param {{inicioMin?:number, fimMin?:number, minutos?:number, feriadosExtra?:Set<string>}} cfg
 */
function resolverConfig(cfg = {}) {
  return {
    inicioMin: cfg.inicioMin ?? DEFAULT_INICIO,
    fimMin: cfg.fimMin ?? DEFAULT_FIM,
    minutos: cfg.minutos ?? DEFAULT_MINUTOS,
    feriadosExtra: cfg.feriadosExtra instanceof Set ? cfg.feriadosExtra : new Set(),
  };
}

/** Chave 'MM-DD' (hora local) de um Date — para comparar com feriados extra. */
function chaveMesDia(date) {
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${mm}-${dd}`;
}

/** É dia útil? (Seg–Sex, não feriado nacional, nem feriado extra da org.) */
function isDiaUtil(date, cfg) {
  cfg = resolverConfig(cfg);
  const dow = date.getDay(); // 0=Dom ... 6=Sáb
  if (dow === 0 || dow === 6) return false;
  if (isFeriado(date)) return false;
  if (cfg.feriadosExtra.has(chaveMesDia(date))) return false;
  return true;
}

/** Minutos desde a meia-noite (hora local) de um Date. */
function minutosDoDia(date) {
  return date.getHours() * 60 + date.getMinutes();
}

/** Clone de `date` com a hora definida para `minutos` (segundos a zero). */
function comMinutos(date, minutos) {
  const d = new Date(date);
  d.setHours(Math.floor(minutos / 60), minutos % 60, 0, 0);
  return d;
}

/** Início da janela do PRÓXIMO dia útil a partir de `date`. */
function inicioProximoDiaUtil(date, cfg) {
  cfg = resolverConfig(cfg);
  const d = new Date(date);
  d.setDate(d.getDate() + 1);
  d.setHours(0, 0, 0, 0);
  while (!isDiaUtil(d, cfg)) {
    d.setDate(d.getDate() + 1);
  }
  return comMinutos(d, cfg.inicioMin);
}

/**
 * Garante que `date` cai DENTRO de uma janela útil.
 *  - Antes do início num dia útil -> início do mesmo dia.
 *  - Depois do fim, fim-de-semana ou feriado -> início do próximo dia útil.
 *  - Já dentro da janela -> inalterado (segundos normalizados ao minuto).
 */
function ajustarParaJanelaUtil(date, cfg) {
  cfg = resolverConfig(cfg);
  let d = new Date(date);
  if (isDiaUtil(d, cfg)) {
    const min = minutosDoDia(d);
    if (min < cfg.inicioMin) return comMinutos(d, cfg.inicioMin);
    if (min >= cfg.fimMin) return inicioProximoDiaUtil(d, cfg);
    // Dentro da janela: normaliza ao minuto (trunca segundos/ms da receção).
    d.setSeconds(0, 0);
    return d;
  }
  return inicioProximoDiaUtil(d, cfg);
}

/**
 * Soma `minutosUteis` minutos úteis a `inicio`, respeitando janela e feriados.
 * @param {Date} inicio
 * @param {number} minutosUteis
 * @param {object} [cfg] — configuração da organização (fallback global).
 * @returns {Date} instante-limite
 */
function adicionarMinutosUteis(inicio, minutosUteis, cfg) {
  cfg = resolverConfig(cfg);
  let cursor = ajustarParaJanelaUtil(inicio, cfg);
  let restante = minutosUteis;

  // Salvaguarda contra ciclos infinitos (config inválida): ~5 anos de dias úteis.
  let guarda = 0;
  const MAX_ITER = 5 * 260 + 10;

  while (restante > 0 && guarda++ < MAX_ITER) {
    const fimDoDia = comMinutos(cursor, cfg.fimMin);
    const minutosAteFim = Math.round((fimDoDia - cursor) / 60000);

    if (restante <= minutosAteFim) {
      cursor = new Date(cursor.getTime() + restante * 60000);
      restante = 0;
    } else {
      restante -= minutosAteFim;
      cursor = inicioProximoDiaUtil(cursor, cfg);
    }
  }
  return cursor;
}

/**
 * Calcula o sla_limite a partir da data de receção.
 * @param {Date|string} dataRececao
 * @param {object} [cfg] — configuração da organização (fallback global).
 * @returns {Date}
 */
function calcularSlaLimite(dataRececao, cfg) {
  const c = resolverConfig(cfg);
  const inicio = dataRececao instanceof Date ? dataRececao : new Date(dataRececao);
  return adicionarMinutosUteis(inicio, c.minutos, c);
}

/**
 * Conta os MINUTOS ÚTEIS decorridos entre dois instantes (para métricas de
 * resolução). Soma, dia a dia, a interseção de [inicio, fim] com a janela útil
 * de cada dia útil (respeitando fim-de-semana e feriados nacionais + extra).
 * @param {Date|string} inicio
 * @param {Date|string} fim
 * @param {object} [cfg] — configuração da organização (fallback global).
 * @returns {number} minutos úteis (0 se fim <= inicio).
 */
function minutosUteisEntre(inicio, fim, cfg) {
  const c = resolverConfig(cfg);
  const a = inicio instanceof Date ? inicio : new Date(inicio);
  const b = fim instanceof Date ? fim : new Date(fim);
  if (b <= a) return 0;

  let total = 0;
  const dia = new Date(a);
  dia.setHours(0, 0, 0, 0);
  const ultimo = new Date(b);
  ultimo.setHours(0, 0, 0, 0);

  let guarda = 0;
  const MAX_ITER = 5 * 366 + 10; // salvaguarda (~5 anos)
  while (dia <= ultimo && guarda++ < MAX_ITER) {
    if (isDiaUtil(dia, c)) {
      const janIni = comMinutos(dia, c.inicioMin);
      const janFim = comMinutos(dia, c.fimMin);
      const ini = a > janIni ? a : janIni;
      const f = b < janFim ? b : janFim;
      if (f > ini) total += Math.round((f - ini) / 60000);
    }
    dia.setDate(dia.getDate() + 1);
  }
  return total;
}

/**
 * Constrói uma `config` a partir de uma linha de `organizacoes`, com fallback
 * para os valores globais quando um campo é NULL.
 * @param {object|null} org — linha da organização (colunas sla_*, feriados_extra).
 */
function configDaOrg(org) {
  if (!org) return resolverConfig();
  const feriados = String(org.feriados_extra || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return resolverConfig({
    inicioMin: org.sla_hora_inicio ? parseHoraParaMinutos(org.sla_hora_inicio, null) : null,
    fimMin: org.sla_hora_fim ? parseHoraParaMinutos(org.sla_hora_fim, null) : null,
    minutos: org.sla_minutos_uteis != null ? Number(org.sla_minutos_uteis) : null,
    feriadosExtra: new Set(feriados),
  });
}

module.exports = {
  calcularSlaLimite,
  adicionarMinutosUteis,
  minutosUteisEntre,
  isDiaUtil,
  ajustarParaJanelaUtil,
  configDaOrg,
  parseHoraParaMinutos,
  // exportados para testes/inspeção:
  _config: { INICIO_MIN: DEFAULT_INICIO, FIM_MIN: DEFAULT_FIM, SLA_MINUTOS_UTEIS: DEFAULT_MINUTOS },
};
