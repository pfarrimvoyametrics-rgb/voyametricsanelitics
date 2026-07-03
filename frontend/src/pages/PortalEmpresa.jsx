import { useState } from 'react';
import Navbar from '../components/Navbar';
import AdminDashboard from './AdminDashboard';
import Parametrizacao from './Parametrizacao';
import RelatoriosBasico from './RelatoriosBasico';

/**
 * PortalEmpresa — experiência do ADMIN da empresa cliente.
 * Três secções claras: Operação (fila/painel), Configuração (empresa +
 * utilizadores/colaboradores) e Relatórios (básico, só leitura). Sem análise
 * por IA nem exportação — essas são ferramentas do consultor.
 */
const SECOES = [
  { chave: 'operacao', rotulo: 'Operação' },
  { chave: 'configuracao', rotulo: 'Configuração' },
  { chave: 'relatorios', rotulo: 'Relatórios' },
];

export default function PortalEmpresa({ socket, ligado }) {
  const [secao, setSecao] = useState('operacao');

  return (
    <div className="min-h-full">
      <Navbar ligado={ligado} />

      <nav className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl gap-1 px-5">
          {SECOES.map((s) => (
            <button
              key={s.chave}
              onClick={() => setSecao(s.chave)}
              className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition ${
                secao === s.chave
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {s.rotulo}
            </button>
          ))}
        </div>
      </nav>

      {secao === 'configuracao' ? (
        <Parametrizacao />
      ) : secao === 'relatorios' ? (
        <RelatoriosBasico />
      ) : (
        <AdminDashboard socketRef={socket} ligado={ligado} />
      )}
    </div>
  );
}
