import SlaTimer, { estadoSla } from './SlaTimer';

const ROTULO_CATEGORIA = {
  suporte_tecnico: 'Suporte Técnico',
  faturacao: 'Faturação',
  comercial: 'Comercial',
};

const COR_BARRA = {
  verde: 'bg-emerald-500',
  laranja: 'bg-amber-500',
  vermelho: 'bg-rose-500',
  neutro: 'bg-slate-300',
};

const BADGE_ESTADO = {
  pendente: 'bg-slate-100 text-slate-600',
  em_andamento: 'bg-indigo-100 text-indigo-700',
  resolvido: 'bg-emerald-100 text-emerald-700',
};

function quando(iso) {
  return new Date(iso).toLocaleString('pt-PT', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

/**
 * @param {object}   ticket
 * @param {object}   utilizador      — sessão atual
 * @param {boolean}  bloqueadoPorOutro — escondido/desativado por outro operador
 * @param {function} onAssumir, onLibertar, onResolver
 */
export default function TicketCard({
  ticket, utilizador, bloqueadoPorOutro,
  onAssumir, onLibertar, onResolver, onAbrir,
}) {
  const cor = estadoSla(ticket.sla_limite, ticket.status);
  const meu = ticket.operador_atribuido_id === utilizador.id;
  const ehAdmin = utilizador.funcao === 'admin';

  return (
    <article
      className={`relative flex items-stretch gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition
        ${bloqueadoPorOutro ? 'opacity-60' : 'hover:shadow-md'}`}
    >
      {/* Barra lateral: urgência num relance */}
      <span className={`absolute left-0 top-0 h-full w-1.5 rounded-l-xl ${COR_BARRA[cor]}`} />

      <div
        className="min-w-0 flex-1 cursor-pointer pl-2"
        role="button"
        tabIndex={0}
        onClick={() => onAbrir && onAbrir(ticket)}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onAbrir && onAbrir(ticket)}
      >
        <div className="flex items-center gap-2">
          <span className="rounded-md bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-500 ring-1 ring-inset ring-slate-200">
            {ROTULO_CATEGORIA[ticket.categoria_ticket]}
          </span>
          <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${BADGE_ESTADO[ticket.status]}`}>
            {ticket.status.replace('_', ' ')}
          </span>
        </div>

        <h3 className="mt-2 truncate text-[15px] font-semibold text-slate-800 hover:text-indigo-700" title={ticket.assunto}>
          {ticket.assunto || '(sem assunto)'}
        </h3>
        <p className="mt-0.5 truncate text-sm text-slate-500">
          De <span className="font-medium text-slate-600">{ticket.remetente}</span> · recebido {quando(ticket.data_rececao)}
        </p>

        {ticket.operador_nome && (
          <p className="mt-1 text-xs text-slate-400">
            A tratar: <span className="font-medium text-slate-600">{ticket.operador_nome}</span>
          </p>
        )}
      </div>

      <div className="flex flex-col items-end justify-between">
        <SlaTimer slaLimite={ticket.sla_limite} status={ticket.status} />

        <div className="mt-3 flex gap-2">
          {ticket.status === 'pendente' && (
            <button
              onClick={() => onAssumir(ticket.id)}
              disabled={bloqueadoPorOutro}
              className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Assumir
            </button>
          )}

          {ticket.status === 'em_andamento' && (meu || ehAdmin) && (
            <>
              <button
                onClick={() => onResolver(ticket.id)}
                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition hover:bg-emerald-700 focus-visible:ring-2 focus-visible:ring-emerald-400"
              >
                Resolver
              </button>
              <button
                onClick={() => onLibertar(ticket.id)}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
              >
                Libertar
              </button>
            </>
          )}
        </div>
      </div>
    </article>
  );
}
