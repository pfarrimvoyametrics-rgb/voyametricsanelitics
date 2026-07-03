/**
 * AnaliseIA.jsx — Cartão de análise de volume de tickets por equipa (Claude),
 * com STREAMING (Server-Sent Events) — o texto aparece à medida que é gerado.
 * Usa fetch + ReadableStream (em vez de EventSource) para poder enviar o token
 * JWT no cabeçalho e um corpo JSON com filtros.
 */
import { useRef, useState } from 'react';
import { lerToken } from '../api/client';

export default function AnaliseIA() {
  const [aCarregar, setACarregar] = useState(false);
  const [analise, setAnalise] = useState('');
  const [estado, setEstado] = useState('');
  const [erro, setErro] = useState('');
  const abortRef = useRef(null);

  async function analisar() {
    setACarregar(true);
    setErro('');
    setAnalise('');
    setEstado('A preparar…');

    const controlador = new AbortController();
    abortRef.current = controlador;

    try {
      const resp = await fetch('/api/analise/volume-equipas/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${lerToken()}`,
        },
        body: JSON.stringify({}), // sem filtros = todo o histórico
        signal: controlador.signal,
      });
      if (!resp.ok || !resp.body) throw new Error(`Erro ${resp.status}`);

      const reader = resp.body.getReader();
      const descodificador = new TextDecoder();
      let buffer = '';

      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += descodificador.decode(value, { stream: true });

        // SSE: blocos separados por linha em branco (\n\n).
        const blocos = buffer.split('\n\n');
        buffer = blocos.pop(); // resto incompleto fica para a próxima leitura

        for (const bloco of blocos) {
          let evento = 'message';
          let dados = '';
          for (const linha of bloco.split('\n')) {
            if (linha.startsWith('event:')) evento = linha.slice(6).trim();
            else if (linha.startsWith('data:')) dados += linha.slice(5).trim();
          }
          if (!dados) continue;
          const obj = JSON.parse(dados);

          if (evento === 'delta') {
            setEstado('');
            setAnalise((a) => a + obj.texto);
          } else if (evento === 'status') {
            setEstado(`A consultar dados (${obj.ferramenta})…`);
          } else if (evento === 'erro') {
            setErro(obj.mensagem || 'Falha ao gerar a análise.');
          } else if (evento === 'fim') {
            setEstado('');
          }
        }
      }
    } catch (e) {
      if (e.name !== 'AbortError') setErro(e.message || 'Falha ao gerar a análise.');
    } finally {
      setACarregar(false);
      abortRef.current = null;
    }
  }

  return (
    <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-700">Análise por IA</h3>
          <p className="text-xs text-slate-400">Volume de tickets por equipa, comentado pelo Claude.</p>
        </div>
        <button
          onClick={analisar}
          disabled={aCarregar}
          className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {aCarregar ? 'A analisar…' : analise ? 'Analisar de novo' : 'Analisar por IA'}
        </button>
      </div>

      {estado && (
        <p className="mt-3 flex items-center gap-2 text-xs text-slate-400">
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-indigo-500" />
          {estado}
        </p>
      )}

      {erro && (
        <p className="mt-3 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-600">{erro}</p>
      )}

      {analise && !erro && (
        <div className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
          {analise}
        </div>
      )}

      {!analise && !erro && !aCarregar && (
        <p className="mt-4 text-sm text-slate-400">
          Carrega em “Analisar por IA” para gerar um resumo da distribuição de carga entre equipas.
        </p>
      )}
    </section>
  );
}
