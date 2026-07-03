import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api/client';

/**
 * Relatorios — Relatórios analíticos do supervisor (tema escuro premium).
 *  - KPIs com comparação e mini-gráfico, conclusões densas, gráficos e tabelas.
 *  - Exportação Excel (SheetJS) e PDF de marca (servidor). Chart.js/SheetJS via CDN.
 */

const ROTULO_CATEGORIA = {
  emergencias: 'Emergências', alteracoes: 'Alterações de Reservas',
  cotacoes: 'Cotações / Orçamentos', reclamacoes: 'Reclamações / Reembolsos',
  suporte_tecnico: 'Suporte Técnico', faturacao: 'Faturação', comercial: 'Comercial',
};
const DIAS = ['', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
const CORES = ['#14c8b8', '#38bdf8', '#fbbf24', '#fb7185', '#34d399', '#e879f9', '#7f99ba'];

const eur = new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' });
const num = new Intl.NumberFormat('pt-PT');
const pct = (v) => (v == null ? '—' : `${num.format(v)}%`);
const horas = (v) => (v == null ? '—' : `${num.format(v)} h`);
const hojeMenos = (d) => { const x = new Date(); x.setDate(x.getDate() - d); return x.toISOString().slice(0, 10); };
const signedPP = (v) => (v == null ? '' : `${v >= 0 ? '+' : ''}${num.format(v)} pp`);
const signedPct = (v) => (v == null ? '' : `${v >= 0 ? '+' : ''}${num.format(v)}%`);
const signedH = (v) => (v == null ? '' : `${v >= 0 ? '+' : ''}${num.format(v)} h`);

function rotuloPeriodo(iso, gran) {
  const d = new Date(iso);
  if (gran === 'mes') return d.toLocaleDateString('pt-PT', { month: 'short', year: '2-digit' });
  if (gran === 'semana') return `sem. ${d.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' })}`;
  return d.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' });
}

const AC = {
  sky:     { b: 'border-sky-500/30',     t: 'text-sky-300',     s: '#38bdf8' },
  emerald: { b: 'border-emerald-500/30', t: 'text-emerald-300', s: '#34d399' },
  cyan:    { b: 'border-cyan-500/30',    t: 'text-cyan-300',    s: '#22d3ee' },
  rose:    { b: 'border-rose-500/30',    t: 'text-rose-300',    s: '#fb7185' },
  amber:   { b: 'border-amber-500/30',   t: 'text-amber-300',   s: '#fbbf24' },
  violet:  { b: 'border-violet-500/30',  t: 'text-violet-300',  s: '#a78bfa' },
  fuchsia: { b: 'border-fuchsia-500/30', t: 'text-fuchsia-300', s: '#e879f9' },
  indigo:  { b: 'border-indigo-500/30',  t: 'text-indigo-300',  s: '#4ed8c7' },
};

function Spark({ data, color }) {
  const pts = (data || []).filter((v) => v != null);
  if (pts.length < 2) return null;
  const max = Math.max(...pts), min = Math.min(...pts), rng = max - min || 1;
  const X = (i) => (i / (pts.length - 1)) * 100;
  const Y = (v) => 30 - ((v - min) / rng) * 23 - 4;
  const line = pts.map((v, i) => `${X(i)},${Y(v)}`).join(' ');
  const gid = 'sp' + String(color).replace('#', '');
  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" className="h-9 w-full">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.34" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline points={`0,30 ${line} 100,30`} fill={`url(#${gid})`} />
      <polyline points={line} fill="none" stroke={color} strokeWidth="2.2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function KpiRich({ rotulo, valor, accent = 'indigo', delta, deltaUp, spark, dica }) {
  const a = AC[accent] || AC.indigo;
  const temSpark = Array.isArray(spark) && spark.filter((v) => v != null).length > 1;
  return (
    <div title={dica} className={`relative flex h-full flex-col overflow-hidden rounded-2xl border ${a.b} bg-slate-900/60 p-4 shadow-lg ring-1 ring-white/5 backdrop-blur transition hover:-translate-y-0.5`}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-400">{rotulo}</p>
        {delta ? (
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${deltaUp ? 'bg-emerald-500/15 text-emerald-300' : 'bg-rose-500/15 text-rose-300'}`}>
            {deltaUp ? '▲' : '▼'} {delta}
          </span>
        ) : null}
      </div>
      <p className={`mt-1.5 tnum text-2xl font-extrabold ${a.t}`}>{valor}</p>
      <div className="mt-auto flex h-9 items-end pt-2">
        {temSpark
          ? <Spark data={spark} color={a.s} />
          : <div className="h-1.5 w-full rounded-full" style={{ background: `linear-gradient(90deg, ${a.s}66, ${a.s}11)` }} />}
      </div>
    </div>
  );
}

export default function Relatorios() {
  const [de, setDe] = useState(hojeMenos(30));
  const [ate, setAte] = useState(hojeMenos(0));
  const [gran, setGran] = useState('dia');
  const [ambitoTipo, setAmbitoTipo] = useState('tudo');
  const [ambitoValor, setAmbitoValor] = useState('');
  const [operadoresLista, setOperadoresLista] = useState([]);
  const [dados, setDados] = useState(null);
  const [aCarregar, setACarregar] = useState(false);
  const [erro, setErro] = useState('');

  const refs = { ev: useRef(null), cat: useRef(null), op: useRef(null), dow: useRef(null), hora: useRef(null) };
  const charts = useRef({});

  useEffect(() => { api.usuarios().then((u) => setOperadoresLista(u.filter((x) => x.funcao === 'operador'))).catch(() => {}); }, []);

  async function carregar() {
    setACarregar(true); setErro('');
    try {
      const params = { de, ate, granularidade: gran };
      if (ambitoTipo === 'cliente' && ambitoValor) params.cliente = ambitoValor;
      if (ambitoTipo === 'operador' && ambitoValor) params.operador = ambitoValor;
      if (ambitoTipo === 'equipa' && ambitoValor) params.equipa = ambitoValor;
      setDados(await api.relatorios(params));
    } catch (e) {
      setErro(e.message || 'Falha ao gerar o relatório.');
    } finally {
      setACarregar(false);
    }
  }
  useEffect(() => { carregar(); /* eslint-disable-next-line */ }, []);

  useEffect(() => {
    const Chart = window.Chart;
    if (!Chart || !dados) return;
    Object.values(charts.current).forEach((c) => c && c.destroy());
    charts.current = {};
    const grelha = { grid: { color: 'rgba(148,163,184,0.12)' }, ticks: { color: '#94a3b8' } };
    const leg = { legend: { labels: { color: '#cbd5e1' } } };

    if (refs.ev.current) charts.current.ev = new Chart(refs.ev.current, {
      type: 'line',
      data: { labels: dados.evolucao.map((p) => rotuloPeriodo(p.periodo, dados.periodo.granularidade)), datasets: [
        { label: 'Recebidos', data: dados.evolucao.map((p) => p.recebidos), borderColor: '#14c8b8', backgroundColor: 'rgba(20,200,184,0.18)', tension: 0.35, fill: true, pointRadius: 0 },
        { label: 'Resolvidos', data: dados.evolucao.map((p) => p.resolvidos), borderColor: '#34d399', backgroundColor: 'rgba(52,211,153,0.14)', tension: 0.35, fill: true, pointRadius: 0 },
      ] },
      options: { responsive: true, maintainAspectRatio: false, scales: { x: grelha, y: { ...grelha, beginAtZero: true } }, plugins: leg },
    });

    if (refs.cat.current) charts.current.cat = new Chart(refs.cat.current, {
      type: 'doughnut',
      data: { labels: dados.categorias.map((c) => ROTULO_CATEGORIA[c.categoria_ticket] || c.categoria_ticket), datasets: [{ data: dados.categorias.map((c) => c.total), backgroundColor: CORES, borderColor: '#0b1020', borderWidth: 3 }] },
      options: { responsive: true, maintainAspectRatio: false, cutout: '60%', plugins: { legend: { position: 'bottom', labels: { color: '#cbd5e1', boxWidth: 12 } } } },
    });

    if (refs.op.current) charts.current.op = new Chart(refs.op.current, {
      type: 'bar',
      data: { labels: dados.operadores.map((o) => o.nome), datasets: [{ label: 'Cumprimento SLA (%)', data: dados.operadores.map((o) => o.taxa_sla ?? 0), backgroundColor: dados.operadores.map((o) => (o.taxa_sla >= 95 ? '#34d399' : o.taxa_sla >= 90 ? '#fbbf24' : '#fb7185')), borderRadius: 6 }] },
      options: { responsive: true, maintainAspectRatio: false, scales: { x: grelha, y: { ...grelha, beginAtZero: true, max: 100 } }, plugins: { legend: { display: false } } },
    });

    if (refs.dow.current) charts.current.dow = new Chart(refs.dow.current, {
      type: 'bar',
      data: { labels: dados.diaSemana.map((d) => DIAS[d.dia]), datasets: [{ label: 'Recebidos', data: dados.diaSemana.map((d) => d.recebidos), backgroundColor: '#4ed8c7', borderRadius: 6 }] },
      options: { responsive: true, maintainAspectRatio: false, scales: { x: grelha, y: { ...grelha, beginAtZero: true } }, plugins: { legend: { display: false } } },
    });

    if (refs.hora.current) charts.current.hora = new Chart(refs.hora.current, {
      type: 'bar',
      data: { labels: dados.hora.map((h) => `${h.hora}h`), datasets: [{ label: 'Recebidos', data: dados.hora.map((h) => h.recebidos), backgroundColor: '#22d3ee', borderRadius: 5 }] },
      options: { responsive: true, maintainAspectRatio: false, scales: { x: grelha, y: { ...grelha, beginAtZero: true } }, plugins: { legend: { display: false } } },
    });

    return () => { Object.values(charts.current).forEach((c) => c && c.destroy()); charts.current = {}; };
  }, [dados]); // eslint-disable-line react-hooks/exhaustive-deps

  const g = dados?.geral;
  const cmp = dados?.comparativo || {};
  const ev = dados?.evolucao || [];
  const sparkSla = ev.map((p) => (p.resolvidos > 0 ? Math.round((p.cumpridos / p.resolvidos) * 100) : null));

  const ambitoTexto = useMemo(() => {
    if (!dados) return 'Global';
    const a = dados.ambito || {};
    if (a.cliente) return `Cliente · ${a.cliente}`;
    if (a.operador) { const o = operadoresLista.find((x) => x.id === a.operador); return `Operador · ${o ? o.nome : a.operador}`; }
    if (a.equipa) return `Equipa · ${ROTULO_CATEGORIA[a.equipa] || a.equipa}`;
    return 'Global (todas as equipas)';
  }, [dados, operadoresLista]);

  function exportarExcel() {
    const XLSX = window.XLSX;
    if (!XLSX) { alert('Biblioteca de Excel não carregada. Verifique a ligação à Internet.'); return; }
    if (!dados) return;
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([{
      'De': dados.periodo.de, 'Até': dados.periodo.ate, 'Âmbito': ambitoTexto,
      'Total': g.total, 'Resolvidos': g.resolvidos, 'Abertos': g.abertos, 'SLA violado (aberto)': g.violados_abertos,
      'Cumprimento SLA (%)': g.taxa_sla, 'Horas médias resolução': g.horas_resolucao_media,
      '1.ª resposta (h)': g.horas_resposta_media, 'Resolução horas úteis (h)': g.horas_uteis_resolucao_media,
      'Vendas ganhas': g.vendas_ganho, 'Vendas perdidas': g.vendas_perdido,
      'Conversão (%)': g.taxa_conversao, 'Receita (€)': g.receita, 'Ticket médio (€)': g.ticket_medio,
      'CSAT médio (/5)': g.csat_media, 'Respostas CSAT': g.csat_respostas, 'Taxa resposta CSAT (%)': g.taxa_resposta_csat,
      'Bilhetes emitidos': g.bilhetes_emitidos, 'Bilhetes c/ erro': g.bilhetes_com_erro, 'Precisão emissão (%)': g.precisao_emissao,
    }]), 'Resumo');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(dados.clientes.map((c) => ({
      'Cliente': c.remetente, 'Domínio': c.dominio, 'Total': c.total, 'Resolvidos': c.resolvidos,
      'Cumprimento SLA (%)': c.taxa_sla, 'Horas médias': c.horas_resolucao_media,
      'Ganhas': c.vendas_ganho, 'Perdidas': c.vendas_perdido, 'Conversão (%)': c.taxa_conversao, 'Receita (€)': c.receita,
    }))), 'Clientes');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(dados.operadores.map((o) => ({
      'Operador': o.nome, 'Categoria': ROTULO_CATEGORIA[o.categoria] || o.categoria, 'Total': o.total, 'Resolvidos': o.resolvidos,
      'Cumprimento SLA (%)': o.taxa_sla, 'Horas médias': o.horas_resolucao_media, '1.ª resposta (h)': o.horas_resposta_media,
      'Resolução horas úteis (h)': o.horas_uteis_resolucao_media, 'Ganhas': o.vendas_ganho, 'Perdidas': o.vendas_perdido,
      'Conversão (%)': o.taxa_conversao, 'Receita (€)': o.receita,
      'Bilhetes emitidos': o.bilhetes_emitidos, 'Bilhetes c/ erro': o.bilhetes_com_erro, 'Precisão emissão (%)': o.precisao_emissao,
    }))), 'Operadores');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(dados.categorias.map((c) => ({
      'Equipa': ROTULO_CATEGORIA[c.categoria_ticket] || c.categoria_ticket, 'Total': c.total, 'Resolvidos': c.resolvidos,
      'Cumprimento SLA (%)': c.taxa_sla, 'Conversão (%)': c.taxa_conversao, 'Receita (€)': c.receita,
    }))), 'Equipas');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(dados.diaSemana.map((d) => ({ 'Dia': DIAS[d.dia], 'Recebidos': d.recebidos, 'Resolvidos': d.resolvidos, 'Cumpridos': d.cumpridos }))), 'Dia da semana');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(dados.hora.map((h) => ({ 'Hora': `${h.hora}h`, 'Recebidos': h.recebidos }))), 'Hora');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(dados.evolucao.map((p) => ({ 'Período': p.periodo, 'Recebidos': p.recebidos, 'Resolvidos': p.resolvidos, 'Cumpridos': p.cumpridos, 'Vendas ganhas': p.vendas_ganho, 'Receita (€)': p.receita }))), 'Evolução');
    XLSX.writeFile(wb, `relatorio_${dados.periodo.de}_a_${dados.periodo.ate}.xlsx`);
  }

  async function baixarPdf() {
    const params = { de, ate, granularidade: gran };
    if (ambitoTipo === 'cliente' && ambitoValor) params.cliente = ambitoValor;
    if (ambitoTipo === 'operador' && ambitoValor) params.operador = ambitoValor;
    if (ambitoTipo === 'equipa' && ambitoValor) params.equipa = ambitoValor;
    try { await api.baixarRelatorioPdf(params); } catch (e) { alert(e.message); }
  }

  async function baixarLideranca() {
    const params = { de, ate };
    if (ambitoTipo === 'cliente' && ambitoValor) params.cliente = ambitoValor;
    if (ambitoTipo === 'operador' && ambitoValor) params.operador = ambitoValor;
    if (ambitoTipo === 'equipa' && ambitoValor) params.equipa = ambitoValor;
    try { await api.baixarLiderancaPdf(params); } catch (e) { alert(e.message); }
  }

  const ins = dados?.insights || {};
  const recs = ins.recomendacoes || [];
  const corImpacto = (i) => i === 'Alto' ? 'bg-rose-500/15 text-rose-300 ring-rose-500/30' : i === 'Médio' ? 'bg-amber-500/15 text-amber-300 ring-amber-500/30' : 'bg-slate-700/40 text-slate-300 ring-slate-600/40';
  const inputCls = 'mt-0.5 block rounded-lg border border-slate-700 bg-slate-800 px-2 py-1.5 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none';

  return (
    <div className="vm-app-bg min-h-screen px-5 py-6 text-slate-200">
      <main className="print-area mx-auto max-w-7xl">
        <div className="print-cover">
          <div className="pc-wordmark">
            <img src="/brand/voyametrics-logo-dark.svg" alt="VoyaMetrics" style={{ height: 38 }} />
          </div>
          <div className="pc-sub">Medidor SLA Email · Departamento Corporate</div>
          <div className="pc-title">Relatório de Desempenho<br />Apoio ao Cliente</div>
          <div className="pc-meta">Período: {dados?.periodo.de || de} a {dados?.periodo.ate || ate}<br />Âmbito: {ambitoTexto}</div>
        </div>

        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="vm-accent-bar" />
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-white">Relatórios analíticos</h2>
              <p className="text-sm text-slate-400">{dados?.periodo.de || de} a {dados?.periodo.ate || ate} · <span className="font-medium text-slate-200">{ambitoTexto}</span></p>
            </div>
          </div>

          <div className="no-print flex flex-wrap items-end gap-2">
            <label className="text-xs text-slate-400">De<input type="date" value={de} onChange={(e) => setDe(e.target.value)} className={inputCls} /></label>
            <label className="text-xs text-slate-400">Até<input type="date" value={ate} onChange={(e) => setAte(e.target.value)} className={inputCls} /></label>
            <label className="text-xs text-slate-400">Agregação
              <select value={gran} onChange={(e) => setGran(e.target.value)} className={inputCls}><option value="dia">Diária</option><option value="semana">Semanal</option><option value="mes">Mensal</option></select>
            </label>
            <label className="text-xs text-slate-400">Âmbito
              <select value={ambitoTipo} onChange={(e) => { setAmbitoTipo(e.target.value); setAmbitoValor(''); }} className={inputCls}><option value="tudo">Tudo</option><option value="cliente">Cliente</option><option value="operador">Operador</option><option value="equipa">Equipa</option></select>
            </label>
            {ambitoTipo === 'cliente' && <input list="lista-clientes" value={ambitoValor} onChange={(e) => setAmbitoValor(e.target.value)} placeholder="email do cliente" className={inputCls} />}
            {ambitoTipo === 'operador' && (
              <select value={ambitoValor} onChange={(e) => setAmbitoValor(e.target.value)} className={inputCls}><option value="">Escolher…</option>{operadoresLista.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}</select>
            )}
            {ambitoTipo === 'equipa' && (
              <select value={ambitoValor} onChange={(e) => setAmbitoValor(e.target.value)} className={inputCls}><option value="">Escolher…</option><option value="emergencias">Emergências</option><option value="alteracoes">Alterações de Reservas</option><option value="cotacoes">Cotações / Orçamentos</option><option value="reclamacoes">Reclamações / Reembolsos</option></select>
            )}
            <button onClick={carregar} disabled={aCarregar} className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:opacity-50">{aCarregar ? 'A gerar…' : 'Gerar'}</button>
            <button onClick={exportarExcel} disabled={!dados} className="rounded-lg border border-emerald-500/40 px-3 py-2 text-sm font-medium text-emerald-300 transition hover:bg-emerald-500/10 disabled:opacity-50">Excel</button>
            <button onClick={baixarPdf} disabled={!dados} title="PDF de marca gerado no servidor" className="rounded-lg border border-slate-600 px-3 py-2 text-sm font-medium text-slate-300 transition hover:bg-slate-700/40 disabled:opacity-50">PDF</button>
            <button onClick={baixarLideranca} disabled={!dados} title="Balanço de Liderança — storytelling, análise e gráficos (adapta-se ao âmbito seleccionado)" className="rounded-lg border border-amber-500/40 px-3 py-2 text-sm font-semibold text-amber-300 transition hover:bg-amber-500/10 disabled:opacity-50">PDF Liderança</button>
          </div>
        </div>

        <datalist id="lista-clientes">{(dados?.clientes || []).map((c) => <option key={c.remetente} value={c.remetente} />)}</datalist>
        {erro && <p className="mb-4 rounded-lg bg-rose-500/10 px-4 py-2 text-sm text-rose-300 ring-1 ring-rose-500/30">{erro}</p>}

        {!dados ? (
          <p className="py-16 text-center text-slate-500">{aCarregar ? 'A gerar relatório…' : 'Sem dados.'}</p>
        ) : (
          <>
            {ins.destaque && (
              <div className="mb-4 rounded-2xl border border-indigo-500/30 bg-gradient-to-r from-indigo-500/15 to-cyan-500/10 px-5 py-3 ring-1 ring-white/5">
                <p className="text-[10.5px] font-semibold uppercase tracking-wider text-indigo-300">Leitura do período</p>
                <p className="mt-0.5 text-lg font-bold text-white">{ins.destaque}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
              <KpiRich rotulo="Recebidos" valor={num.format(g.total)} accent="sky" spark={ev.map((p) => p.recebidos)} delta={cmp.total_pct != null ? signedPct(cmp.total_pct) : ''} deltaUp={(cmp.total_pct || 0) >= 0} />
              <KpiRich rotulo="Resolvidos" valor={num.format(g.resolvidos)} accent="emerald" spark={ev.map((p) => p.resolvidos)} />
              <KpiRich rotulo="Cumprimento SLA" valor={pct(g.taxa_sla)} accent={g.taxa_sla >= 95 ? 'cyan' : g.taxa_sla >= 85 ? 'amber' : 'rose'} spark={sparkSla} delta={cmp.taxa_sla_pp != null ? signedPP(cmp.taxa_sla_pp) : ''} deltaUp={(cmp.taxa_sla_pp || 0) >= 0} dica="Resolvidos dentro do prazo / resolvidos" />
              <KpiRich rotulo="SLA violado (aberto)" valor={num.format(g.violados_abertos)} accent="rose" />
              <KpiRich rotulo="Tempo médio resolução" valor={horas(g.horas_resolucao_media)} accent="violet" delta={cmp.horas_uteis_resolucao_delta != null ? signedH(cmp.horas_uteis_resolucao_delta) : ''} deltaUp={(cmp.horas_uteis_resolucao_delta || 0) <= 0} dica="Relógio de parede" />
              <KpiRich rotulo="1.ª resposta (média)" valor={horas(g.horas_resposta_media)} accent="amber" delta={cmp.horas_resposta_delta != null ? signedH(cmp.horas_resposta_delta) : ''} deltaUp={(cmp.horas_resposta_delta || 0) <= 0} dica="Tempo até ser assumido" />
              <KpiRich rotulo="Resolução (horas úteis)" valor={horas(g.horas_uteis_resolucao_media)} accent="violet" />
              <KpiRich rotulo="Conversão de vendas" valor={pct(g.taxa_conversao)} accent="fuchsia" delta={cmp.conversao_pp != null ? signedPP(cmp.conversao_pp) : ''} deltaUp={(cmp.conversao_pp || 0) >= 0} />
              <KpiRich rotulo="Receita" valor={eur.format(g.receita)} accent="emerald" spark={ev.map((p) => p.receita)} delta={cmp.receita_pct != null ? signedPct(cmp.receita_pct) : ''} deltaUp={(cmp.receita_pct || 0) >= 0} />
              <KpiRich rotulo="Ticket médio" valor={eur.format(g.ticket_medio)} accent="amber" />
              <KpiRich rotulo="Satisfação (CSAT)" valor={g.csat_media != null ? `${String(g.csat_media).replace('.', ',')}/5` : '—'} accent="amber" dica={`${num.format(g.csat_respostas || 0)} respostas · taxa ${pct(g.taxa_resposta_csat)}`} />
              <KpiRich rotulo="Precisão de emissão" valor={pct(g.precisao_emissao)} accent="cyan" dica={`${num.format(g.bilhetes_emitidos || 0)} emitidos · ${num.format(g.bilhetes_com_erro || 0)} c/ erro`} />
            </div>

            {(ins.conclusoes?.length || recs.length) ? (
              <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
                <section className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-5 ring-1 ring-white/5">
                  <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-200"><span className="grid h-6 w-6 place-items-center rounded-lg bg-indigo-500/20 text-indigo-300">∑</span>Conclusões</h3>
                  <ul className="space-y-2 text-sm text-slate-300">
                    {(ins.conclusoes || []).map((c, i) => (
                      <li key={i} className="flex gap-2"><span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-400" /><span>{c}</span></li>
                    ))}
                  </ul>
                </section>
                <section className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-5 ring-1 ring-white/5">
                  <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-200"><span className="grid h-6 w-6 place-items-center rounded-lg bg-emerald-500/20 text-emerald-300">➜</span>Recomendações priorizadas</h3>
                  <div className="space-y-2">
                    {recs.map((r, i) => (
                      <div key={i} className="rounded-xl border border-slate-700/50 bg-slate-800/40 p-3">
                        <p className="text-sm text-slate-200">{r.texto}</p>
                        <div className="mt-2 flex gap-2 text-[11px]">
                          <span className={`rounded-full px-2 py-0.5 font-semibold ring-1 ring-inset ${corImpacto(r.impacto)}`}>Impacto: {r.impacto}</span>
                          <span className="rounded-full bg-slate-700/40 px-2 py-0.5 font-medium text-slate-300 ring-1 ring-inset ring-slate-600/40">Esforço: {r.esforco}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            ) : null}

            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
              <section className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-4 ring-1 ring-white/5 lg:col-span-2">
                <h3 className="mb-3 text-sm font-semibold text-slate-200">Evolução — recebidos vs. resolvidos</h3>
                <div style={{ height: 260 }}><canvas ref={refs.ev} /></div>
              </section>
              <section className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-4 ring-1 ring-white/5">
                <h3 className="mb-3 text-sm font-semibold text-slate-200">Volume por equipa</h3>
                <div style={{ height: 260 }}><canvas ref={refs.cat} /></div>
              </section>
            </div>

            <section className="mt-4 rounded-2xl border border-slate-700/60 bg-slate-900/60 p-5 ring-1 ring-white/5">
              <h3 className="mb-3 text-sm font-semibold text-slate-200">Cumprimento por canal (vs SLA acordado)</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-[11px] uppercase tracking-wide text-slate-500">
                    <th className="pb-2 font-semibold">Canal</th><th className="pb-2 font-semibold">SLA acordado</th><th className="pb-2 font-semibold">Total</th><th className="pb-2 font-semibold">Resolução (h. úteis)</th><th className="pb-2 font-semibold">Cumprimento</th><th className="pb-2 font-semibold">Conversão</th>
                  </tr></thead>
                  <tbody className="divide-y divide-slate-800">
                    {dados.categorias.map((c) => (
                      <tr key={c.categoria_ticket} className="hover:bg-white/5">
                        <td className="py-2 font-medium text-slate-200">{ROTULO_CATEGORIA[c.categoria_ticket] || c.categoria_ticket}</td>
                        <td className="py-2 tnum text-slate-400">{c.sla_minutos != null ? `${num.format(Math.round((c.sla_minutos / 60) * 10) / 10)} h` : '—'}</td>
                        <td className="py-2 tnum text-slate-300">{num.format(c.total)}</td>
                        <td className="py-2 tnum text-slate-300">{horas(c.horas_uteis_resolucao_media)}</td>
                        <td className={`py-2 tnum font-semibold ${c.taxa_sla >= 95 ? 'text-emerald-400' : c.taxa_sla >= 85 ? 'text-amber-400' : 'text-rose-400'}`}>{pct(c.taxa_sla)}</td>
                        <td className="py-2 tnum text-slate-300">{pct(c.taxa_conversao)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
              <section className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-4 ring-1 ring-white/5">
                <h3 className="mb-3 text-sm font-semibold text-slate-200">Cumprimento de SLA por operador</h3>
                <div style={{ height: 240 }}><canvas ref={refs.op} /></div>
              </section>
              <section className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-4 ring-1 ring-white/5">
                <h3 className="mb-3 text-sm font-semibold text-slate-200">Volume por dia da semana</h3>
                <div style={{ height: 240 }}><canvas ref={refs.dow} /></div>
              </section>
            </div>

            <section className="mt-4 rounded-2xl border border-slate-700/60 bg-slate-900/60 p-4 ring-1 ring-white/5">
              <h3 className="mb-3 text-sm font-semibold text-slate-200">Volume por hora do dia (horas de ponta)</h3>
              <div style={{ height: 220 }}><canvas ref={refs.hora} /></div>
            </section>

            <section className="mt-4 rounded-2xl border border-slate-700/60 bg-slate-900/60 p-5 ring-1 ring-white/5">
              <h3 className="mb-3 text-sm font-semibold text-slate-200">Detalhe por operador</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-[11px] uppercase tracking-wide text-slate-500">
                    <th className="pb-2 font-semibold">Operador</th><th className="pb-2 font-semibold">Equipa</th><th className="pb-2 font-semibold">Total</th><th className="pb-2 font-semibold">Resolv.</th><th className="pb-2 font-semibold">SLA</th><th className="pb-2 font-semibold">1.ª resp.</th><th className="pb-2 font-semibold">H. úteis</th><th className="pb-2 font-semibold">Conversão</th><th className="pb-2 font-semibold">Receita</th><th className="pb-2 font-semibold">Precisão</th>
                  </tr></thead>
                  <tbody className="divide-y divide-slate-800">
                    {dados.operadores.map((o) => (
                      <tr key={o.id} className="hover:bg-white/5">
                        <td className="py-2 font-medium text-slate-200">{o.nome}</td>
                        <td className="py-2 text-slate-400">{ROTULO_CATEGORIA[o.categoria] || o.categoria}</td>
                        <td className="py-2 tnum text-slate-300">{num.format(o.total)}</td><td className="py-2 tnum text-slate-300">{num.format(o.resolvidos)}</td>
                        <td className={`py-2 tnum font-semibold ${o.taxa_sla >= 95 ? 'text-emerald-400' : o.taxa_sla >= 85 ? 'text-amber-400' : 'text-rose-400'}`}>{pct(o.taxa_sla)}</td>
                        <td className="py-2 tnum text-slate-300">{horas(o.horas_resposta_media)}</td>
                        <td className="py-2 tnum text-slate-300">{horas(o.horas_uteis_resolucao_media)}</td><td className="py-2 tnum text-slate-300">{pct(o.taxa_conversao)}</td>
                        <td className="py-2 tnum text-emerald-300">{eur.format(o.receita)}</td><td className="py-2 tnum text-slate-300">{pct(o.precisao_emissao)}</td>
                      </tr>
                    ))}
                    {dados.operadores.length === 0 && <tr><td colSpan={10} className="py-6 text-center text-slate-500">Sem dados no período.</td></tr>}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="mt-4 rounded-2xl border border-slate-700/60 bg-slate-900/60 p-5 ring-1 ring-white/5">
              <h3 className="mb-3 text-sm font-semibold text-slate-200">Top clientes (por volume)</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-[11px] uppercase tracking-wide text-slate-500">
                    <th className="pb-2 font-semibold">Cliente</th><th className="pb-2 font-semibold">Total</th><th className="pb-2 font-semibold">Resolv.</th><th className="pb-2 font-semibold">SLA</th><th className="pb-2 font-semibold">Conversão</th><th className="pb-2 font-semibold">Receita</th>
                  </tr></thead>
                  <tbody className="divide-y divide-slate-800">
                    {dados.clientes.slice(0, 50).map((c) => (
                      <tr key={c.remetente} className="hover:bg-white/5">
                        <td className="py-2 font-medium text-slate-200">{c.remetente}</td>
                        <td className="py-2 tnum text-slate-300">{num.format(c.total)}</td><td className="py-2 tnum text-slate-300">{num.format(c.resolvidos)}</td>
                        <td className="py-2 tnum text-slate-300">{pct(c.taxa_sla)}</td><td className="py-2 tnum text-slate-300">{pct(c.taxa_conversao)}</td>
                        <td className="py-2 tnum text-emerald-300">{eur.format(c.receita)}</td>
                      </tr>
                    ))}
                    {dados.clientes.length === 0 && <tr><td colSpan={6} className="py-6 text-center text-slate-500">Sem dados no período.</td></tr>}
                  </tbody>
                </table>
              </div>
              {dados.clientes.length > 50 && <p className="mt-2 text-xs text-slate-500">A mostrar os 50 maiores. O Excel inclui todos ({num.format(dados.clientes.length)}).</p>}
            </section>

            <p className="mt-4 text-xs text-slate-500">Tempo de resolução em relógio de parede; cumprimento de SLA medido em horas úteis (Seg–Sex, 09h30–19h00, feriados nacionais excluídos).</p>
          </>
        )}
      </main>
    </div>
  );
}
