import { useState } from 'react';
import GestaoUtilizadores from '../components/GestaoUtilizadores';
import RegrasTriagem from '../components/RegrasTriagem';
import ConfigSla from '../components/ConfigSla';

const SUBTABS = [
  { chave: 'utilizadores', rotulo: 'Utilizadores' },
  { chave: 'triagem', rotulo: 'Regras de triagem' },
  { chave: 'sla', rotulo: 'SLA' },
];

/**
 * Parametrizacao — back-office do super administrador.
 * Módulos: gestão de utilizadores e regras de triagem.
 */
export default function Parametrizacao() {
  const [sub, setSub] = useState('utilizadores');

  return (
    <main className="mx-auto max-w-7xl px-5 py-6">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-slate-800">Parametrização</h1>
        <p className="text-sm text-slate-500">Gestão de utilizadores e configuração da aplicação.</p>
      </div>

      <div className="mb-6 inline-flex rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
        {SUBTABS.map((t) => (
          <button
            key={t.chave}
            onClick={() => setSub(t.chave)}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition ${
              sub === t.chave ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.rotulo}
          </button>
        ))}
      </div>

      {sub === 'utilizadores' ? <GestaoUtilizadores /> : sub === 'triagem' ? <RegrasTriagem /> : <ConfigSla />}
    </main>
  );
}
