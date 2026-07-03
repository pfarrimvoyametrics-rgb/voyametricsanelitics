/**
 * papeis.js — Papéis (funções) dos utilizadores e helpers de autorização.
 *
 * Fonte única de verdade sobre "quem é admin". O `super_admin` herda todos os
 * privilégios de `admin` (vê todas as categorias, gere utilizadores/regras) e
 * acrescenta as operações reservadas à administração do servidor.
 */

const PAPEIS = Object.freeze({
  OPERADOR: 'operador',
  ADMIN: 'admin',
  SUPER_ADMIN: 'super_admin',
});

const PAPEIS_VALIDOS = Object.freeze(Object.values(PAPEIS));

/** É admin OU super_admin (privilégios administrativos). */
function ehAdmin(funcao) {
  return funcao === PAPEIS.ADMIN || funcao === PAPEIS.SUPER_ADMIN;
}

/** É o super administrador do servidor. */
function ehSuperAdmin(funcao) {
  return funcao === PAPEIS.SUPER_ADMIN;
}

/** Valida um papel recebido do exterior. */
function papelValido(funcao) {
  return PAPEIS_VALIDOS.includes(funcao);
}

module.exports = { PAPEIS, PAPEIS_VALIDOS, ehAdmin, ehSuperAdmin, papelValido };
