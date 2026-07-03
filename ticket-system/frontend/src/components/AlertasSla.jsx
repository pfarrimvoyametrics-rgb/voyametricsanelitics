import { useEffect, useMemo, useRef, useState } from 'react';

/**
 * AlertasSla — Camada de alertas de SLA sobre a lista de tickets visível.
 *
 * Dois níveis:
 *   1) AVISO (30 min finais): para cada email por responder que entra nos
 *      últimos 30 minutos do prazo, surge UM toast (uma vez por email) e um
 *      sinal sonoro curto.
 *   2) CRÍTICO (prazo ultrapassado): enquanto houver emails por responder com
 *      o SLA já vencido, mostra-se um popup INTERMITENTE no topo, com a lista
 *      (remetente + assunto + atraso). Pode silenciar-se e dispensar-se; o
 *      popup reaparece se surgir um novo email vencido.
 *
 * "Por responder" = qualquer ticket com status diferente de 'resolvido'.
 */

const TRINTA_MIN = 30 * 60 * 1000;

function formatarDuracao(ms) {
  const total = Math.floor(Math.abs(ms) / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  const s = total % 60;
  return `${m}m ${String(s).padStart(2, '0')}s`;
}

// Sinal sonoro curto (Web Audio). Falha em silêncio se o browser bloquear.
function apitar(frequencia = 880, duracaoMs = 170) {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = frequencia;
    gain.gain.value = 0.06;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    setTimeout(() => { osc.stop(); ctx.close(); }, duracaoMs);
  } catch {
    /* ambiente sem áudio — ignorar */
  }
}

export default function AlertasSla({ tickets }) {
  const [agora, setAgora] = useState(Date.now());
  const [toasts, setToasts] = useState([]);
  const [silenciado, setSilenciado] = useState(false);
  const [dispensadoSig, setDispensadoSig] = useState('');

  const avisados = useRef(new Set());   // ids já avisados aos 30 min
  const vencidosRef = useRef(new Set()); // ids já vencidos (para som único)

  // Relógio de 1 s.
  useEffect(() => {
    const id = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const naoResolvidos = useMemo(
    () => (tickets || []).filter((t) => t.status !== 'resolvido'),
    [tickets]
  );

  const vencidos = useMemo(
    () => naoResolvidos
      .filter((t) => new Date(t.sla_limite).getTime() - agora <= 0)
      .sort((a, b) => new Date(a.sla_limite) - new Date(b.sla_limite)),
    [naoResolvidos, agora]
  );

  const aExpirar = useMemo(
    () => naoResolvidos.filter((t) => {
      const r = new Date(t.sla_limite).getTime() - agora;
      return r > 0 && r <= TRINTA_MIN;
    }),
    [naoResolvidos, agora]
  );

  // Detetar novos avisos (30 min) e novos vencidos a cada tique.
  useEffect(() => {
    const idsAtuais = new Set(naoResolvidos.map((t) => t.id));

    // Limpeza: tickets resolvidos/saídos podem voltar a avisar no futuro.
    avisados.current.forEach((id) => { if (!idsAtuais.has(id)) avisados.current.delete(id); });
    vencidosRef.current.forEach((id) => { if (!idsAtuais.has(id)) vencidosRef.current.delete(id); });

    // Novos avisos de 30 min -> toast (uma vez por email).
    const novosAvisos = aExpirar.filter((t) => !avisados.current.has(t.id));
    if (novosAvisos.length) {
      novosAvisos.forEach((t) => avisados.current.add(t.id));
      if (!silenciado) apitar(880, 150);
    }

    // Novos vencidos -> som mais marcado (o popup trata da parte visual).
    const novosVencidos = vencidos.filter((t) => !vencidosRef.current.has(t.id));
    vencidos.forEach((t) => vencidosRef.current.add(t.id));
    if (novosVencidos.length && !silenciado) apitar(1320, 240);

    // Atualizar pilha de toasts: juntar novos e descartar os com mais de 12 s.
    setToasts((prev) => {
      const adicionados = novosAvisos.map((t) => ({
        chave: `${t.id}-${Date.now()}`,
        remetente: t.remetente,
        assunto: t.assunto,
        limite: t.sla_limite,
        ts: Date.now(),
      }));
      return [...prev, ...adicionados].filter((x) => Date.now() - x.ts < 12000);
    });
  }, [agora]); // eslint-disable-line react-hooks/exhaustive-deps

  const sigVencidos = useMemo(() => vencidos.map((t) => t.id).sort().join('|'), [vencidos]);
  const mostrarPopup = vencidos.length > 0 && sigVencidos !== dispensadoSig;

  return (
    <>
      {/* ---------- POPUP CRÍTICO (SLA ultrapassado) ---------- */}
      {mostrarPopup && (
        <div className="pointer-events-none fixed inset-x-0 top-4 z-50 flex justify-center px-4">
          <div
            role="alertdialog"
            aria-live="assertive"
            className="flash-alerta pointer-events-auto w-full max-w-xl rounded-2xl border-2 border-rose-500 p-4 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-rose-600 text-white">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
                  </svg>
                </span>
                <div>
                  <p className="text-sm font-extrabold uppercase tracking-wide text-rose-700">
                    SLA ultrapassado · {vencidos.length} email{vencidos.length > 1 ? 's' : ''}
                  </p>
                  <p className="text-xs text-rose-600">Por responder com o prazo já vencido. Priorize já.</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setSilenciado((s) => !s)}
                  className="rounded-md px-2 py-1 text-xs font-medium text-rose-700 hover:bg-rose-100"
                  title={silenciado ? 'Ativar som' : 'Silenciar som'}
                >
                  {silenciado ? '🔇' : '🔔'}
                </button>
                <button
                  onClick={() => setDispensadoSig(sigVencidos)}
                  className="rounded-md px-2 py-1 text-xs font-medium text-rose-700 hover:bg-rose-100"
                  title="Dispensar (reaparece se surgir novo email vencido)"
                >
                  Dispensar
                </button>
              </div>
            </div>

            <ul className="mt-3 max-h-52 space-y-1.5 overflow-auto pr-1">
              {vencidos.map((t) => (
                <li
                  key={t.id}
                  className="flex items-center justify-between gap-3 rounded-lg bg-white/70 px-3 py-2 text-sm ring-1 ring-inset ring-rose-200"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-semibold text-slate-800">{t.assunto || '(sem assunto)'}</span>
                    <span className="block truncate text-xs text-slate-500">{t.remetente}</span>
                  </span>
                  <span className="tnum shrink-0 rounded-md bg-rose-600 px-2 py-1 text-xs font-bold text-white">
                    +{formatarDuracao(new Date(t.sla_limite).getTime() - agora)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* ---------- TOASTS DE AVISO (30 min finais) ---------- */}
      <div className="fixed bottom-4 right-4 z-40 flex w-80 flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.chave}
            className="toast-entra rounded-xl border border-amber-200 bg-amber-50 p-3 shadow-lg"
            role="status"
          >
            <div className="flex items-start gap-2">
              <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-amber-500 text-white">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                  <path d="M12 8v5M12 16h.01" /><circle cx="12" cy="12" r="9" />
                </svg>
              </span>
              <div className="min-w-0">
                <p className="text-xs font-bold text-amber-800">Faltam menos de 30 min para o SLA</p>
                <p className="truncate text-sm font-semibold text-slate-800" title={t.assunto}>
                  {t.assunto || '(sem assunto)'}
                </p>
                <p className="truncate text-xs text-slate-500">{t.remetente}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
