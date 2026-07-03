/**
 * analiseIaService.js — Análise de tickets com o Claude (Anthropic).
 *
 * Foco: VOLUME DE TICKETS POR EQUIPA. No modelo de dados, a "equipa" é a
 * `categoria_ticket` (a mesma fila/categoria que também define o `categoria`
 * do operador). O Claude NUNCA escreve SQL: expomos ferramentas read-only e
 * parametrizadas que devolvem apenas agregados seguros da base de dados, e o
 * modelo usa esses números reais para produzir a análise.
 *
 * Padrão: laço agêntico manual sobre client.messages.create — enquanto o
 * modelo pedir ferramentas (stop_reason === 'tool_use'), executamos, devolvemos
 * o resultado e repetimos até ele concluir. Adaptive thinking ligado.
 */
const { pool } = require('../config/db');
const { env } = require('../config/env');

const MAX_ITERACOES = 6; // salvaguarda contra laços de ferramentas infinitos
const STATUS_VALIDOS = ['pendente', 'em_andamento', 'resolvido'];

let clienteSingleton = null;

/** Cria (uma vez) o cliente Anthropic; erro claro se faltar a chave. */
function obterCliente() {
  if (!env.anthropic.apiKey) {
    throw new Error(
      'ANTHROPIC_API_KEY em falta — defina-a no .env do backend para usar a análise por IA.'
    );
  }
  if (!clienteSingleton) {
    // Require preguiçoso: assim o backend arranca mesmo sem o SDK instalado;
    // só falha (com mensagem clara) quando a análise é efetivamente usada.
    let Anthropic;
    try {
      Anthropic = require('@anthropic-ai/sdk');
    } catch {
      throw new Error(
        "Pacote '@anthropic-ai/sdk' não instalado — corra `npm install @anthropic-ai/sdk` no backend."
      );
    }
    clienteSingleton = new Anthropic({ apiKey: env.anthropic.apiKey });
  }
  return clienteSingleton;
}

// ---------------------------------------------------------------------------
//  Ferramentas expostas ao modelo (esquema JSON) — TODAS read-only.
// ---------------------------------------------------------------------------
const FERRAMENTAS = [
  {
    name: 'volume_por_equipa',
    description:
      'Devolve o número total de tickets por equipa (categoria_ticket), ' +
      'ordenado do maior para o menor, com a percentagem sobre o total. ' +
      'Use para a distribuição de carga entre equipas.',
    input_schema: {
      type: 'object',
      properties: {
        desde: {
          type: 'string',
          description: 'Início do período (ISO 8601, ex.: 2026-06-01). Opcional.',
        },
        ate: {
          type: 'string',
          description: 'Fim do período, exclusivo (ISO 8601). Opcional.',
        },
        status: {
          type: 'string',
          enum: STATUS_VALIDOS,
          description: 'Filtra por estado do ticket. Opcional (por defeito, todos).',
        },
      },
    },
  },
  {
    name: 'evolucao_diaria_por_equipa',
    description:
      'Devolve a contagem diária de tickets por equipa no período, para ' +
      'detetar tendências, picos ou anomalias ao longo do tempo.',
    input_schema: {
      type: 'object',
      properties: {
        desde: { type: 'string', description: 'Início do período (ISO 8601). Opcional.' },
        ate: { type: 'string', description: 'Fim do período, exclusivo (ISO 8601). Opcional.' },
        status: {
          type: 'string',
          enum: STATUS_VALIDOS,
          description: 'Filtra por estado. Opcional.',
        },
      },
    },
  },
];

// ---------------------------------------------------------------------------
//  Execução das ferramentas (SQL parametrizado — nada vem cru do modelo).
// ---------------------------------------------------------------------------

/** Valida e normaliza os parâmetros comuns, herdando os filtros do pedido. */
function normalizarFiltros(input, base) {
  const p = {
    desde: input.desde ?? base.desde ?? null,
    ate: input.ate ?? base.ate ?? null,
    status: input.status ?? base.status ?? null,
    // A organização NUNCA vem do modelo — só do contexto do pedido.
    orgId: base.orgId ?? null,
  };
  for (const campo of ['desde', 'ate']) {
    if (p[campo] !== null && Number.isNaN(Date.parse(p[campo]))) {
      throw new Error(`Data inválida em "${campo}": ${p[campo]}`);
    }
  }
  if (p.status !== null && !STATUS_VALIDOS.includes(p.status)) {
    throw new Error(`Estado inválido: ${p.status}`);
  }
  return p;
}

