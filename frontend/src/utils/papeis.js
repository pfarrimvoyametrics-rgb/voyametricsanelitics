/**
 * papeis.js — Espelho (frontend) dos papéis do backend.
 * super_admin herda a vista de administração.
 */
export const PAPEIS = { OPERADOR: 'operador', ADMIN: 'admin', SUPER_ADMIN: 'super_admin' };

export const ehAdmin = (funcao) =>
  funcao === PAPEIS.ADMIN || funcao === PAPEIS.SUPER_ADMIN;

export const ehSuperAdmin = (funcao) => funcao === PAPEIS.SUPER_ADMIN;
