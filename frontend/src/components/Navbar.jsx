import { useAuth } from '../context/AuthContext';

const ROTULO_CATEGORIA = {
  suporte_tecnico: 'Suporte Técnico',
  faturacao: 'Faturação',
  comercial: 'Comercial',
};

export default function Navbar({ ligado }) {
  const { utilizador, sair } = useAuth();
  if (!utilizador) return null;

  const iniciais = utilizador.nome
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-indigo-600 text-white shadow-sm">
            {/* marca simples: caixa de entrada */}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 12h-6l-2 3h-4l-2-3H2" />
              <path d="M5.5 5.5h13L22 12v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6l3.5-6.5Z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-bold leading-tight text-slate-800">Central de Tickets</p>
            <p className="text-xs leading-tight text-slate-500">Gestão de SLA &amp; Equipa</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 text-xs text-slate-500" title={ligado ? 'Tempo real ativo' : 'Sem ligação em tempo real'}>
            <span className={`h-2 w-2 rounded-full ${ligado ? 'bg-emerald-500' : 'bg-slate-300'}`} />
            {ligado ? 'Em direto' : 'Offline'}
          </span>

          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-full bg-slate-800 text-xs font-semibold text-white">
              {iniciais}
            </div>
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium leading-tight text-slate-800">{utilizador.nome}</p>
              <p className="text-xs leading-tight text-slate-500">
                {utilizador.funcao === 'super_admin'
                  ? 'Super Administrador'
                  : utilizador.funcao === 'admin'
                    ? 'Administrador'
                    : ROTULO_CATEGORIA[utilizador.categoria]}
              </p>
            </div>
          </div>

          <button
            onClick={sair}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
          >
            Sair
          </button>
        </div>
      </div>
    </header>
  );
}
