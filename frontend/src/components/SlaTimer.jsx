import { useEffect, useState } from 'react';

/**
 * SlaTimer — Cronómetro visual de SLA.
 *
 * Cores (sobre o instante absoluto sla_limite):
 *   • Verde    : faltam mais de 60 min
 *   • Laranja  : falta menos de 60 min
 *   • Vermelho : prazo expirado (mostra o atraso com sinal +)
 * Tickets já resolvidos mostram um estado neutro.
 *
 * Os dígitos usam .tnum (tabular-nums) para não "saltarem" a cada segundo.
 */

function formatar(ms) {
  const total = Math.floor(Math.abs(ms) / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const p = (n) => String(n).padStart(2, '0');
  return `${p(h)}:${p(m)}:${p(s)}`;
}

const ESTILOS = {
  verde:    { txt: 'text-emerald-700', bg: 'bg-emerald-50',  ponto: 'bg-emerald-500', rotulo: 'Dentro do prazo' },
  laranja:  { txt: 'text-amber-700',   bg: 'bg-amber-50',    ponto: 'bg-amber-500',   rotulo: 'A expirar' },
  vermelho: { txt: 'text-rose-700',    bg: 'bg-rose-50',     ponto: 'bg-rose-500',    rotulo: 'Expirado' },
  neutro:   { txt: 'text-slate-500',   bg: 'bg-slate-100',   ponto: 'bg-slate-400',   rotulo: 'Resolvido' },
};

export function estadoSla(slaLimite, status, agora = Date.now()) {
  if (status === 'resolvido') return 'neutro';
  const restante = new Date(slaLimite).getTime() - agora;
  if (restante <= 0) return 'vermelho';
  if (restante < 60 * 60 * 1000) return 'laranja';
  return 'verde';
}

export default function SlaTimer({ slaLimite, status, tamanho = 'md' }) {
  const [agora, setAgora] = useState(Date.now());

  useEffect(() => {
    if (status === 'resolvido') return;
    const id = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(id);
  }, [status]);

  const cor = estadoSla(slaLimite, status, agora);
  const e = ESTILOS[cor];
  const restante = new Date(slaLimite).getTime() - agora;
  const expirado = cor === 'vermelho';
  const texto = status === 'resolvido' ? '—' : `${expirado ? '+' : ''}${formatar(restante)}`;

  const dims = tamanho === 'lg' ? 'text-2xl px-3 py-1.5' : 'text-base px-2.5 py-1';

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-lg ${e.bg} ${dims}`}
      role="timer"
      aria-label={`SLA: ${e.rotulo}`}
      title={`Limite: ${new Date(slaLimite).toLocaleString('pt-PT')}`}
    >
      <span className={`inline-block h-2 w-2 rounded-full ${e.ponto} ${expirado ? 'animate-pulse' : ''}`} />
      <span className={`tnum font-semibold ${e.txt}`}>{texto}</span>
    </div>
  );
}
