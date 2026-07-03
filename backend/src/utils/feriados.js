/**
 * feriados.js — Feriados nacionais obrigatórios de Portugal.
 *
 * Inclui os feriados fixos e os MÓVEIS (dependentes da Páscoa).
 * A data da Páscoa é calculada pelo algoritmo de Meeus/Jones/Butcher
 * (válido no calendário Gregoriano), evitando depender de tabelas.
 *
 * Feriados considerados (obrigatórios à escala nacional):
 *   Fixos:
 *     01 Jan  Ano Novo
 *     25 Abr  Dia da Liberdade
 *     01 Mai  Dia do Trabalhador
 *     10 Jun  Dia de Portugal
 *     15 Ago  Assunção de Nossa Senhora
 *     05 Out  Implantação da República
 *     01 Nov  Todos os Santos
 *     01 Dez  Restauração da Independência
 *     08 Dez  Imaculada Conceição
 *     25 Dez  Natal
 *   Móveis:
 *     Sexta-Feira Santa  (Páscoa − 2 dias)
 *     Domingo de Páscoa  (cai sempre a um domingo)
 *     Corpo de Deus      (Páscoa + 60 dias)
 *
 * Nota: o Carnaval NÃO é feriado nacional obrigatório (é tolerância de
 * ponto, decidida ano a ano), por isso fica de fora por omissão. Caso
 * a empresa o queira contar, basta acrescentá-lo via FERIADOS_EXTRA.
 */

// Feriados adicionais opcionais (ex.: feriados municipais/tolerâncias),
// no formato 'MM-DD'. Lidos a partir de variável de ambiente, separados
// por vírgula. Ex.: FERIADOS_EXTRA="06-13,12-24"
const FERIADOS_EXTRA = (process.env.FERIADOS_EXTRA || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

/** Calcula o Domingo de Páscoa para um dado ano (algoritmo de Meeus). */
function calcularPascoa(ano) {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31); // 3 = Março, 4 = Abril
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(ano, mes - 1, dia));
}

/** Devolve uma chave 'MM-DD' a partir de um Date (em UTC). */
function chaveMesDia(date) {
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  return `${mm}-${dd}`;
}

// Cache por ano para não recalcular a Páscoa em cada chamada.
const cachePorAno = new Map();

/** Conjunto de chaves 'MM-DD' que são feriado nesse ano. */
function feriadosDoAno(ano) {
  if (cachePorAno.has(ano)) return cachePorAno.get(ano);

  const fixos = [
    '01-01', '04-25', '05-01', '06-10', '08-15',
    '10-05', '11-01', '12-01', '12-08', '12-25',
  ];

  const pascoa = calcularPascoa(ano);
  const sextaSanta = new Date(pascoa); sextaSanta.setUTCDate(pascoa.getUTCDate() - 2);
  const corpoDeus = new Date(pascoa); corpoDeus.setUTCDate(pascoa.getUTCDate() + 60);

  const moveis = [
    chaveMesDia(sextaSanta),
    chaveMesDia(pascoa),
    chaveMesDia(corpoDeus),
  ];

  const set = new Set([...fixos, ...moveis, ...FERIADOS_EXTRA]);
  cachePorAno.set(ano, set);
  return set;
}

/**
 * É feriado nacional?
 * @param {Date} date — instante a verificar (a componente de dia é o que conta).
 * @returns {boolean}
 */
function isFeriado(date) {
  const ano = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return feriadosDoAno(ano).has(`${mm}-${dd}`);
}

module.exports = { isFeriado, calcularPascoa };
