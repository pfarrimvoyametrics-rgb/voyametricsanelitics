/**
 * extras.test.js — Testes adicionais introduzidos na revisão de código:
 *   • Precisão do SLA ao minuto (truncar segundos da receção).
 *   • Normalização de texto da triagem (sem acentos, minúsculas).
 *
 * Executar:  TZ=Europe/Lisbon node --test
 */
process.env.TZ = 'Europe/Lisbon';
process.env.SLA_HORA_INICIO = '09:30';
process.env.SLA_HORA_FIM = '19:00';
process.env.SLA_MINUTOS_UTEIS = '120';

const test = require('node:test');
const assert = require('node:assert');
const { calcularSlaLimite, minutosUteisEntre } = require('../src/services/slaService');
const { normalizar } = require('../src/services/triageService');

function fmt(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

// --- Precisão do SLA ---------------------------------------------------------

test('SLA trunca os segundos da receção (Seg 10:00:59 -> 12:00:00)', () => {
  const r = calcularSlaLimite(new Date(2025, 5, 2, 10, 0, 59, 999));
  assert.strictEqual(fmt(r), '2025-06-02 12:00');
  assert.strictEqual(r.getSeconds(), 0, 'segundos devem ser zero');
  assert.strictEqual(r.getMilliseconds(), 0, 'milissegundos devem ser zero');
});

test('SLA com segundos no transbordo de dia (Seg 18:00:30 -> Ter 10:30:00)', () => {
  const r = calcularSlaLimite(new Date(2025, 5, 2, 18, 0, 30));
  assert.strictEqual(fmt(r), '2025-06-03 10:30');
  assert.strictEqual(r.getSeconds(), 0);
});

// --- Normalização da triagem -------------------------------------------------

test('normalizar remove acentos e baixa para minúsculas', () => {
  assert.strictEqual(normalizar('Factura'), 'factura');
  assert.strictEqual(normalizar('REEMBOLSO'), 'reembolso');
  assert.strictEqual(normalizar('Orçamento'), 'orcamento');
  assert.strictEqual(normalizar('Não Funciona'), 'nao funciona');
});

test('normalizar é seguro com entradas vazias/nulas', () => {
  assert.strictEqual(normalizar(''), '');
  assert.strictEqual(normalizar(undefined), '');
  assert.strictEqual(normalizar(null), '');
});

test('normalizar permite casar "fatura" dentro do texto', () => {
  const corpo = normalizar('Boa tarde, segue a minha FATURA em anexo.');
  assert.ok(corpo.includes('fatura'));
});

// --- Minutos úteis entre dois instantes (métricas de resolução) --------------

test('minutosUteisEntre: mesmo dia útil (Seg 10:00 -> 11:30 = 90 min)', () => {
  const a = new Date(2025, 5, 2, 10, 0); // Segunda
  const b = new Date(2025, 5, 2, 11, 30);
  assert.strictEqual(minutosUteisEntre(a, b), 90);
});

test('minutosUteisEntre: ignora fora-da-janela e fim-de-semana (Sex 18:30 -> Seg 10:00 = 60 min)', () => {
  // Sex 18:30->19:00 = 30 min; Sáb/Dom não contam; Seg 09:30->10:00 = 30 min.
  const a = new Date(2025, 5, 6, 18, 30); // Sexta
  const b = new Date(2025, 5, 9, 10, 0);  // Segunda
  assert.strictEqual(minutosUteisEntre(a, b), 60);
});

test('minutosUteisEntre: fim <= início devolve 0', () => {
  const a = new Date(2025, 5, 2, 12, 0);
  assert.strictEqual(minutosUteisEntre(a, a), 0);
  assert.strictEqual(minutosUteisEntre(a, new Date(2025, 5, 2, 11, 0)), 0);
});
