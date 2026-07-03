/**
 * client.js — Pequeno cliente HTTP sobre fetch, com token JWT.
 * Em dev, os pedidos /api são encaminhados pelo proxy do Vite.
 */
const TOKEN_KEY = 'ticket_token';

export function guardarToken(t) {
  localStorage.setItem(TOKEN_KEY, t);
}
export function lerToken() {
  return localStorage.getItem(TOKEN_KEY);
}
export function limparToken() {
  localStorage.removeItem(TOKEN_KEY);
}

async function pedir(caminho, opcoes = {}) {
  const token = lerToken();
  const resp = await fetch(`/api${caminho}`, {
    ...opcoes,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opcoes.headers || {}),
    },
  });
  if (resp.status === 204) return null;
  const dados = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    throw new Error(dados.erro || `Erro ${resp.status}`);
  }
  return dados;
}

export const api = {
  login: (email) => pedir('/auth/login', { method: 'POST', body: JSON.stringify({ email }) }),
  me: () => pedir('/auth/me'),
  listarTickets: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return pedir(`/tickets${q ? `?${q}` : ''}`);
  },
  assumir: (id) => pedir(`/tickets/${id}/assumir`, { method: 'POST' }),
  libertar: (id) => pedir(`/tickets/${id}/libertar`, { method: 'POST' }),
  resolver: (id, resposta) =>
    pedir(`/tickets/${id}/resolver`, { method: 'POST', body: JSON.stringify({ resposta }) }),
  metricas: () => pedir('/tickets/metricas'),
  // Apenas em desenvolvimento:
  mockTicket: () => pedir('/dev/mock-ticket', { method: 'POST', body: '{}' }),
};
