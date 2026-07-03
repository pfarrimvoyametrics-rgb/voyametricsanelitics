import { useEffect, useState } from 'react';
import { api } from '../api/client';

/**
 * CsatPublic — inquérito de satisfação PÚBLICO (sem login).
 * Aberto pelo cliente através do link  http://.../?csat=<id-do-ticket>
 */
export default function CsatPublic({ id }) {
  const [info, setInfo] = useState(null);
  const [erro, setErro] = useState('');
  const [nota, setNota] = useState(0);
  const [hover, setHover] = useState(0);
  const [comentario, setComentario] = useState('');
  const [estado, setEstado] = useState('carregar'); // carregar | pronto | enviado | erro

  useEffect(() => {
    api.csatObter(id)
      .then((d) => { setInfo(d); setEstado(d.ja_respondido ? 'enviado' : 'pronto'); })
      .catch(() => { setErro('Não foi possível abrir o inquérito.'); setEstado('erro'); });
  }, [id]);

  async function enviar() {
    if (!nota) return;
    try {
      await api.csatEnviar(id, nota, comentario);
      setEstado('enviado');
    } catch (e) {
      setErro(e.message || 'Falha ao enviar.');
    }
  }

  return (
    <div className="grid min-h-full place-items-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center gap-3">
          <img src="/brand/voyametrics-logo-primary.svg" alt="VoyaMetrics" className="h-9 w-auto" />
          <div>
            <h1 className="text-lg font-bold text-slate-800">Apoio ao Cliente</h1>
            <p className="text-sm text-slate-500">A sua opinião ajuda-nos a melhorar.</p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          {estado === 'carregar' && <p className="text-center text-slate-400">A carregar…</p>}

          {estado === 'erro' && <p className="text-center text-rose-600">{erro}</p>}

          {estado === 'enviado' && (
            <div className="py-6 text-center">
              <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-emerald-100 text-emerald-700">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M20 6 9 17l-5-5" /></svg>
              </div>
              <p className="font-semibold text-slate-800">Obrigado pela sua resposta!</p>
              <p className="mt-1 text-sm text-slate-500">A sua avaliação foi registada.</p>
            </div>
          )}

          {estado === 'pronto' && (
            <>
              {info?.assunto && <p className="mb-1 text-sm text-slate-500">Sobre: <span className="font-medium text-slate-700">{info.assunto}</span></p>}
              <p className="mb-3 text-sm font-medium text-slate-700">Como avalia o nosso atendimento?</p>
              <div className="mb-4 flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} type="button"
                    onMouseEnter={() => setHover(n)} onMouseLeave={() => setHover(0)} onClick={() => setNota(n)}
                    className="text-3xl leading-none transition" aria-label={`${n} estrelas`}>
                    <span className={(hover || nota) >= n ? 'text-amber-400' : 'text-slate-300'}>★</span>
                  </button>
                ))}
                {nota > 0 && <span className="ml-2 text-sm text-slate-500">{nota}/5</span>}
              </div>
              <textarea value={comentario} onChange={(e) => setComentario(e.target.value)} rows={4}
                placeholder="Quer deixar um comentário? (opcional)"
                className="mb-3 w-full resize-y rounded-xl border border-slate-300 p-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200" />
              {erro && <p className="mb-2 text-sm text-rose-600">{erro}</p>}
              <button onClick={enviar} disabled={!nota}
                className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50">
                Enviar avaliação
              </button>
            </>
          )}
        </div>
        <p className="mt-4 text-center text-xs text-slate-400">VoyaMetrics — Medidor SLA Email</p>
      </div>
    </div>
  );
}
