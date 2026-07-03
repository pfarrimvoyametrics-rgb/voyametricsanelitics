import { useAuth } from './context/AuthContext';
import { useSocket } from './hooks/useSocket';
import { ehSuperAdmin, ehAdmin } from './utils/papeis';
import Navbar from './components/Navbar';
import Login from './pages/Login';
import Queue from './pages/Queue';
import CsatPublic from './pages/CsatPublic';
import PortalConsultor from './pages/PortalConsultor';
import PortalEmpresa from './pages/PortalEmpresa';

/**
 * App — encaminhamento por URL e por papel.
 *  - `?csat=<id>`  -> inquérito público (sem login).
 *  - `/consultor`  -> página de login do consultor (super admin).
 *  - `/`           -> página de login da empresa cliente.
 * Depois de autenticar, cada papel cai no seu portal próprio:
 *  super_admin -> PortalConsultor · admin -> PortalEmpresa · operador -> fila.
 */
export default function App() {
  const { utilizador, aCarregar } = useAuth();
  const { socket, ligado } = useSocket();

  // Inquérito público de satisfação: ?csat=<id-do-ticket> (sem login).
  const csatId = new URLSearchParams(window.location.search).get('csat');
  if (csatId) return <CsatPublic id={csatId} />;

  // Duas entradas de login distintas por URL.
  const ehEntradaConsultor = window.location.pathname.startsWith('/consultor');

  if (aCarregar) {
    return <div className="grid min-h-full place-items-center text-slate-400">A iniciar…</div>;
  }

  if (!utilizador) {
    return <Login variante={ehEntradaConsultor ? 'consultor' : 'empresa'} />;
  }

  // --- Portais por papel (cada um limpo e separado) --------------------------
  if (ehSuperAdmin(utilizador.funcao)) {
    return <PortalConsultor socket={socket} ligado={ligado} />;
  }
  if (ehAdmin(utilizador.funcao)) {
    return <PortalEmpresa socket={socket} ligado={ligado} />;
  }

  // Colaborador (operador): apenas a sua fila.
  return (
    <div className="min-h-full">
      <Navbar ligado={ligado} />
      <Queue socketRef={socket} ligado={ligado} />
    </div>
  );
}
