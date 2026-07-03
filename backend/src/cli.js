/**
 * cli.js — Utilitário de linha de comandos.
 * Uso:
 *   node src/cli.js migrate        # aplica migrações
 *   node src/cli.js seed           # aplica seed (regras + perfis + super admin)
 *   node src/cli.js create-admin   # cria/atualiza o super admin a partir do .env
 *   node src/cli.js subscribe      # cria subscrição do Graph
 */
const { migrar, pool } = require('./config/db');

async function main() {
  const cmd = process.argv[2];
  try {
    switch (cmd) {
      case 'migrate':
        await migrar();
        console.log('✅ Migrações aplicadas.');
        break;
      case 'seed': {
        const { semear } = require('./db/seed');
        await semear();
        console.log('✅ Seed aplicado.');
        break;
      }
      case 'create-admin': {
        const userService = require('./services/userService');
        const r = await userService.garantirSuperAdmin();
        if (r.criado) {
          console.log(`✅ Super admin pronto: ${r.utilizador.email}`);
        } else {
          console.error(
            '❌ Faltam SUPER_ADMIN_EMAIL e/ou SUPER_ADMIN_PASSWORD no ambiente (.env).'
          );
          process.exitCode = 1;
        }
        break;
      }
      case 'subscribe': {
        const graphService = require('./services/graphService');
        const sub = await graphService.criarSubscricao();
        console.log('✅ Subscrição criada:', sub.id);
        break;
      }
      default:
        console.log('Comandos: migrate | seed | create-admin | subscribe');
    }
  } catch (err) {
    console.error('❌ Erro:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();
