import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

// Perfis do seed — atalhos de entrada rápida (demonstração).
// A palavra-passe demo corresponde a SEED_DEMO_PASSWORD no backend.
const DEMO_PASSWORD = 'demo1234';
const PERFIS = [
  { email: 'admin@empresa.pt', nome: 'Admin Geral', papel: 'Administrador', cor: 'bg-slate-800' },
  { email: 'sofia.suporte@empresa.pt', nome: 'Sofia Marques', papel: 'Suporte Técnico', cor: 'bg-sky-600' },
  { email: 'carlos.fatura@empresa.pt', nome: 'Carlos Nunes', papel: 'Faturação', cor: 'bg-violet-600' },
  { email: 'ines.comercial@empresa.pt', nome: 'Inês Carvalho', papel: 'Comercial', cor: 'bg-emerald-600' },
];

export default function Login() {
  const { entrar } = useAuth();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [aEntrar, setAEntrar] = useState(false);

  async function submeter({ emailAlvo, senhaAlvo } = {}) {
    setErro('');
    setAEntrar(true);
    try {
      await entrar(
        (emailAlvo || email).toLowerCase().trim(),
        senhaAlvo != null ? senhaAlvo : senha
      );
    } catch (e) {
      setErro(e.message || 'Não foi possível entrar.');
    } finally {
      setAEntrar(false);
    }
  }

  const podeEntrar = email && senha && !aEntrar;

  return (
    <div className="grid min-h-full place-items-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-indigo-600 text-white shadow">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 12h-6l-2 3h-4l-2-3H2" />
              <path d="M5.5 5.5h13L22 12v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6l3.5-6.5Z" />
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-800">Central de Tickets</h1>
            <p className="text-sm text-slate-500">Entre com o seu email e palavra-passe.</p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (podeEntrar) submeter();
            }}
          >
            <label className="block text-sm font-medium text-slate-700">Email de trabalho</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nome@empresa.pt"
              autoComplete="username"
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
            />

            <label className="mt-4 block text-sm font-medium text-slate-700">Palavra-passe</label>
            <input
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
            />

            <button
              type="submit"
              disabled={!podeEntrar}
              className="mt-5 w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
            >
              {aEntrar ? 'A entrar…' : 'Entrar'}
            </button>
          </form>

          {erro && <p className="mt-2 text-sm text-rose-600">{erro}</p>}

          <div className="my-5 flex items-center gap-3 text-xs text-slate-400">
            <span className="h-px flex-1 bg-slate-200" /> entrada rápida (demo) <span className="h-px flex-1 bg-slate-200" />
          </div>

          <div className="grid grid-cols-2 gap-2">
            {PERFIS.map((p) => (
              <button
                key={p.email}
                onClick={() => submeter({ emailAlvo: p.email, senhaAlvo: DEMO_PASSWORD })}
                disabled={aEntrar}
                className="flex items-center gap-2 rounded-lg border border-slate-200 p-2 text-left transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50"
              >
                <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${p.cor} text-xs font-semibold text-white`}>
                  {p.nome.split(' ').map((x) => x[0]).slice(0, 2).join('')}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-slate-700">{p.nome}</span>
                  <span className="block truncate text-xs text-slate-400">{p.papel}</span>
                </span>
              </button>
            ))}
          </div>
        </div>

        <p className="mt-4 text-center text-xs text-slate-400">
          Os atalhos de demonstração usam a palavra-passe <code>demo1234</code>. O super
          administrador entra com as credenciais definidas no servidor.
        </p>
      </div>
    </div>
  );
}
