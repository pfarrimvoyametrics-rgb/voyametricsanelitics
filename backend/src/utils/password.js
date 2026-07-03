/**
 * password.js — Hashing e verificação de palavras-passe (bcrypt).
 *
 * Usa `bcryptjs` (implementação pura em JS) para evitar dependências nativas
 * que complicam a build em containers Alpine. O custo (rounds) é configurável.
 */
const bcrypt = require('bcryptjs');

const ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);

/** Gera o hash de uma palavra-passe em claro. */
async function gerarHash(senhaEmClaro) {
  if (!senhaEmClaro || typeof senhaEmClaro !== 'string') {
    throw new Error('Palavra-passe inválida.');
  }
  return bcrypt.hash(senhaEmClaro, ROUNDS);
}

/**
 * Compara uma palavra-passe em claro com um hash guardado.
 * Devolve sempre um booleano (nunca lança por hash em falta/mal-formado).
 */
async function verificar(senhaEmClaro, hash) {
  if (!senhaEmClaro || !hash) return false;
  try {
    return await bcrypt.compare(senhaEmClaro, hash);
  } catch {
    return false;
  }
}

module.exports = { gerarHash, verificar, ROUNDS };
