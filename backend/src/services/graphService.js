/**
 * graphService.js — Integração com a Microsoft Graph API (app-only).
 *
 * Fluxo:
 *   1. Autenticação OAuth2 Client Credentials (sem utilizador interativo)
 *      contra a caixa de correio PARTILHADA do Office 365.
 *   2. Criação de uma subscrição (webhook) para novas mensagens na Inbox.
 *      A Graph envia POSTs para MS_WEBHOOK_URL quando chega email novo.
 *   3. Renovação automática da subscrição antes de expirar (as subscrições
 *      de mensagens duram no máximo ~3 dias).
 *   4. Leitura da mensagem por id e envio de respostas.
 *
 * Permissões de aplicação necessárias no registo da app (Azure AD),
 * com consentimento de administrador:
 *   - Mail.Read       (ler mensagens da caixa partilhada)
 *   - Mail.Send       (enviar respostas)
 *   - Mail.ReadWrite  (opcional: marcar como lido)
 *
 * Requer Node 18+ (fetch nativo). Não usa SDK externo de propósito,
 * para manter as dependências mínimas e o fluxo transparente.
 */

const { env } = require('../config/env');

const GRAPH = 'https://graph.microsoft.com/v1.0';
const LOGIN = `https://login.microsoftonline.com/${env.graph.tenantId}/oauth2/v2.0/token`;

// --- Cache do token de acesso ------------------------------------------------
let tokenCache = { value: null, expiraEm: 0 };

/** Obtém (com cache) um token app-only para a Graph. */
async function obterToken() {
  const agora = Date.now();
  if (tokenCache.value && agora < tokenCache.expiraEm - 60000) {
    return tokenCache.value;
  }
  const body = new URLSearchParams({
    client_id: env.graph.clientId,
    client_secret: env.graph.clientSecret,
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials',
  });

  const resp = await fetch(LOGIN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`[graph] Falha ao obter token (${resp.status}): ${txt}`);
  }
  const json = await resp.json();
  tokenCache = {
    value: json.access_token,
    expiraEm: agora + json.expires_in * 1000,
  };
  return tokenCache.value;
}

/** Wrapper de chamadas autenticadas à Graph. */
async function graphFetch(caminho, opcoes = {}) {
  const token = await obterToken();
  const resp = await fetch(`${GRAPH}${caminho}`, {
    ...opcoes,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(opcoes.headers || {}),
    },
  });
  return resp;
}

const recursoInbox = () =>
  `/users/${encodeURIComponent(env.graph.mailbox)}/mailFolders('Inbox')/messages`;

// --- Subscrições (webhooks) --------------------------------------------------

/**
 * Cria uma subscrição de novas mensagens. A Graph valida o endpoint
 * enviando primeiro um GET/POST com validationToken (ver webhookRoutes).
 * @returns {Promise<object>} a subscrição criada
 */
async function criarSubscricao() {
  // Máx. para mensagens ~4230 min; usamos ~2 dias e renovamos antes.
  const expiraEm = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
  const corpo = {
    changeType: 'created',
    notificationUrl: env.graph.webhookUrl,
    resource: recursoInbox(),
    expirationDateTime: expiraEm,
    clientState: env.graph.clientState,
  };
  const resp = await graphFetch('/subscriptions', {
    method: 'POST',
    body: JSON.stringify(corpo),
  });
  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`[graph] Falha ao criar subscrição (${resp.status}): ${txt}`);
  }
  const sub = await resp.json();
  console.log(`[graph] Subscrição criada: ${sub.id} (expira ${sub.expirationDateTime})`);
  return sub;
}

/** Renova uma subscrição existente, empurrando a data de expiração. */
async function renovarSubscricao(subscriptionId) {
  const expiraEm = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
  const resp = await graphFetch(`/subscriptions/${subscriptionId}`, {
    method: 'PATCH',
    body: JSON.stringify({ expirationDateTime: expiraEm }),
  });
  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`[graph] Falha ao renovar subscrição (${resp.status}): ${txt}`);
  }
  return resp.json();
}

/** Lê uma mensagem por id e devolve os campos que nos interessam. */
async function obterMensagem(messageId) {
  const campos = '$select=id,subject,from,toRecipients,ccRecipients,receivedDateTime,bodyPreview,body';
  const resp = await graphFetch(
    `/users/${encodeURIComponent(env.graph.mailbox)}/messages/${messageId}?${campos}`
  );
  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`[graph] Falha ao ler mensagem ${messageId} (${resp.status}): ${txt}`);
  }
  const m = await resp.json();
  // Destinatários (To + Cc) — usados para rotear o email para a organização certa.
  const destinatarios = []
    .concat(m.toRecipients || [], m.ccRecipients || [])
    .map((r) => r?.emailAddress?.address)
    .filter(Boolean);
  return {
    outlookMessageId: m.id,
    assunto: m.subject || '(sem assunto)',
    remetente: m.from?.emailAddress?.address || 'desconhecido',
    destinatarios,
    dataRececao: m.receivedDateTime,
    corpoEmail: m.body?.content || m.bodyPreview || '',
  };
}

/**
 * Envia uma resposta a uma mensagem (mantém a thread no Outlook).
 * @param {string} messageId
 * @param {string} comentarioHtml — corpo da resposta
 */
async function responderMensagem(messageId, comentarioHtml) {
  const resp = await graphFetch(
    `/users/${encodeURIComponent(env.graph.mailbox)}/messages/${messageId}/reply`,
    {
      method: 'POST',
      body: JSON.stringify({ comment: comentarioHtml }),
    }
  );
  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`[graph] Falha ao responder ${messageId} (${resp.status}): ${txt}`);
  }
  return true;
}

module.exports = {
  obterToken,
  criarSubscricao,
  renovarSubscricao,
  obterMensagem,
  responderMensagem,
};
