# Registo textual da conversa

Esta pasta contém o registo das conversas de desenvolvimento da Central de
Tickets com o Claude.

- **conversa-completa.md** — *versão legível*: apenas o diálogo (perguntas e
  respostas), sem os blocos internos de raciocínio e com o detalhe técnico das
  ferramentas resumido em notas. É o ficheiro recomendado para ler.
- **transcricao-integral.txt** — *registo em bruto e completo* da sessão de
  construção (formato técnico: JSON com todos os blocos, incluindo as chamadas
  de ferramentas e os respectivos resultados). Fidelidade total.
- **catalogo-sessoes.txt** — catálogo das sessões de desenvolvimento.

> **Nota:** estes ficheiros cobrem as sessões de **construção** do projecto. A
> sessão mais recente — validação em Docker de ponta a ponta e correcção do
> *proxy* TLS (`NPM_STRICT_SSL`) — está resumida no `HISTORICO.md`, na raiz do
> projecto.
