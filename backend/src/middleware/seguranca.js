/**
 * seguranca.js — Hardening básico sem dependências externas (em linha com a
 * filosofia do projecto de manter as dependências mínimas).
 *
 *  - cabecalhosSeguranca: cabeçalhos de segurança equivalentes ao essencial
 *    do helmet (nosniff, anti-clickjacking, referrer, HSTS em produção).
 *  - limitadorPedidos: rate-limiter por IP em memória (janela fixa), para
 *    travar abuso/força-bruta — pensado para o endpoint de login.
 */

/** Define cabeçalhos de segurança em todas as respostas. */
function cabecalhosSeguranca(_req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-DNS-Prefetch-Control', 'off');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
  }
  next();
}

/**
 * Rate-limiter por IP (janela fixa, em memória).
 * Suficiente para uma instância; com várias instâncias, usar um store
 * partilhado (ex.: Redis).
 * @param {{janelaMs?: number, maximo?: number, mensagem?: string}} opcoes
 */
function limitadorPedidos({ janelaMs = 60_000, maximo = 10, mensagem } = {}) {
  const acessos = new Map(); // ip -> { contagem, reinicioEm }

  // Limpeza periódica das entradas expiradas (evita crescer indefinidamente).
  const limpeza = setInterval(() => {
    const agora = Date.now();
    for (const [ip, reg] of acessos) {
      if (agora > reg.reinicioEm) acessos.delete(ip);
    }
  }, janelaMs);
  if (typeof limpeza.unref === 'function') limpeza.unref();

  return function limitar(req, res, next) {
    const ip = req.ip || req.socket?.remoteAddress || 'desconhecido';
    const agora = Date.now();
    let reg = acessos.get(ip);

    if (!reg || agora > reg.reinicioEm) {
      reg = { contagem: 0, reinicioEm: agora + janelaMs };
      acessos.set(ip, reg);
    }
    reg.contagem++;

    if (reg.contagem > maximo) {
      const retryAfter = Math.ceil((reg.reinicioEm - agora) / 1000);
      res.setHeader('Retry-After', String(Math.max(retryAfter, 1)));
      return res.status(429).json({
        erro: mensagem || 'Demasiados pedidos. Tente novamente daqui a pouco.',
      });
    }
    next();
  };
}

module.exports = { cabecalhosSeguranca, limitadorPedidos };
