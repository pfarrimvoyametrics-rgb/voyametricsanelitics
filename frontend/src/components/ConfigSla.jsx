import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client';

/**
 * ConfigSla — configuração do SLA da organização ativa.
 * Cada campo vazio significa "usar o valor global" (mostrado como placeholder).
 */
export default function ConfigSla() {
  const [dados, setDados] = useState(null);
  const [defaults, setDefaults] = useState(null);
  const [form, setForm] = useState({ sla_hora_inicio: '', sla_hora_fim: '', sla_minutos_uteis: '', feriados_extra: '' });
  const [aCarregar, setACarregar] = useState(true);
  const [aGravar, setAGravar] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');

  const carregar = useCallback(async () => {
    setACarregar(true);
    try {
      const c = await api.lerConfigSla();
      setDefaults(c.defaults);
      setDados(c);
      setForm({
        sla_hora_inicio: c.sla_hora_inicio || '',
        sla_hora_fim: c.sla_hora_fim || '',
        sla_minutos_uteis: c.sla_minutos_uteis != null ? String(c.sla_minutos_uteis) : '',
        feriados_extra: c.feriados_extra || '',
      });
    } catch (e) {
      setErro(e.message);
    } finally {
      setACarregar(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const alterar = (campo) => (ev) => setForm((f) => ({ ...f, [campo]: ev.target.value }));

  async function submeter(ev) {
    ev.preventDefault();
    setErro(''); setSucesso(''); setAGravar(true);
    try {
      await api.guardarConfigSla(form);
      setSucesso('Configuração de SLA guardada.');
      await carregar();
    } catch (e) {
      setErro(e.message);
    } finally {
      setAGravar(false);
    }
  }

  async function repor() {
    setForm({ sla_hora_inicio: '', sla_hora_fim: '', sla_minutos_uteis: '', feriados_extra: '' });
  }

  if (aCarregar) return <p className="text-sm text-slate-400">A carregar…</p>;

  const usaGlobal = !dados?.sla_hora_inicio && !dados?.sla_hora_fim && dados?.sla_minutos_uteis == null && !dados?.feriados_extra;

  return (
    <div className="max-w-2xl">
      {erro && <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700">{erro}</div>}
      {sucesso && <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-700">{sucesso}</div>}

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">SLA da organização</h2>
          <p className="mt-1 text-xs text-slate-400">
            Campos vazios usam o valor global{' '}
            {defaults && <>(janela {defaults.sla_hora_inicio}–{defaults.sla_hora_fim}, {defaults.sla_minutos_uteis} min)</>}.
            {usaGlobal && <span className="ml-1 font-medium text-slate-500">Atualmente: a usar os valores globais.</span>}
          </p>
        </div>

        <form onSubmit={submeter} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Início da janela útil</label>
              <input value={form.sla_hora_inicio} onChange={alterar('sla_hora_inicio')} placeholder={defaults?.sla_hora_inicio || '09:30'}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Fim da janela útil</label>
              <input value={form.sla_hora_fim} onChange={alterar('sla_hora_fim')} placeholder={defaults?.sla_hora_fim || '19:00'}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Prazo de SLA (minutos úteis)</label>
            <input type="number" min="1" value={form.sla_minutos_uteis} onChange={alterar('sla_minutos_uteis')}
              placeholder={String(defaults?.sla_minutos_uteis ?? 120)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
            <p className="mt-1 text-xs text-slate-400">Ex.: 120 = 2 horas úteis; 240 = 4 horas úteis.</p>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Feriados extra (além dos nacionais)</label>
            <input value={form.feriados_extra} onChange={alterar('feriados_extra')} placeholder="06-13, 12-24"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
            <p className="mt-1 text-xs text-slate-400">Formato MM-DD, separados por vírgula. Recorrentes todos os anos.</p>
          </div>

          <div className="flex items-center gap-2">
            <button type="submit" disabled={aGravar}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60">
              {aGravar ? 'A guardar…' : 'Guardar'}
            </button>
            <button type="button" onClick={repor}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50">
              Repor para os valores globais
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
