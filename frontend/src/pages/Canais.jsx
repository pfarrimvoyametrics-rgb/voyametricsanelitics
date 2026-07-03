import { useEffect, useState } from 'react';
import { api } from '../api/client';

/**
 * Canais — configuração do SLA (prazo de resposta, em horas úteis) por canal.
 * Só admin. O valor define o prazo aplicado aos NOVOS tickets de cada canal.
 */
const ROTULO = {
  emergencias: 'Emergências', alteracoes: 'Alterações de Reservas',
  cotacoes: 'Cotações / Orçamentos', reclamacoes: 'Reclamações / Reembolsos',
  suporte_tecnico: 'Suporte Técnico', faturacao: 'Faturação', comercial: 'Comercial',
};
const COR_CAT = {
  emergencias: '#fb7185', alteracoes: '#38bdf8', cotacoes: '#a78bfa',
  reclamacoes: '#fbbf24', suporte_tecnico: '#94a3b8', faturacao: '#34d399', comercial: '#818cf8',
};
const minToH = (m) => Math.round((m / 60) * 10) / 10;

export default function Canais() {
  const [canais, setCanais] = useState([]);
  const [edicao, setEdicao] = useState({}); // categoria -> minutos (string)
  const [aGuardar, setAGuardar] = useState('');
  const [msg, setMsg] = useState('');
  const [erro, setErro] = useState('');

  async function carregar() {
    try {
      const lista = await api.canais();
      setCanais(lista);
      const e = {}; lista.forEach((c) => { e[c.categoria] = String(c.sla_minutos); });
      setEdicao(e);
    } catch (err) { setErro(err.message); }
  }
  useEffect(() => { carregar(); }, []);

  async function guardar(categoria) {
    setErro(''); setMsg(''); setAGuardar(categoria);
    try {
      const c = await api.atualizarCanal(categoria, parseInt(edicao[categoria], 10));
      setCanais((atual) => atual.map((x) => (x.categoria === categoria ? c : x)));
      setMsg(`SLA de ${ROTULO[categoria] || categoria} atualizado para ${minToH(c.sla_minutos)} h.`);
    } catch (err) { setErro(err.message); }
    finally { setAGuardar(''); }
  }

  return (
    <div className="vm-app-bg min-h-screen px-5 py-6 text-slate-200">
      <main className="relative mx-auto max-w-3xl">
        <div className="mb-4 flex items-center gap-3.5">
          <span className="vm-accent-bar" />
          <div>
            <p className="vm-eyebrow mb-0.5">Configuração</p>
            <h2 className="text-2xl font-bold tracking-tight text-white">Canais &amp; SLA</h2>
          </div>
        </div>
        <p className="mb-4 text-sm text-slate-400">
          Prazo de resposta (em horas úteis: Seg–Sex 09h30–19h00, feriados excluídos) por canal.
          Aplica-se aos <span className="font-medium text-slate-200">novos</span> tickets de cada canal.
        </p>

        {msg && <p className="mb-3 rounded-lg bg-emerald-400/10 px-4 py-2 text-sm text-emerald-300 ring-1 ring-inset ring-emerald-400/20">{msg}</p>}
        {erro && <p className="mb-3 rounded-lg bg-rose-500/10 px-4 py-2 text-sm text-rose-300 ring-1 ring-inset ring-rose-400/20">{erro}</p>}

        <div className="vm-panel vm-enter overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3 font-semibold">Canal</th>
                <th className="px-4 py-3 font-semibold">SLA (minutos úteis)</th>
                <th className="px-4 py-3 font-semibold">Equivalente</th>
                <th className="px-4 py-3 font-semibold"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {canais.map((c) => (
                <tr key={c.categoria} className="transition hover:bg-white/[0.03]">
                  <td className="px-4 py-3 font-medium text-slate-200">
                    <span className="inline-flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full" style={{ background: COR_CAT[c.categoria] || '#818cf8', boxShadow: `0 0 6px ${COR_CAT[c.categoria] || '#818cf8'}` }} />
                      {ROTULO[c.categoria] || c.rotulo || c.categoria}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number" min="1" step="1"
                      value={edicao[c.categoria] ?? ''}
                      onChange={(e) => setEdicao((s) => ({ ...s, [c.categoria]: e.target.value }))}
                      className="w-28 rounded-lg border border-white/10 bg-black/20 px-2 py-1.5 text-sm text-slate-100 outline-none focus:border-teal-400/50 focus:ring-2 focus:ring-teal-400/30"
                    />
                  </td>
                  <td className="px-4 py-3 tnum text-slate-400">{minToH(parseInt(edicao[c.categoria], 10) || 0)} h</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => guardar(c.categoria)}
                      disabled={aGuardar === c.categoria || !edicao[c.categoria]}
                      className="vm-btn vm-btn-primary"
                    >
                      {aGuardar === c.categoria ? 'A guardar…' : 'Guardar'}
                    </button>
                  </td>
                </tr>
              ))}
              {canais.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-500">A carregar…</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <p className="mt-3 text-xs text-slate-500">
          Nota: alterar o SLA não muda os tickets já existentes — só os novos. Para canais distintos
          (Emergências, Alterações, Cotações, Reclamações) é necessária a fase de reconfiguração de categorias.
        </p>
      </main>
    </div>
  );
}
