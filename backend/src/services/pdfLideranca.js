/**
 * pdfLideranca.js — "Balanço de Liderança" de um operador, em PDF de marca.
 * Funde a análise de serviço (SLA, canais, clientes) com storytelling de
 * feedback 360º, na voz de um líder que quer tirar o melhor das pessoas e
 * das contas. Gráficos vetoriais desenhados em pdfkit (nítidos, sem imagens).
 */
const PDFDocument = require('pdfkit');
const path = require('path');

const NAVY = '#0b2545', TEAL = '#14c8b8', INK = '#1f2937', SLATE = '#475569',
      MUTE = '#6b7280', LINE = '#e2e8f0', LIGHT = '#eef2f1', HEAD = '#eef2f7',
      EMER = '#059669', AMBER = '#b45309', ROSE = '#e11d48', INDIGO = '#0b2545',
      GOLD = '#b8860b', CREAM = '#fbf6e6', MINT = '#e8f6f3';
const ROTULO = {
  emergencias: 'Emergências', alteracoes: 'Alterações de Reservas',
  cotacoes: 'Cotações / Orçamentos', reclamacoes: 'Reclamações / Reembolsos',
  suporte_tecnico: 'Suporte Técnico', faturacao: 'Faturação', comercial: 'Comercial',
};
const DIAS = ['', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
const LOGO = path.join(__dirname, '..', 'assets', 'logo.png');

const numpt = (n) => (n == null ? '—' : String(Math.round(n * 10) / 10).replace('.', ','));
const i0 = (n) => (n == null ? '—' : new Intl.NumberFormat('pt-PT').format(Math.round(n)));
const pct = (n) => (n == null ? '—' : numpt(n) + '%');
const horas = (n) => (n == null ? '—' : numpt(n) + ' h');
const eur = (n) => (n == null ? '—' : new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(n));
const corSla = (v) => (v == null ? MUTE : v >= 95 ? EMER : v >= 85 ? AMBER : ROSE);

// ---------------------------------------------------------------------------
//  Narrativa de liderança — texto denso derivado dos dados
// ---------------------------------------------------------------------------
function narrativa(d) {
  const g = d.geral || {}, cmp = d.comparativo || {}, meta = (d.insights && d.insights.meta) || 95;
  const amb = d.ambito || {};
  let nome, prim, deX, colectivo;
  if (amb.operador && d.operadores && d.operadores[0] && d.operadores[0].nome) {
    nome = d.operadores[0].nome; prim = nome.split(' ')[0]; deX = 'de ' + prim; colectivo = false;
  } else if (amb.cliente) {
    nome = 'Conta · ' + amb.cliente; prim = 'esta conta'; deX = 'desta conta'; colectivo = true;
  } else if (amb.equipa) {
    nome = ROTULO[amb.equipa] || amb.equipa; prim = 'a equipa'; deX = 'da equipa'; colectivo = true;
  } else {
    nome = 'Departamento (todas as equipas)'; prim = 'a equipa'; deX = 'da equipa'; colectivo = true;
  }
  const resolvidos = +g.resolvidos || 0;
  const cumpridos = Math.round(((g.taxa_sla || 0) / 100) * resolvidos);
  const foraPrazo = Math.max(0, resolvidos - cumpridos);
  const violados = +g.violados_abertos || 0;
  const ini = new Date(d.periodo.de + 'T00:00:00Z'), fim = new Date(d.periodo.ate + 'T00:00:00Z');
  const dias = Math.max(1, Math.round((fim - ini) / 86400000) + 1);
  const ritmo = resolvidos / dias;
  const backlogDias = ritmo > 0 ? Math.ceil(violados / ritmo) : null;
  const precisaMeta = Math.max(0, Math.ceil((meta / 100) * resolvidos) - cumpridos);

  const cats = (d.categorias || []).filter((c) => (c.total || 0) > 0);
  const volTotal = cats.reduce((s, c) => s + (c.total || 0), 0) || 1;
  const pior = [...cats].sort((a, b) => (a.taxa_sla ?? 101) - (b.taxa_sla ?? 101))[0];
  const maisVol = [...cats].sort((a, b) => b.total - a.total)[0];

  const ds = d.diaSemana || [];
  const totDs = ds.reduce((s, x) => s + (x.recebidos || 0), 0) || 1;
  const picoDia = [...ds].sort((a, b) => b.recebidos - a.recebidos)[0];
  const shareDia = picoDia ? Math.round((picoDia.recebidos / totDs) * 100) : 0;
  const picoHora = (d.hora || []).length ? [...d.hora].sort((a, b) => b.recebidos - a.recebidos)[0] : null;

  const clientes = d.clientes || [];
  const recTotal = clientes.reduce((s, c) => s + (c.receita || 0), 0) || (g.receita || 1);
  const top3 = [...clientes].sort((a, b) => (b.receita || 0) - (a.receita || 0)).slice(0, 3);
  const top3Share = Math.round((top3.reduce((s, c) => s + (c.receita || 0), 0) / recTotal) * 100);
  const risco = [...clientes].filter((c) => c.taxa_sla != null && (c.total || 0) >= 8 && c.taxa_sla < 90)
                              .sort((a, b) => b.total - a.total);
  const piorCli = [...clientes].filter((c) => (c.total || 0) >= 3).sort((a, b) => (a.taxa_sla ?? 101) - (b.taxa_sla ?? 101))[0];

  const emit = +g.bilhetes_emitidos || 0, erros = +g.bilhetes_com_erro || 0;

  return {
    nome, prim, deX, colectivo, meta, resolvidos, cumpridos, foraPrazo, violados, dias, ritmo, backlogDias, precisaMeta,
    pior, maisVol, volTotal, picoDia, shareDia, picoHora, top3, top3Share, recTotal, risco, piorCli, emit, erros, cmp, g,
    leitura:
      `Como líder, leio este mês em três tempos. Primeiro, ${prim} esteve em ESCALA: o volume ` +
      `${cmp.total_pct != null ? `cresceu ${numpt(cmp.total_pct)}% ` : 'subiu '}para ${i0(g.total)} pedidos e a receita ` +
      `${cmp.receita_pct != null ? `acompanhou (+${numpt(cmp.receita_pct)}%)` : 'acompanhou'}, chegando a ${eur(g.receita)}. ` +
      `Segundo, fê-lo a MELHORAR o serviço — SLA de ${pct(g.taxa_sla)}${cmp.taxa_sla_pp != null ? ` (${cmp.taxa_sla_pp >= 0 ? '+' : ''}${numpt(cmp.taxa_sla_pp)} pp)` : ''} ` +
      `e 1.ª resposta em ${horas(g.horas_resposta_media)}, a métrica que mais pesa na percepção do cliente. ` +
      `Terceiro, e é aqui que entra o meu papel: faltam ${precisaMeta > 0 ? precisaMeta : 'poucas'} resoluções no prazo para ` +
      `chegar à meta de ${pct(meta)} — não é um problema de empenho, é de capacidade em janelas concretas e de um canal específico. ` +
      `O trabalho do líder não é exigir mais; é remover esses obstáculos e proteger as contas já conquistadas.`,
  };
}

// ---------------------------------------------------------------------------
//  Gráficos vetoriais (pdfkit)
// ---------------------------------------------------------------------------
function barrasH(doc, x, y, w, items, opts) {
  opts = opts || {};
  const rowH = opts.rowH || 20, gap = opts.gap || 8, labelW = opts.labelW || 130;
  const mx = opts.max || Math.max(1, ...items.map((i) => i.value)) * 1.14;
  const plotX = x + labelW, plotW = w - labelW - 52;
  items.forEach((it, i) => {
    const cy = y + i * (rowH + gap);
    doc.fillColor(MUTE).font('Helvetica').fontSize(8.3).text(it.label, x, cy + rowH / 2 - 5, { width: labelW - 8, align: 'right', lineBreak: false });
    doc.roundedRect(plotX, cy, plotW, rowH, rowH / 2).fill(LIGHT);
    const bw = Math.max(rowH, (it.value / mx) * plotW);
    doc.roundedRect(plotX, cy, bw, rowH, rowH / 2).fill(it.color);
    doc.fillColor(INK).font('Helvetica-Bold').fontSize(8.3).text(it.tag != null ? it.tag : String(it.value), plotX + bw + 6, cy + rowH / 2 - 5, { width: 80, lineBreak: false });
  });
  const hh = items.length * (rowH + gap) - gap;
  if (opts.target != null) {
    const tx = plotX + (opts.target / mx) * plotW;
    doc.save().dash(2, { space: 2 }).moveTo(tx, y - 5).lineTo(tx, y + hh + 5).strokeColor(NAVY).lineWidth(1).stroke().undash().restore();
    doc.fillColor(NAVY).font('Helvetica').fontSize(6.8).text(opts.targetLabel || 'Meta', tx - 12, y + hh + 7, { width: 60, lineBreak: false });
  }
  return y + hh + (opts.target != null ? 16 : 4);
}

function termometroSla(doc, x, y, w, sla, meta) {
  const h = 20;
  doc.roundedRect(x, y, w, h, h / 2).fill(LIGHT);
  const col = corSla(sla);
  doc.roundedRect(x, y, Math.max(h, (Math.min(100, sla) / 100) * w), h, h / 2).fill(col);
  const mx = x + (meta / 100) * w;
  doc.save().dash(2, { space: 2 }).moveTo(mx, y - 5).lineTo(mx, y + h + 5).strokeColor(NAVY).lineWidth(1.2).stroke().undash().restore();
  doc.fillColor(NAVY).font('Helvetica').fontSize(7).text('Meta ' + pct(meta), mx - 18, y + h + 6, { width: 60, lineBreak: false });
  doc.fillColor(col).font('Helvetica-Bold').fontSize(13).text(pct(sla), x, y - 20, { width: 60, lineBreak: false });
  return y + h + 18;
}

// ---------------------------------------------------------------------------
function gerar(d) {
  return new Promise((resolve, reject) => {
    try {
      const N = narrativa(d);
      const doc = new PDFDocument({ size: 'A4', margin: 42, bufferPages: true });
      const chunks = [];
      doc.on('data', (c) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      const W = doc.page.width, H = doc.page.height, M = 42, CW = W - 2 * M;
      const g = d.geral || {}, cmp = d.comparativo || {}, ins = d.insights || {}, meta = N.meta;
      const cats = (d.categorias || []).filter((c) => (c.total || 0) > 0);
      const bottom = H - 54;
      let y = M;
      const ensure = (hh) => { if (y + hh > bottom) { doc.addPage(); y = M; } };
      const h1 = (t) => { ensure(30); doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(13.5).text(t, M, y); doc.moveTo(M, y + 18).lineTo(M + 26, y + 18).lineWidth(2.4).strokeColor(TEAL).stroke(); y += 26; };
      const h2 = (t) => { ensure(20); doc.fillColor(TEAL).font('Helvetica-Bold').fontSize(10.5).text(t, M, y); y += 16; };
      const par = (t, c = SLATE, size = 9.4) => { doc.fillColor(c).font('Helvetica').fontSize(size); const hh = doc.heightOfString(t, { width: CW, lineGap: 1.5 }); ensure(hh + 4); doc.text(t, M, y, { width: CW, lineGap: 1.5 }); y += hh + 5; };
      const callout = (t, bar = TEAL, bg = MINT, c = INK) => {
        doc.font('Helvetica').fontSize(9.4);
        const inW = CW - 22; const hh = doc.heightOfString(t, { width: inW, lineGap: 1.5 });
        ensure(hh + 16);
        doc.roundedRect(M, y, CW, hh + 14, 6).fill(bg);
        doc.rect(M, y, 3.5, hh + 14).fill(bar);
        doc.fillColor(c).font('Helvetica').fontSize(9.4).text(t, M + 12, y + 7, { width: inW, lineGap: 1.5 });
        y += hh + 20;
      };
      const bullets = (arr, c = SLATE) => {
        arr.forEach((t) => {
          doc.fillColor(TEAL).font('Helvetica-Bold').fontSize(9.4);
          const bx = M + 2;
          doc.font('Helvetica').fillColor(c).fontSize(9.4);
          const hh = doc.heightOfString(t, { width: CW - 16, lineGap: 1.2 });
          ensure(hh + 4);
          doc.circle(bx + 2, y + 5, 1.7).fill(TEAL);
          doc.fillColor(c).text(t, M + 14, y, { width: CW - 16, lineGap: 1.2 });
          y += hh + 4;
        });
      };

      // ===================== CAPA =====================
      doc.rect(0, 0, W, H).fill(NAVY);
      doc.rect(0, 0, W, 6).fill(TEAL);
      try { doc.image(LOGO, M, 64, { width: 50 }); } catch (e) { /* sem logo */ }
      doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(20).text('VoyaMetrics', M, 124);
      doc.fillColor('#9fb6c9').font('Helvetica').fontSize(9.5).text('Medidor SLA Email · Departamento Corporate', M, 150);
      doc.fillColor(TEAL).font('Helvetica-Bold').fontSize(11).text('BALANÇO DE LIDERANÇA', M, 232);
      doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(30).text('Desempenho &', M, 252, { width: CW });
      doc.fontSize(30).text('Desenvolvimento', M, 286, { width: CW });
      doc.fillColor('#cbd5e1').font('Helvetica').fontSize(13).text(N.nome, M, 344);
      doc.fillColor('#9fb6c9').fontSize(11)
        .text(`Período: ${d.periodo.de} a ${d.periodo.ate}`, M, 372)
        .text(`Comparado com: ${d.periodoAnterior ? d.periodoAnterior.de + ' a ' + d.periodoAnterior.ate : 'período anterior'}`, M, 390);
      // mini-KPIs na capa
      const capaK = [['SLA', pct(g.taxa_sla)], ['Receita', eur(g.receita)], ['CSAT', g.csat_media != null ? numpt(g.csat_media) + '/5' : '—'], ['Volume', i0(g.total)]];
      capaK.forEach((k, i) => {
        const x = M + i * ((CW) / 4);
        doc.fillColor('#16324f').roundedRect(x, 440, CW / 4 - 10, 56, 8).fill();
        doc.fillColor('#7f9bb3').font('Helvetica').fontSize(8).text(k[0].toUpperCase(), x + 12, 452);
        doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(15).text(k[1], x + 12, 466, { width: CW / 4 - 24, lineBreak: false });
      });
      doc.fillColor('#6b7f93').fontSize(8.5).text('Documento confidencial · uso interno de gestão · VoyaMetrics', M, H - 58, { width: CW });

      // ===================== PÁG. 1 — PAINEL EXECUTIVO =====================
      doc.addPage(); y = M;
      h1(`${N.nome} — leitura do período`);
      par(`Período ${d.periodo.de} a ${d.periodo.ate}` + (d.periodoAnterior ? ` (comparado com ${d.periodoAnterior.de} a ${d.periodoAnterior.ate}).` : '.'), MUTE, 8.6);

      // KPIs 4x2 com deltas
      const arr = (v, up) => (v == null || v === '' ? '' : (up ? '▲ ' : '▼ ') + v);
      const kpis = [
        ['Recebidos', i0(g.total), cmp.total_pct != null ? arr(numpt(Math.abs(cmp.total_pct)) + '%', cmp.total_pct >= 0) : '', INK, cmp.total_pct >= 0 ? EMER : ROSE],
        ['Cumprimento SLA', pct(g.taxa_sla), cmp.taxa_sla_pp != null ? arr(numpt(Math.abs(cmp.taxa_sla_pp)) + ' pp', cmp.taxa_sla_pp >= 0) : '', corSla(g.taxa_sla), cmp.taxa_sla_pp >= 0 ? EMER : ROSE],
        ['1.ª resposta', horas(g.horas_resposta_media), '', TEAL, MUTE],
        ['Resolução (úteis)', horas(g.horas_uteis_resolucao_media), '', INK, MUTE],
        ['Conversão', pct(g.taxa_conversao), cmp.conversao_pp != null ? arr(numpt(Math.abs(cmp.conversao_pp)) + ' pp', cmp.conversao_pp >= 0) : '', INDIGO, cmp.conversao_pp >= 0 ? EMER : ROSE],
        ['Receita', eur(g.receita), cmp.receita_pct != null ? arr(numpt(Math.abs(cmp.receita_pct)) + '%', cmp.receita_pct >= 0) : '', EMER, cmp.receita_pct >= 0 ? EMER : ROSE],
        ['CSAT', g.csat_media != null ? numpt(g.csat_media) + '/5' : '—', g.csat_respostas ? g.csat_respostas + ' resp.' : '', AMBER, MUTE],
        ['Precisão emissão', pct(g.precisao_emissao), g.bilhetes_com_erro != null ? g.bilhetes_com_erro + ' c/ erro' : '', TEAL, MUTE],
      ];
      const gap = 8, cardW = (CW - 3 * gap) / 4, cardH = 54;
      ensure(cardH * 2 + gap + 4);
      kpis.forEach((k, i) => {
        const col = i % 4, row = Math.floor(i / 4);
        const x = M + col * (cardW + gap), cy = y + row * (cardH + gap);
        doc.roundedRect(x, cy, cardW, cardH, 7).fill('#f7faf9');
        doc.roundedRect(x, cy, cardW, cardH, 7).lineWidth(0.6).strokeColor(LINE).stroke();
        doc.fillColor(MUTE).font('Helvetica').fontSize(6.6).text(k[0].toUpperCase(), x + 8, cy + 7, { width: cardW - 16 });
        doc.fillColor(k[3]).font('Helvetica-Bold').fontSize(14.5).text(k[1], x + 8, cy + 18, { width: cardW - 16, lineBreak: false });
        if (k[2]) doc.fillColor(k[4]).font('Helvetica-Bold').fontSize(7).text(k[2], x + 8, cy + 39, { width: cardW - 16 });
      });
      y += cardH * 2 + gap + 14;

      // Termómetro SLA
      h2('Cumprimento de SLA face à meta');
      y = termometroSla(doc, M, y + 6, CW, g.taxa_sla || 0, meta) + 2;
      par(`Dos ${i0(N.resolvidos)} pedidos resolvidos, ${i0(N.cumpridos)} ficaram dentro do prazo e ${i0(N.foraPrazo)} fora — `
        + `esforço executado sem valor de SLA reconhecido. Para tocar a meta de ${pct(meta)} bastavam `
        + `${N.precisaMeta} resolução(ões) no prazo: a distância é curta e cirúrgica, não estrutural.`);

      // Leitura de liderança
      callout(N.leitura, GOLD, CREAM, INK);

      // ===================== NARRATIVA =====================
      h1('1. A narrativa do desempenho');
      h2('1.1 O que reconhecer — e porquê');
      par(`Em plena duplicação de carga, ${N.prim} subiu o cumprimento e segurou a 1.ª resposta em ${horas(g.horas_resposta_media)}. `
        + `Esta combinação — mais volume, melhor serviço — é o indicador mais difícil de manter e o mais valioso de premiar. `
        + `A satisfação confirma a leitura (CSAT ${g.csat_media != null ? numpt(g.csat_media) + '/5' : '—'} em ${i0(g.csat_respostas)} respostas), e no comercial `
        + `${N.prim} não se limitou a despachar: converteu ${pct(g.taxa_conversao)} e elevou o ticket médio para ${eur(g.ticket_medio)}. `
        + `Isto é matéria para dar responsabilidade, não apenas elogio.`);
      bullets([
        `Resiliência sob carga: +${cmp.total_pct != null ? numpt(cmp.total_pct) : '—'}% de volume com SLA a subir ${cmp.taxa_sla_pp != null ? numpt(cmp.taxa_sla_pp) + ' pp' : ''}.`,
        `Rapidez na 1.ª resposta (${horas(g.horas_resposta_media)}) — o fator que mais condiciona a percepção do cliente.`,
        `Valor comercial: ${eur(g.receita)} de receita e ticket médio de ${eur(g.ticket_medio)}, acima da média de balcão.`,
      ]);
      par(`Há um detalhe que distingo como líder: a melhoria do SLA aconteceu enquanto o volume praticamente duplicava. `
        + `É fácil manter o serviço quando a carga é estável; mantê-lo a subir sob pressão crescente revela método e sangue-frio. `
        + (N.colectivo ? `Este é o tipo de desempenho que justifica investir neste serviço — mais capacidade nas janelas certas, melhores ferramentas e processo mais firme.` : `Este é o tipo de desempenho que justifica investir em ${N.prim} — dar-lhe mais autonomia, mais visibilidade e, no momento certo, mais equipa para liderar.`));

      h2('1.2 Onde está o travão — a favor da ' + (N.colectivo ? 'equipa' : 'pessoa'));
      par(`Há ${i0(N.violados)} pedidos vencidos por responder. Ao ritmo médio de ${numpt(N.ritmo)} resolvidos/dia do período, `
        + `representam cerca de ${N.backlogDias} dia(s) de backlog a absorver — é a origem imediata da erosão do SLA. `
        + `A causa não é transversal: a procura concentra-se ${N.picoDia ? `à ${DIAS[N.picoDia.dia]} (${N.shareDia}% do volume)` : 'em janelas específicas'}`
        + `${N.picoHora ? ` e na faixa das ${N.picoHora.hora}h` : ''}. Se o incumprimento se alinha com estes picos, é défice de `
        + `capacidade nessas janelas — resolve-se com escala e triagem, não com pressão sobre quem já está a dar o seu melhor.`);

      // ===================== CAUSA-RAIZ =====================
      doc.addPage(); y = M;
      h1('2. Análise de causa-raiz');
      h2('O canal é a alavanca isolada de maior impacto');
      if (N.pior && N.pior.taxa_sla != null) {
        par(`O canal ${ROTULO[N.pior.categoria_ticket] || N.pior.categoria_ticket} cumpre apenas ${pct(N.pior.taxa_sla)} `
          + `sobre ${Math.round((N.pior.total / N.volTotal) * 100)}% do volume, contra ${N.maisVol ? pct(N.maisVol.taxa_sla) : '—'} do canal de maior peso `
          + `(${N.maisVol ? ROTULO[N.maisVol.categoria_ticket] || N.maisVol.categoria_ticket : '—'}). `
          + `Com prazos acordados diferentes por canal, é aqui que cada hora ganha mais SLA. Decisão de gestão: reforçar a `
          + `capacidade neste canal ou renegociar o prazo acordado — manter ambos como estão é desenhar o incumprimento.`);
      }
      ensure(40 + cats.length * 28);
      const catItems = [...cats].sort((a, b) => (a.taxa_sla ?? 0) - (b.taxa_sla ?? 0)).map((c) => ({
        label: ROTULO[c.categoria_ticket] || c.categoria_ticket, value: c.taxa_sla || 0, color: corSla(c.taxa_sla), tag: pct(c.taxa_sla),
      }));
      catItems.push({ label: 'Global (operador)', value: g.taxa_sla || 0, color: NAVY, tag: pct(g.taxa_sla) });
      y = barrasH(doc, M, y + 4, CW, catItems, { max: 105, labelW: 150, target: meta, targetLabel: 'Meta ' + pct(meta), rowH: 18 });
      doc.fillColor(MUTE).font('Helvetica-Oblique').fontSize(7.6).text('Fig. 1 — Cumprimento por canal vs. meta. O canal abaixo da linha é a prioridade.', M, y); y += 16;

      h2('A concentração temporal explica o "quando"');
      par(`${N.picoDia ? `${DIAS[N.picoDia.dia]} concentra ${N.shareDia}% da procura` : 'A procura concentra-se em poucos dias'}`
        + `${N.picoHora ? ` e a hora de ponta é ${N.picoHora.hora}h` : ''}. Reforçar a escala exatamente nestas janelas tem mais retorno `
        + `do que distribuir capacidade por igual: ataca-se o pico onde o SLA quebra, sem inflacionar custo no resto da semana.`);
      const dsItems = (d.diaSemana || []).filter((x) => (x.recebidos || 0) > 0).sort((a, b) => a.dia - b.dia)
        .map((x) => ({ label: DIAS[x.dia], value: x.recebidos, color: (N.picoDia && x.dia === N.picoDia.dia) ? TEAL : '#9fb6c9', tag: String(x.recebidos) }));
      if (dsItems.length) {
        ensure(dsItems.length * 24 + 30);
        h2('Distribuição da procura por dia da semana');
        y = barrasH(doc, M, y + 2, CW, dsItems, { labelW: 120, rowH: 16, gap: 7 });
        doc.fillColor(MUTE).font('Helvetica-Oblique').fontSize(7.6).text('Fig. 4 — Pedidos recebidos por dia. O pico (a verde) é onde se deve reforçar a escala.', M, y); y += 16;
      }
      par(`Traduzido em gestão: não falta empenho, falta capacidade no instante certo. Reforçar uma pessoa de apoio `
        + `${N.picoDia ? `à ${DIAS[N.picoDia.dia]} de manhã` : 'nas janelas de pico'} resolve mais SLA do que qualquer apelo ao esforço individual — `
        + `e liberta ${N.prim} para o trabalho de maior valor, que é converter e fidelizar.`);

      // ===================== EVOLUÇÃO =====================
      const evo = (d.evolucao || []).filter((r) => (r.recebidos || 0) > 0);
      if (evo.length >= 2) {
        h1('3. Evolução do serviço no período');
        par(`A trajectória importa tanto como o valor final. O gráfico cruza o volume recebido (barras) com o cumprimento de `
          + `SLA (linha) ao longo do período: mostra se a melhoria é tendência sólida ou oscilação pontual, e em que momentos a `
          + `pressão de procura fez o serviço ceder.`);
        const fmtLabel = (p) => { const dt = new Date(p); return `${String(dt.getUTCDate()).padStart(2, '0')}/${String(dt.getUTCMonth() + 1).padStart(2, '0')}`; };
        const evoRows = evo.map((r) => ({ label: fmtLabel(r.periodo), volume: r.recebidos || 0, sla: (r.resolvidos > 0 ? Math.round((r.cumpridos / r.resolvidos) * 1000) / 10 : 0) }));
        ensure(172);
        y = evolucaoChart(doc, M, y + 4, CW, 150, evoRows, meta) + 2;
        doc.fillColor(MUTE).font('Helvetica-Oblique').fontSize(7.6).text('Fig. 5 — Volume recebido (barras) e cumprimento de SLA (linha) por período. Tracejado = meta.', M, y); y += 16;
        const primeira = evoRows[0].sla, ultima = evoRows[evoRows.length - 1].sla;
        const dlt = Math.round((ultima - primeira) * 10) / 10;
        par(`Leitura: o SLA ${dlt >= 0 ? 'subiu' : 'recuou'} ${numpt(Math.abs(dlt))} pp do início (${numpt(primeira)}%) ao fim (${numpt(ultima)}%) do período. `
          + `${dlt >= 0 ? 'A tendência é de consolidação — o desafio é torná-la estrutural, não deixá-la depender de semanas de menor procura.' : 'O recuo coincide com os picos de volume — confirma que o travão é de capacidade, não de competência.'}`);
      }

      // ===================== MATRIZ DE RISCO =====================
      const cliRisco = (d.clientes || []).filter((c) => (c.total || 0) > 0 && c.taxa_sla != null);
      if (cliRisco.length >= 3) {
        h1('4. Matriz de risco da carteira');
        par(`Cada conta posicionada por volume (eixo horizontal) e cumprimento de SLA (eixo vertical). O quadrante inferior-direito `
          + `— muito volume e SLA abaixo da meta — é o de maior risco: é onde um problema de serviço tem maior exposição de receita e `
          + `de relação, e por isso onde a atenção do líder rende mais.`);
        ensure(212);
        y = matrizRisco(doc, M, y + 4, CW, 190, cliRisco, meta) + 2;
        doc.fillColor(MUTE).font('Helvetica-Oblique').fontSize(7.6).text('Fig. 6 — Matriz volume × SLA. Zona sombreada = prioridade de protecção. Cor do ponto = nível de SLA.', M, y); y += 14;
        const volsC = cliRisco.map((c) => c.total).sort((a, b) => a - b);
        const medVolC = volsC.length ? (volsC.length % 2 ? volsC[(volsC.length - 1) / 2] : (volsC[volsC.length / 2 - 1] + volsC[volsC.length / 2]) / 2) : 0;
        const proteger = cliRisco.filter((c) => c.total >= medVolC && (c.taxa_sla || 0) < meta);
        h2('Leitura da matriz');
        par(`${proteger.length} de ${cliRisco.length} contas caem no quadrante de protecção prioritária \u2014 volume acima da mediana e SLA abaixo da meta${proteger.length ? ': ' + proteger.slice(0, 5).map((c) => (c.remetente.split('@')[1] || c.remetente).split('.')[0]).join(', ') : ''}. São as relações onde uma falha de serviço tem maior exposição de receita e de confiança; é aí que o acompanhamento do líder rende mais. As contas no canto superior-esquerdo (SLA alto, volume baixo) são âncoras estáveis e referências de método; o objectivo de gestão é puxar as do canto inferior-direito para cima \u2014 mais cumprimento sem perder as que já estão seguras.`);
      }

      // ===================== ANÁLISES DETALHADAS (1 página por entidade) =====================
      const tabelaSimples = (titulo, cols, linhas) => {
        doc.addPage(); y = M; h1(titulo);
        const totalW = cols.reduce((a, c) => a + c.w, 0);
        const head = () => { doc.rect(M, y, totalW, 16).fill('#eef2f7'); let xx = M; doc.fillColor(INDIGO).font('Helvetica-Bold').fontSize(8); cols.forEach((c) => { doc.text(c.t, xx + 5, y + 4, { width: c.w - 8, align: c.a || 'left' }); xx += c.w; }); y += 16; };
        head();
        linhas.forEach((ln, idx) => { if (y + 15 > bottom) { doc.addPage(); y = M; head(); } if (idx % 2 === 1) doc.rect(M, y, totalW, 15).fill('#f6f8fa'); let xx = M; doc.font('Helvetica').fontSize(8.2); cols.forEach((c, ci) => { doc.fillColor(ci === 0 ? INK : SLATE).text(ln[ci] == null ? '—' : String(ln[ci]), xx + 5, y + 3.5, { width: c.w - 8, align: c.a || 'left' }); xx += c.w; }); doc.moveTo(M, y + 15).lineTo(M + totalW, y + 15).strokeColor(LINE).lineWidth(0.5).stroke(); y += 15; });
        y += 8;
      };

      // ---------- INDICADORES, BENCHMARKS E METODOLOGIA DE SLA ----------
      doc.addPage(); y = M;
      h1('Indicadores, benchmarks e metodologia de SLA');
      h2('Como ler este balanço');
      par('Este balanço mede o serviço prestado pela óptica do SLA — o cumprimento do prazo acordado com o cliente — e usa os indicadores comerciais (receita, conversão, ticket) apenas como contexto do valor de negócio em jogo. A análise está organizada em três níveis: panorama global, análise por ponto (causa-raiz, temporal, evolução, risco) e fichas individuais (uma por operador, por canal e por cliente estratégico). Cada ficha responde às mesmas perguntas de gestão: o que aconteceu, porque aconteceu, o que está bem, o que corrigir e que decisão tomar.');
      h2('Indicadores e referências');
      par(`Cumprimento de SLA actual: ${pct(g.taxa_sla)} (meta ${pct(meta)}). 1.ª resposta média: ${horas(g.horas_resposta_media)}. Resolução em horas úteis: ${horas(g.horas_uteis_resolucao_media)}. Pedidos vencidos por tratar: ${i0(N.violados)}. Satisfação (CSAT): ${g.csat_media != null ? numpt(g.csat_media) + '/5' : '—'}. A meta de ${pct(meta)} é o limiar de serviço acordado; entre 85% e 95% o cumprimento considera-se a vigiar, abaixo de 85% em risco.`);
      h2('Metodologia e critérios');
      par('O tempo de resolução é medido em horas úteis (Seg–Sex, 09h30–19h00, feriados nacionais excluídos); a 1.ª resposta em relógio de parede. O cumprimento de SLA é a percentagem de pedidos resolvidos dentro do prazo do respectivo canal. A classificação de operadores cruza cumprimento de SLA, escala (volume e quota) e qualidade de serviço (1.ª resposta), e distingue cinco perfis: Top Performer (≥ meta), Performer Sólido (≥ média da equipa), Em Desenvolvimento (até 8 pp abaixo da média), Em Alerta (abaixo) e Não Comparável (sem volume atribuído — função a validar). As conclusões são instrumento de apoio à decisão e não dispensam o juízo qualitativo da gestão.')


      const ops = (d.operadores || []).filter((o) => o);
      const mediaSlaEq = ops.length ? ops.reduce((s, o) => s + (o.taxa_sla || 0), 0) / ops.length : meta;
      const totalEq = g.total || ops.reduce((s, o) => s + (o.total || 0), 0) || 1;
      const classificar = (o) => {
        if (!o.total) return { cls: 'Não Comparável / Dados Insuficientes', cor: MUTE, tag: '#cbd5e1' };
        const sla = o.taxa_sla || 0;
        if (sla >= meta) return { cls: 'Top Performer', cor: EMER, tag: '#86efac' };
        if (sla >= mediaSlaEq) return { cls: 'Performer Sólido', cor: TEAL, tag: '#99f6e4' };
        if (sla >= mediaSlaEq - 8) return { cls: 'Em Desenvolvimento', cor: AMBER, tag: '#fcd34d' };
        return { cls: 'Em Alerta', cor: ROSE, tag: '#fda4af' };
      };
      const kpiRow = (items) => {
        const gp = 8, cw = (CW - (items.length - 1) * gp) / items.length, ch = 48;
        ensure(ch + 8);
        items.forEach((k, i) => { const xx = M + i * (cw + gp); doc.roundedRect(xx, y, cw, ch, 6).fill('#f4f7f9'); doc.fillColor(MUTE).font('Helvetica').fontSize(6.4).text(String(k[0]).toUpperCase(), xx + 7, y + 7, { width: cw - 12 }); doc.fillColor(k[2] || INK).font('Helvetica-Bold').fontSize(13).text(k[1], xx + 7, y + 20, { width: cw - 12, lineBreak: false }); });
        y += ch + 10;
      };
      const banda = (txt, tag, tagCor) => {
        ensure(32); doc.roundedRect(M, y, CW, 26, 6).fill(NAVY);
        doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(11.5).text(txt, M + 12, y + 7.5, { width: CW - 150, height: 14, lineBreak: false, ellipsis: true });
        if (tag) doc.fillColor(tagCor || '#9fb6c9').font('Helvetica-Bold').fontSize(9).text(tag, M + CW - 158, y + 9, { width: 146, align: 'right' });
        y += 32;
      };

      // ---------- ANÁLISE POR OPERADOR (1 página cada) ----------
      if (ops.length) {
        doc.addPage(); y = M;
        h1('Análise por operador');
        par(`Uma página por operador, na óptica de SLA — o financeiro entra apenas como contexto. Para cada um: leitura executiva do serviço, o que reconhecer, o que corrigir, a classificação de gestão (Top Performer · Performer Sólido · Em Desenvolvimento · Em Alerta · Não Comparável) e o plano individual. A média de cumprimento da equipa é ${pct(Math.round(mediaSlaEq * 10) / 10)}; a meta é ${pct(meta)}.`);
        const opCh = [...ops].sort((a, b) => (a.taxa_sla || 0) - (b.taxa_sla || 0)).map((o) => ({ label: o.nome, value: o.taxa_sla || 0, color: corSla(o.taxa_sla), tag: pct(o.taxa_sla) }));
        ensure(opCh.length * 21 + 24);
        h2('Cumprimento de SLA por operador (ordenado)');
        y = barrasH(doc, M, y + 2, CW, opCh, { max: 105, labelW: 130, target: meta, targetLabel: 'Meta ' + pct(meta), rowH: 14, gap: 6 });
        const slaVals = ops.map((o) => o.taxa_sla || 0);
        const melhorEq = Math.max(...slaVals), piorEq = Math.min(...slaVals);
        const acimaMeta = ops.filter((o) => (o.taxa_sla || 0) >= meta).length;
        const acimaMedia = ops.filter((o) => (o.taxa_sla || 0) >= mediaSlaEq).length;
        const top3o = [...ops].sort((a, b) => (b.total || 0) - (a.total || 0)).slice(0, 3);
        const top3ShareO = Math.round(top3o.reduce((s, o) => s + (o.total || 0), 0) / totalEq * 1000) / 10;
        y += 6;
        h2('Leitura do ranking');
        par(`O cumprimento de SLA da equipa vai de ${pct(piorEq)} (o mais baixo) a ${pct(melhorEq)} (o mais alto) \u2014 uma amplitude de ${numpt(Math.round((melhorEq - piorEq) * 10) / 10)} pp entre operadores. Apenas ${acimaMeta} de ${ops.length} estão na meta de ${pct(meta)} e ${acimaMedia} acima da média da equipa (${pct(Math.round(mediaSlaEq * 10) / 10)}). Esta dispersão é, em si, uma oportunidade: aproximar a metade inferior da média move o SLA global vários pontos sem depender de contratar \u2014 depende de método e de capacidade nas janelas certas.`);
        h2('Concentração da produção');
        par(`Os três operadores de maior volume concentram ${pct(top3ShareO)} dos pedidos do departamento. É eficiência, mas também risco de ruptura: a ausência prolongada de um deles teria impacto material no serviço. A leitura de gestão é reduzir a dependência \u2014 documentar método, partilhar carteira e desenvolver os perfis intermédios \u2014 em paralelo com a subida do cumprimento.`);
        h2('Como ler as fichas seguintes');
        par('Cada operador tem duas páginas: a primeira com a leitura executiva do serviço, o que reconhecer e corrigir, a classificação de gestão, o plano individual e o impacto no SLA global; a segunda com o posicionamento face à meta, à média e ao melhor da equipa, a dependência e sucessão, os sinais a vigiar e o plano de acompanhamento 30/60/90 dias. O financeiro (conversão) aparece apenas como contexto do valor associado ao serviço.');
        [...ops].sort((a, b) => (b.total || 0) - (a.total || 0)).forEach((o) => {
          doc.addPage(); y = M;
          const cl = classificar(o);
          banda('Operador · ' + o.nome, cl.cls.toUpperCase(), cl.tag);
          const quota = totalEq ? Math.round((o.total / totalEq) * 1000) / 10 : null;
          const dlt = o.taxa_sla != null ? Math.round((o.taxa_sla - mediaSlaEq) * 10) / 10 : null;
          kpiRow([['Volume', i0(o.total), INK], ['Cumprimento SLA', pct(o.taxa_sla), corSla(o.taxa_sla)], ['1.ª resposta', horas(o.horas_resposta_media), TEAL], ['Conversão', pct(o.taxa_conversao), INDIGO], ['Quota no dept.', quota != null ? pct(quota) : '—', INK]]);
          h2('Cumprimento de SLA face à meta');
          y = termometroSla(doc, M, y + 8, CW, o.taxa_sla || 0, meta) + 2;
          h2('Leitura executiva');
          if (!o.total) {
            par(`${o.nome} não regista pedidos atribuídos no período, pelo que não é comparável em serviço. Antes de qualquer leitura de desempenho, há que validar a sua função real (back-office, qualidade, apoio) e a atribuição de pedidos na origem dos dados — tratá-lo como operador em incumprimento seria um erro de diagnóstico.`);
          } else {
            par(`${o.nome} processou ${i0(o.total)} pedidos (${quota != null ? pct(quota) : '—'} do total) com um cumprimento de SLA de ${pct(o.taxa_sla)} — ${dlt >= 0 ? '+' : ''}${numpt(dlt)} pp face à média da equipa (${pct(Math.round(mediaSlaEq * 10) / 10)}) e ${o.taxa_sla >= meta ? 'já dentro' : 'ainda ' + numpt(Math.round((meta - o.taxa_sla) * 10) / 10) + ' pp abaixo'} da meta de ${pct(meta)}. A 1.ª resposta média é de ${horas(o.horas_resposta_media)}, o factor que mais condiciona a percepção do cliente, e a conversão comercial fixa-se em ${pct(o.taxa_conversao)}. A leitura de liderança cruza estes três eixos: capacidade de absorver volume, pontualidade de serviço e valor comercial gerado.`);
          }
          if (o.total) {
            h2('O que reconhecer');
            bullets([
              `${o.taxa_sla >= mediaSlaEq ? 'Cumprimento acima da média da equipa' : 'Contributo de volume relevante'} — ${pct(o.taxa_sla)} de SLA sobre ${i0(o.total)} pedidos.`,
              `1.ª resposta em ${horas(o.horas_resposta_media)}${o.horas_resposta_media != null && o.horas_resposta_media <= 2 ? ' — rápida, protege a percepção do cliente.' : ' — margem para acelerar a primeira resposta.'}`,
              `Conversão comercial de ${pct(o.taxa_conversao)} — valor de negócio associado ao serviço prestado.`,
            ]);
            h2('O que corrigir');
            bullets([
              `${o.taxa_sla < meta ? 'Fechar a distância de ' + numpt(Math.round((meta - o.taxa_sla) * 10) / 10) + ' pp para a meta de ' + pct(meta) + ', priorizando os pedidos mais próximos do prazo.' : 'Sustentar o cumprimento acima da meta, evitando regressão sob picos de carga.'}`,
              `${o.horas_resposta_media != null && o.horas_resposta_media > 2 ? 'Reduzir a 1.ª resposta — é a alavanca mais rápida de percepção e de SLA.' : 'Manter a triagem rápida nas janelas de pico.'}`,
              `Equilibrar produtividade e qualidade: volume sem cumprimento é esforço sem valor de serviço reconhecido.`,
            ]);
            h2('Classificação e justificação');
            par(`Classificação de gestão: ${cl.cls}. Justifica-se pelo cruzamento de cumprimento de SLA (${pct(o.taxa_sla)} vs média ${pct(Math.round(mediaSlaEq * 10) / 10)} e meta ${pct(meta)}), escala (${i0(o.total)} pedidos, ${quota != null ? pct(quota) : '—'} do departamento) e qualidade de serviço (1.ª resposta ${horas(o.horas_resposta_media)}). ${cl.cls === 'Top Performer' ? 'Perfil de referência — reter e usar para transferir método à equipa.' : cl.cls === 'Performer Sólido' ? 'Base fiável — pequenos ganhos de pontualidade elevam-no à excelência.' : cl.cls === 'Em Desenvolvimento' ? 'Potencial claro — alvo prioritário de acompanhamento e método.' : 'Necessita de plano de recuperação próximo com metas semanais.'}`);
            h2('Plano individual');
            const plOp = [
              ['Priorizar os pedidos perto do prazo', `Antes de novas entradas, despachar por ordem de proximidade do limite de SLA — é o ganho de cumprimento mais imediato.`],
              [o.horas_resposta_media != null && o.horas_resposta_media > 2 ? 'Acelerar a 1.ª resposta' : 'Blindar as janelas de pico', `Reservar foco nos momentos de maior procura; o líder garante a escala, ${o.nome.split(' ')[0]} garante a triagem rápida.`],
              ['Acompanhamento e método', `Revisão ${o.taxa_sla >= meta ? 'mensal' : 'quinzenal'} de cumprimento, partilha de boas práticas e metas claras de SLA e 1.ª resposta.`],
            ];
            plOp.forEach((p, i) => {
              doc.font('Helvetica').fontSize(9.3);
              const ch = doc.heightOfString(p[1], { width: CW - 30, lineGap: 1.2 }); ensure(ch + 16);
              doc.circle(M + 8, y + 8, 8).fill(TEAL); doc.fillColor('#fff').font('Helvetica-Bold').fontSize(8.5).text(String(i + 1), M + 4.8, y + 4, { width: 7, align: 'center' });
              doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(9.6).text(p[0], M + 26, y, { width: CW - 30 });
              doc.fillColor(SLATE).font('Helvetica').fontSize(9.3).text(p[1], M + 26, y + 12, { width: CW - 30, lineGap: 1.2 });
              y += ch + 16;
            });
            h2('Impacto no SLA global e leitura comparativa');
            const gapMeta = Math.max(0, Math.round((meta - (o.taxa_sla || 0)) * 10) / 10);
            const contrib = Math.round((gapMeta * (quota || 0) / 100) * 10) / 10;
            const rank = [...ops].sort((a, b) => (b.taxa_sla || 0) - (a.taxa_sla || 0)).findIndex((x) => x === o) + 1;
            par(`No ranking de cumprimento, ${o.nome.split(' ')[0]} ocupa a ${rank}.ª posição entre ${ops.length}. Faltam ${numpt(gapMeta)} pp para a meta de ${pct(meta)}; como pesa ${quota != null ? pct(quota) : '\u2014'} do volume, fechar essa distância acrescenta cerca de ${numpt(contrib)} pp ao SLA do departamento \u2014 uma das contribuições mais directas para o resultado global. ${(o.taxa_sla || 0) >= mediaSlaEq ? 'Estando acima da média, é candidato a transferir método aos pares.' : 'Estando abaixo da média, é onde o acompanhamento tem maior retorno marginal.'}`);
            bullets([
              `Distância à meta: ${numpt(gapMeta)} pp \u00b7 contribuição potencial para o SLA global: ~${numpt(contrib)} pp.`,
              `Posição no ranking de serviço: ${rank}.ª de ${ops.length} \u00b7 1.ª resposta ${horas(o.horas_resposta_media)} \u00b7 conversão ${pct(o.taxa_conversao)}.`,
              `Quota de volume: ${quota != null ? pct(quota) : '\u2014'} \u2014 ${quota != null && quota >= 20 ? 'concentração a vigiar (sucessão).' : 'peso equilibrado.'}`,
            ]);
          }
          callout((o.total ? 'Decisão recomendada. ' + (cl.cls === 'Top Performer' ? 'Reter e dar visibilidade; usar como referência interna de pricing/serviço.' : cl.cls === 'Em Alerta' ? 'Abrir plano de recuperação a 90 dias com metas semanais e revisão próxima da Direcção.' : 'Acompanhamento ' + (o.taxa_sla >= meta ? 'mensal' : 'quinzenal') + ' com metas de SLA e 1.ª resposta; desenvolver carteira conforme evolução.') : 'Decisão recomendada. Validar a função real desta posição e a atribuição de pedidos antes de qualquer consequência de gestão.'), o.total ? TEAL : GOLD, o.total ? MINT : CREAM, INK);
          if (o.total) {
            ensure(46);
            banda(o.nome + ' · acompanhamento', cl.cls.toUpperCase(), cl.tag);
            h2('Posição face à meta, à média e ao melhor da equipa');
            const melhor = Math.max(...ops.map((x) => x.taxa_sla || 0));
            ensure(3 * 24 + 24);
            y = barrasH(doc, M, y + 4, CW, [
              { label: o.nome, value: o.taxa_sla || 0, color: corSla(o.taxa_sla), tag: pct(o.taxa_sla) },
              { label: 'Média da equipa', value: Math.round(mediaSlaEq * 10) / 10, color: NAVY, tag: pct(Math.round(mediaSlaEq * 10) / 10) },
              { label: 'Melhor da equipa', value: melhor, color: EMER, tag: pct(melhor) },
            ], { max: 105, labelW: 130, target: meta, targetLabel: 'Meta ' + pct(meta), rowH: 16, gap: 9 });
            h2('Dependência e sucessão');
            par(`${o.nome} representa ${quota != null ? pct(quota) : '—'} do volume do departamento. ${quota != null && quota >= 20 ? 'É uma concentração de produção relevante: uma ausência prolongada teria impacto material no serviço. A mitigação é reduzir a dependência — documentar método, partilhar carteira e preparar redundância — sem penalizar o desempenho.' : 'O peso é moderado, o que reduz o risco de ruptura por ausência; o foco deve ser elevar o cumprimento sem aumentar a dependência.'}`);
            h2('Plano de acompanhamento 30 / 60 / 90 dias');
            [['30 dias', `Estabilizar o cumprimento e atacar os pedidos próximos do prazo; reduzir a 1.ª resposta onde aplicável.`], ['60 dias', 'Consolidar a triagem nas janelas de pico e rever a carteira atribuída conforme a evolução.'], ['90 dias', `${o.taxa_sla >= meta ? 'Assumir papel de referência, transferindo método aos pares.' : 'Atingir a meta de ' + pct(meta) + ' de forma sustentada, com revisão de progresso.'}`]].forEach((p) => {
              doc.font('Helvetica').fontSize(9.3); const chh = doc.heightOfString(p[1], { width: CW - 70, lineGap: 1.2 }); ensure(Math.max(20, chh + 8));
              doc.roundedRect(M, y, 58, 16, 4).fill(TEAL); doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(8).text(p[0], M, y + 4, { width: 58, align: 'center' });
              doc.fillColor(SLATE).font('Helvetica').fontSize(9.3).text(p[1], M + 66, y, { width: CW - 70, lineGap: 1.2 }); y += Math.max(18, chh + 6);
            });
            h2('Sinais a vigiar');
            bullets([
              'Regressão do cumprimento sob picos de carga \u2014 sinal de capacidade, não de empenho.',
              'Subida da 1.ª resposta acima de 2 h \u2014 primeiro sintoma de sobrecarga.',
              'Concentração da carteira em poucas contas \u2014 risco de exposição em caso de ausência.',
            ]);
            h2('O que o sucesso parece em 90 dias');
            par(`${(o.taxa_sla || 0) >= meta ? 'Cumprimento sustentado na meta sob carga variável, com ' + o.nome.split(' ')[0] + ' como referência interna de método.' : 'Cumprimento a convergir para a meta de ' + pct(meta) + ', 1.ª resposta estável abaixo de 2 h e menor dispersão face à média da equipa.'} O critério é claro: mais cumprimento sem mais dependência \u2014 o serviço melhora e o risco de ruptura diminui.`);
            callout('Decisão recomendada. Acompanhamento ' + (o.taxa_sla >= meta ? 'mensal' : 'quinzenal') + ' com metas explícitas de SLA e 1.ª resposta, e revisão do plano 30/60/90 no fim de cada ciclo.', TEAL, MINT, INK);
          }
        });
      }

      // ---------- ANÁLISE POR CANAL (1 página cada) ----------
      if (cats.length) {
        doc.addPage(); y = M;
        h1('Análise por canal');
        par('Uma página por canal. Cada canal tem um prazo acordado e um comportamento próprio; a margem de SLA ganha-se onde cada hora de resolução vale mais. Para cada um: leitura, causa e decisão.');
        [...cats].sort((a, b) => (a.taxa_sla ?? 0) - (b.taxa_sla ?? 0)).forEach((c) => {
          doc.addPage(); y = M;
          const rot = ROTULO[c.categoria_ticket] || c.categoria_ticket;
          const share = Math.round((c.total / (g.total || cats.reduce((s, x) => s + x.total, 0) || 1)) * 1000) / 10;
          banda('Canal · ' + rot, pct(c.taxa_sla), corSla(c.taxa_sla) === EMER ? '#86efac' : corSla(c.taxa_sla) === AMBER ? '#fcd34d' : '#fda4af');
          kpiRow([['Volume', i0(c.total), INK], ['% do total', pct(share), INK], ['Cumprimento SLA', pct(c.taxa_sla), corSla(c.taxa_sla)], ['SLA acordado', c.sla_minutos != null ? numpt(c.sla_minutos / 60) + ' h' : '—', TEAL], ['Resolução (úteis)', horas(c.horas_uteis_resolucao_media), INK]]);
          h2('Cumprimento de SLA face à meta');
          y = termometroSla(doc, M, y + 8, CW, c.taxa_sla || 0, meta) + 2;
          h2('Leitura executiva');
          par(`O canal ${rot} representa ${pct(share)} do volume (${i0(c.total)} pedidos) e cumpre ${pct(c.taxa_sla)} de SLA, com resolução média de ${horas(c.horas_uteis_resolucao_media)} em horas úteis face a um prazo acordado de ${c.sla_minutos != null ? numpt(c.sla_minutos / 60) + ' h' : '—'}. ${c.taxa_sla < meta ? 'Está abaixo da meta de ' + pct(meta) + ', e com este peso no volume é uma das alavancas de maior impacto no SLA global.' : 'Está em linha/acima da meta — um ponto forte a preservar.'}`);
          h2('Causa e interpretação');
          par(`${c.taxa_sla < mediaSlaEq ? 'Cumprimento abaixo da média dos canais' : 'Cumprimento acima da média dos canais'}. Onde o prazo acordado é mais curto, cada hora de atraso custa mais SLA; onde o volume é maior, o mesmo desvio percentual representa mais pedidos fora de prazo. A decisão de gestão é reforçar capacidade neste canal nas janelas de pico ou renegociar o prazo acordado — manter ambos como estão é desenhar o incumprimento.`);
          h2('Impacto no SLA global');
          const gapC = Math.max(0, Math.round((meta - (c.taxa_sla || 0)) * 10) / 10);
          const contribC = Math.round((gapC * share / 100) * 10) / 10;
          par(`Com ${pct(share)} do volume e ${numpt(gapC)} pp de distância à meta, este canal contribui com cerca de ${numpt(contribC)} pp para o défice de SLA do departamento. ${c.taxa_sla < meta ? 'É, por isso, uma das alavancas isoladas de maior impacto: cada hora de resolução ganha aqui rende mais cumprimento do que no resto do mix.' : 'Está em linha com a meta e ajuda a compensar os canais mais frágeis.'} A resolução média (${horas(c.horas_uteis_resolucao_media)}) face ao prazo acordado (${c.sla_minutos != null ? numpt(c.sla_minutos / 60) + ' h' : '\u2014'}) revela a folga ou o aperto operacional.`);
          h2('Passos de execução');
          bullets([
            `${c.taxa_sla < meta ? 'Reforçar capacidade dedicada nas horas de ponta deste canal.' : 'Manter o nível e libertar folga para canais mais frágeis.'}`,
            'Rever o prazo acordado se a resolução média estiver estruturalmente acima dele.',
            'Monitorizar o cumprimento do canal semanalmente, com responsável atribuído.',
          ]);
          callout('Decisão recomendada. ' + (c.taxa_sla < meta ? 'Reforçar capacidade dedicada a ' + rot + ' nas horas de ponta e/ou rever o prazo acordado; KPI: cumprimento do canal, semanal.' : 'Manter o nível e usar a folga de cumprimento para absorver picos de outros canais.'), c.taxa_sla < meta ? GOLD : TEAL, c.taxa_sla < meta ? CREAM : MINT, INK);
        });
      }

      // ---------- ANÁLISE POR CLIENTE ESTRATÉGICO (1 página cada) ----------
      const cliTop = [...(d.clientes || [])].filter((c) => (c.total || 0) > 0).sort((a, b) => (b.total || 0) - (a.total || 0)).slice(0, 18);
      if (cliTop.length) {
        doc.addPage(); y = M;
        h1('Análise por cliente estratégico');
        par('Uma página por conta de maior peso. A leitura lidera pelo serviço (cumprimento de SLA e volume), com a receita como contexto do valor em jogo. Para cada uma: estado, leitura e decisão de protecção.');
        cliTop.forEach((c) => {
          doc.addPage(); y = M;
          const slaC = c.taxa_sla;
          const estado = slaC == null ? '—' : slaC < 90 ? 'PROTEGER' : slaC >= 95 ? 'SÓLIDA' : 'VIGIAR';
          banda('Cliente · ' + c.remetente, estado, slaC != null && slaC < 90 ? '#fda4af' : slaC >= 95 ? '#86efac' : '#fcd34d');
          kpiRow([['Pedidos', i0(c.total), INK], ['Cumprimento SLA', pct(slaC), corSla(slaC)], ['Receita (contexto)', eur(c.receita), EMER]]);
          h2('Cumprimento de SLA face à meta');
          y = termometroSla(doc, M, y + 8, CW, slaC || 0, meta) + 2;
          h2('Leitura executiva');
          par(`A conta ${c.remetente} gerou ${i0(c.total)} pedidos no período com um cumprimento de SLA de ${pct(slaC)}. ${slaC != null && slaC < 90 ? 'Está abaixo de 90% — uma falha repetida de serviço numa conta deste peso é, antes de tudo, um risco de relação, não um problema comercial.' : slaC >= 95 ? 'Está acima da meta — relação sólida e candidata natural a aprofundamento.' : 'Está em zona de vigilância — um pequeno reforço de pontualidade move-a para terreno seguro.'} A receita associada (${eur(c.receita)}) é o contexto do valor em jogo, não o foco da leitura.`);
          h2('Risco e valor em jogo');
          par(`Esta conta gerou ${i0(c.total)} pedidos e ${eur(c.receita)} de receita associada. ${slaC != null && slaC < 90 ? 'Com cumprimento abaixo de 90%, o risco é de relação: a repetição de falhas de serviço numa conta deste peso pode custar a renovação, independentemente do valor comercial. Proteger o serviço é, aqui, proteger receita.' : slaC >= 95 ? 'Com cumprimento acima da meta, é uma relação madura \u2014 o valor em jogo recomenda aprofundar, não defender.' : 'Em zona de vigilância, o valor em jogo justifica estabilizar o serviço antes de qualquer esforço de expansão.'}`);
          h2('Plano de protecção');
          bullets([
            `${slaC != null && slaC < 90 ? 'Prioridade de fila para os pedidos desta conta nas próximas semanas.' : 'Manter o nível de serviço e o ponto de contacto dedicado.'}`,
            'Rever a causa-raiz dos incumprimentos recentes (canal, tipo de pedido, janela horária).',
            'Contacto proactivo do líder para reforçar a relação e antecipar necessidades.',
          ]);
          h2('Decisão de protecção');
          callout('Decisão recomendada. ' + (slaC != null && slaC < 90 ? 'Prioridade de fila para esta conta e contacto proactivo do líder; rever causa-raiz dos incumprimentos antes que afecte a relação.' : slaC >= 95 ? 'Usar como referência e procurar expandir, sem risco reputacional.' : 'Estabilizar o serviço antes de empurrar volume; acompanhamento próximo do cumprimento.'), slaC != null && slaC < 90 ? GOLD : TEAL, slaC != null && slaC < 90 ? CREAM : MINT, INK);
        });
      }

      // ---------- APÊNDICE · TABELAS COMPLETAS ----------
      if (ops.length) tabelaSimples('Apêndice · operadores (serviço)',
        [{ t: 'Operador', w: CW - 4 * 75 }, { t: 'Volume', w: 75, a: 'right' }, { t: 'SLA', w: 75, a: 'right' }, { t: '1.ª resp.', w: 75, a: 'right' }, { t: 'Conversão', w: 75, a: 'right' }],
        [...ops].sort((a, b) => (b.total || 0) - (a.total || 0)).map((o) => [o.nome, i0(o.total), pct(o.taxa_sla), horas(o.horas_resposta_media), pct(o.taxa_conversao)]));
      if (cats.length) tabelaSimples('Apêndice · canais (SLA vs acordado)',
        [{ t: 'Canal', w: CW - 3 * 90 }, { t: 'Volume', w: 90, a: 'right' }, { t: 'SLA acordado', w: 90, a: 'right' }, { t: 'Cumprimento', w: 90, a: 'right' }],
        [...cats].sort((a, b) => (a.taxa_sla ?? 0) - (b.taxa_sla ?? 0)).map((c) => [ROTULO[c.categoria_ticket] || c.categoria_ticket, i0(c.total), c.sla_minutos != null ? numpt(c.sla_minutos / 60) + ' h' : '—', pct(c.taxa_sla)]));
      if ((d.clientes || []).length) tabelaSimples('Apêndice · clientes (serviço; receita como contexto)',
        [{ t: 'Cliente', w: CW - 3 * 85 }, { t: 'Pedidos', w: 85, a: 'right' }, { t: 'Cumprimento SLA', w: 85, a: 'right' }, { t: 'Receita', w: 85, a: 'right' }],
        [...(d.clientes || [])].sort((a, b) => (b.total || 0) - (a.total || 0)).slice(0, 30).map((c) => [c.remetente, i0(c.total), pct(c.taxa_sla), eur(c.receita)]));

      // ===================== PLANO =====================
      doc.addPage(); y = M;
      h1('5. Plano de desenvolvimento' + (N.colectivo ? ' da equipa' : ' individual'));
      par(`Para ${N.prim} — compromissos para o próximo ciclo, do mais urgente ao mais estrutural. A ordem é deliberada: `
        + `primeiro estancar a hemorragia (backlog), depois prevenir (capacidade nos picos), por fim crescer (mentoria).`);
      const plano = [
        ['Limpar o backlog vencido primeiro', `Antes de novas entradas, despachar os ${i0(N.violados)} vencidos por ordem de atraso. É a origem imediata da erosão do SLA — cerca de ${N.backlogDias} dia(s) de trabalho que valem pontos de cumprimento imediatos.`],
        [`Blindar ${N.picoDia ? DIAS[N.picoDia.dia] : 'os picos'}${N.picoHora ? ' e as ' + N.picoHora.hora + 'h' : ''}`, `Reservar capacidade nas janelas de pico (${N.shareDia}% do volume). O líder garante a escala; ${N.prim} garante a triagem rápida nesses momentos. Atacar o pico, não a média.`],
        ['Dupla verificação nas emissões de valor', `Precisão de ${pct(N.g.precisao_emissao)} (${i0(N.erros)} erros em ${i0(N.emit)} emissões). Instituir segunda conferência nos bilhetes de maior valor, onde o custo de um erro — reemissão e risco de reclamação — é mais alto.`],
        [`${N.colectivo ? 'Especializar uma referência no canal ' : 'Passar a mentora do canal '}${N.pior ? ROTULO[N.pior.categoria_ticket] || N.pior.categoria_ticket : 'crítico'}`, `Reconhecimento com responsabilidade: usar a conversão e o ticket médio acima da média ${N.deX} para elevar o canal mais frágil da equipa, transferindo método e não apenas carga.`],
      ];
      plano.forEach((p, i) => {
        doc.font('Helvetica').fontSize(9.3);
        const corpoH = doc.heightOfString(p[1], { width: CW - 32, lineGap: 1.3 });
        const blocoH = corpoH + 16;
        ensure(blocoH);
        doc.circle(M + 9, y + 9, 9).fill(TEAL);
        doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(9).text(String(i + 1), M + 5.5, y + 4.5, { width: 8, align: 'center' });
        doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(9.8).text(p[0], M + 28, y, { width: CW - 32 });
        doc.fillColor(SLATE).font('Helvetica').fontSize(9.3).text(p[1], M + 28, y + 13, { width: CW - 32, lineGap: 1.3 });
        y += blocoH + 4;
        doc.moveTo(M + 28, y - 2).lineTo(M + CW, y - 2).strokeColor(LINE).lineWidth(0.5).stroke();
      });
      y += 6;
      callout('Compromisso do líder. Eu trato da escala nos picos, da renegociação do prazo do canal crítico e das chamadas às '
        + 'contas em risco. ' + (N.colectivo ? 'À equipa' : 'A ' + N.prim) + ' cabe o que já faz bem — responder depressa e converter — agora com o caminho desimpedido. '
        + 'É assim que se tira o melhor das pessoas: removendo obstáculos, não somando exigências.', TEAL, MINT, INK);

      // ===================== SÍNTESE =====================
      doc.addPage(); y = M;
      h1('6. Síntese e foco para os próximos 30 dias');
      par(`Em síntese, ${N.prim} fecha o período ${N.colectivo ? 'com o serviço em ascensão' : 'como uma operadora em ascensão'}: dobrou o volume, melhorou o cumprimento `
        + `para ${pct(g.taxa_sla)}, manteve a 1.ª resposta em ${horas(g.horas_resposta_media)} e gerou ${eur(g.receita)} de receita com `
        + `satisfação de ${g.csat_media != null ? numpt(g.csat_media) + '/5' : '—'}. O que separa este desempenho de um desempenho de excelência `
        + `não é mais esforço — é remover dois atritos concretos: o backlog de ${i0(N.violados)} vencidos e a fragilidade do canal `
        + `${N.pior ? ROTULO[N.pior.categoria_ticket] || N.pior.categoria_ticket : 'crítico'}.`);
      par(`Projeção a 30 dias, se os dois atritos forem resolvidos: ao ritmo actual de ${numpt(N.ritmo)} resoluções/dia, o backlog `
        + `é absorvível em cerca de ${N.backlogDias} dia(s); com o canal crítico a convergir para a meta, o SLA global aproxima-se de `
        + `${pct(N.meta)} sem necessidade de aumentar a carga individual. O retorno é duplo: cumprimento contratual e protecção das `
        + `contas que pesam ${N.top3Share}% da receita.`);
      const recap = `Foco do líder para o próximo ciclo, por esta ordem: (1) limpar o backlog vencido; (2) reforçar a escala `
        + `${N.picoDia ? 'à ' + DIAS[N.picoDia.dia] : 'nos picos'}; (3) renegociar ou reforçar o canal `
        + `${N.pior ? ROTULO[N.pior.categoria_ticket] || N.pior.categoria_ticket : 'crítico'}; (4) proteger as contas em risco com contacto directo. `
        + `Métrica de sucesso: SLA global \u2265 ${pct(N.meta)} e zero contas estratégicas abaixo de 90%.`;
      callout(recap, GOLD, CREAM, INK);

      // ===================== DADOS DE APOIO =====================
      h1('Dados de apoio · impacto comercial e financeiro');
      par('As secções seguintes são de apoio: a carteira, a receita por cliente e as fichas comerciais quantificam o valor de negócio associado ao serviço. Servem de contexto à leitura de SLA, não são o foco do balanço.', MUTE, 9);

      // ===================== CLIENTES =====================
      h1('7. Dados de apoio · carteira de clientes');
      par('Secção de apoio. Os indicadores comerciais e de receita seguintes são contexto da leitura de SLA — mostram o valor de negócio em jogo por detrás do serviço, e não o foco do balanço de liderança.', MUTE, 9);
      par(`A carteira ${N.deX} vale receita real e confiança. A receita está concentrada: os 3 maiores clientes pesam `
        + `${N.top3Share}% do total faturado — o que os torna ativos a proteger com prioridade. `
        + (N.risco.length ? `Duas contas pedem atenção do líder, não da operação: ${N.risco.slice(0, 2).map((c) => `${c.remetente} (${i0(c.total)} pedidos a ${pct(c.taxa_sla)})`).join(' e ')}. ` : '')
        + (N.piorCli ? `O ponto mais fraco da carteira é ${N.piorCli.remetente} (${pct(N.piorCli.taxa_sla)}). ` : '')
        + `Uma chamada proativa minha a estas contas vale mais do que dez emails de operação.`);

      // Gráfico carteira (volume colorido por SLA)
      const cliVol = [...clientesTop(d, 9)].map((c) => ({
        label: c.remetente.split('@')[1] || c.remetente, value: c.total || 0, color: corSla(c.taxa_sla), tag: `${i0(c.total)}  ·  ${pct(c.taxa_sla)}`,
      }));
      ensure(cliVol.length * 26 + 30);
      y = barrasH(doc, M, y + 4, CW, cliVol, { labelW: 150, rowH: 17, gap: 7 });
      doc.fillColor(MUTE).font('Helvetica-Oblique').fontSize(7.6).text('Fig. 2 — Volume por cliente; a cor indica o cumprimento de SLA (verde ≥95, âmbar 85–95, vermelho <85).', M, y); y += 16;

      // Gráfico receita
      const cliRec = [...(d.clientes || [])].sort((a, b) => (b.receita || 0) - (a.receita || 0)).slice(0, 8)
        .map((c) => ({ label: c.remetente.split('@')[1] || c.remetente, value: c.receita || 0, color: TEAL, tag: eur(c.receita) }));
      if (cliRec.length) {
        ensure(cliRec.length * 24 + 30);
        h2('Onde está a receita — para priorizar a proteção certa');
        y = barrasH(doc, M, y + 2, CW, cliRec, { labelW: 150, rowH: 16, gap: 7 });
        doc.fillColor(MUTE).font('Helvetica-Oblique').fontSize(7.6).text('Fig. 3 — Receita gerada por cliente (top 8).', M, y); y += 16;
      }

      // Tabela carteira
      tabelaClientes(doc, d, { M, CW, y, ensureRef: () => y, setY: (v) => { y = v; }, getY: () => y, bottom });
      y = tabelaClientes._lastY;

      // ===================== FICHAS DE CLIENTES =====================
      h1('8. Fichas de clientes estratégicos (apoio)');
      par(`Leitura individual das contas que mais pesam na receita da carteira ${N.deX}. Para cada uma: o estado actual, o valor `
        + `em jogo e a acção concreta que recomendo — porque proteger receita conquistada custa sempre menos do que reconquistá-la.`);
      const estrategicos = [...(d.clientes || [])].sort((a, b) => (b.receita || 0) - (a.receita || 0)).slice(0, 4);
      estrategicos.forEach((c) => {
        const slaC = c.taxa_sla != null ? c.taxa_sla : (c.resolvidos > 0 ? Math.round((c.cumpridos / c.resolvidos) * 1000) / 10 : null);
        const ganho = c.vendas_ganho || 0, perd = c.vendas_perdido || 0;
        const conv = (ganho + perd) > 0 ? Math.round((ganho / (ganho + perd)) * 1000) / 10 : null;
        const ticket = ganho > 0 ? c.receita / ganho : null;
        ensure(152);
        doc.roundedRect(M, y, CW, 26, 6).fill(NAVY);
        doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(11).text(c.remetente, M + 12, y + 7, { width: CW - 130, lineBreak: false });
        const tag = slaC == null ? '—' : (slaC < 90 ? 'PROTEGER' : slaC >= 95 ? 'SÓLIDA' : 'VIGIAR');
        doc.fillColor(slaC != null && slaC < 90 ? '#fda4af' : (slaC >= 95 ? '#86efac' : '#fcd34d')).font('Helvetica-Bold').fontSize(9).text(tag, M + CW - 118, y + 8, { width: 106, align: 'right' });
        y += 32;
        const kc = [['Pedidos', i0(c.total)], ['SLA', pct(slaC)], ['Receita', eur(c.receita)], ['Ticket médio', eur(ticket)], ['Conversão', pct(conv)]];
        const cw2 = (CW - 4 * 8) / 5;
        kc.forEach((k, i) => { const xx = M + i * (cw2 + 8); doc.roundedRect(xx, y, cw2, 42, 6).fill('#f4f7f9'); doc.fillColor(MUTE).font('Helvetica').fontSize(6.4).text(k[0].toUpperCase(), xx + 7, y + 7, { width: cw2 - 12 }); doc.fillColor(i === 1 ? corSla(slaC) : INK).font('Helvetica-Bold').fontSize(12).text(k[1], xx + 7, y + 19, { width: cw2 - 12, lineBreak: false }); });
        y += 50;
        par(leituraCliente(c, slaC, conv, ticket, N), SLATE, 9.2);
        y += 2;
      });

      // ---------------- Rodapé ----------------
      const range = doc.bufferedPageRange();
      for (let i = 1; i < range.count; i++) {
        doc.switchToPage(range.start + i);
        doc.page.margins.bottom = 0; // impede auto-paginação ao escrever no rodapé
        doc.fillColor(MUTE).font('Helvetica').fontSize(7.6)
          .text(`VoyaMetrics · Balanço de Liderança · ${N.nome}`, M, H - 30, { width: CW - 60, lineBreak: false })
          .text(`Página ${i}`, W - M - 60, H - 30, { width: 60, align: 'right', lineBreak: false });
      }
      doc.end();
    } catch (err) { reject(err); }
  });
}

function clientesTop(d, n) {
  return [...(d.clientes || [])].sort((a, b) => (b.total || 0) - (a.total || 0)).slice(0, n);
}

function tabelaClientes(doc, d, ctx) {
  const { M, CW } = ctx; const bottom = ctx.bottom;
  const NAVY = '#0b2545', INDIGO = '#0b2545', INK = '#1f2937', SLATE = '#475569', LINE = '#e2e8f0', HEAD = '#eef2f7', LIGHT = '#f6f8fa';
  let y = ctx.getY();
  const ensure = (h) => { if (y + h > bottom) { doc.addPage(); y = 42; } };
  ensure(28);
  doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(10.5).text('Carteira — leitura por conta', M, y); y += 18;
  const cols = [{ t: 'Cliente', w: CW - 3 * 70 - 70 }, { t: 'Pedidos', w: 70, a: 'right' }, { t: 'SLA', w: 70, a: 'right' }, { t: 'Receita', w: 70, a: 'right' }, { t: 'Leitura', w: 70, a: 'right' }];
  const totalW = cols.reduce((s, c) => s + c.w, 0);
  const head = () => { doc.rect(M, y, totalW, 16).fill(HEAD); let x = M; doc.fillColor(INDIGO).font('Helvetica-Bold').fontSize(8); cols.forEach((c) => { doc.text(c.t, x + 5, y + 4, { width: c.w - 8, align: c.a || 'left' }); x += c.w; }); y += 16; };
  ensure(34); head();
  const linhas = [...(d.clientes || [])].slice(0, 8).map((c) => {
    const leitura = (c.taxa_sla != null && c.taxa_sla < 90) ? 'Proteger' : (c.taxa_sla >= 95 ? 'Sólida' : 'Vigiar');
    return [c.remetente, c.total, c.taxa_sla == null ? '—' : Math.round(c.taxa_sla) + '%', new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(c.receita || 0), leitura];
  });
  linhas.forEach((ln, idx) => {
    ensure(16); if (y === 42) head();
    if (idx % 2 === 1) doc.rect(M, y, totalW, 15).fill(LIGHT);
    let x = M; doc.font('Helvetica').fontSize(8.2);
    cols.forEach((c, ci) => { doc.fillColor(ci === 0 ? INK : (ci === 4 ? NAVY : SLATE)).font(ci === 4 ? 'Helvetica-Bold' : (ci === 0 ? 'Helvetica-Bold' : 'Helvetica')).text(ln[ci] == null ? '—' : String(ln[ci]), x + 5, y + 3.5, { width: c.w - 8, align: c.a || 'left' }); x += c.w; });
    doc.moveTo(M, y + 15).lineTo(M + totalW, y + 15).strokeColor(LINE).lineWidth(0.5).stroke();
    y += 15;
    });
  y += 12;
  tabelaClientes._lastY = y;
}

function mediana(a) { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; }

function evolucaoChart(doc, x, y, w, h, rows, meta) {
  const n = rows.length, padL = 8, padR = 40, padT = 8, padB = 16;
  const plotX = x + padL, plotW = w - padL - padR, plotY = y + padT, plotH = h - padT - padB;
  const maxVol = Math.max(1, ...rows.map((r) => r.volume));
  doc.roundedRect(x, y, w, h, 6).fill('#f7faf9');
  const xc = (i) => plotX + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const bw = Math.max(4, Math.min(24, (plotW / n) * 0.5));
  rows.forEach((r, i) => { const bh = (r.volume / maxVol) * plotH * 0.82; doc.roundedRect(xc(i) - bw / 2, plotY + plotH - bh, bw, bh, 2).fill('#dce7ea'); });
  const ySla = (v) => plotY + plotH - (Math.min(100, Math.max(0, v)) / 100) * plotH;
  doc.save().dash(2, { space: 2 }).moveTo(plotX, ySla(meta)).lineTo(plotX + plotW, ySla(meta)).strokeColor('#0b2545').lineWidth(0.8).stroke().undash().restore();
  doc.fillColor('#0b2545').font('Helvetica').fontSize(6.5).text('Meta ' + meta + '%', plotX + plotW + 3, ySla(meta) - 3, { lineBreak: false });
  doc.save().lineWidth(2.2).strokeColor('#14c8b8').lineJoin('round');
  rows.forEach((r, i) => { const px = xc(i), py = ySla(r.sla); if (i) doc.lineTo(px, py); else doc.moveTo(px, py); });
  doc.stroke().restore();
  rows.forEach((r, i) => { const px = xc(i), py = ySla(r.sla); doc.circle(px, py, 2.4).fill('#14c8b8'); doc.fillColor('#1f2937').font('Helvetica-Bold').fontSize(6.4).text(numpt(r.sla) + '%', px - 11, py - 12, { width: 24, align: 'center', lineBreak: false }); doc.fillColor('#6b7280').font('Helvetica').fontSize(6.2).text(r.label, px - 14, plotY + plotH + 4, { width: 28, align: 'center', lineBreak: false }); });
  return y + h;
}

function matrizRisco(doc, x, y, w, h, clientes, meta) {
  const pts = clientes.filter((c) => c.taxa_sla != null);
  const maxVol = Math.max(1, ...pts.map((c) => c.total));
  const padL = 30, padR = 14, padT = 12, padB = 22;
  const plotX = x + padL, plotW = w - padL - padR, plotY = y + padT, plotH = h - padT - padB;
  doc.roundedRect(x, y, w, h, 6).fill('#f7faf9');
  const loSla = 60;
  const X = (v) => plotX + (v / maxVol) * plotW;
  const Y = (v) => plotY + plotH - ((Math.min(100, Math.max(loSla, v)) - loSla) / (100 - loSla)) * plotH;
  const medVol = mediana(pts.map((c) => c.total));
  doc.rect(X(medVol), Y(meta), (plotX + plotW) - X(medVol), (plotY + plotH) - Y(meta)).fill('#fdecee');
  doc.save().dash(2, { space: 2 });
  doc.moveTo(plotX, Y(meta)).lineTo(plotX + plotW, Y(meta)).strokeColor('#e11d48').lineWidth(0.8).stroke();
  doc.moveTo(X(medVol), plotY).lineTo(X(medVol), plotY + plotH).strokeColor('#94a3b8').lineWidth(0.8).stroke();
  doc.undash().restore();
  doc.fillColor('#e11d48').font('Helvetica-Bold').fontSize(7).text('PROTEGER', plotX + plotW - 56, plotY + plotH - 13, { lineBreak: false });
  // pontos + rótulos com anti-colisão simples
  doc.font('Helvetica').fontSize(6);
  const colocados = [];
  [...pts].sort((a, b) => X(a.total) - X(b.total)).forEach((c) => {
    const cx = X(c.total), cy = Y(c.taxa_sla);
    doc.circle(cx, cy, 3.2).fill(corSla(c.taxa_sla));
    const nm = (c.remetente.split('@')[1] || c.remetente).split('.')[0];
    const wpx = doc.widthOfString(nm);
    const left = cx > plotX + plotW * 0.62;
    let lx = left ? cx - 5 - wpx : cx + 5;
    let ly = cy - 3;
    let guard = 0;
    while (guard < 12 && colocados.some((p) => Math.abs(p.y - ly) < 7 && lx < p.x + p.w + 3 && lx + wpx > p.x - 3)) { ly += 7.5; guard++; }
    colocados.push({ x: lx, y: ly, w: wpx });
    doc.fillColor('#475569').text(nm, lx, ly, { lineBreak: false });
  });
  // eixo Y (rótulo vertical na margem esquerda, fora da nuvem de pontos)
  doc.save().rotate(-90, { origin: [x + 7, plotY + plotH / 2] });
  doc.fillColor('#6b7280').font('Helvetica').fontSize(6.6).text('Cumprimento SLA % (meta ' + meta + '%)', x + 7 - plotH / 2, plotY + plotH / 2 - 3, { width: plotH, align: 'center', lineBreak: false });
  doc.restore();
  doc.fillColor('#6b7280').font('Helvetica').fontSize(6.6).text('Volume de pedidos →', plotX + plotW - 92, plotY + plotH + 8, { width: 92, align: 'right', lineBreak: false });
  return y + h;
}

function leituraCliente(c, sla, conv, ticket, N) {
  const dom = c.remetente.split('@')[1] || c.remetente;
  if (sla != null && sla < 90) {
    return `${dom} é uma conta a proteger: gera ${eur(c.receita)} mas cumpre apenas ${pct(sla)} de SLA. O risco aqui não é comercial, é de serviço — uma falha repetida pode custar a relação. Acção: chamada proactiva ${N.deX} (ou minha, se a conta for sensível) e prioridade de fila nos próximos pedidos.`;
  }
  if (sla != null && sla >= 95) {
    return `${dom} é uma relação sólida: ${pct(sla)} de SLA sobre ${i0(c.total)} pedidos e ${eur(c.receita)} de receita${ticket ? ` (ticket médio ${eur(ticket)})` : ''}. Acção: usar como referência e procurar expandir — é o tipo de conta onde upsell e mais conversão são possíveis sem risco reputacional.`;
  }
  return `${dom} está em zona de vigilância: ${pct(sla)} de SLA e ${eur(c.receita)} de receita${conv != null ? `, conversão de ${pct(conv)}` : ''}. Acção: estabilizar o serviço antes de empurrar volume; um pequeno reforço de pontualidade move esta conta para terreno seguro.`;
}

module.exports = { gerar };
