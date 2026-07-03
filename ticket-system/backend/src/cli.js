/**
 * cli.js — Utilitário de linha de comandos.
 * Uso:
 *   node src/cli.js migrate      # aplica migrações
 *   node src/cli.js seed         # aplica seed
 *   node src/cli.js subscribe    # cria subscrição do Graph
 */
const { migrar, semear, pool } = require('./config/db');

async function main() {
  const cmd = process.argv[2];
  try {
    switch (cmd) {
      case 'migrate':
        await migrar();
        console.log('✅ Migrações aplicadas.');
        break;
      case 'seed':
        await semear();
        console.log('✅ Seed aplicado.');
        break;
      case 'subscribe': {
        const graphService = require('./services/graphService');
        const sub = await graphService.criarSubscricao();
        console.log('✅ Subscrição criada:', sub.id);
        break;
      }
      default:
        console.log('Comandos: migrate | seed | subscribe');
    }
  } catch (err) {
    console.error('❌ Erro:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();
