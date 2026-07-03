import { useEffect, useState } from 'react';
import { api } from '../api/client';

/**
 * RelatoriosBasico — resumo analítico SÓ LEITURA para o Admin da empresa cliente.
 * KPIs essenciais + evolução simples, sem exportação. Os relatórios detalhados
 * (com PDF/Excel e Balanço de Liderança) são exclusivos do consultor.
 */
const num = new Intl.NumberFormat('pt-PT');
const pct = (v) => (v == null ? '—' : `${num.format(v)}%`);
const horas = (v) => (v == null ? '—' : `${num.format(v)} h`);
const hojeMenos = (d) => { const x = new Date(); x.setDate(x.getDate() - d); return x.toISOString().slice(0, 10); };
const hoje = () => new Date().toISOString().slice(0, 10);

function Kpi({ rotulo, valor, cor = 'text-slate-800', dica }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm" title={dica}>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{rotulo}</p>
      <p className={`mt-1 tnum text-2xl font-bold ${cor}`}>{valor}</p>
    </div>
  );
}

/** Mini-gráfico de evolução (SVG, sem dependências). */
function Spark({ dados }) {
  const pts = (dados || []).map((p) => Number(p.recebidos) || 0);
  if (pts.length < 2) return null;
  const max = Math.max(...pts, 1);
  const X = (i) => (i / (pts.length - 1)) * 100;
  const Y = (v) => 34 - (v / max) * 30 - 2;
  const linha = pts.map((v, i) => `${X(i)},${Y(v)}`).join(' ');
  return (
    <svg viewBox="0 0 100 36" preserveAspectRatio="none" className="h-16 w-full">
      <polyline points={linha} fill="none" stroke="#4f46e5" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export default function RelatoriosBasico() {
  const [de, setDe] = useState(hojeMenos(30));
  const [ate, setAte] = useState(hoje());
  const [dados, setDados] = useState(null);
  const [aCarregar, setACarregar] = useState(false);
  const [erro, setErro] = useState('');

  async function carregar() {
    setACarregar(true); setErro('');
    try {
      setDados(await api.relatorios({ de, ate }));
    } catch (e) {
      setErro(e.message || 'Falha ao gerar o relatório.');
    } finally {
      setACarregar(false);
    }
  }
  useEffect(() => { carregar(); /* eslint-disable-next-line */ }, []);

  const g = dados?.geral || {};
  const inputCls = 'rounded-lg border border-slate-300 px-2 py-1.5 text-sm text-slate-700 focus:border-indigo-500 focus:outline-none';

  return (
    <main className="mx-auto max-w-7xl px-5 py-6">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Relatórios</h1>
          <p className="text-sm text-slate-500">Resumo de desempenho da sua equipa (só leitura).</p>
        </div>
        <div className="flex items-end gap-2">
          <label className="text-xs text-slate-500">De<br /><input type="date" value={de} max={ate} onChange={(e) => setDe(e.target.value)} className={inputCls} /></label>
          <label className="text-xs text-slate-500">Até<br /><input type="date" value={ate} min={de} max={hoje()} onChange={(e) => setAte(e.target.value)} className={inputCls} /></label>
          <button onClick={carregar} disabled={aCarregar}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60">
            {aCarregar ? 'A gerar…' : 'Atualizar'}
          </button>
        </div>
      </div>

      {erro && <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700">{erro}</div>}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Kpi rotulo="Cumprimento SLA" valor={pct(g.taxa_sla)} cor="text-emerald-600" dica="Resolvidos dentro do prazo" />
        <Kpi rotulo="Recebidos" valor={num.format(g.total || 0)} />
        <Kpi rotulo="Resolvidos" valor={num.format(g.resolvidos || 0)} />
        <Kpi rotulo="Por tratar" valor={num.format(g.abertos || 0)} cor="text-slate-800" />
        <Kpi rotulo="Satisfação (CSAT)" valor={g.csat_media != null ? `${num.format(g.csat_media)}/5` : '—'} cor="text-amber-600" />
        <Kpi rotulo="Tempo médio resol." valor={horas(g.horas_resolucao_media)} dica="Relógio de parede" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">Evolução (recebidos)</p>
          {dados?.evolucao?.length ? <Spark dados={dados.evolucao} /> : <p className="py-6 text-center text-sm text-slate-400">Sem dados no período.</p>}
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">Tempos</p>
          <dl className="space-y-1.5 text-sm">
            <div className="flex justify-between"><dt className="text-slate-500">1.ª resposta (média)</dt><dd className="font-semibold text-slate-700">{horas(g.horas_resposta_media)}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Resolução em horas úteis</dt><dd className="font-semibold text-slate-700">{horas(g.horas_uteis_resolucao_media)}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Vencidos por tratar</dt><dd className="font-semibold text-rose-600">{num.format(g.violados_abertos || 0)}</dd></div>
          </dl>
        </div>
      </div>

      <p className="mt-6 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
        Precisa de uma análise detalhada (por operador, cliente, canal) ou de um relatório em PDF?
        O seu consultor prepara-a e envia-lha.
      </p>
    </main>
  );
}
