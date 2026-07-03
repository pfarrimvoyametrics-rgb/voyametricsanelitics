/**
 * userService.js — Lógica de negócio sobre utilizadores.
 *
 * Responsável por:
 *  - garantirSuperAdmin(): cria/atualiza o super administrador a partir das
 *    variáveis de ambiente (SUPER_ADMIN_EMAIL / SUPER_ADMIN_PASSWORD). Corre
 *    no arranque do servidor e no comando `cli.js create-admin`.
 *  - semearUtilizadoresDemo(): perfis de demonstração com palavra-passe.
 */
const userModel = require('../models/userModel');
const orgModel = require('../models/orgModel');
const { gerarHash } = require('../utils/password');
const { PAPEIS } = require('../utils/papeis');
const { env } = require('../config/env');

/**
 * Garante que existe um super administrador com as credenciais do ambiente.
 * - Se as variáveis não estiverem definidas, não faz nada (apenas avisa).
 * - Se existirem, faz upsert e (re)define a palavra-passe a partir do env,
 *   mantendo o env como fonte de verdade para o acesso de emergência.
 *
 * @returns {Promise<{criado: boolean, utilizador?: object, motivo?: string}>}
 */
async function garantirSuperAdmin() {
  const { email, password, nome } = env.superAdmin;

  if (!email || !password) {
    return { criado: false, motivo: 'sem_configuracao' };
  }
  if (String(password).length < 8) {
    throw new Error('SUPER_ADMIN_PASSWORD deve ter pelo menos 8 caracteres.');
  }

  const senhaHash = await gerarHash(password);
  const utilizador = await userModel.upsert({
    nome: nome || 'Super Administrador',
    email,
    categoria: null,
    funcao: PAPEIS.SUPER_ADMIN,
    senhaHash,
    ativo: true,
  });

  return { criado: true, utilizador };
}

// Perfis de demonstração (correspondem aos atalhos do ecrã de login).
const DEMO = [
  { nome: 'Admin Geral',    email: 'admin@empresa.pt',            categoria: null,        funcao: PAPEIS.ADMIN },
  { nome: 'Sofia Marques',  email: 'sofia.suporte@empresa.pt',    categoria: 'suporte_tecnico', funcao: PAPEIS.OPERADOR },
  { nome: 'Carlos Nunes',   email: 'carlos.fatura@empresa.pt',    categoria: 'faturacao', funcao: PAPEIS.OPERADOR },
  { nome: 'Inês Carvalho',  email: 'ines.comercial@empresa.pt',   categoria: 'comercial', funcao: PAPEIS.OPERADOR },
];

/**
 * Semeia (upsert) os perfis de demonstração, todos com a mesma palavra-passe
 * de demonstração (env.demoPassword). Não afeta o super admin.
 * @returns {Promise<number>} quantidade de perfis semeados.
 */
async function semearUtilizadoresDemo() {
  const senhaHash = await gerarHash(env.demoPassword);
  // Os perfis demo pertencem à organização 'demo' (criada na migração 002).
  const orgDemo = await orgModel.porSlug('demo');
  const organizacaoId = orgDemo ? orgDemo.id : null;
  let n = 0;
  for (const u of DEMO) {
    await userModel.upsert({ ...u, senhaHash, ativo: true, organizacaoId });
    n += 1;
  }
  return n;
}

// --- Gestão de utilizadores (super admin) -----------------------------------

const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PAPEIS_CRIAVEIS = [PAPEIS.OPERADOR, PAPEIS.ADMIN];

/**
 * Cria um utilizador (operador ou admin) a partir do painel de parametrização.
 * Validações de negócio antes de tocar na base de dados. Não permite criar
 * outro super_admin (esse é exclusivo do arranque, via ambiente).
 * @throws {Error} com `.status` para o handler HTTP mapear.
 */
async function criarUtilizador({ nome, email, categoria, funcao, password, organizacaoId }) {
  const erro = (msg, status = 400) => Object.assign(new Error(msg), { status });

  nome = (nome || '').trim();
  email = (email || '').trim().toLowerCase();
  funcao = (funcao || PAPEIS.OPERADOR).trim();
  categoria = (categoria || '').trim() || null;

  if (!organizacaoId) throw erro('Organização em falta.');
  if (!nome) throw erro('Nome em falta.');
  if (!RE_EMAIL.test(email)) throw erro('Email inválido.');
  if (!PAPEIS_CRIAVEIS.includes(funcao)) throw erro('Função inválida (operador ou admin).');
  if (!password || String(password).length < 8) {
    throw erro('A palavra-passe deve ter pelo menos 8 caracteres.');
  }
  // Operador precisa de uma categoria (a sua fila); admin não usa categoria.
  if (funcao === PAPEIS.OPERADOR && !categoria) throw erro('Um operador precisa de uma categoria.');
  if (funcao === PAPEIS.ADMIN) categoria = null;

  const senhaHash = await gerarHash(password);
  try {
    return await userModel.criar({ nome, email, categoria, funcao, senhaHash, ativo: true, organizacaoId });
  } catch (e) {
    if (e.code === '23505') throw erro('Já existe um utilizador com esse email.', 409);
    throw e;
  }
}

/**
 * Ativa/desativa um utilizador dentro de uma organização. Devolve null (→404) se
 * não existir ou não pertencer à organização; 403 se for um super_admin.
 */
async function definirAtivoUtilizador(id, ativo, orgId) {
  const alvo = await userModel.porId(id);
  if (!alvo || alvo.organizacao_id !== orgId) return null;
  if (alvo.funcao === PAPEIS.SUPER_ADMIN) {
    throw Object.assign(new Error('O super administrador não pode ser desativado aqui.'), { status: 403 });
  }
  return userModel.definirAtivo(id, !!ativo);
}

/** Redefine a palavra-passe de um utilizador da organização (mín. 8 caracteres). */
async function redefinirSenha(id, password, orgId) {
  if (!password || String(password).length < 8) {
    throw Object.assign(new Error('A palavra-passe deve ter pelo menos 8 caracteres.'), { status: 400 });
  }
  const alvo = await userModel.porId(id);
  if (!alvo || alvo.organizacao_id !== orgId) return null;
  await userModel.definirSenha(id, await gerarHash(password));
  return alvo;
}

module.exports = {
  garantirSuperAdmin,
  semearUtilizadoresDemo,
  criarUtilizador,
  definirAtivoUtilizador,
  redefinirSenha,
  DEMO,
};
