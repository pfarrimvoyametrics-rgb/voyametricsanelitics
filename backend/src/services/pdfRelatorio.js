/**
 * pdfRelatorio.js — Gera o relatório analítico em PDF (de marca), no servidor,
 * a partir dos dados já calculados (geral, categorias, operadores, clientes,
 * insights, comparativo). Usa pdfkit (JS puro, sem dependências nativas).
 */
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const NAVY = '#0b2545', TEAL = '#14c8b8', INK = '#1f2937', SLATE = '#475569',
      MUTE = '#6b7280', LINE = '#e2e8f0', LIGHT = '#f1f5f9', HEAD = '#eef2f7',
      EMER = '#059669', AMBER = '#b45309', ROSE = '#e11d48', INDIGO = '#0b2545';
const ROTULO = {
  emergencias: 'Emergências', alteracoes: 'Alterações de Reservas',
  cotacoes: 'Cotações / Orçamentos', reclamacoes: 'Reclamações / Reembolsos',
  suporte_tecnico: 'Suporte Técnico', faturacao: 'Faturação', comercial: 'Comercial',
};
const LOGO = path.join(__dirname, '..', 'assets', 'logo.png');

const numpt = (n) => (n == null ? '—' : String(Math.round(n * 10) / 10).replace('.', ','));
const pct = (n) => (n == null ? '—' : numpt(n) + '%');
const horas = (n) => (n == null ? '—' : numpt(n) + ' h');
const eur = (n) => (n == null ? '—' : new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(n));

function ambitoTexto(a = {}, geral) {
  if (a.cliente) return `Cliente · ${a.cliente}`;
  if (a.operador) return `Operador · ${a.operador}`;
  if (a.equipa) return `Equipa · ${ROTULO[a.equipa] || a.equipa}`;
  return 'Global (todas as equipas)';
}

function corSla(v) { return v == null ? MUTE : v >= 95 ? EMER : v >= 85 ? AMBER : ROSE; }

function barrasH(doc, x, y, w, items, opts) {
  opts = opts || {};
  const rowH = opts.rowH || 18, gap = opts.gap || 7, labelW = opts.labelW || 140;
  const mx = opts.max || Math.max(1, ...items.map((i) => i.value)) * 1.14;
  const plotX = x + labelW, plotW = w - labelW - 58;
  items.forEach((it, i) => {
    const cy = y + i * (rowH + gap);
    doc.fillColor(MUTE).font('Helvetica').fontSize(8).text(it.label, x, cy + rowH / 2 - 5, { width: labelW - 8, align: 'right', lineBreak: false });
    doc.roundedRect(plotX, cy, plotW, rowH, rowH / 2).fill(LIGHT);
    const bw = Math.max(rowH, (it.value / mx) * plotW);
    doc.roundedRect(plotX, cy, bw, rowH, rowH / 2).fill(it.color);
    doc.fillColor(INK).font('Helvetica-Bold').fontSize(8).text(it.tag != null ? it.tag : String(it.value), plotX + bw + 6, cy + rowH / 2 - 5, { width: 92, lineBreak: false });
  });
  const hh = items.length * (rowH + gap) - gap;
  if (opts.target != null) {
    const tx = plotX + (opts.target / mx) * plotW;
    doc.save().dash(2, { space: 2 }).moveTo(tx, y - 5).lineTo(tx, y + hh + 5).strokeColor(NAVY).lineWidth(1).stroke().undash().restore();
    doc.fillColor(NAVY).font('Helvetica').fontSize(6.8).text(opts.targetLabel || 'Meta', tx - 12, y + hh + 7, { width: 60, lineBreak: false });
  }
  return y + hh + (opts.target != null ? 16 : 4);
}

