import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client';

const ROTULO_CATEGORIA = {
  suporte_tecnico: 'Suporte Técnico',
  faturacao: 'Faturação',
  comercial: 'Comercial',
};
const ROTULO_CAMPO = { assunto: 'Assunto', corpo: 'Corpo', ambos: 'Ambos' };

const FORM_VAZIO = { palavra_chave: '', categoria: 'suporte_tecnico', campo_alvo: 'ambos', prioridade: 100 };

function corCategoria(cat) {
  if (cat === 'suporte_tecnico') return 'bg-sky-100 text-sky-700';
  if (cat === 'faturacao') return 'bg-amber-100 text-amber-700';
  if (cat === 'comercial') return 'bg-emerald-100 text-emerald-700';
  return 'bg-slate-100 text-slate-600';
}

/**
 * Editor das regras de triagem: palavra-chave → categoria, com prioridade e
 * campo-alvo. Inclui um provador que classifica um texto de exemplo ao vivo.
 */
export default function RegrasTriagem() {
  const [regras, setRegras] = useState([]);
  const [aCarregar, setACarregar] = useState(true);
  const [form, setForm] = useState(FORM_VAZIO);
  const [aGravar, setAGravar] = useState(false);
  const [erro, setErro] = useState('');

  // Provador de triagem
  const [teste, setTeste] = useState({ assunto: '', corpo: '' });
  const [resultado, setResultado] = useState(null);
  const [aTestar, setATestar] = useState(false);

  const carregar = useCallback(async () => {
    setACarregar(true);
    try {
      setRegras(await api.listarRegras());
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
    setErro(''); setAGravar(true);
    try {
      await api.criarRegra({ ...form, prioridade: Number(form.prioridade) });
      setForm(FORM_VAZIO);
      await carregar();
    } catch (e) {
      setErro(e.message);
    } finally {
      setAGravar(false);
    }
  }

  async function alternarAtiva(r) {
    setErro('');
    try {
      await api.atualizarRegra(r.id, { ativa: !r.ativa });
      await carregar();
    } catch (e) {
      setErro(e.message);
    }
  }

  async function remover(r) {
    if (!window.confirm(`Remover a regra "${r.palavra_chave}" → ${ROTULO_CATEGORIA[r.categoria] || r.categoria}?`)) return;
    setErro('');
    try {
      await api.removerRegra(r.id);
      await carregar();
    } catch (e) {
      setErro(e.message);
    }
  }

  async function testar(ev) {
    ev.preventDefault();
    setATestar(true); setResultado(null);
    try {
      setResultado(await api.testarTriagem(teste.assunto, teste.corpo));
    } catch (e) {
      setErro(e.message);
    } finally {
      setATestar(false);
    }
  }

  return (
    <>
      {erro && <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700">{erro}</div>}

      <div className="grid gap-6 lg:grid-cols-[1fr_1.5fr]">
        {/* --- Coluna esquerda: criar + provador --- */}
        <div className="space-y-6">
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">Nova regra</h2>
            <form onSubmit={submeter} className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Palavra-chave</label>
                <input value={form.palavra_chave} onChange={alterar('palavra_chave')} required
                  placeholder="ex.: reembolso"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                <p className="mt-1 text-xs text-slate-400">Comparação sem acentos e maiúsculas ("Factura" casa com "fatura").</p>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Categoria de destino</label>
                <input list="cats" value={form.categoria} onChange={alterar('categoria')} required
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                <datalist id="cats">
                  <option value="suporte_tecnico" /><option value="faturacao" /><option value="comercial" />
                </datalist>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Procurar em</label>
                  <select value={form.campo_alvo} onChange={alterar('campo_alvo')}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500">
                    <option value="ambos">Assunto + Corpo</option>
                    <option value="assunto">Só assunto</option>
                    <option value="corpo">Só corpo</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Prioridade</label>
                  <input type="number" min="0" value={form.prioridade} onChange={alterar('prioridade')} required
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                </div>
              </div>
              <p className="text-xs text-slate-400">Menor prioridade = avaliada primeiro. Ganha a primeira que casar.</p>
              <button type="submit" disabled={aGravar}
                className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60">
                {aGravar ? 'A criar…' : 'Adicionar regra'}
              </button>
            </form>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">Provar triagem</h2>
            <form onSubmit={testar} className="space-y-3">
              <input value={teste.assunto} onChange={(e) => setTeste((t) => ({ ...t, assunto: e.target.value }))}
                placeholder="Assunto do email de exemplo"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
              <textarea value={teste.corpo} onChange={(e) => setTeste((t) => ({ ...t, corpo: e.target.value }))}
                placeholder="Corpo do email de exemplo" rows={3}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
              <button type="submit" disabled={aTestar}
                className="w-full rounded-lg border border-indigo-300 px-4 py-2 text-sm font-semibold text-indigo-600 transition hover:bg-indigo-50 disabled:opacity-60">
                {aTestar ? 'A classificar…' : 'Classificar'}
              </button>
            </form>
            {resultado && (
              <div className="mt-4 rounded-lg bg-slate-50 p-3 text-sm">
                <span className="text-slate-500">Categoria: </span>
                <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${corCategoria(resultado.categoria)}`}>
                  {ROTULO_CATEGORIA[resultado.categoria] || resultado.categoria}
                </span>
                <p className="mt-2 text-xs text-slate-500">
                  {resultado.regra
                    ? `Casou com a regra "${resultado.regra.palavra}" (prioridade ${resultado.regra.prioridade}).`
                    : 'Nenhuma regra casou — categoria por omissão.'}
                </p>
              </div>
            )}
          </section>
        </div>

        {/* --- Coluna direita: lista de regras --- */}
        <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Regras {!aCarregar && <span className="text-slate-400">({regras.length})</span>}
            </h2>
          </div>
          {aCarregar ? (
            <p className="px-5 py-6 text-sm text-slate-400">A carregar…</p>
          ) : regras.length === 0 ? (
            <p className="px-5 py-6 text-sm text-slate-400">Sem regras. Todos os emails caem na categoria por omissão.</p>
          ) : (
            <div className="max-h-[70vh] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-50 text-left text-xs uppercase text-slate-400">
                  <tr>
                    <th className="px-4 py-2 font-medium">Prio.</th>
                    <th className="px-4 py-2 font-medium">Palavra-chave</th>
                    <th className="px-4 py-2 font-medium">Categoria</th>
                    <th className="px-4 py-2 font-medium">Em</th>
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {regras.map((r) => (
                    <tr key={r.id} className={r.ativa ? '' : 'opacity-50'}>
                      <td className="px-4 py-2 tnum text-slate-500">{r.prioridade}</td>
                      <td className="px-4 py-2 font-medium text-slate-800">{r.palavra_chave}</td>
                      <td className="px-4 py-2">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${corCategoria(r.categoria)}`}>
                          {ROTULO_CATEGORIA[r.categoria] || r.categoria}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-xs text-slate-500">{ROTULO_CAMPO[r.campo_alvo]}</td>
                      <td className="px-4 py-2">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => alternarAtiva(r)}
                            className={`rounded-md border px-2 py-1 text-xs transition ${r.ativa
                              ? 'border-slate-300 text-slate-500 hover:bg-slate-50'
                              : 'border-emerald-300 text-emerald-600 hover:bg-emerald-50'}`}>
                            {r.ativa ? 'Desativar' : 'Ativar'}
                          </button>
                          <button onClick={() => remover(r)}
                            className="rounded-md border border-rose-300 px-2 py-1 text-xs text-rose-600 transition hover:bg-rose-50">
                            Remover
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
