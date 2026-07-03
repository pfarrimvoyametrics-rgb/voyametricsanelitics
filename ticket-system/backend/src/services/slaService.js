/**
 * slaService.js — Cálculo do prazo de SLA em HORAS ÚTEIS.
 *
 * Regras de negócio (confirmadas com o cliente):
 *   • Dias úteis: Segunda a Sexta.
 *   • Janela útil: 09:30 → 19:00, CONTÍNUA.
 *       A empresa não fecha ao almoço (cada funcionário almoça em
 *       horário próprio), logo o relógio do SLA NÃO pára às 13:00–14:00.
 *       => 9,5 horas úteis por dia = 570 minutos.
 *   • Feriados nacionais portugueses: EXCLUÍDOS (ver utils/feriados.js).
 *   • SLA = data_rececao + 2 horas úteis (120 minutos úteis).
 *
 * IMPORTANTE — fuso horário:
 *   A janela 09:30–19:00 é hora local de Portugal continental
 *   (Europe/Lisbon). O processo Node DEVE correr com TZ=Europe/Lisbon
 *   (ver docker-compose.yml e .env.example). Assim os métodos locais de
 *   Date refletem corretamente a hora de parede, incluindo a mudança
 *   para a hora de verão.
 */

const { isFeriado } = require('../utils/feriados');

const SLA_MINUTOS_UTEIS = parseInt(process.env.SLA_MINUTOS_UTEIS || '120', 10);

/** Converte "HH:MM" em minutos desde a meia-noite. */
function parseHoraParaMinutos(hhmm, fallback) {
  const m = /^(\d{1,2}):(\d{2})$/.exec((hhmm || '').trim());
  if (!m) return fallback;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

const INICIO_MIN = parseHoraParaMinutos(process.env.SLA_HORA_INICIO, 9 * 60 + 30); // 09:30
const FIM_MIN = parseHoraParaMinutos(process.env.SLA_HORA_FIM, 19 * 60); // 19:00

/** É dia útil? (Seg–Sex e não feriado) */
function isDiaUtil(date) {
  const dow = date.getDay(); // 0=Dom ... 6=Sáb
  if (dow === 0 || dow === 6) return false;
  if (isFeriado(date)) return false;
  return true;
}

/** Minutos desde a meia-noite (hora local) de um Date. */
function minutosDoDia(date) {
  return date.getHours() * 60 + date.getMinutes();
}

/** Devolve um clone de `date` com a hora definida para `minutosDoDia`. */
function comMinutos(date, minutos) {
  const d = new Date(date);
  d.setHours(Math.floor(minutos / 60), minutos % 60, 0, 0);
  return d;
}

/** Início (09:30) do PRÓXIMO dia útil a partir de `date`. */
function inicioProximoDiaUtil(date) {
  const d = new Date(date);
  d.setDate(d.getDate() + 1);
  d.setHours(0, 0, 0, 0);
  while (!isDiaUtil(d)) {
    d.setDate(d.getDate() + 1);
  }
  return comMinutos(d, INICIO_MIN);
}

/**
 * Garante que `date` cai DENTRO de uma janela útil.
 *  - Antes das 09:30 num dia útil  -> 09:30 do mesmo dia.
 *  - Depois das 19:00, fim-de-semana ou feriado -> 09:30 do próximo dia útil.
 *  - Já dentro da janela -> inalterado.
 */
function ajustarParaJanelaUtil(date) {
  let d = new Date(date);
  if (isDiaUtil(d)) {
    const min = minutosDoDia(d);
    if (min < INICIO_MIN) return comMinutos(d, INICIO_MIN);
    if (min >= FIM_MIN) return inicioProximoDiaUtil(d);
    return d; // dentro da janela
  }
  return inicioProximoDiaUtil(d);
}

/**
 * Soma `minutosUteis` minutos úteis a `inicio`, respeitando janela e feriados.
 * @param {Date} inicio
 * @param {number} minutosUteis
 * @returns {Date} instante-limite
 */
function adicionarMinutosUteis(inicio, minutosUteis) {
  let cursor = ajustarParaJanelaUtil(inicio);
  let restante = minutosUteis;

  // Salvaguarda contra ciclos infinitos (config inválida): no máximo
  // ~5 anos de dias úteis.
  let guarda = 0;
  const MAX_ITER = 5 * 260 + 10;

  while (restante > 0 && guarda++ < MAX_ITER) {
    const fimDoDia = comMinutos(cursor, FIM_MIN);
    const minutosAteFim = Math.round((fimDoDia - cursor) / 60000);

    if (restante <= minutosAteFim) {
      cursor = new Date(cursor.getTime() + restante * 60000);
      restante = 0;
    } else {
      restante -= minutosAteFim;
      cursor = inicioProximoDiaUtil(cursor);
    }
  }
  return cursor;
}

/**
 * Calcula o sla_limite a partir da data de receção.
 * @param {Date|string} dataRececao
 * @returns {Date}
 */
function calcularSlaLimite(dataRececao) {
  const inicio = dataRececao instanceof Date ? dataRececao : new Date(dataRececao);
  return adicionarMinutosUteis(inicio, SLA_MINUTOS_UTEIS);
}

module.exports = {
  calcularSlaLimite,
  adicionarMinutosUteis,
  isDiaUtil,
  ajustarParaJanelaUtil,
  // exportados para testes/inspeção:
  _config: { INICIO_MIN, FIM_MIN, SLA_MINUTOS_UTEIS },
};
