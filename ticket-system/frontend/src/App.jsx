import { useAuth } from './context/AuthContext';
import { useSocket } from './hooks/useSocket';
import Navbar from './components/Navbar';
import Login from './pages/Login';
import Queue from './pages/Queue';
import AdminDashboard from './pages/AdminDashboard';

export default function App() {
  const { utilizador, aCarregar } = useAuth();
  // Uma única ligação de tempo real, partilhada pelas páginas.
  const { socket, ligado } = useSocket();

  if (aCarregar) {
    return <div className="grid min-h-full place-items-center text-slate-400">A iniciar…</div>;
  }

  if (!utilizador) return <Login />;

  return (
    <div className="min-h-full">
      <Navbar ligado={ligado} />
      {utilizador.funcao === 'admin' ? (
        <AdminDashboard socketRef={socket} ligado={ligado} />
      ) : (
        <Queue socketRef={socket} ligado={ligado} />
      )}
    </div>
  );
}
