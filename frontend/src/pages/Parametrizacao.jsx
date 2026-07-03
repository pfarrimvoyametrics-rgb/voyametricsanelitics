import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client';

const ROTULO_CATEGORIA = {
  suporte_tecnico: 'Suporte Técnico',
  faturacao: 'Faturação',
  comercial: 'Comercial',
};

const ROTULO_FUNCAO = {
  super_admin: 'Super Administrador',
  admin: 'Administrador',
  operador: 'Operador',
};

const FORM_VAZIO = { nome: '', email: '', funcao: 'operador', categoria: 'suporte_tecnico', password: '' };

function Badge({ children, cor }) {
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${cor}`}>{children}</span>
  );
}

/**
 * Parametrizacao — back-office do super administrador.
 * Primeiro módulo: gestão de utilizadores (criar operadores/admins,
 * ativar/desativar, redefinir palavra-passe).
 */
export default function Parametrizacao() {
  const [utilizadores, setUtilizadores] = useState([]);
  const [aCarregar, setACarregar] = useState(true);
  const [form, setForm] = useState(FORM_VAZIO);
  const [aGravar, setAGravar] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');

  const carregar = useCallback(async () => {
    setACarregar(true);
    try {
      setUtilizadores(await api.listarUsuarios());
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
      const payload = { ...form };
      if (payload.funcao === 'admin') delete payload.categoria;
      const criado = await api.criarUsuario(payload);
      setSucesso(`Utilizador "${criado.nome}" criado.`);
      setForm(FORM_VAZIO);
      await carregar();
    } catch (e) {
      setErro(e.message);
    } finally {
      setAGravar(false);
    }
  }

  async function alternarAtivo(u) {
    setErro(''); setSucesso('');
    try {
      await api.definirAtivoUsuario(u.id, !u.ativo);
      await carregar();
    } catch (e) {
      setErro(e.message);
    }
  }

  async function redefinirSenha(u) {
    const nova = window.prompt(`Nova palavra-passe para ${u.nome} (mín. 8 caracteres):`);
    if (nova == null) return;
    setErro(''); setSucesso('');
    try {
      await api.redefinirSenhaUsuario(u.id, nova);
      setSucesso(`Palavra-passe de "${u.nome}" redefinida.`);
    } catch (e) {
      setErro(e.message);
    }
  }

  return (
    <main className="mx-auto max-w-7xl px-5 py-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-800">Parametrização</h1>
        <p className="text-sm text-slate-500">Gestão de utilizadores e configuração da aplicação.</p>
      </div>

      {erro && (
        <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700">{erro}</div>
      )}
      {sucesso && (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-700">{sucesso}</div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        {/* --- Criar utilizador --- */}
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">Novo utilizador</h2>
          <form onSubmit={submeter} className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Nome</label>
              <input value={form.nome} onChange={alterar('nome')} required
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Email</label>
              <input type="email" value={form.email} onChange={alterar('email')} required
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Função</label>
              <select value={form.funcao} onChange={alterar('funcao')}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500">
                <option value="operador">Operador</option>
                <option value="admin">Administrador</option>
              </select>
            </div>
            {form.funcao === 'operador' && (
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Categoria (fila)</label>
                <select value={form.categoria} onChange={alterar('categoria')}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500">
                  <option value="suporte_tecnico">Suporte Técnico</option>
                  <option value="faturacao">Faturação</option>
                  <option value="comercial">Comercial</option>
                </select>
              </div>
            )}
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Palavra-passe (mín. 8)</label>
              <input type="text" value={form.password} onChange={alterar('password')} required minLength={8}
                placeholder="Definir palavra-passe inicial"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
            </div>
            <button type="submit" disabled={aGravar}
              className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60">
              {aGravar ? 'A criar…' : 'Criar utilizador'}
            </button>
          </form>
        </section>

        {/* --- Lista de utilizadores --- */}
        <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Utilizadores {!aCarregar && <span className="text-slate-400">({utilizadores.length})</span>}
            </h2>
          </div>
          {aCarregar ? (
            <p className="px-5 py-6 text-sm text-slate-400">A carregar…</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {utilizadores.map((u) => (
                <div key={u.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-800">
                      {u.nome}{' '}
                      {!u.ativo && <Badge cor="bg-slate-100 text-slate-500">inativo</Badge>}
                    </p>
                    <p className="truncate text-xs text-slate-500">{u.email}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge cor={u.funcao === 'super_admin' ? 'bg-violet-100 text-violet-700'
                      : u.funcao === 'admin' ? 'bg-indigo-100 text-indigo-700'
                        : 'bg-slate-100 text-slate-600'}>
                      {ROTULO_FUNCAO[u.funcao] || u.funcao}
                    </Badge>
                    {u.categoria && (
                      <Badge cor="bg-amber-100 text-amber-700">{ROTULO_CATEGORIA[u.categoria] || u.categoria}</Badge>
                    )}
                    {u.funcao !== 'super_admin' && (
                      <>
                        <button onClick={() => redefinirSenha(u)} title="Redefinir palavra-passe"
                          className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-600 transition hover:bg-slate-50">
                          Senha
                        </button>
                        <button onClick={() => alternarAtivo(u)}
                          className={`rounded-md border px-2 py-1 text-xs transition ${u.ativo
                            ? 'border-rose-300 text-rose-600 hover:bg-rose-50'
                            : 'border-emerald-300 text-emerald-600 hover:bg-emerald-50'}`}>
                          {u.ativo ? 'Desativar' : 'Ativar'}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
