/**
 * relatorioModel.js — Agregações para os relatórios analíticos.
 *
 * Período por RECEÇÃO (data_rececao ∈ [de, ate]) e ÂMBITO opcional:
 *   • cliente  (remetente exacto)
 *   • operador (id do operador atribuído)
 *   • equipa   (categoria_ticket)
 *
 * Métricas partilhadas por todas as dimensões:
 *   total / resolvidos / cumpridos (dentro do SLA) / abertos / violados_abertos
 *   horas_resolucao_media (relógio de parede) · horas_resposta_media (até 1.ª
 *   atribuição) · horas_uteis_resolucao_media (horas úteis) · vendas e receita.
 */

const { pool } = require('../config/db');

// Expressão de métricas reutilizada (sobre `tickets` ou alias).
const metricas = (col = '') => {
  const c = col ? `${col}.` : '';
  return `
    COUNT(*)::int AS total,
    COUNT(*) FILTER (WHERE ${c}status = 'resolvido')::int AS resolvidos,
    COUNT(*) FILTER (WHERE ${c}status = 'resolvido' AND ${c}data_resolucao <= ${c}sla_limite)::int AS cumpridos,
    COUNT(*) FILTER (WHERE ${c}status <> 'resolvido')::int AS abertos,
    COUNT(*) FILTER (WHERE ${c}status <> 'resolvido' AND ${c}sla_limite < now())::int AS violados_abertos,
    ROUND(AVG(EXTRACT(EPOCH FROM (${c}data_resolucao - ${c}data_rececao)) / 3600.0)
          FILTER (WHERE ${c}status = 'resolvido')::numeric, 2)::float AS horas_resolucao_media,
    ROUND(AVG(EXTRACT(EPOCH FROM (${c}data_primeira_atribuicao - ${c}data_rececao)) / 3600.0)
          FILTER (WHERE ${c}data_primeira_atribuicao IS NOT NULL)::numeric, 2)::float AS horas_resposta_media,
    ROUND((AVG(${c}minutos_uteis_resolucao)
          FILTER (WHERE ${c}status = 'resolvido' AND ${c}minutos_uteis_resolucao IS NOT NULL) / 60.0)::numeric, 2)::float AS horas_uteis_resolucao_media,
    COUNT(*) FILTER (WHERE ${c}resultado_venda = 'ganho')::int AS vendas_ganho,
    COUNT(*) FILTER (WHERE ${c}resultado_venda = 'perdido')::int AS vendas_perdido,
    COALESCE(SUM(${c}valor_venda) FILTER (WHERE ${c}resultado_venda = 'ganho'), 0)::float AS receita,
    COUNT(*) FILTER (WHERE ${c}csat IS NOT NULL)::int AS csat_respostas,
    ROUND(AVG(${c}csat) FILTER (WHERE ${c}csat IS NOT NULL)::numeric, 2)::float AS csat_media,
    COALESCE(SUM(${c}bilhetes_emitidos), 0)::int AS bilhetes_emitidos,
    COALESCE(SUM(${c}bilhetes_com_erro), 0)::int AS bilhetes_com_erro`;
};

/**
 * Constrói a cláusula WHERE (período + âmbito) e os parâmetros.
 * @returns {{where: string, params: any[]}}
 */
function filtro({ de, ate, cliente, operador, equipa }, col = '') {
  const c = col ? `${col}.` : '';
  const cond = [`${c}data_rececao >= $1`, `${c}data_rececao < ($2::date + interval '1 day')`];
  const params = [de, ate];
  let i = 3;
  if (cliente) { cond.push(`${c}remetente = $${i++}`); params.push(cliente); }
  if (operador) { cond.push(`${c}operador_atribuido_id = $${i++}`); params.push(operador); }
  if (equipa) { cond.push(`${c}categoria_ticket = $${i++}`); params.push(equipa); }
  return { where: cond.join(' AND '), params };
}

function enriquecer(r) {
  const resolvidos = Number(r.resolvidos) || 0;
  const cumpridos = Number(r.cumpridos) || 0;
  const ganho = Number(r.vendas_ganho) || 0;
  const perdido = Number(r.vendas_perdido) || 0;
  const fechadas = ganho + perdido;
  const csatResp = Number(r.csat_respostas) || 0;
  const emitidos = Number(r.bilhetes_emitidos) || 0;
  const comErro = Number(r.bilhetes_com_erro) || 0;
  return {
    ...r,
    taxa_sla: resolvidos > 0 ? Math.round((cumpridos / resolvidos) * 1000) / 10 : null,
    taxa_conversao: fechadas > 0 ? Math.round((ganho / fechadas) * 1000) / 10 : null,
    ticket_medio: ganho > 0 ? Math.round((Number(r.receita) / ganho) * 100) / 100 : 0,
    taxa_resposta_csat: resolvidos > 0 ? Math.round((csatResp / resolvidos) * 1000) / 10 : null,
    precisao_emissao: emitidos > 0 ? Math.round((1 - comErro / emitidos) * 1000) / 10 : null,
  };
}

