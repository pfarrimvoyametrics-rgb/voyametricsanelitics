/**
 * demo.js — Gera dados de DEMONSTRAÇÃO para testar a app sem ligação ao email.
 *
 * Cria centenas de tickets realistas ao longo dos últimos ~45 dias úteis,
 * distribuídos por categorias, operadores e clientes, já com:
 *   • SLA calculado (regra de horas úteis),
 *   • 1.ª atribuição, resolução e minutos úteis de resolução,
 *   • resultados comerciais (ganho/perdido + valor) na categoria Comercial.
 * Assim os relatórios ficam imediatamente preenchidos e analisáveis.
 *
 * Uso:  node src/cli.js demo [n]      (por omissão 400)
 *       node src/cli.js demo:clear    (remove os tickets de demonstração)
 */
const { pool } = require('../config/db');
const slaService = require('../services/slaService');
const canalModel = require('../models/canalModel');

const ASSUNTOS = {
  emergencias: [
    'Passageiro retido no aeroporto de Madrid', 'Voo cancelado — preciso de ajuda urgente',
    'Greve aérea: reacomodação imediata', 'Emergência em viagem — contacto urgente', 'Bagagem extraviada à chegada',
  ],
  alteracoes: [
    'Alteração de datas da reserva', 'Remarcar voo de regresso', 'Mudar nome no bilhete',
    'Cancelar reserva de hotel', 'Reagendar transfer do aeroporto', 'Alterar passageiro na reserva',
  ],
  cotacoes: [
    'Orçamento para viagem a Roma', 'Proposta de programa corporativo', 'Reserva de grupo para evento',
    'Cotação de voos para Nova Iorque', 'Pedido de informação sobre pacotes', 'Renovação de contrato anual',
  ],
  reclamacoes: [
    'Reembolso de reserva cancelada', 'Reclamação sobre o hotel', 'Pedido de nota de crédito',
    'Devolução de valor cobrado a mais', 'Insatisfação com o serviço prestado', 'Queixa sobre atraso no atendimento',
  ],
};

const CLIENTES = [
  'compras@navaralda.pt', 'viagens@globotech.pt', 'geral@meridiano-sa.pt', 'adm@lusofrota.pt',
  'eventos@atlanticgrp.pt', 'reservas@delta-consulting.pt', 'financeiro@porto-imports.pt',
  'rh@vianorte.pt', 'direcao@sulmar.pt', 'apoio@quintela-lda.pt',
];

const CATEGORIAS = ['emergencias', 'alteracoes', 'cotacoes', 'reclamacoes'];
const rnd = (a, b) => a + Math.random() * (b - a);
const escolher = (arr) => arr[Math.floor(Math.random() * arr.length)];

async function gerarDemo(n = 400) {
  const { rows: ops } = await pool.query(`SELECT id, categoria FROM usuarios WHERE funcao = 'operador'`);
  if (!ops.length) throw new Error('Sem operadores na base de dados — corra o seed primeiro (npm run seed).');
  const porCat = {};
  for (const o of ops) (porCat[o.categoria] ||= []).push(o.id);

  const mapaSla = await canalModel.mapaSla();
  const agora = Date.now();
  let inseridos = 0;

  for (let i = 0; i < n; i++) {
    const categoria = escolher(CATEGORIAS);

    // Data de receção: últimos 45 dias, empurrada para dia útil, hora 09–18.
    const d = new Date(agora - Math.floor(rnd(0, 45)) * 86400000);
    if (d.getDay() === 0) d.setDate(d.getDate() + 1);
    if (d.getDay() === 6) d.setDate(d.getDate() + 2);
    d.setHours(Math.floor(rnd(9, 18)), Math.floor(rnd(0, 60)), 0, 0);
    const dataRececao = new Date(d);
    const slaLimite = slaService.calcularSlaLimite(dataRececao, mapaSla[categoria]);

    const opsCat = porCat[categoria] || ops.map((o) => o.id);
    const r = Math.random();
    let status = 'pendente';
    let operador = null, dataPrimeira = null, dataResolucao = null, minUteis = null;
    let resultado = 'nao_aplicavel', valor = null;

    if (r < 0.85) {
      status = 'resolvido';
      operador = escolher(opsCat);
      dataPrimeira = new Date(dataRececao.getTime() + rnd(5, 180) * 60000);
      const dentro = Math.random() < 0.9; // 90% dentro do SLA
      const alvo = dentro
        ? slaLimite.getTime() - rnd(5, 90) * 60000
        : slaLimite.getTime() + rnd(10, 600) * 60000;
      dataResolucao = new Date(Math.max(alvo, dataPrimeira.getTime() + 10 * 60000));
      minUteis = slaService.minutosUteisEntre(dataRececao, dataResolucao);
    } else if (r < 0.95) {
      status = 'em_andamento';
      operador = escolher(opsCat);
      dataPrimeira = new Date(dataRececao.getTime() + rnd(5, 120) * 60000);
    }

    if (categoria === 'cotacoes' && status === 'resolvido') {
      // Regra: Cotações resolvidas têm sempre resultado (ganho/perdido).
      if (Math.random() < 0.45) { resultado = 'ganho'; valor = Math.round(rnd(150, 3500)); }
      else { resultado = 'perdido'; }
    }

    // Emissões: canais operacionais (emergências/alterações/cotações) que resolvem
    // costumam emitir bilhetes/vouchers; ~6% saem com erro (reemissão/correcção).
    let emitidos = 0, comErro = 0, emissaoEm = null;
    if (status === 'resolvido' && categoria !== 'reclamacoes' && Math.random() < 0.7) {
      emitidos = Math.floor(rnd(1, 5));
      for (let b = 0; b < emitidos; b++) if (Math.random() < 0.06) comErro++;
      emissaoEm = dataResolucao;
    }

    // CSAT: ~60% dos resolvidos respondem ao inquérito (notas enviesadas para o alto).
    let csat = null, csatEm = null;
    if (status === 'resolvido' && Math.random() < 0.6) {
      const r2 = Math.random();
      csat = r2 < 0.55 ? 5 : r2 < 0.85 ? 4 : r2 < 0.95 ? 3 : r2 < 0.98 ? 2 : 1;
      csatEm = new Date(dataResolucao.getTime() + rnd(1, 48) * 3600000);
    }

    const oid = `demo-${Date.now().toString(36)}-${i}`;
    const { rowCount } = await pool.query(
      `INSERT INTO tickets
         (outlook_message_id, remetente, assunto, corpo_email, data_rececao, sla_limite, status,
          categoria_ticket, operador_atribuido_id, data_resolucao, data_primeira_atribuicao,
          resultado_venda, valor_venda, minutos_uteis_resolucao, csat, csat_em,
          bilhetes_emitidos, bilhetes_com_erro, emissao_em)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
       ON CONFLICT (outlook_message_id) DO NOTHING`,
      [oid, escolher(CLIENTES), escolher(ASSUNTOS[categoria]),
       'Mensagem de demonstração para teste de relatórios.', dataRececao, slaLimite, status,
       categoria, operador, dataResolucao, dataPrimeira, resultado, valor, minUteis, csat, csatEm,
       emitidos, comErro, emissaoEm]
    );
    inseridos += rowCount;
  }
  return inseridos;
}

async function limparDemo() {
  const { rowCount } = await pool.query(`DELETE FROM tickets WHERE outlook_message_id LIKE 'demo-%'`);
  return rowCount;
}

module.exports = { gerarDemo, limparDemo };
