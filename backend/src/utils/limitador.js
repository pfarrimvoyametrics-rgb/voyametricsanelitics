/**
 * limitador.js — Limitador de concorrência minimalista (estilo p-limit),
 * sem dependências externas.
 *
 * A 10 000 emails/dia, um pico de notificações do Graph não pode lançar
 * centenas de operações em paralelo (esgotaria o pool da BD e provocaria
 * 429 no Graph). Este limitador garante que, no máximo, `maxConcorrencia`
 * tarefas correm ao mesmo tempo; as restantes esperam em fila.
 *
 * Uso:
 *   const limitar = criarLimitador(8);
 *   limitar(() => processar(x));   // devolve uma Promise com o resultado
 */
function criarLimitador(maxConcorrencia) {
  const max = Math.max(1, parseInt(maxConcorrencia, 10) || 1);
  let ativos = 0;
  const fila = [];

  const seguinte = () => {
    if (ativos >= max || fila.length === 0) return;
    ativos++;
    const { tarefa, resolver, rejeitar } = fila.shift();
    Promise.resolve()
      .then(tarefa)
      .then(resolver, rejeitar)
      .finally(() => {
        ativos--;
        seguinte();
      });
  };

  function limitar(tarefa) {
    return new Promise((resolver, rejeitar) => {
      fila.push({ tarefa, resolver, rejeitar });
      seguinte();
    });
  }

  limitar.pendentes = () => fila.length;
  limitar.ativos = () => ativos;
  return limitar;
}

module.exports = { criarLimitador };
