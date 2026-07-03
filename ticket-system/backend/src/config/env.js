/**
 * env.js — Centraliza o acesso às variáveis de ambiente.
 * Carrega o .env e expõe um objeto `env` tipado/validado.
 */
require('dotenv').config();

function obrigatoria(nome) {
  const v = process.env[nome];
  if (!v && process.env.NODE_ENV === 'production') {
    throw new Error(`Variável de ambiente obrigatória em falta: ${nome}`);
  }
  return v;
}

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '4000', 10),
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',

  // Base de dados
  databaseUrl: process.env.DATABASE_URL,

  // Autenticação (JWT)
  jwtSecret: process.env.JWT_SECRET || 'troque-este-segredo-em-producao',
  jwtExpiry: process.env.JWT_EXPIRY || '12h',

  // Microsoft Graph (app-only / client credentials)
  graph: {
    tenantId: obrigatoria('MS_TENANT_ID'),
    clientId: obrigatoria('MS_CLIENT_ID'),
    clientSecret: obrigatoria('MS_CLIENT_SECRET'),
    mailbox: process.env.MS_SHARED_MAILBOX, // caixa partilhada
    webhookUrl: process.env.MS_WEBHOOK_URL, // URL pública HTTPS para notificações
    clientState: process.env.MS_CLIENT_STATE || 'segredo-de-validacao-webhook',
  },

  // Locking
  lockReleaseMinutes: parseInt(process.env.LOCK_RELEASE_MINUTES || '5', 10),
};

module.exports = { env };
