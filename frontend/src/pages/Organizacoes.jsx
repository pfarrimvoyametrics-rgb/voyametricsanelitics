import { useState } from 'react';
import { api } from '../api/client';

const FORM_VAZIO = {
  nome: '',
  slug: '',
  email_dominios: '',
  admin_nome: '',
  admin_email: '',
  admin_password: '',
};

/**
 * EditorDominios — edição inline dos domínios/endereços que roteiam a ingestão
 * de email para uma organização (ver P0-4 / webhook).
 */
function EditorDominios({ org, aoGuardar }) {
  const [valor, setValor] = useState(org.email_dominios || '');
  const [estado, setEstado] = useState(''); // '' | a-guardar | ok | erro
  async function guardar() {
    setEstado('a-guardar');
    try {
      await aoGuardar(org.id, valor.trim());
      setEstado('ok');
      setTimeout(() => setEstado(''), 1500);
    } catch {
      setEstado('erro');
    }
  }
  return (
    <div className="mt-1.5 flex items-center gap-2">
      <input
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        placeholder="domínios de email: acme.pt, suporte@acme.pt"
        className="w-full rounded border border-slate-200 px-2 py-1 text-xs text-slate-600 focus:border-indigo-400 focus:outline-none"
      />
      <button
        onClick={guardar}
        disabled={estado === 'a-guardar'}
        className="shrink-0 rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-60"
      >
        Guardar
      </button>
      {estado === 'ok' && <span className="text-xs text-emerald-600">✓</span>}
      {estado === 'erro' && <span className="text-xs text-rose-600">erro</span>}
    </div>
  );
}

function sugerirSlug(nome) {
  return (nome || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Organizacoes — gestão dos clientes da plataforma (só super admin).
 * Criar/listar/ativar organizações e (opcional) o admin inicial de cada uma.
 * `aoSelecionar` define qual a organização ativa a operar no resto do painel.
 */
export default function Organizacoes({ orgs, orgAtivaId, aoSelecionar, aoRecarregar }) {
  const [form, setForm] = useState(FORM_VAZIO);
  const [aGravar, setAGravar] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');

  const alterar = (campo) => (ev) => {
    const val = ev.target.value;
    setForm((f) => {
      const prox = { ...f, [campo]: val };
      // Auto-sugere o slug enquanto o utilizador não o editou manualmente.
      if (campo === 'nome' && (!f.slug || f.slug === sugerirSlug(f.nome))) {
        prox.slug = sugerirSlug(val);
      }
      return prox;
    });
  };

  async function submeter(ev) {
    ev.preventDefault();
    setErro(''); setSucesso(''); setAGravar(true);
    try {
      const payload = { nome: form.nome, slug: form.slug };
      if (form.email_dominios.trim()) payload.email_dominios = form.email_dominios.trim();
      if (form.admin_email || form.admin_nome || form.admin_password) {
        payload.admin = { nome: form.admin_nome, email: form.admin_email, password: form.admin_password };
      }
      const r = await api.criarOrganizacao(payload);
      setSucesso(`Organização "${r.organizacao.nome}" criada${r.admin ? ` com o admin ${r.admin.email}` : ''}.`);
      setForm(FORM_VAZIO);
      await aoRecarregar();
      aoSelecionar(r.organizacao.id);
    } catch (e) {
      setErro(e.message);
    } finally {
      setAGravar(false);
    }
  }

  async function alternarAtivo(o) {
    setErro(''); setSucesso('');
    try {
      await api.definirAtivoOrganizacao(o.id, !o.ativo);
      await aoRecarregar();
    } catch (e) {
      setErro(e.message);
    }
  }

  async function guardarDominios(id, valor) {
    await api.atualizarEmailDominiosOrganizacao(id, valor);
    await aoRecarregar();
  }

  return (
    <main className="mx-auto max-w-7xl px-5 py-6">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-slate-800">Organizações</h1>
        <p className="text-sm text-slate-500">Os clientes da plataforma. Cada um tem dados, utilizadores e regras isolados.</p>
      </div>

      {erro && <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700">{erro}</div>}
      {sucesso && <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-700">{sucesso}</div>}

      <div className="grid gap-6 lg:grid-cols-[1fr_1.3fr]">
        {/* Criar organização */}
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">Nova organização</h2>
          <form onSubmit={submeter} className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Nome</label>
              <input value={form.nome} onChange={alterar('nome')} required placeholder="Ex.: Agência Sol"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Slug (identificador)</label>
              <input value={form.slug} onChange={alterar('slug')} required pattern="[a-z0-9-]+" placeholder="agencia-sol"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
              <p className="mt-1 text-xs text-slate-400">Apenas minúsculas, números e hífen.</p>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Domínios de email (opcional)</label>
              <input value={form.email_dominios} onChange={alterar('email_dominios')} placeholder="acme.pt, suporte@acme.pt"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
              <p className="mt-1 text-xs text-slate-400">Emails para estes domínios/endereços são atribuídos a esta organização.</p>
            </div>

            <div className="rounded-lg bg-slate-50 p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Admin inicial (opcional)</p>
              <div className="space-y-2">
                <input value={form.admin_nome} onChange={alterar('admin_nome')} placeholder="Nome do admin"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                <input type="email" value={form.admin_email} onChange={alterar('admin_email')} placeholder="admin@cliente.pt"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                <input type="text" value={form.admin_password} onChange={alterar('admin_password')} placeholder="Palavra-passe (mín. 8)"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
              </div>
            </div>

            <button type="submit" disabled={aGravar}
              className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60">
              {aGravar ? 'A criar…' : 'Criar organização'}
            </button>
          </form>
        </section>

        {/* Lista de organizações */}
        <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Clientes <span className="text-slate-400">({orgs.length})</span>
            </h2>
          </div>
          <div className="divide-y divide-slate-100">
            {orgs.map((o) => {
              const ativa = o.id === orgAtivaId;
              return (
                <div key={o.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-800">
                      {o.nome}{' '}
                      {ativa && <span className="ml-1 inline-flex rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700">a operar</span>}
                      {!o.ativo && <span className="ml-1 inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">inativa</span>}
                    </p>
                    <p className="truncate text-xs text-slate-500">{o.slug}</p>
                    <EditorDominios org={o} aoGuardar={guardarDominios} />
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {!ativa && o.ativo && (
                      <button onClick={() => aoSelecionar(o.id)}
                        className="rounded-md border border-indigo-300 px-2 py-1 text-xs font-medium text-indigo-600 transition hover:bg-indigo-50">
                        Operar
                      </button>
                    )}
                    <button onClick={() => alternarAtivo(o)}
                      className={`rounded-md border px-2 py-1 text-xs transition ${o.ativo
                        ? 'border-rose-300 text-rose-600 hover:bg-rose-50'
                        : 'border-emerald-300 text-emerald-600 hover:bg-emerald-50'}`}>
                      {o.ativo ? 'Desativar' : 'Ativar'}
                    </button>
                  </div>
                </div>
              );
            })}
            {orgs.length === 0 && <p className="px-5 py-6 text-sm text-slate-400">Ainda não há organizações.</p>}
          </div>
        </section>
      </div>
    </main>
  );
}
