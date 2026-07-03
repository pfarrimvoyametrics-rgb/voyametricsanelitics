# HISTÓRICO DE DESENVOLVIMENTO — Central de Tickets (SLA & Equipa)

Registo das decisões e do trabalho realizado nas sessões de desenvolvimento
assistido com o Claude. Serve de memória do projecto e complementa o
`README.md` (detalhe técnico), o `CLAUDE.md` (contexto e convenções) e o
`MELHORIAS.md` (backlog priorizado). O registo textual integral da conversa
está em `docs/conversa/`.

*Última actualização: 30 de Junho de 2026.*

---

## 1. Objectivo
Construir uma aplicação web que transforme o fluxo de emails de uma caixa
partilhada do Outlook (Office 365) em tickets, com triagem automática por
categoria, controlo de SLA em horas úteis, distribuição e bloqueio em tempo
real entre operadores, e alertas visuais e sonoros. Dimensão alvo: 500 a 10 000
emails por dia e cerca de 10 operadores, organizados por categoria.

## 2. Decisões de arquitectura (e porquê)
- **Backend em Node.js + Express + Socket.io** (em vez de Python/FastAPI): tempo
  real nativo com o Socket.io e a mesma linguagem no servidor e no cliente.
- **Captura de emails por webhooks do Microsoft Graph** (e não por sondagem
  periódica): reacção imediata e menos chamadas à API.
- **SLA em horas úteis contínuas, das 09:30 às 19:00**, de Segunda a Sexta — a
  empresa não fecha ao almoço, pelo que o relógio do SLA **não pára** entre as
  13h e as 14h (9,5 h úteis por dia). Excluídos os feriados nacionais,
  **incluindo os móveis** (Sexta-Feira Santa, Páscoa, Corpo de Deus), calculados
  pelo algoritmo de Meeus. Prazo de resposta: **2 horas úteis**.
- **Triagem configurável** através da tabela `regras_triagem`
  (palavra-chave → categoria), com cache em memória; categoria por omissão
  `comercial`.
- **Bloqueio com heartbeat + sweeper**: quem abre um ticket bloqueia-o; o cliente
  renova o bloqueio periodicamente e um processo de limpeza (a cada 30 s) liberta
  os tickets cujo bloqueio expirou (5 min). A atribuição é **atómica** em SQL (só
  ocorre se o ticket estiver `pendente`), o que evita que dois operadores fiquem
  com o mesmo email.
- **Empacotamento em Docker**: `docker compose up` sobe a base de dados, o
  backend e o frontend, acessíveis num **único endereço** (http://localhost:8080),
  com o nginx a servir a aplicação React e a fazer de *proxy* para a API e para
  os WebSockets. Esta opção torna o sistema portável — corre igual no computador
  agora e num servidor mais tarde.

## 3. O que foi construído
Aplicação completa e funcional:
- **Backend** — serviços de SLA, triagem, Microsoft Graph e tickets; rotas de
  autenticação, tickets, utilizadores e webhooks; modelos com SQL escrito à mão;
  migração e seed (1 administrador, operadores por categoria e regras de
  triagem). Testes de SLA (7 casos).
- **Frontend** — páginas de login, fila do operador e painel do supervisor;
  componentes de cronómetro de SLA, cartão de ticket, detalhe com leitura e
  resposta ao email pelo Outlook, e alertas em três níveis (cartão a laranja,
  aviso sonoro nos 30 min finais, e alerta intermitente quando o SLA é
  ultrapassado).
- **Documentação** — `README.md`, `COMECAR.md`, e os ficheiros de handoff para o
  Claude Code (`CLAUDE.md` e `MELHORIAS.md`).

## 4. Validação
Numa primeira fase, cada componente foi validado isoladamente: testes de SLA
(7/7 a passar), migração e seed contra um PostgreSQL real, *build* do frontend,
verificação de sintaxe do backend e dos ficheiros compose, e prova do fluxo de
triagem e do isolamento por categoria.

Mais tarde, com o Docker disponível, a aplicação foi **validada de ponta a ponta
em contentores**, pelo caminho real (browser → nginx → backend → PostgreSQL):

| Verificação | Resultado |
|---|---|
| `docker compose up` arranca os 3 serviços | OK — db *healthy* → backend → frontend |
| Aplicação responde em :8080 | OK — HTTP 200 (~2 s) |
| nginx serve a SPA React | OK |
| Migração + seed automáticos no arranque | OK |
| Login (JWT) | OK — token emitido |
| Triagem automática | OK — suporte técnico, facturação e comercial |
| Administrador vê todos os tickets | OK — 3 visíveis |
| Operador vê apenas a sua categoria | OK — isolamento confirmado |

## 5. Problema do proxy TLS e melhoria introduzida
Durante o teste em Docker, a instalação de dependências falhava de forma
sistemática, sempre ao fim de ~71 s, com o erro `SELF_SIGNED_CERT_IN_CHAIN` —
sinal de uma rede que **intercepta o TLS** e apresenta um certificado próprio
(situação comum em ambientes corporativos). A causa foi diagnosticada e
resolvida, com duas melhorias úteis também numa rede de empresa:
- Passagem para **`npm ci`** (instalação determinística a partir do *lockfile*).
- Opção **`NPM_STRICT_SSL`** nos Dockerfiles e no `docker-compose.yml`, **segura
  por omissão** (`true`). Quando necessário, constrói-se com:
  `NPM_STRICT_SSL=false docker compose up --build`.

## 6. Estado actual e próximos passos
A aplicação está completa, validada de ponta a ponta e pronta a testar em
qualquer máquina com Docker. As evoluções recomendadas estão priorizadas no
`MELHORIAS.md`. A mais importante antes de produção é a **P0-1 — autenticação
real** (palavra-passe com hash ou SSO/Entra ID) e o endurecimento da API.
