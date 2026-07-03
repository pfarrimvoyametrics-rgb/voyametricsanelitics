import { useEffect, useState } from 'react';
import SlaTimer from './SlaTimer';

const ROTULO_CATEGORIA = {
  suporte_tecnico: 'Suporte Técnico',
  faturacao: 'Faturação',
  comercial: 'Comercial',
};

/** Converte HTML de email em texto legível, sem inserir HTML no DOM (seguro). */
function htmlParaTexto(html) {
  if (!html) return '';
  let s = html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<\s*br\s*\/?\s*>/gi, '\n')
    .replace(/<\/(p|div|tr|li|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, '');
  const ent = { '&nbsp;': ' ', '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&apos;': "'" };
  s = s.replace(/&[a-z#0-9]+;/gi, (m) => ent[m] || m);
  return s.replace(/\n{3,}/g, '\n\n').replace(/[ \t]{2,}/g, ' ').trim();
}

/**
 * Painel de detalhe de um ticket.
 * Permite ler o email e — se o ticket estiver atribuído ao próprio (ou for
 * admin) — escrever a resposta (enviada pelo Outlook) e resolver.
 */
export default function TicketDetail({
  ticket, utilizador, onFechar, onAssumir, onLibertar, onResolver, onResponder,
}) {
  const [resposta, setResposta] = useState('');
  const [aEnviar, setAEnviar] = useState(false);

  // Fechar com a tecla Esc.
  useEffect(() => {
    const h = (e) => e.key === 'Escape' && onFechar();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onFechar]);

  if (!ticket) return null;

  const meu = ticket.operador_atribuido_id === utilizador.id;
  const ehAdmin = utilizador.funcao === 'admin';
  const podeResponder = ticket.status === 'em_andamento' && (meu || ehAdmin);
  const corpo = htmlParaTexto(ticket.corpo_email);

  async function enviarEResolver() {
    if (!resposta.trim()) return;
    setAEnviar(true);
    try {
      await onResponder(ticket.id, resposta.trim());
      onFechar();
    } finally {
      setAEnviar(false);
    }
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      {/* Fundo */}
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onFechar} />

      {/* Painel */}
      <div className="relative flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* Cabeçalho */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-5">
          <div className="min-w-0">
            <div className="mb-1.5 flex items-center gap-2">
              <span className="rounded-md bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-500 ring-1 ring-inset ring-slate-200">
                {ROTULO_CATEGORIA[ticket.categoria_ticket]}
              </span>
              <span className="text-xs capitalize text-slate-400">{ticket.status.replace('_', ' ')}</span>
            </div>
            <h2 className="truncate text-lg font-bold text-slate-800" title={ticket.assunto}>
              {ticket.assunto || '(sem assunto)'}
            </h2>
            <p className="mt-0.5 text-sm text-slate-500">
              De <span className="font-medium text-slate-700">{ticket.remetente}</span> ·{' '}
              {new Date(ticket.data_rececao).toLocaleString('pt-PT')}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <SlaTimer slaLimite={ticket.sla_limite} status={ticket.status} tamanho="lg" />
            <button onClick={onFechar} className="text-sm text-slate-400 hover:text-slate-600">Fechar ✕</button>
          </div>
        </div>

        {/* Corpo do email */}
        <div className="scroll-fina flex-1 overflow-auto p-5">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Mensagem</p>
          <div className="whitespace-pre-wrap rounded-xl bg-slate-50 p-4 text-sm leading-relaxed text-slate-700 ring-1 ring-inset ring-slate-100">
            {corpo || '(sem conteúdo)'}
          </div>

          {/* Resposta */}
          {podeResponder && (
            <div className="mt-5">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">A sua resposta</p>
              <textarea
                value={resposta}
                onChange={(e) => setResposta(e.target.value)}
                rows={5}
                placeholder="Escreva a resposta ao cliente. Será enviada pela caixa partilhada do Outlook."
                className="w-full resize-y rounded-xl border border-slate-300 p-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
              />
            </div>
          )}
        </div>

        {/* Rodapé / ações */}
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/60 p-4">
          {ticket.status === 'pendente' && (
            <button
              onClick={() => onAssumir(ticket.id)}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
            >
              Assumir para responder
            </button>
          )}

          {podeResponder && (
            <>
              <button
                onClick={() => onLibertar(ticket.id)}
                className="mr-auto rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-white"
              >
                Libertar
              </button>
              <button
                onClick={() => { onResolver(ticket.id); onFechar(); }}
                className="rounded-lg border border-emerald-300 px-4 py-2 text-sm font-medium text-emerald-700 transition hover:bg-emerald-50"
              >
                Resolver sem responder
              </button>
              <button
                onClick={enviarEResolver}
                disabled={aEnviar || !resposta.trim()}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
              >
                {aEnviar ? 'A enviar…' : 'Enviar resposta e resolver'}
              </button>
            </>
          )}

          {ticket.status === 'resolvido' && (
            <span className="text-sm font-medium text-emerald-600">
              ✓ Resolvido em {ticket.data_resolucao ? new Date(ticket.data_resolucao).toLocaleString('pt-PT') : '—'}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
