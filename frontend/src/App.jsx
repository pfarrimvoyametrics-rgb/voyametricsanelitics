import { useCallback, useEffect, useState } from 'react';
import { useAuth } from './context/AuthContext';
import { useSocket } from './hooks/useSocket';
import { ehAdmin, ehSuperAdmin } from './utils/papeis';
import { api, lerOrgAtiva, definirOrgAtiva } from './api/client';
import Navbar from './components/Navbar';
import Login from './pages/Login';
import Queue from './pages/Queue';
import AdminDashboard from './pages/AdminDashboard';
import Parametrizacao from './pages/Parametrizacao';
import Organizacoes from './pages/Organizacoes';

export default function App() {
  const { utilizador, aCarregar } = useAuth();
  const { socket, ligado } = useSocket();

  const [vista, setVista] = useState('painel'); // painel | parametrizacao | organizacoes
  const [orgs, setOrgs] = useState([]);
  const [orgAtivaId, setOrgAtivaId] = useState(lerOrgAtiva() || '');

  const superAdmin = utilizador && ehSuperAdmin(utilizador.funcao);

  // Super admin: carregar a lista de organizações (para o seletor e a gestão).
  const carregarOrgs = useCallback(async () => {
    const lista = await api.listarOrganizacoes();
    setOrgs(lista);
    // Se não há organização escolhida, escolhe a primeira ativa.
    setOrgAtivaId((atual) => {
      if (atual && lista.some((o) => o.id === atual && o.ativo)) return atual;
      const primeira = lista.find((o) => o.ativo);
      const id = primeira ? primeira.id : '';
      definirOrgAtiva(id);
      return id;
    });
  }, []);

  useEffect(() => {
    if (superAdmin) carregarOrgs().catch(() => {});
  }, [superAdmin, carregarOrgs]);

  const selecionarOrg = useCallback((id) => {
    definirOrgAtiva(id);
    setOrgAtivaId(id);
  }, []);

  // Super admin a observar uma organização: entra na sala dela (tempo real).
  useEffect(() => {
    if (superAdmin && orgAtivaId && ligado && socket.current) {
      socket.current.emit('org:entrar', { orgId: orgAtivaId });
    }
  }, [superAdmin, orgAtivaId, ligado, socket]);

  if (aCarregar) {
    return <div className="grid min-h-full place-items-center text-slate-400">A iniciar…</div>;
  }
  if (!utilizador) return <Login />;

  // --- Admin de organização / operador: fluxo direto (org do token) ---------
  if (!superAdmin) {
    const adminOrg = ehAdmin(utilizador.funcao);
    return (
      <div className="min-h-full">
        <Navbar ligado={ligado} />

        {adminOrg && (
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

        {adminOrg && vista === 'parametrizacao' ? (
          <Parametrizacao />
        ) : adminOrg ? (
          <AdminDashboard socketRef={socket} ligado={ligado} />
        ) : (
          <Queue socketRef={socket} ligado={ligado} />
        )}
      </div>
    );
  }

  // --- Super admin: seletor de organização + separadores --------------------
  const orgsAtivas = orgs.filter((o) => o.ativo);
  const semOrg = !orgAtivaId;

  return (
    <div className="min-h-full">
      <Navbar ligado={ligado} />

      <nav className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-5">
          <div className="flex gap-1">
            {[
              { chave: 'painel', rotulo: 'Painel' },
              { chave: 'parametrizacao', rotulo: 'Parametrização' },
              { chave: 'organizacoes', rotulo: 'Organizações' },
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

          {vista !== 'organizacoes' && (
            <label className="flex items-center gap-2 py-2 text-sm text-slate-500">
              Cliente:
              <select
                value={orgAtivaId}
                onChange={(e) => selecionarOrg(e.target.value)}
                className="rounded-lg border border-slate-300 px-2 py-1 text-sm text-slate-700 focus:border-indigo-500 focus:outline-none"
              >
                {!orgAtivaId && <option value="">— escolher —</option>}
                {orgsAtivas.map((o) => (
                  <option key={o.id} value={o.id}>{o.nome}</option>
                ))}
              </select>
            </label>
          )}
        </div>
      </nav>

      {vista === 'organizacoes' ? (
        <Organizacoes orgs={orgs} orgAtivaId={orgAtivaId} aoSelecionar={selecionarOrg} aoRecarregar={carregarOrgs} />
      ) : semOrg ? (
        <div className="mx-auto max-w-7xl px-5 py-16 text-center text-slate-500">
          <p className="text-sm">Escolha uma organização (cliente) para ver o painel.</p>
          <button onClick={() => setVista('organizacoes')} className="mt-3 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">
            Gerir organizações
          </button>
        </div>
      ) : vista === 'parametrizacao' ? (
        <Parametrizacao key={orgAtivaId} />
      ) : (
        <AdminDashboard key={orgAtivaId} socketRef={socket} ligado={ligado} />
      )}
    </div>
  );
}
