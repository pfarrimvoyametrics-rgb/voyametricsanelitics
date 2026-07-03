import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import TicketCard from '../components/TicketCard';
import TicketDetail from '../components/TicketDetail';
import AlertasSla from '../components/AlertasSla';

const FILTROS = [
  { chave: 'por_tratar', rotulo: 'Por tratar' },
  { chave: 'pendente', rotulo: 'Pendentes' },
  { chave: 'em_andamento', rotulo: 'Em curso' },
  { chave: 'resolvido', rotulo: 'Resolvidos' },
];

const ROTULO_CATEGORIA = {
  suporte_tecnico: 'Suporte Técnico',
  faturacao: 'Faturação',
  comercial: 'Comercial',
};

export default function Queue({ socketRef, ligado }) {
  const { utilizador } = useAuth();
  const [tickets, setTickets] = useState([]);     // activos (pendente + em_andamento)
  const [resolvidos, setResolvidos] = useState([]);
  const [filtro, setFiltro] = useState('por_tratar');
  const [aCarregar, setACarregar] = useState(true);
  const [selecionadoId, setSelecionadoId] = useState(null);
  const resolvidosCarregados = useRef(false);

  const dev = import.meta.env.DEV;

  // Upsert num ticket activo; se ficou resolvido, sai da lista de activos.
  const aplicarAtivo = useCallback((t) => {
    setTickets((atual) => {
      const semEle = atual.filter((x) => x.id !== t.id);
      if (t.status === 'resolvido') return semEle;
      const existente = atual.find((x) => x.id === t.id);
      return existente ? [...semEle, { ...existente, ...t }] : [t, ...semEle];
    });
    if (t.status === 'resolvido' && resolvidosCarregados.current) {
      setResolvidos((prev) => [t, ...prev.filter((x) => x.id !== t.id)]);
    }
  }, []);

  const carregar = useCallback(async () => {
    setACarregar(true);
    try {
      setTickets(await api.listarTickets({ ativos: 1 }));
    } finally {
      setACarregar(false);
    }
  }, []);

  const carregarResolvidos = useCallback(async () => {
    setResolvidos(await api.listarTickets({ status: 'resolvido', limite: 100 }));
    resolvidosCarregados.current = true;
  }, []);

  useEffect(() => { carregar(); }, [carregar]);
  useEffect(() => { if (filtro === 'resolvido') carregarResolvidos(); }, [filtro, carregarResolvidos]);

  // --- Tempo real ------------------------------------------------------------
  useEffect(() => {
    const s = socketRef.current;
    if (!s) return;
    const handler = ({ ticket }) => aplicarAtivo(ticket);
    s.on('ticket:novo', handler);
    s.on('ticket:bloqueado', handler);
    s.on('ticket:libertado', handler);
    s.on('ticket:resolvido', handler);
    return () => {
      s.off('ticket:novo', handler);
      s.off('ticket:bloqueado', handler);
      s.off('ticket:libertado', handler);
      s.off('ticket:resolvido', handler);
    };
  }, [socketRef, ligado, aplicarAtivo]);

  // --- Heartbeat: mantém vivos os tickets que tenho abertos ------------------
  useEffect(() => {
    const id = setInterval(() => {
      const s = socketRef.current;
      if (!s) return;
      tickets
        .filter((t) => t.status === 'em_andamento' && t.operador_atribuido_id === utilizador.id)
        .forEach((t) => s.emit('ticket:heartbeat', { ticketId: t.id }));
    }, 60 * 1000);
    return () => clearInterval(id);
  }, [tickets, socketRef, utilizador.id]);

  // --- Ações -----------------------------------------------------------------
  const onAssumir = async (id) => {
    try { aplicarAtivo(await api.assumir(id)); }
    catch (e) { alert(e.message === 'ja_tomado' ? 'Este ticket já foi assumido por outro operador.' : e.message); }
  };
  const onLibertar = async (id) => { try { aplicarAtivo(await api.libertar(id)); } catch (e) { alert(e.message); } };
  const onResolver = async (id) => { try { aplicarAtivo(await api.resolver(id)); } catch (e) { alert(e.message); } };
  const onResponder = async (id, texto) => {
    try { aplicarAtivo(await api.resolver(id, texto)); }
    catch (e) { alert(e.message); throw e; }
  };

  const visiveis = useMemo(() => {
    if (filtro === 'resolvido') return resolvidos;
    if (filtro === 'por_tratar') return tickets;
    return tickets.filter((t) => t.status === filtro);
  }, [tickets, resolvidos, filtro]);

  const contagem = useMemo(() => ({
    pendente: tickets.filter((t) => t.status === 'pendente').length,
    em_andamento: tickets.filter((t) => t.status === 'em_andamento').length,
  }), [tickets]);

  const selecionado = useMemo(
    () => [...tickets, ...resolvidos].find((t) => t.id === selecionadoId) || null,
    [tickets, resolvidos, selecionadoId]
  );

  return (
    <main className="mx-auto max-w-7xl px-5 py-6">
      <AlertasSla tickets={tickets} />

      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800">
            A minha fila · {ROTULO_CATEGORIA[utilizador.categoria]}
          </h2>
          <p className="text-sm text-slate-500">
            {contagem.pendente} por atribuir · {contagem.em_andamento} em curso · ordenados pelo SLA mais urgente.
          </p>
        </div>
        {dev && (
          <button
            onClick={() => api.mockTicket()}
            className="rounded-lg border border-dashed border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-50"
            title="Apenas em desenvolvimento: injeta um ticket de teste"
          >
            + Ticket de teste
          </button>
        )}
      </div>

      <div className="mb-4 inline-flex rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
        {FILTROS.map((f) => (
          <button
            key={f.chave}
            onClick={() => setFiltro(f.chave)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
              filtro === f.chave ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            {f.rotulo}
          </button>
        ))}
      </div>

      {aCarregar ? (
        <p className="py-16 text-center text-slate-400">A carregar…</p>
      ) : visiveis.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white py-16 text-center">
          <p className="font-medium text-slate-600">Nada por aqui.</p>
          <p className="text-sm text-slate-400">Quando chegar um email para esta categoria, aparece aqui em direto.</p>
        </div>
      ) : (
        <div className="scroll-fina space-y-3">
          {visiveis.map((t) => (
            <TicketCard
              key={t.id}
              ticket={t}
              utilizador={utilizador}
              bloqueadoPorOutro={t.status === 'em_andamento' && t.operador_atribuido_id !== utilizador.id}
              onAssumir={onAssumir}
              onLibertar={onLibertar}
              onResolver={onResolver}
              onAbrir={(tk) => setSelecionadoId(tk.id)}
            />
          ))}
        </div>
      )}

      {selecionado && (
        <TicketDetail
          ticket={selecionado}
          utilizador={utilizador}
          onFechar={() => setSelecionadoId(null)}
          onAssumir={onAssumir}
          onLibertar={onLibertar}
          onResolver={onResolver}
          onResponder={onResponder}
        />
      )}
    </main>
  );
}