async function geral(f) {
  const { where, params } = filtro(f);
  const { rows } = await pool.query(`SELECT ${metricas()} FROM tickets WHERE ${where}`, params);
  return enriquecer(rows[0]);
}

async function porCliente(f, limite = 1000) {
  const n = Math.min(parseInt(limite, 10) || 1000, 5000);
  const { where, params } = filtro(f);
  const { rows } = await pool.query(
    `SELECT remetente, split_part(remetente, '@', 2) AS dominio, ${metricas()}
       FROM tickets WHERE ${where}
      GROUP BY remetente ORDER BY total DESC, receita DESC LIMIT ${n}`, params);
  return rows.map(enriquecer);
}

async function porOperador(f) {
  const { where, params } = filtro(f, 't');
  const { rows } = await pool.query(
    `SELECT u.id, u.nome, u.categoria, ${metricas('t')}
       FROM tickets t JOIN usuarios u ON u.id = t.operador_atribuido_id
      WHERE ${where}
      GROUP BY u.id, u.nome, u.categoria ORDER BY resolvidos DESC, total DESC`, params);
  return rows.map(enriquecer);
}

async function porCategoria(f) {
  const { where, params } = filtro(f);
  const { rows } = await pool.query(
    `SELECT categoria_ticket, cs.sla_minutos, cs.rotulo, ${metricas()}
       FROM tickets
       LEFT JOIN canais_sla cs ON cs.categoria = tickets.categoria_ticket
      WHERE ${where}
      GROUP BY categoria_ticket, cs.sla_minutos, cs.rotulo
      ORDER BY total DESC`, params);
  return rows.map(enriquecer);
}

async function porEstado(f) {
  const { where, params } = filtro(f);
  const { rows } = await pool.query(
    `SELECT status, COUNT(*)::int AS total FROM tickets WHERE ${where}
      GROUP BY status ORDER BY total DESC`, params);
  return rows;
}

/** Volume por dia da semana (1=Segunda … 7=Domingo). */
async function porDiaSemana(f) {
  const { where, params } = filtro(f);
  const { rows } = await pool.query(
    `SELECT EXTRACT(ISODOW FROM data_rececao)::int AS dia,
            COUNT(*)::int AS recebidos,
            COUNT(*) FILTER (WHERE status = 'resolvido' AND data_resolucao <= sla_limite)::int AS cumpridos,
            COUNT(*) FILTER (WHERE status = 'resolvido')::int AS resolvidos
       FROM tickets WHERE ${where}
      GROUP BY 1 ORDER BY 1`, params);
  return rows;
}

/** Volume por hora do dia (0–23) — identifica horas de ponta. */
async function porHora(f) {
  const { where, params } = filtro(f);
  const { rows } = await pool.query(
    `SELECT EXTRACT(HOUR FROM data_rececao)::int AS hora, COUNT(*)::int AS recebidos
       FROM tickets WHERE ${where}
      GROUP BY 1 ORDER BY 1`, params);
  return rows;
}

async function evolucao(f, granularidade = 'dia') {
  const mapa = { dia: 'day', semana: 'week', mes: 'month' };
  const unidade = mapa[granularidade] || 'day';
  const { where, params } = filtro(f);
  const { rows } = await pool.query(
    `SELECT date_trunc('${unidade}', data_rececao) AS periodo,
            COUNT(*)::int AS recebidos,
            COUNT(*) FILTER (WHERE status = 'resolvido')::int AS resolvidos,
            COUNT(*) FILTER (WHERE status = 'resolvido' AND data_resolucao <= sla_limite)::int AS cumpridos,
            COUNT(*) FILTER (WHERE resultado_venda = 'ganho')::int AS vendas_ganho,
            COALESCE(SUM(valor_venda) FILTER (WHERE resultado_venda = 'ganho'), 0)::float AS receita
       FROM tickets WHERE ${where}
      GROUP BY 1 ORDER BY 1`, params);
  return rows;
}

module.exports = {
  geral, porCliente, porOperador, porCategoria,
  porEstado, porDiaSemana, porHora, evolucao,
};
