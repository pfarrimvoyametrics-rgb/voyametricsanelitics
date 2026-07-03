/**
 * seed.js — Orquestra a sementeira completa da base de dados.
 *
 * Passos:
 *   1. seed.sql  -> regras de triagem (dados não sensíveis)
 *   2. perfis de demonstração (com palavra-passe cifrada)
 *   3. super administrador (a partir das variáveis de ambiente)
 *
 * É chamado por `cli.js seed` (npm run seed / db:reset).
 */
const { semearSql } = require('../config/db');
const userService = require('../services/userService');

async function semear() {
  await semearSql();

  const nDemo = await userService.semearUtilizadoresDemo();
  console.log(`[seed] ${nDemo} perfis de demonstração semeados.`);

  const sa = await userService.garantirSuperAdmin();
  if (sa.criado) {
    console.log(`[seed] Super admin garantido: ${sa.utilizador.email}`);
  } else {
    console.warn(
      '[seed] Super admin NÃO configurado (defina SUPER_ADMIN_EMAIL e ' +
        'SUPER_ADMIN_PASSWORD no .env). Pode criá-lo depois com: npm run create-admin'
    );
  }
}

module.exports = { semear };
