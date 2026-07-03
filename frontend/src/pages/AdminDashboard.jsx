import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import TicketCard from '../components/TicketCard';
import TicketDetail from '../components/TicketDetail';
import AlertasSla from '../components/AlertasSla';

const ROTULO_CATEGORIA = {
  suporte_tecnico: 'Suporte Técnico',
  faturacao: 'Faturação',
  comercial: 'Comercial',
};

function Kpi({ rotulo, valor, sufixo, cor = 'text-slate-800', dica }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm" title={dica}>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{rotulo}</p>
      <p className={`mt-1 tnum text-2xl font-bold ${cor}`}>
        {valor}<span className="text-base font-semibold text-slate-400">{sufixo}</span>
      </p>
    </div>
  );
}

export default function AdminDashboard({ socketRef, ligado }) {
  const { utilizador } = useAuth();
  const [metricas, setMetricas] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [catAtiva, setCatAtiva] = useState('todas');
  const [selecionadoId, setSelecionadoId] = useState(null);

  const carregarMetricas = useCallback(async () => {
    setMetricas(await api.metricas());
  }, []);

  const carregarTickets = useCallback(async () => {
    // Carrega os tickets ATIVOS (por tratar) de todas as categorias — base da
    // lista e dos alertas. Os números de resolvidos estão nos KPIs (agregados).
    setTickets(await api.listarTickets({ ativos: 1 }));
  }, []);

  useEffect(() => { carregarMetricas(); }, [carregarMetricas]);
  useEffect(() => { carregarTickets(); }, [carregarTickets]);

  const visiveis = useMemo(
    () => (catAtiva === 'todas' ? tickets : tickets.filter((t) => t.categoria_ticket === catAtiva)),
    [tickets, catAtiva]
  );

  // Tempo real: qualquer alteração dispara recarga das métricas; os eventos de
  // ticket atualizam a lista localmente.
  useEffect(() => {
    const s = socketRef.current;
    if (!s) return;

    const aplicar = ({ ticket }) =>
      setTickets((atual) => {
        const sem = atual.filter((x) => x.id !== ticket.id);
        if (ticket.status === 'resolvido') return sem; // saiu dos activos
        const existente = atual.find((x) => x.id === ticket.id);
        return existente ? [...sem, { ...existente, ...ticket }] : [ticket, ...sem];
      });
    const onMetricas = () => carregarMetricas();

    s.on('ticket:novo', aplicar);
    s.on('ticket:bloqueado', aplicar);
    s.on('ticket:libertado', aplicar);
    s.on('ticket:resolvido', aplicar);
    s.on('metricas:atualizar', onMetricas);

    return () => {
      s.off('ticket:novo', aplicar);
      s.off('ticket:bloqueado', aplicar);
      s.off('ticket:libertado', aplicar);
      s.off('ticket:resolvido', aplicar);
      s.off('metricas:atualizar', onMetricas);
    };
  }, [socketRef, ligado, carregarMetricas]);

  const sla = metricas?.sla;
  const carga = metricas?.carga || [];

  const taxa = sla ? Number(sla.taxa_cumprimento) : 100;
  const corTaxa = taxa >= 95 ? 'text-emerald-600' : taxa >= 85 ? 'text-amber-600' : 'text-rose-600';

  const cargaMax = useMemo(
    () => Math.max(1, ...carga.map((o) => Number(o.em_andamento))),
    [carga]
  );

  const onLibertar = async (id) => { try { await api.libertar(id); } catch (e) { alert(e.message); } };
  const onResolver = async (id) => { try { await api.resolver(id); } catch (e) { alert(e.message); } };
  const onResponder = async (id, texto) => { try { await api.resolver(id, texto); } catch (e) { alert(e.message); throw e; } };

  const selecionado = useMemo(
    () => tickets.find((t) => t.id === selecionadoId) || null,
    [tickets, selecionadoId]
  );

  return (
    <main className="mx-auto max-w-7xl px-5 py-6">
      <AlertasSla tickets={tickets} />
      <div className="mb-5">
        <h2 className="text-xl font-bold text-slate-800">Painel do supervisor</h2>
        <p className="text-sm text-slate-500">Visão global de todas as categorias, em direto.</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Kpi rotulo="Cumprimento SLA" valor={taxa} sufixo="%" cor={corTaxa}
             dica="Resolvidos dentro do prazo / total de resolvidos" />
        <Kpi rotulo="Pendentes" valor={sla?.pendentes ?? '–'} />
        <Kpi rotulo="Em curso" valor={sla?.em_andamento ?? '–'} cor="text-indigo-600" />
        <Kpi rotulo="Resolvidos" valor={sla?.resolvidos ?? '–'} cor="text-emerald-600" />
        <Kpi rotulo="SLA violado (aberto)" valor={sla?.violados_abertos ?? '–'} cor="text-rose-600"
             dica="Tickets ainda por resolver com prazo já ultrapassado" />
        <Kpi rotulo="Total" valor={sla?.total ?? '–'} />
      </div>

      {/* Carga por operador */}
      <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold text-slate-700">Carga por operador</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="pb-2 font-medium">Operador</th>
                <th className="pb-2 font-medium">Categoria</th>
                <th className="pb-2 font-medium">Em curso</th>
                <th className="pb-2 font-medium">Resolvidos</th>
                <th className="pb-2 font-medium">Distribuição</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {carga.map((o) => (
                <tr key={o.id}>
                  <td className="py-2 font-medium text-slate-700">{o.nome}</td>
                  <td className="py-2 text-slate-500">{ROTULO_CATEGORIA[o.categoria]}</td>
                  <td className="py-2 tnum font-semibold text-indigo-600">{o.em_andamento}</td>
                  <td className="py-2 tnum text-slate-500">{o.resolvidos}</td>
                  <td className="py-2">
                    <div className="h-2 w-40 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-indigo-500"
                        style={{ width: `${(Number(o.em_andamento) / cargaMax) * 100}%` }}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Tickets por tratar, com filtro por categoria (resolvidos contam nos KPIs) */}
      <section className="mt-6">
        <h3 className="mb-3 text-sm font-semibold text-slate-700">Tickets por tratar</h3>
        <div className="mb-3 inline-flex rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
          {['todas', 'suporte_tecnico', 'faturacao', 'comercial'].map((c) => (
            <button
              key={c}
              onClick={() => setCatAtiva(c)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                catAtiva === c ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              {c === 'todas' ? 'Todas' : ROTULO_CATEGORIA[c]}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          {visiveis.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-300 bg-white py-10 text-center text-slate-400">
              Sem tickets nesta vista.
            </p>
          ) : (
            visiveis.map((t) => (
              <TicketCard
                key={t.id}
                ticket={t}
                utilizador={utilizador}
                bloqueadoPorOutro={false}
                onAssumir={() => {}}
                onLibertar={onLibertar}
                onResolver={onResolver}
                onAbrir={(tk) => setSelecionadoId(tk.id)}
              />
            ))
          )}
        </div>
      </section>

      {selecionado && (
        <TicketDetail
          ticket={selecionado}
          utilizador={utilizador}
          onFechar={() => setSelecionadoId(null)}
          onAssumir={() => {}}
          onLibertar={onLibertar}
          onResolver={onResolver}
          onResponder={onResponder}
        />
      )}
    </main>
  );
}