async function volumePorEquipa(filtros) {
  const { rows } = await pool.query(
    `SELECT categoria_ticket AS equipa, COUNT(*)::int AS total
       FROM tickets
      WHERE organizacao_id = $4
        AND ($1::timestamptz IS NULL OR data_rececao >= $1)
        AND ($2::timestamptz IS NULL OR data_rececao <  $2)
        AND ($3::text        IS NULL OR status = $3)
      GROUP BY categoria_ticket
      ORDER BY total DESC`,
    [filtros.desde, filtros.ate, filtros.status, filtros.orgId]
  );
  const totalGeral = rows.reduce((s, r) => s + r.total, 0);
  return {
    periodo: { desde: filtros.desde, ate: filtros.ate },
    status: filtros.status,
    total_geral: totalGeral,
    n_equipas: rows.length,
    por_equipa: rows.map((r) => ({
      equipa: r.equipa,
      total: r.total,
      pct: totalGeral ? Number(((r.total / totalGeral) * 100).toFixed(1)) : 0,
    })),
  };
}

async function evolucaoDiariaPorEquipa(filtros) {
  const { rows } = await pool.query(
    `SELECT categoria_ticket AS equipa,
            date_trunc('day', data_rececao)::date AS dia,
            COUNT(*)::int AS total
       FROM tickets
      WHERE organizacao_id = $4
        AND ($1::timestamptz IS NULL OR data_rececao >= $1)
        AND ($2::timestamptz IS NULL OR data_rececao <  $2)
        AND ($3::text        IS NULL OR status = $3)
      GROUP BY equipa, dia
      ORDER BY dia ASC, equipa ASC`,
    [filtros.desde, filtros.ate, filtros.status, filtros.orgId]
  );
  return {
    periodo: { desde: filtros.desde, ate: filtros.ate },
    status: filtros.status,
    n_pontos: rows.length,
    serie: rows.map((r) => ({
      equipa: r.equipa,
      dia: r.dia instanceof Date ? r.dia.toISOString().slice(0, 10) : r.dia,
      total: r.total,
    })),
  };
}

/** Encaminha uma chamada de ferramenta para o executor correspondente. */
async function executarFerramenta(nome, input, filtrosBase) {
  const filtros = normalizarFiltros(input || {}, filtrosBase);
  switch (nome) {
    case 'volume_por_equipa':
      return volumePorEquipa(filtros);
    case 'evolucao_diaria_por_equipa':
      return evolucaoDiariaPorEquipa(filtros);
    default:
      throw new Error(`Ferramenta desconhecida: ${nome}`);
  }
}

// ---------------------------------------------------------------------------
//  Prompt de sistema.
// ---------------------------------------------------------------------------
const SISTEMA = [
  'És um analista de operações de suporte da VoyaMetrics.',
  'Analisas o VOLUME DE TICKETS POR EQUIPA — no sistema, "equipa" = categoria_ticket.',
  '',
  'Regras:',
  '- Obtém sempre os números através das ferramentas antes de analisar. Nunca inventes valores.',
  '- Baseia cada afirmação em dados devolvidos pelas ferramentas.',
  '- Sê conciso e direto: começa pela conclusão principal, depois o detalhe.',
  '',
  'Estrutura a resposta em: (1) distribuição por equipa com números e %, ',
  '(2) equipas mais e menos carregadas e eventuais desequilíbrios, ',
  '(3) tendências/anomalias se relevantes, (4) 1 a 3 recomendações acionáveis.',
  'Responde em português de Portugal.',
].join('\n');

/** Constrói a mensagem inicial do utilizador com o contexto do pedido. */
function construirPergunta({ pergunta, filtros }) {
  const ctx = [];
  if (filtros.desde) ctx.push(`desde ${filtros.desde}`);
  if (filtros.ate) ctx.push(`até ${filtros.ate}`);
  if (filtros.status) ctx.push(`estado = ${filtros.status}`);
  const periodo = ctx.length ? ` (${ctx.join(', ')})` : ' (todo o histórico)';
  const base =
    pergunta && pergunta.trim()
      ? pergunta.trim()
      : 'Analisa o volume de tickets por equipa.';
  return `${base}${periodo}`;
}

