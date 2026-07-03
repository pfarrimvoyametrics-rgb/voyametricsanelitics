/**
 * db.js — Pool de ligações PostgreSQL (node-postgres) e utilitários.
 */
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const { env } = require('./env');

const pool = new Pool({
  connectionString: env.databaseUrl,
  max: 20, // suficiente para 10 operadores + webhooks
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('[db] Erro inesperado no cliente do pool:', err);
});

/** Executa um ficheiro .sql (migração ou seed). */
async function executarFicheiroSql(caminhoAbsoluto) {
  const sql = fs.readFileSync(caminhoAbsoluto, 'utf8');
  await pool.query(sql);
}

/** Aplica todas as migrações em src/db/migrations (por ordem alfabética). */
async function migrar() {
  const dir = path.join(__dirname, '..', 'db', 'migrations');
  const ficheiros = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  for (const f of ficheiros) {
    console.log(`[db] A aplicar migração: ${f}`);
    await executarFicheiroSql(path.join(dir, f));
  }
}

/** Aplica o seed inicial. */
async function semear() {
  const ficheiro = path.join(__dirname, '..', 'db', 'seeds', 'seed.sql');
  console.log('[db] A aplicar seed inicial…');
  await executarFicheiroSql(ficheiro);
}

module.exports = { pool, migrar, semear };
