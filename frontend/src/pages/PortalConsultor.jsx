import { useCallback, useEffect, useState } from 'react';
import { api, lerOrgAtiva, definirOrgAtiva } from '../api/client';
import Navbar from '../components/Navbar';
import Organizacoes from './Organizacoes';
import AdminDashboard from './AdminDashboard';
import Parametrizacao from './Parametrizacao';
import Relatorios from './Relatorios';
import AnaliseIA from '../components/AnaliseIA';

/**
 * PortalConsultor — plataforma do super administrador (consultor).
 *  - Empresas: criar/gerir os clientes (organizações) e escolher qual operar.
 *  - Com um cliente selecionado: Operação, Configuração, Relatórios (avançados,
 *    com PDF/Liderança) e Análise por IA — as ferramentas de consultoria.
 * A organização escolhida segue no header `x-org-id` (ver api/client + resolverOrg).
 */
const SECOES = [
  { chave: 'empresas', rotulo: 'Empresas' },
  { chave: 'operacao', rotulo: 'Operação' },
  { chave: 'configuracao', rotulo: 'Configuração' },
  { chave: 'relatorios', rotulo: 'Relatórios' },
  { chave: 'analise', rotulo: 'Análise IA' },
];

export default function PortalConsultor({ socket, ligado }) {
  const [vista, setVista] = useState('empresas');
  const [orgs, setOrgs] = useState([]);
  const [orgAtivaId, setOrgAtivaId] = useState(lerOrgAtiva() || '');

  const carregarOrgs = useCallback(async () => {
    const lista = await api.listarOrganizacoes();
    setOrgs(lista);
    setOrgAtivaId((atual) => {
      if (atual && lista.some((o) => o.id === atual && o.ativo)) return atual;
      const primeira = lista.find((o) => o.ativo);
      const id = primeira ? primeira.id : '';
      definirOrgAtiva(id);
      return id;
    });
  }, []);

  useEffect(() => { carregarOrgs().catch(() => {}); }, [carregarOrgs]);

  const selecionarOrg = useCallback((id) => {
    definirOrgAtiva(id);
    setOrgAtivaId(id);
  }, []);

  // Ao observar uma organização, entra na sua sala de tempo real.
  useEffect(() => {
    if (orgAtivaId && ligado && socket.current) {
      socket.current.emit('org:entrar', { orgId: orgAtivaId });
    }
  }, [orgAtivaId, ligado, socket]);

  const orgsAtivas = orgs.filter((o) => o.ativo);
  const semOrg = !orgAtivaId;

  function conteudo() {
    if (vista === 'empresas') {
      return <Organizacoes orgs={orgs} orgAtivaId={orgAtivaId} aoSelecionar={selecionarOrg} aoRecarregar={carregarOrgs} />;
    }
    if (semOrg) {
      return (
        <div className="mx-auto max-w-7xl px-5 py-16 text-center text-slate-500">
          <p className="text-sm">Escolha uma empresa cliente para ver esta secção.</p>
          <button onClick={() => setVista('empresas')} className="mt-3 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">
            Ir para Empresas
          </button>
        </div>
      );
    }
    if (vista === 'configuracao') return <Parametrizacao key={orgAtivaId} />;
    if (vista === 'relatorios') return <Relatorios key={orgAtivaId} />;
    if (vista === 'analise') return <AnaliseIA key={orgAtivaId} />;
    return <AdminDashboard key={orgAtivaId} socketRef={socket} ligado={ligado} />;
  }

  return (
    <div className="min-h-full">
      <Navbar ligado={ligado} />

      <nav className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-5">
          <div className="flex gap-1">
            {SECOES.map((s) => (
              <button
                key={s.chave}
                onClick={() => setVista(s.chave)}
                className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition ${
                  vista === s.chave
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                {s.rotulo}
              </button>
            ))}
          </div>

          {vista !== 'empresas' && (
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

      {conteudo()}
    </div>
  );
}
