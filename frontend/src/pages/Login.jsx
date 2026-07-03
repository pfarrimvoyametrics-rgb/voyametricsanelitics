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

export default function Login({ variante = 'empresa' }) {
  const ehConsultor = variante === 'consultor';
  const { entrar } = useAuth();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
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
          <div className={`grid h-11 w-11 place-items-center rounded-xl text-white shadow ${ehConsultor ? 'bg-slate-900' : 'bg-indigo-600'}`}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 12h-6l-2 3h-4l-2-3H2" />
              <path d="M5.5 5.5h13L22 12v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6l3.5-6.5Z" />
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-800">{ehConsultor ? 'Consola do Consultor' : 'Central de Tickets'}</h1>
            <p className="text-sm text-slate-500">
              {ehConsultor ? 'Plataforma VoyaMetrics — acesso do super administrador.' : 'Entre com o seu email e palavra-passe.'}
            </p>
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
            <div className="relative mt-1.5">
              <input
                type={mostrarSenha ? 'text' : 'password'}
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 pr-10 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
              />
              <button
                type="button"
                onClick={() => setMostrarSenha((v) => !v)}
                tabIndex={-1}
                aria-label={mostrarSenha ? 'Ocultar palavra-passe' : 'Mostrar palavra-passe'}
                title={mostrarSenha ? 'Ocultar palavra-passe' : 'Mostrar palavra-passe'}
                className="absolute inset-y-0 right-0 grid w-10 place-items-center text-slate-400 transition hover:text-slate-600"
              >
                {mostrarSenha ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c6.5 0 10 7 10 7a13.2 13.2 0 0 1-1.67 2.68" />
                    <path d="M6.61 6.61A13.5 13.5 0 0 0 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.39-1.61" />
                    <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
                    <path d="m2 2 20 20" />
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>

            <button
              type="submit"
              disabled={!podeEntrar}
              className="mt-5 w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
            >
              {aEntrar ? 'A entrar…' : 'Entrar'}
            </button>
          </form>

          {erro && <p className="mt-2 text-sm text-rose-600">{erro}</p>}

          {!ehConsultor && import.meta.env.DEV && (
          <>
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
          </>
          )}
        </div>

        {!ehConsultor && import.meta.env.DEV && (
          <p className="mt-4 text-center text-xs text-slate-400">
            Os atalhos de demonstração usam a palavra-passe <code>demo1234</code>. O super
            administrador entra com as credenciais definidas no servidor.
          </p>
        )}
      </div>
    </div>
  );
}
