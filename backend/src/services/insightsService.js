/**
 * insightsService.js — Motor de "insights" dos relatórios.
 *
 * A partir dos dados agregados de um período (e do período anterior), produz:
 *   • destaque: leitura executiva de uma linha (titular do período);
 *   • comparativo: variações face ao período homólogo anterior;
 *   • focos: canal/dia/hora/operador/cliente que merecem atenção;
 *   • conclusoes: frases analíticas densas (dado + comparação + impacto/causa);
 *   • recomendacoes: acções priorizadas (texto + impacto + esforço).
 *
 * Tom corporativo, analítico e directo (pt-PT). Cada frase traz um dado concreto,
 * uma correlação de causa-raiz ou um impacto operacional/financeiro deduzido.
 * Função PURA (sem base de dados) — fácil de testar.
 */

const META = parseFloat(process.env.SLA_META_PCT || '95');
const DIAS = ['', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
const ROTULO = {
  emergencias: 'Emergências', alteracoes: 'Alterações de Reservas',
  cotacoes: 'Cotações / Orçamentos', reclamacoes: 'Reclamações / Reembolsos',
  suporte_tecnico: 'Suporte Técnico', faturacao: 'Faturação', comercial: 'Comercial',
};

const rot = (c) => ROTULO[c] || c;
const numpt = (n) => (n == null ? '—' : String(Math.round(n * 10) / 10).replace('.', ','));
const int = (n) => new Intl.NumberFormat('pt-PT').format(Math.round(n || 0));
const eur = (n) => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(n || 0);
const pp = (a, b) => (a == null || b == null ? null : Math.round((a - b) * 10) / 10);
const pctVar = (a, b) => (a == null || b == null || b === 0 ? null : Math.round(((a - b) / b) * 1000) / 10);
const frasePP = (d) => (d == null ? '' : d >= 0 ? `, +${numpt(d)} pp face ao período anterior` : `, ${numpt(d)} pp face ao período anterior`);
const frasePct = (d) => (d == null ? '' : d >= 0 ? ` (+${numpt(d)}% vs período anterior)` : ` (${numpt(d)}% vs período anterior)`);

function gerarInsights(atual = {}, anterior = {}) {
  const g = atual.geral || {};
  const ant = anterior.geral || {};
  const dias = Math.max(1, Number(atual.dias) || 30);
  const conclusoes = [];
  const recomendacoes = [];
  const focos = {};

  const total = Number(g.total) || 0;
  const resolvidos = Number(g.resolvidos) || 0;
  const violados = Number(g.violados_abertos) || 0;
  const ritmoDia = resolvidos / dias; // resolvidos por dia no período

  // --- SLA global + backlog vencido (impacto) ---
  if (g.taxa_sla != null) {
    const vsMeta = g.taxa_sla >= META
      ? `${numpt(g.taxa_sla - META)} pp acima da meta de ${numpt(META)}%`
      : `${numpt(META - g.taxa_sla)} pp abaixo da meta de ${numpt(META)}%`;
    const foraPrazo = Math.max(0, resolvidos - Math.round((g.taxa_sla / 100) * resolvidos));
    conclusoes.push(
      `Cumprimento de SLA de ${numpt(g.taxa_sla)}%${frasePP(pp(g.taxa_sla, ant.taxa_sla))} — ${vsMeta}. ` +
      `Dos ${int(resolvidos)} resolvidos, ${int(foraPrazo)} ficaram fora do prazo: esforço executado sem valor de SLA reconhecido.`
    );
  }
  if (violados > 0) {
    const backlogDias = ritmoDia > 0 ? Math.ceil(violados / ritmoDia) : null;
    conclusoes.push(
      `${int(violados)} pedidos permanecem por responder com o prazo já vencido` +
      (backlogDias != null ? `; ao ritmo médio de ${numpt(ritmoDia)} resolvidos/dia do período, equivalem a cerca de ${backlogDias} dia(s) de backlog a absorver.` : '.')
    );
    recomendacoes.push({ texto: `Limpar o backlog vencido (${int(violados)} pedidos) por ordem de atraso antes de novas entradas — é a origem imediata da erosão do SLA.`, impacto: 'Alto', esforco: 'Médio' });
  }

  // --- Tempos (1.ª resposta e resolução) ---
  if (g.horas_resposta_media != null || g.horas_uteis_resolucao_media != null) {
    conclusoes.push(
      `Tempo médio até à 1.ª resposta de ${numpt(g.horas_resposta_media)} h e resolução em ${numpt(g.horas_uteis_resolucao_media)} h úteis — ` +
      `a 1.ª resposta é o principal travão à percepção de rapidez do cliente.`
    );
  }

  // --- Canais: pior cumprimento como alavanca isolada ---
  const cats = (atual.categorias || []).filter((c) => (c.total || 0) > 0);
  if (cats.length) {
    const volTotal = cats.reduce((s, c) => s + (c.total || 0), 0) || 1;
    const pior = [...cats].sort((a, b) => (a.taxa_sla ?? 101) - (b.taxa_sla ?? 101))[0];
    const shareP = Math.round((pior.total / volTotal) * 100);
    focos.pior_categoria = pior;
    if (pior.taxa_sla != null && pior.taxa_sla < META) {
      conclusoes.push(
        `O canal ${rot(pior.categoria_ticket)} é o mais crítico: ${numpt(pior.taxa_sla)}% de cumprimento sobre ${shareP}% do volume — ` +
        `a alavanca isolada com maior impacto no SLA global.`
      );
      recomendacoes.push({ texto: `Rever o fluxo do canal ${rot(pior.categoria_ticket)} (triagem, capacidade e prazo acordado) — concentra ${shareP}% do volume com o pior cumprimento.`, impacto: 'Alto', esforco: 'Médio' });
    }
    const maisVol = [...cats].sort((a, b) => b.total - a.total)[0];
    conclusoes.push(`Maior volume no canal ${rot(maisVol.categoria_ticket)} com ${int(maisVol.total)} pedidos (${Math.round((maisVol.total / volTotal) * 100)}% do total).`);
  }

  // --- Concentração temporal (dia + hora) como causa-raiz de capacidade ---
  const diasSem = atual.diaSemana || [];
  const horas = atual.hora || [];
  if (diasSem.length) {
    const tot = diasSem.reduce((s, d) => s + (d.recebidos || 0), 0) || 1;
    const pico = [...diasSem].sort((a, b) => b.recebidos - a.recebidos)[0];
    const share = Math.round((pico.recebidos / tot) * 100);
    focos.dia_pico = { ...pico, share };
    const horaPico = horas.length ? [...horas].sort((a, b) => b.recebidos - a.recebidos)[0] : null;
    if (horaPico) focos.hora_pico = horaPico;
    conclusoes.push(
      `A procura concentra-se à ${DIAS[pico.dia]} (${share}% do volume)` +
      (horaPico ? ` e na faixa das ${horaPico.hora}h` : '') +
      `; se o incumprimento se alinha com estes picos, é défice de capacidade nessas janelas e não um problema transversal.`
    );
    if (share >= 28 && g.taxa_sla != null && g.taxa_sla < META) {
      recomendacoes.push({ texto: `Reforçar a escala à ${DIAS[pico.dia]}${horaPico ? ` (pico às ${horaPico.hora}h)` : ''} — concentra ${share}% da procura e o SLA está abaixo da meta.`, impacto: 'Alto', esforco: 'Médio' });
    }
  }

  // --- Operador abaixo da meta (amostra mínima para evitar ruído) ---
  const ops = (atual.operadores || []).filter((o) => o.taxa_sla != null && (o.resolvidos || 0) >= 5);
  if (ops.length) {
    const ab = [...ops].sort((a, b) => a.taxa_sla - b.taxa_sla)[0];
    const top = [...ops].sort((a, b) => b.taxa_sla - a.taxa_sla)[0];
    if (top && top.taxa_sla >= META) {
      conclusoes.push(`Referência interna: ${top.nome} sustenta ${numpt(top.taxa_sla)}% de cumprimento em ${int(top.resolvidos)} resolvidos — padrão a replicar.`);
    }
    if (ab.taxa_sla < META) {
      focos.operador_abaixo = ab;
      recomendacoes.push({ texto: `Acompanhar ${ab.nome} (SLA ${numpt(ab.taxa_sla)}% em ${int(ab.resolvidos)} resolvidos) com mentoria do top da equipa e reequilíbrio de carga.`, impacto: 'Médio', esforco: 'Baixo' });
    }
  }

  // --- Cliente em risco (relação) ---
  const cli = (atual.clientes || []).filter((c) => c.taxa_sla != null && (c.total || 0) >= 5 && c.taxa_sla < META);
  if (cli.length) {
    const risco = [...cli].sort((a, b) => b.total - a.total)[0];
    focos.cliente_risco = risco;
    conclusoes.push(`Risco de relação: ${risco.remetente} acumula ${int(risco.total)} pedidos a ${numpt(risco.taxa_sla)}% de SLA — exposição a insatisfação numa conta de volume.`);
    recomendacoes.push({ texto: `Revisão de conta proativa com ${risco.remetente} (${int(risco.total)} pedidos a ${numpt(risco.taxa_sla)}% de SLA) antes que a insatisfação escale.`, impacto: 'Médio', esforco: 'Baixo' });
  }

  // --- Comercial (impacto financeiro) ---
  if ((g.vendas_ganho || 0) + (g.vendas_perdido || 0) > 0) {
    conclusoes.push(
      `Conversão de vendas de ${numpt(g.taxa_conversao)}%${frasePct(pp(g.taxa_conversao, ant.taxa_conversao))}, ` +
      `com receita de ${eur(g.receita)} e ticket médio de ${eur(g.ticket_medio)}${frasePct(pctVar(g.receita, ant.receita))}.`
    );
  }

  // --- CSAT ---
  if ((g.csat_respostas || 0) > 0) {
    conclusoes.push(`Satisfação (CSAT) média de ${numpt(g.csat_media)}/5 em ${int(g.csat_respostas)} respostas (taxa de ${numpt(g.taxa_resposta_csat)}%).`);
    if (g.csat_media != null && g.csat_media < 4) {
      recomendacoes.push({ texto: 'CSAT abaixo de 4/5 — analisar comentários por categoria e fechar o ciclo com os clientes insatisfeitos.', impacto: 'Alto', esforco: 'Médio' });
    }
  }

  // --- Precisão de emissão (custo de erro) ---
  if ((g.bilhetes_emitidos || 0) > 0) {
    conclusoes.push(`Precisão de emissão de ${numpt(g.precisao_emissao)}% — ${int(g.bilhetes_emitidos)} bilhetes, ${int(g.bilhetes_com_erro)} com erro; cada erro implica reemissão e risco de reclamação/custo.`);
    if (g.precisao_emissao != null && g.precisao_emissao < 97) {
      recomendacoes.push({ texto: `Precisão de emissão em ${numpt(g.precisao_emissao)}% (<97%) — instituir dupla verificação nas emissões de maior valor.`, impacto: 'Alto', esforco: 'Baixo' });
    }
  }

  if (!recomendacoes.length) {
    recomendacoes.push({ texto: 'Manter o nível de serviço e consolidar boas práticas — sem focos críticos no período.', impacto: '—', esforco: '—' });
  }

  // --- Destaque executivo (titular do período) ---
  const partes = [];
  if (g.taxa_sla != null) partes.push(`SLA ${numpt(g.taxa_sla)}%${g.taxa_sla >= META ? ' (na meta)' : ' (abaixo da meta)'}`);
  partes.push(`${int(total)} pedidos`);
  if (violados > 0) partes.push(`${int(violados)} vencidos por tratar`);
  if ((g.receita || 0) > 0) partes.push(`receita ${eur(g.receita)}`);
  const destaque = partes.join(' · ');

  const comparativo = {
    taxa_sla_pp: pp(g.taxa_sla, ant.taxa_sla),
    conversao_pp: pp(g.taxa_conversao, ant.taxa_conversao),
    horas_resposta_delta: g.horas_resposta_media != null && ant.horas_resposta_media != null
      ? Math.round((g.horas_resposta_media - ant.horas_resposta_media) * 100) / 100 : null,
    horas_uteis_resolucao_delta: g.horas_uteis_resolucao_media != null && ant.horas_uteis_resolucao_media != null
      ? Math.round((g.horas_uteis_resolucao_media - ant.horas_uteis_resolucao_media) * 100) / 100 : null,
    total_pct: pctVar(g.total, ant.total),
    receita_pct: pctVar(g.receita, ant.receita),
  };

  return { meta: META, destaque, comparativo, focos, conclusoes, recomendacoes };
}

module.exports = { gerarInsights };
