/**
 * sla.test.js — Testes do cálculo de SLA em horas úteis.
 * Executar:  TZ=Europe/Lisbon node --test
 *
 * Fixamos o fuso e a janela ANTES de carregar o serviço, pois este lê a
 * configuração no momento do require.
 */
process.env.TZ = 'Europe/Lisbon';
process.env.SLA_HORA_INICIO = '09:30';
process.env.SLA_HORA_FIM = '19:00';
process.env.SLA_MINUTOS_UTEIS = '120';

const test = require('node:test');
const assert = require('node:assert');
const { calcularSlaLimite } = require('../src/services/slaService');
const { isFeriado } = require('../src/utils/feriados');

/** Formata um Date para 'YYYY-MM-DD HH:MM' em hora local. */
function fmt(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

// Semana de referência sem feriados: 2 a 6 de Junho de 2025 (Seg–Sex).

test('A) meio da manhã: Seg 10:00 -> 12:00 mesmo dia', () => {
  const r = calcularSlaLimite(new Date(2025, 5, 2, 10, 0));
  assert.strictEqual(fmt(r), '2025-06-02 12:00');
});

test('B) transbordo de dia: Seg 18:00 -> Ter 10:30', () => {
  // 18:00->19:00 = 1h; restam 1h -> próximo dia 09:30 + 1h = 10:30
  const r = calcularSlaLimite(new Date(2025, 5, 2, 18, 0));
  assert.strictEqual(fmt(r), '2025-06-03 10:30');
});

test('C) transbordo fim-de-semana: Sex 18:30 -> Seg 11:00', () => {
  // 18:30->19:00 = 30min; restam 90min -> Seg 09:30 + 90min = 11:00
  const r = calcularSlaLimite(new Date(2025, 5, 6, 18, 30));
  assert.strictEqual(fmt(r), '2025-06-09 11:00');
});

test('D) antes de abrir: Seg 08:00 -> 11:30 (conta a partir das 09:30)', () => {
  const r = calcularSlaLimite(new Date(2025, 5, 2, 8, 0));
  assert.strictEqual(fmt(r), '2025-06-02 11:30');
});

test('E) fim-de-semana: Sáb 14:00 -> Seg 11:30', () => {
  const r = calcularSlaLimite(new Date(2025, 5, 7, 14, 0));
  assert.strictEqual(fmt(r), '2025-06-09 11:30');
});

test('F) feriado (10 Jun, Dia de Portugal): email às 10:00 -> dia seguinte 11:30', () => {
  const r = calcularSlaLimite(new Date(2025, 5, 10, 10, 0));
  assert.strictEqual(fmt(r), '2025-06-11 11:30');
});

test('Feriados fixos e móveis de 2025 são reconhecidos', () => {
  assert.ok(isFeriado(new Date(2025, 5, 10)), '10 Jun — Dia de Portugal');
  assert.ok(isFeriado(new Date(2025, 3, 25)), '25 Abr — Liberdade');
  assert.ok(isFeriado(new Date(2025, 11, 25)), '25 Dez — Natal');
  assert.ok(isFeriado(new Date(2025, 3, 18)), '18 Abr — Sexta-Feira Santa');
  assert.ok(isFeriado(new Date(2025, 5, 19)), '19 Jun — Corpo de Deus');
  assert.ok(!isFeriado(new Date(2025, 5, 11)), '11 Jun — dia normal');
});
