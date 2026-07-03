import { useMemo } from 'react';

/**
 * KpisFila — faixa de KPIs do PRÓPRIO operador, no topo da sua fila.
 * Contagens (por tratar / pendentes / em curso) são calculadas ao vivo a partir
 * da lista activa; resolvidos, valor ganho e as séries de 7 dias vêm do
 * endpoint /api/tickets/meus-kpis. Mini-gráficos em SVG (sparklines e barras).
 */

const eur = new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const num = new Intl.NumberFormat('pt-PT');

const CORES = { sky: '#38bdf8', amber: '#fbbf24', teal: '#2dd4c4', emerald: '#34d399', gold: '#f5b301' };

const ICON = {
  inbox: 'M22 12h-6l-2 3h-4l-2-3H2 M5.5 5.5h13L22 12v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6l3.5-6.5Z',
  clock: 'M12 7v5l3 2 M12 3a9 9 0 1 0 9 9',
  spinner: 'M21 12a9 9 0 1 1-6.2-8.5',
  check: 'M20 6 9 17l-5-5',
  euro: 'M14 21a8 8 0 1 1 0-16 M4 11h9 M4 15h7',
};

function Sparkline({ data = [], color = '#38bdf8' }) {
  const pts = data.map((v) => Number(v) || 0);
  const max = pts.length ? Math.max(...pts) : 0;
  if (pts.length < 2 || max === 0) {
    return <div className="h-9 w-full rounded-md" style={{ background: `linear-gradient(90deg, ${color}22, transparent)` }} />;
  }
  const min = Math.min(...pts), rng = max - min || 1;
  const X = (i) => (i / (pts.length - 1)) * 100;
  const Y = (v) => 30 - ((v - min) / rng) * 23 - 3;
  const linha = pts.map((v, i) => `${X(i)},${Y(v)}`).join(' ');
  const ultimo = pts.length - 1;
  const gid = 'kpi' + String(color).replace('#', '');
  return (
    <svg viewBox="0 0 100 32" preserveAspectRatio="none" className="h-9 w-full overflow-visible">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.4" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline points={`0,32 ${linha} 100,32`} fill={`url(#${gid})`} />
      <polyline points={linha} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={X(ultimo)} cy={Y(pts[ultimo])} r="2.2" fill={color} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function Barra({ frac = 0, color = '#38bdf8' }) {
  const p = Math.max(0, Math.min(1, frac || 0));
  return (
    <div className="flex h-9 items-end pb-1.5">
      <div className="h-2 w-full overflow-hidden rounded-full bg-white/10 ring-1 ring-inset ring-white/5">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${p * 100}%`, background: `linear-gradient(90deg, ${color}, ${color}cc)`, boxShadow: `0 0 10px ${color}80` }} />
      </div>
    </div>
  );
}

function Cartao({ rotulo, valor, sub, color, icone, children }) {
  return (
    <div className="vm-panel vm-panel-hover vm-enter flex flex-col gap-1.5 overflow-hidden p-4">
      {/* aura de cor ao fundo */}
      <span className="pointer-events-none absolute -right-6 -top-8 h-20 w-20 rounded-full opacity-20 blur-2xl" style={{ background: color }} aria-hidden />
      <div className="flex items-center justify-between gap-2">
        <p className="vm-eyebrow">{rotulo}</p>
        <span className="grid h-7 w-7 place-items-center rounded-lg ring-1 ring-inset ring-white/10" style={{ background: `${color}1f`, color }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={ICON[icone] || ICON.inbox} /></svg>
        </span>
      </div>
      <p className="tnum text-2xl font-extrabold tracking-tight text-white">{valor}</p>
      <div className="mt-0.5">{children}</div>
      {sub ? <p className="text-[11px] leading-tight text-slate-500">{sub}</p> : null}
    </div>
  );
}

export default function KpisFila({ kpis, tickets = [], utilizadorId }) {
  const live = useMemo(() => {
    const porTratar = tickets.length;
    const pendentes = tickets.filter((t) => t.status === 'pendente').length;
    const emCursoCategoria = tickets.filter((t) => t.status === 'em_andamento').length;
    const emCursoMeus = tickets.filter((t) => t.status === 'em_andamento' && t.operador_atribuido_id === utilizadorId).length;
    return { porTratar, pendentes, emCursoCategoria, emCursoMeus };
  }, [tickets, utilizadorId]);

  const serie = kpis?.serie || [];
  const snap = kpis?.snapshot || {};
  const recebidos = serie.map((d) => d.recebidos);
  const resolvidosSerie = serie.map((d) => d.resolvidos);
  const valorSerie = serie.map((d) => d.valor);
  const valor7d = valorSerie.reduce((s, v) => s + (Number(v) || 0), 0);

  return (
    <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      <Cartao rotulo="Emails por tratar" valor={num.format(live.porTratar)} color={CORES.sky} icone="inbox" sub="entradas — últimos 7 dias">
        <Sparkline data={recebidos} color={CORES.sky} />
      </Cartao>

      <Cartao
        rotulo="Pendentes"
        valor={num.format(live.pendentes)}
        color={CORES.amber}
        icone="clock"
        sub={live.porTratar ? `${Math.round((live.pendentes / live.porTratar) * 100)}% da fila por atribuir` : 'fila vazia'}
      >
        <Barra frac={live.porTratar ? live.pendentes / live.porTratar : 0} color={CORES.amber} />
      </Cartao>

      <Cartao
        rotulo="Em curso (meus)"
        valor={num.format(live.emCursoMeus)}
        color={CORES.teal}
        icone="spinner"
        sub={`${num.format(live.emCursoCategoria)} em curso na categoria`}
      >
        <Barra frac={live.emCursoCategoria ? live.emCursoMeus / live.emCursoCategoria : 0} color={CORES.teal} />
      </Cartao>

      <Cartao
        rotulo="Resolvidos (meus)"
        valor={kpis ? num.format(snap.resolvidos_meus || 0) : '—'}
        color={CORES.emerald}
        icone="check"
        sub={kpis ? `${num.format(snap.resolvidos_hoje_meus || 0)} hoje · 7 dias` : 'a carregar…'}
      >
        <Sparkline data={resolvidosSerie} color={CORES.emerald} />
      </Cartao>

      <Cartao
        rotulo="Valor ganho (meu)"
        valor={kpis ? eur.format(snap.valor_ganho_meus || 0) : '—'}
        color={CORES.gold}
        icone="euro"
        sub={kpis ? `${eur.format(valor7d)} nos últimos 7 dias` : 'a carregar…'}
      >
        <Sparkline data={valorSerie} color={CORES.gold} />
      </Cartao>
    </div>
  );
}
