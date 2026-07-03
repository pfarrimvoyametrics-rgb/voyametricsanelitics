/**
 * client.js — Pequeno cliente HTTP sobre fetch, com token JWT.
 * Em dev, os pedidos /api são encaminhados pelo proxy do Vite.
 */
const TOKEN_KEY = 'ticket_token';
const ORG_KEY = 'ticket_org_ativa';

export function guardarToken(t) {
  localStorage.setItem(TOKEN_KEY, t);
}
export function lerToken() {
  return localStorage.getItem(TOKEN_KEY);
}
export function limparToken() {
  localStorage.removeItem(TOKEN_KEY);
}

// Organização ativa (só o super_admin a usa para escolher o cliente a operar).
// Vai no header `x-org-id`; para admin/operador o backend ignora-a e usa a do token.
export function definirOrgAtiva(id) {
  if (id) localStorage.setItem(ORG_KEY, id);
  else localStorage.removeItem(ORG_KEY);
}
export function lerOrgAtiva() {
  return localStorage.getItem(ORG_KEY);
}

async function pedir(caminho, opcoes = {}) {
  const token = lerToken();
  const orgAtiva = lerOrgAtiva();
  const resp = await fetch(`/api${caminho}`, {
    ...opcoes,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(orgAtiva ? { 'x-org-id': orgAtiva } : {}),
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
  login: (email, senha) =>
    pedir('/auth/login', { method: 'POST', body: JSON.stringify({ email, senha }) }),
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
  // Análise por IA (admin): volume de tickets por equipa.
  analiseVolumeEquipas: (opcoes = {}) =>
    pedir('/analise/volume-equipas', { method: 'POST', body: JSON.stringify(opcoes) }),
  // Gestão de utilizadores (parametrização — super admin nas mutações):
  listarUsuarios: () => pedir('/usuarios'),
  criarUsuario: (dados) => pedir('/usuarios', { method: 'POST', body: JSON.stringify(dados) }),
  definirAtivoUsuario: (id, ativo) =>
    pedir(`/usuarios/${id}/ativo`, { method: 'PATCH', body: JSON.stringify({ ativo }) }),
  redefinirSenhaUsuario: (id, password) =>
    pedir(`/usuarios/${id}/senha`, { method: 'POST', body: JSON.stringify({ password }) }),
  // Regras de triagem (parametrização — super admin nas mutações):
  listarRegras: () => pedir('/regras'),
  criarRegra: (dados) => pedir('/regras', { method: 'POST', body: JSON.stringify(dados) }),
  atualizarRegra: (id, dados) => pedir(`/regras/${id}`, { method: 'PATCH', body: JSON.stringify(dados) }),
  removerRegra: (id) => pedir(`/regras/${id}`, { method: 'DELETE' }),
  testarTriagem: (assunto, corpo) =>
    pedir('/regras/testar', { method: 'POST', body: JSON.stringify({ assunto, corpo }) }),
  // Configuração de SLA da organização (admin):
  lerConfigSla: () => pedir('/config/sla'),
  guardarConfigSla: (dados) => pedir('/config/sla', { method: 'PATCH', body: JSON.stringify(dados) }),
  // Organizações / clientes (só super admin):
  listarOrganizacoes: () => pedir('/organizacoes'),
  criarOrganizacao: (dados) => pedir('/organizacoes', { method: 'POST', body: JSON.stringify(dados) }),
  definirAtivoOrganizacao: (id, ativo) =>
    pedir(`/organizacoes/${id}/ativo`, { method: 'PATCH', body: JSON.stringify({ ativo }) }),
  // Apenas em desenvolvimento:
  mockTicket: () => pedir('/dev/mock-ticket', { method: 'POST', body: '{}' }),
};
