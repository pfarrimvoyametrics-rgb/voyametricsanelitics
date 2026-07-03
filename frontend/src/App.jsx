import { useState } from 'react';
import { useAuth } from './context/AuthContext';
import { useSocket } from './hooks/useSocket';
import { ehAdmin, ehSuperAdmin } from './utils/papeis';
import Navbar from './components/Navbar';
import Login from './pages/Login';
import Queue from './pages/Queue';
import AdminDashboard from './pages/AdminDashboard';
import Parametrizacao from './pages/Parametrizacao';

export default function App() {
  const { utilizador, aCarregar } = useAuth();
  // Uma única ligação de tempo real, partilhada pelas páginas.
  const { socket, ligado } = useSocket();
  // Vista ativa do super admin: 'painel' (dashboard) ou 'parametrizacao'.
  const [vista, setVista] = useState('painel');

  if (aCarregar) {
    return <div className="grid min-h-full place-items-center text-slate-400">A iniciar…</div>;
  }

  if (!utilizador) return <Login />;

  const superAdmin = ehSuperAdmin(utilizador.funcao);

  return (
    <div className="min-h-full">
      <Navbar ligado={ligado} />

      {superAdmin && (
        <nav className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-7xl gap-1 px-5">
            {[
              { chave: 'painel', rotulo: 'Painel' },
              { chave: 'parametrizacao', rotulo: 'Parametrização' },
            ].map((t) => (
              <button
                key={t.chave}
                onClick={() => setVista(t.chave)}
                className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition ${
                  vista === t.chave
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                {t.rotulo}
              </button>
            ))}
          </div>
        </nav>
      )}

      {superAdmin && vista === 'parametrizacao' ? (
        <Parametrizacao />
      ) : ehAdmin(utilizador.funcao) ? (
        <AdminDashboard socketRef={socket} ligado={ligado} />
      ) : (
        <Queue socketRef={socket} ligado={ligado} />
      )}
    </div>
  );
}