// ---------------------------------------------------------------------------
//  Entrada pública: corre o laço agêntico e devolve a análise em texto.
// ---------------------------------------------------------------------------
/**
 * @param {{desde?: string, ate?: string, status?: string, pergunta?: string}} opts
 * @returns {Promise<{analise: string, modelo: string, uso: object}>}
 */
async function analisarVolumeEquipas(opts = {}) {
  const cliente = obterCliente();
  const filtrosBase = {
    desde: opts.desde ?? null,
    ate: opts.ate ?? null,
    status: opts.status ?? null,
    orgId: opts.orgId ?? null,
  };

  const messages = [
    { role: 'user', content: construirPergunta({ pergunta: opts.pergunta, filtros: filtrosBase }) },
  ];

  let resposta;
  for (let i = 0; i < MAX_ITERACOES; i++) {
    resposta = await cliente.messages.create({
      model: env.anthropic.modelo,
      max_tokens: 4000,
      thinking: { type: 'adaptive' },
      system: SISTEMA,
      tools: FERRAMENTAS,
      messages,
    });

    if (resposta.stop_reason !== 'tool_use') break;

    // Preserva o turno do assistente COMPLETO (inclui blocos de thinking).
    messages.push({ role: 'assistant', content: resposta.content });

    const resultados = [];
    for (const bloco of resposta.content) {
      if (bloco.type !== 'tool_use') continue;
      try {
        const dados = await executarFerramenta(bloco.name, bloco.input, filtrosBase);
        resultados.push({
          type: 'tool_result',
          tool_use_id: bloco.id,
          content: JSON.stringify(dados),
        });
      } catch (err) {
        resultados.push({
          type: 'tool_result',
          tool_use_id: bloco.id,
          content: `Erro na ferramenta: ${err.message}`,
          is_error: true,
        });
      }
    }
    messages.push({ role: 'user', content: resultados });
  }

  const analise = resposta.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim();

  return { analise, modelo: resposta.model, uso: resposta.usage };
}

/**
 * Variante em STREAMING: igual a analisarVolumeEquipas, mas emite o texto à
 * medida que é gerado (callbacks), em vez de devolver tudo no fim.
 * @param {{desde?:string, ate?:string, status?:string, pergunta?:string}} opts
 * @param {{onDelta?:(t:string)=>void, onFerramenta?:(nome:string)=>void}} cb
 * @returns {Promise<{modelo:string, uso:object}>}
 */
async function analisarVolumeEquipasStream(opts = {}, cb = {}) {
  const { onDelta, onFerramenta } = cb;
  const cliente = obterCliente();
  const filtrosBase = {
    desde: opts.desde ?? null,
    ate: opts.ate ?? null,
    status: opts.status ?? null,
    orgId: opts.orgId ?? null,
  };

  const messages = [
    { role: 'user', content: construirPergunta({ pergunta: opts.pergunta, filtros: filtrosBase }) },
  ];

  let ultimo;
  for (let i = 0; i < MAX_ITERACOES; i++) {
    const stream = cliente.messages.stream({
      model: env.anthropic.modelo,
      max_tokens: 4000,
      thinking: { type: 'adaptive' },
      system: SISTEMA,
      tools: FERRAMENTAS,
      messages,
    });

    // Emite cada fragmento de texto assim que chega.
    if (onDelta) stream.on('text', (delta) => onDelta(delta));

    ultimo = await stream.finalMessage();
    if (ultimo.stop_reason !== 'tool_use') break;

    messages.push({ role: 'assistant', content: ultimo.content });

    const resultados = [];
    for (const bloco of ultimo.content) {
      if (bloco.type !== 'tool_use') continue;
      if (onFerramenta) onFerramenta(bloco.name);
      try {
        const dados = await executarFerramenta(bloco.name, bloco.input, filtrosBase);
        resultados.push({ type: 'tool_result', tool_use_id: bloco.id, content: JSON.stringify(dados) });
      } catch (err) {
        resultados.push({
          type: 'tool_result',
          tool_use_id: bloco.id,
          content: `Erro na ferramenta: ${err.message}`,
          is_error: true,
        });
      }
    }
    messages.push({ role: 'user', content: resultados });
  }

  return { modelo: ultimo.model, uso: ultimo.usage };
}

module.exports = { analisarVolumeEquipas, analisarVolumeEquipasStream };
