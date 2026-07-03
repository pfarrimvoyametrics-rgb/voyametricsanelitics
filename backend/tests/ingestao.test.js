/**
 * ingestao.test.js — Roteamento da ingestão de email por organização (P0-4).
 * Testa a função PURA `escolherOrgPorEnderecos` (sem BD).
 *
 * Executar:  node --test
 */
const test = require('node:test');
const assert = require('node:assert');
const { escolherOrgPorEnderecos } = require('../src/models/orgModel');

const acme = { id: 'a', slug: 'acme', ativo: true, email_dominios: 'acme.pt, suporte@acme.pt' };
const sol = { id: 's', slug: 'sol', ativo: true, email_dominios: 'agencia-sol.com' };
const inativa = { id: 'x', slug: 'x', ativo: false, email_dominios: 'acme.pt' };
const semDominios = { id: 'd', slug: 'demo', ativo: true, email_dominios: null };
const ORGS = [semDominios, acme, sol, inativa];

test('casa pelo domínio do destinatário', () => {
  const r = escolherOrgPorEnderecos(ORGS, ['joao@acme.pt']);
  assert.strictEqual(r && r.id, 'a');
});

test('casa por endereço/alias completo', () => {
  const r = escolherOrgPorEnderecos(ORGS, ['suporte@acme.pt']);
  assert.strictEqual(r && r.id, 'a');
});

test('casa por subdomínio (mail.acme.pt -> acme.pt)', () => {
  const r = escolherOrgPorEnderecos(ORGS, ['ana@mail.acme.pt']);
  assert.strictEqual(r && r.id, 'a');
});

test('respeita a ordem dos endereços (destinatário antes do remetente)', () => {
  // 1.º endereço casa "sol"; não deve saltar para "acme" (2.º).
  const r = escolherOrgPorEnderecos(ORGS, ['geral@agencia-sol.com', 'cliente@acme.pt']);
  assert.strictEqual(r && r.id, 's');
});

test('ignora organizações inativas e sem domínios', () => {
  // Só a inativa tem 'outra.pt'; nada ativo casa -> null.
  const r = escolherOrgPorEnderecos([inativa, semDominios], ['x@acme.pt']);
  assert.strictEqual(r, null);
});

test('sem correspondência devolve null (cai na org por omissão no chamador)', () => {
  assert.strictEqual(escolherOrgPorEnderecos(ORGS, ['alguem@outrolado.org']), null);
  assert.strictEqual(escolherOrgPorEnderecos(ORGS, []), null);
  assert.strictEqual(escolherOrgPorEnderecos([], ['x@acme.pt']), null);
});