function evolucaoChart(doc, x, y, w, h, rows, meta) {
  const n = rows.length, padL = 8, padR = 40, padT = 8, padB = 16;
  const plotX = x + padL, plotW = w - padL - padR, plotY = y + padT, plotH = h - padT - padB;
  const maxVol = Math.max(1, ...rows.map((r) => r.volume));
  doc.roundedRect(x, y, w, h, 6).fill('#f7faf9');
  const xc = (i) => plotX + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const bw = Math.max(4, Math.min(26, (plotW / n) * 0.5));
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

function gerar(d) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 40, bufferPages: true });
      const chunks = [];
      doc.on('data', (c) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));

      const W = doc.page.width, H = doc.page.height, M = 40, CW = W - 2 * M;
      const g = d.geral || {}, cmp = d.comparativo || {}, ins = d.insights || {};
      const meta = ins.meta || 95;

      // ---------------- CAPA ----------------
      doc.rect(0, 0, W, H).fill(NAVY);
      doc.rect(0, 0, W, 6).fill(TEAL);
      try { doc.image(LOGO, M, 70, { width: 54 }); } catch (e) { /* sem logo */ }
      doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(22).text('VoyaMetrics', M, 135);
      doc.fillColor('#94a3b8').font('Helvetica').fontSize(10).text('Medidor SLA Email · Departamento Corporate', M, 162);
      doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(28).text('Relatório Analítico de Serviço', M, 250, { width: CW });
      doc.fontSize(28).text('e Desempenho (SLA)', M, 284, { width: CW });
      doc.fillColor('#cbd5e1').font('Helvetica').fontSize(12)
        .text(`Período: ${d.periodo.de} a ${d.periodo.ate}`, M, 340)
        .text(`Âmbito: ${ambitoTexto(d.ambito, g)}`, M, 360);
      doc.fillColor('#6b7280').fontSize(8.5)
        .text('Confidencial · gerado pelo sistema de gestão de qualidade VoyaMetrics', M, H - 60, { width: CW });

      // ---------------- CONTEÚDO ----------------
      doc.addPage();
      let y = M;
      const bottom = H - 50;
      const ensure = (h) => { if (y + h > bottom) { doc.addPage(); y = M; } };
      const h2 = (t) => { ensure(26); doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(13).text(t, M, y); y += 20; };
      const par = (t, c = SLATE, size = 9.5) => { doc.fillColor(c).font('Helvetica').fontSize(size); const hgt = doc.heightOfString(t, { width: CW }); ensure(hgt + 4); doc.text(t, M, y, { width: CW }); y += hgt + 4; };

      h2(`Relatório — ${ambitoTexto(d.ambito, g)}`);
      par(`Período ${d.periodo.de} a ${d.periodo.ate} (comparado com ${d.periodoAnterior ? d.periodoAnterior.de + ' a ' + d.periodoAnterior.ate : 'período anterior'}).`, MUTE, 9);
      y += 4;

      // KPIs (grelha 4 col x 2 linhas)
      const kpis = [
        ['Recebidos', String(g.total ?? '—'), cmp.total_pct != null ? `${cmp.total_pct >= 0 ? '+' : ''}${numpt(cmp.total_pct)}%` : '', INK],
        ['Resolvidos', String(g.resolvidos ?? '—'), '', INK],
        ['Cumprimento SLA', pct(g.taxa_sla), cmp.taxa_sla_pp != null ? `${cmp.taxa_sla_pp >= 0 ? '+' : ''}${numpt(cmp.taxa_sla_pp)} pp` : '', g.taxa_sla >= (ins.meta || 95) ? EMER : ROSE],
        ['1.ª resposta', horas(g.horas_resposta_media), '', INK],
        ['Resolução (h. úteis)', horas(g.horas_uteis_resolucao_media), '', INK],
        ['SLA violado (aberto)', String(g.violados_abertos ?? '—'), '', ROSE],
        ['Satisfação (CSAT)', g.csat_media != null ? `${numpt(g.csat_media)}/5` : '—', g.csat_respostas ? `${g.csat_respostas} resp.` : '', AMBER],
        ['Precisão de emissão', pct(g.precisao_emissao), g.bilhetes_com_erro != null ? `${g.bilhetes_com_erro} c/ erro` : '', INK],
        ['Conversão de vendas', pct(g.taxa_conversao), cmp.conversao_pp != null ? `${cmp.conversao_pp >= 0 ? '+' : ''}${numpt(cmp.conversao_pp)} pp` : '', INDIGO],
        ['Receita', eur(g.receita), cmp.receita_pct != null ? `${cmp.receita_pct >= 0 ? '+' : ''}${numpt(cmp.receita_pct)}%` : '', EMER],
        ['Ticket médio', eur(g.ticket_medio), '', INK],
      ];
      const gap = 8, cardW = (CW - 3 * gap) / 4, cardH = 52;
      const linhas = Math.ceil(kpis.length / 4);
      ensure(cardH * linhas + gap * (linhas - 1) + 6);
      kpis.forEach((k, i) => {
        const col = i % 4, row = Math.floor(i / 4);
        const x = M + col * (cardW + gap), cy = y + row * (cardH + gap);
        doc.roundedRect(x, cy, cardW, cardH, 6).fill(LIGHT);
        doc.fillColor(MUTE).font('Helvetica').fontSize(7).text(k[0].toUpperCase(), x + 8, cy + 7, { width: cardW - 16 });
        doc.fillColor(k[3]).font('Helvetica-Bold').fontSize(14).text(k[1], x + 8, cy + 19, { width: cardW - 16 });
        if (k[2]) doc.fillColor(MUTE).font('Helvetica').fontSize(7).text(k[2], x + 8, cy + 38, { width: cardW - 16 });
      });
      y += cardH * linhas + gap * (linhas - 1) + 12;

      // Gráfico de evolução
      const evo = (d.evolucao || []).filter((r) => (r.recebidos || 0) > 0);
      if (evo.length >= 2) {
        h2('Evolução do serviço no período');
        const fl = (p) => { const dt = new Date(p); return String(dt.getUTCDate()).padStart(2, '0') + '/' + String(dt.getUTCMonth() + 1).padStart(2, '0'); };
        const er = evo.map((r) => ({ label: fl(r.periodo), volume: r.recebidos || 0, sla: (r.resolvidos > 0 ? Math.round((r.cumpridos / r.resolvidos) * 1000) / 10 : 0) }));
        ensure(166);
        y = evolucaoChart(doc, M, y + 2, CW, 146, er, meta) + 2;
        doc.fillColor(MUTE).font('Helvetica-Oblique').fontSize(7.6).text('Barras = volume recebido por período; linha = cumprimento de SLA; tracejado = meta.', M, y); y += 12;
      }

      // Conclusões
      h2('Conclusões e recomendações');
      (ins.conclusoes || []).forEach((c) => {
        doc.fillColor(SLATE).font('Helvetica').fontSize(9.5);
        const txt = '•  ' + c;
        const hgt = doc.heightOfString(txt, { width: CW - 6 });
        ensure(hgt + 3);
        doc.text(txt, M + 4, y, { width: CW - 6 }); y += hgt + 3;
      });
      y += 6;

      // Recomendações (tabela)
      const recs = ins.recomendacoes || [];
      if (recs.length) {
        const wRec = CW - 70 - 70, xImp = M + wRec, xEsf = M + wRec + 70;
        ensure(18);
        doc.rect(M, y, CW, 16).fill(HEAD);
        doc.fillColor(INDIGO).font('Helvetica-Bold').fontSize(8)
          .text('RECOMENDAÇÃO', M + 6, y + 4, { width: wRec - 8 })
          .text('IMPACTO', xImp, y + 4, { width: 66 })
          .text('ESFORÇO', xEsf, y + 4, { width: 66 });
        y += 16;
        recs.forEach((r) => {
          doc.font('Helvetica').fontSize(8.5).fillColor(INK);
          const hgt = Math.max(14, doc.heightOfString(r.texto, { width: wRec - 8 }) + 6);
          ensure(hgt);
          doc.fillColor(INK).text(r.texto, M + 6, y + 3, { width: wRec - 8 });
          const corImp = r.impacto === 'Alto' ? ROSE : r.impacto === 'Médio' ? AMBER : MUTE;
          doc.fillColor(corImp).font('Helvetica-Bold').text(r.impacto || '—', xImp, y + 3, { width: 66 });
          doc.fillColor(SLATE).font('Helvetica').text(r.esforco || '—', xEsf, y + 3, { width: 66 });
          doc.moveTo(M, y + hgt).lineTo(M + CW, y + hgt).strokeColor(LINE).lineWidth(0.5).stroke();
          y += hgt;
        });
        y += 10;
      }

      // Tabela genérica
      function tabela(titulo, cols, linhas) {
        h2(titulo);
        const totalW = cols.reduce((s, c) => s + c.w, 0);
        const drawHead = () => {
          doc.rect(M, y, totalW, 16).fill(HEAD);
          doc.fillColor(INDIGO).font('Helvetica-Bold').fontSize(8);
          let x = M; cols.forEach((c) => { doc.text(c.t, x + 5, y + 4, { width: c.w - 8, align: c.a || 'left' }); x += c.w; });
          y += 16;
        };
        ensure(34); drawHead();
        linhas.forEach((ln) => {
          ensure(16);
          if (y === M) drawHead();
          doc.font('Helvetica').fontSize(8.3).fillColor(INK);
          let x = M;
          cols.forEach((c, ci) => { doc.fillColor(ci === 0 ? INK : SLATE).text(ln[ci] == null ? '—' : String(ln[ci]), x + 5, y + 4, { width: c.w - 8, align: c.a || 'left' }); x += c.w; });
          doc.moveTo(M, y + 15).lineTo(M + totalW, y + 15).strokeColor(LINE).lineWidth(0.5).stroke();
          y += 16;
        });
        y += 10;
      }

      // Gráfico: cumprimento por canal
      const catCh = (d.categorias || []).filter((c) => (c.total || 0) > 0).sort((a, b) => (a.taxa_sla ?? 0) - (b.taxa_sla ?? 0))
        .map((c) => ({ label: ROTULO[c.categoria_ticket] || c.categoria_ticket, value: c.taxa_sla || 0, color: corSla(c.taxa_sla), tag: pct(c.taxa_sla) }));
      if (catCh.length) {
        h2('Cumprimento de SLA por canal');
        ensure(catCh.length * 25 + 22);
        y = barrasH(doc, M, y + 2, CW, catCh, { max: 105, labelW: 160, target: meta, targetLabel: 'Meta ' + pct(meta), rowH: 16 });
        doc.fillColor(MUTE).font('Helvetica-Oblique').fontSize(7.6).text('Canais à esquerda da linha tracejada estão fora da meta.', M, y); y += 12;
      }
      // Cumprimento por canal (tabela de detalhe)
      tabela('Detalhe por canal (vs SLA acordado)',
        [{ t: 'Canal', w: CW - 4 * 75 }, { t: 'SLA acordado', w: 75, a: 'right' }, { t: 'Total', w: 75, a: 'right' }, { t: 'Resol. (h.úteis)', w: 75, a: 'right' }, { t: 'Cumprimento', w: 75, a: 'right' }],
        (d.categorias || []).map((c) => [ROTULO[c.categoria_ticket] || c.categoria_ticket, c.sla_minutos != null ? numpt(c.sla_minutos / 60) + ' h' : '—', c.total, horas(c.horas_uteis_resolucao_media), pct(c.taxa_sla)]));

      // Gráfico: SLA por operador
      const opsCh = (d.operadores || []).filter((o) => (o.total || 0) > 0);
      if (opsCh.length > 1) {
        const oc = [...opsCh].sort((a, b) => (a.taxa_sla ?? 0) - (b.taxa_sla ?? 0)).slice(0, 12)
          .map((o) => ({ label: o.nome, value: o.taxa_sla || 0, color: corSla(o.taxa_sla), tag: pct(o.taxa_sla) }));
        h2('Cumprimento de SLA por operador');
        ensure(oc.length * 22 + 22);
        y = barrasH(doc, M, y + 2, CW, oc, { max: 105, labelW: 120, target: meta, targetLabel: 'Meta ' + pct(meta), rowH: 14, gap: 6 });
        doc.fillColor(MUTE).font('Helvetica-Oblique').fontSize(7.6).text('Ordenado do menor ao maior cumprimento — identifica quem precisa de apoio e quem é referência.', M, y); y += 12;
      }
      // Operadores
      tabela('Desempenho por operador',
        [{ t: 'Operador', w: CW - 4 * 70 }, { t: 'Total', w: 70, a: 'right' }, { t: 'SLA', w: 70, a: 'right' }, { t: '1.ª resp.', w: 70, a: 'right' }, { t: 'Conversão', w: 70, a: 'right' }],
        (d.operadores || []).map((o) => [o.nome, o.total, pct(o.taxa_sla), horas(o.horas_resposta_media), pct(o.taxa_conversao)]));

      // Gráfico: clientes por volume (cor = SLA)
      const cliCh = [...(d.clientes || [])].slice(0, 8)
        .map((c) => ({ label: (c.remetente.split('@')[1] || c.remetente), value: c.total || 0, color: corSla(c.taxa_sla), tag: String(c.total) + '  ·  ' + pct(c.taxa_sla) }));
      if (cliCh.length) {
        h2('Top clientes por volume (cor = SLA)');
        ensure(cliCh.length * 22 + 22);
        y = barrasH(doc, M, y + 2, CW, cliCh, { labelW: 160, rowH: 14, gap: 6 });
        doc.fillColor(MUTE).font('Helvetica-Oblique').fontSize(7.6).text('Verde ≥95, âmbar 85–95, vermelho <85. Barras vermelhas com muito volume são a prioridade.', M, y); y += 12;
      }
      // Top clientes (volume + SLA)
      tabela('Top clientes (por volume e cumprimento de SLA)',
        [{ t: 'Cliente', w: CW - 2 * 95 }, { t: 'Total', w: 95, a: 'right' }, { t: 'Cumprimento SLA', w: 95, a: 'right' }],
        (d.clientes || []).slice(0, 15).map((c) => [c.remetente, c.total, pct(c.taxa_sla)]));

      // ---------------- Dados de apoio: impacto financeiro ----------------
      const temFin = (g.receita != null && g.receita !== 0) || (g.taxa_conversao != null);
      if (temFin) {
        h2('Dados de apoio · impacto financeiro');
        par('Detalhe comercial de apoio à leitura de SLA: receita por cliente. Os totais financeiros constam dos cartões no topo do relatório.', MUTE, 8.5);
        const cliRec = [...(d.clientes || [])].filter((c) => c.receita).sort((a, b) => (b.receita || 0) - (a.receita || 0)).slice(0, 8);
        if (cliRec.length) {
          tabela('Top clientes por receita (apoio)',
            [{ t: 'Cliente', w: CW - 2 * 95 }, { t: 'Receita', w: 95, a: 'right' }, { t: 'Cumprimento SLA', w: 95, a: 'right' }],
            cliRec.map((c) => [c.remetente, eur(c.receita), pct(c.taxa_sla)]));
        }
      }

      par('Tempo de resolução em relógio de parede; cumprimento de SLA em horas úteis (Seg–Sex, 09h30–19h00, feriados nacionais excluídos).', MUTE, 8);

      // ---------------- Rodapé em todas as páginas (excepto capa) ----------------
      const range = doc.bufferedPageRange();
      for (let i = 1; i < range.count; i++) {
        doc.switchToPage(range.start + i);
        doc.page.margins.bottom = 0; // impede auto-paginação ao escrever no rodapé
        doc.fillColor(MUTE).font('Helvetica').fontSize(8)
          .text(`VoyaMetrics · Relatório Analítico · ${ambitoTexto(d.ambito, g)}`, M, H - 30, { width: CW - 60, lineBreak: false })
          .text(`Página ${i}`, W - M - 60, H - 30, { width: 60, align: 'right', lineBreak: false });
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { gerar };
