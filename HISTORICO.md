# HISTÓRICO DE DESENVOLVIMENTO — Central de Tickets (SLA & Equipa)

Registo das decisões e do trabalho realizado nas sessões de desenvolvimento
assistido com o Claude. Serve de memória do projecto e complementa o
`README.md` (detalhe técnico), o `CLAUDE.md` (contexto e convenções) e o
`MELHORIAS.md` (backlog priorizado).

*Última actualização: 3 de Julho de 2026.*

---

## 0. Evolução pós-construção (sessão de 3 de Julho de 2026)

Desde a versão inicial (secções 1–6, datadas de 30 de Junho) o projecto cresceu.
Esta secção resume o que mudou e, sobretudo, **o que está integrado e o que
ainda não está** — para não induzir em erro quem retomar o trabalho.

### 0.1 O que passou a estar integrado (ligado ao `server.js`)
- **Autenticação real por palavra-passe.** O login deixou de ser só por email:
  agora é **email + palavra-passe com hash bcrypt** (`bcryptjs`,
  `utils/password.js`), com coluna `senha_hash` em `usuarios`. Novo papel
  **`super_admin`** (além de `operador`/`admin`), criado no arranque a partir de
  `SUPER_ADMIN_EMAIL`/`SUPER_ADMIN_PASSWORD` (ou `npm run create-admin`). Os
  perfis de demonstração são semeados por código com `SEED_DEMO_PASSWORD`. Isto
  cobre, no essencial, a antiga **P0-1** (falta apenas SSO/Entra ID, opcional).
- **Análise por IA com o Claude** (`services/analiseIaService.js`, rota
  `/api/analise`). Analisa o **volume de tickets por equipa** num laço agêntico
  com ferramentas **read-only parametrizadas** (o modelo nunca escreve SQL), com
  resposta completa e em *streaming* (SSE). Frontend em `components/AnaliseIA.jsx`.
  Usa `@anthropic-ai/sdk` (carregado preguiçosamente; **não** está no
  `package.json`) e `ANTHROPIC_API_KEY`; modelo por omissão `claude-opus-4-8`.
- **Middleware de segurança caseiro** (`middleware/seguranca.js`): cabeçalhos de
  segurança (equivalente ao essencial do helmet) e rate-limiter por IP, **sem
  dependências externas** — em linha com a filosofia de dependências mínimas.
  ⚠️ Ainda **não estão aplicados** globalmente nem no login (só o CSAT os usa).
- **Testes**: passaram de 7 para **12 casos** (`sla.test.js` + `extras.test.js`),
  cobrindo o SLA e a normalização da triagem. Correr com `TZ=Europe/Lisbon`.

### 0.2 Segunda vaga — no repo mas AINDA POR INTEGRAR
Foram esboçadas várias funcionalidades cujo código (rotas, models, serviços e
páginas) já existe, mas que **não estão montadas** no `server.js` e cujo
**esquema de BD não foi criado** na migração `001_init.sql`. Não funcionam como
estão; ver `CLAUDE.md` e a nova **P0-0** em `MELHORIAS.md` para o caminho de
conclusão. Em resumo:
- **CSAT** (inquérito público pós-resolução) — falta coluna `tickets.csat`.
- **Canais / SLA por canal** — falta tabela `canais_sla`; introduz um conjunto
  de **7 categorias** (emergências, alterações, cotações, reclamações, suporte
  técnico, facturação, comercial) que ainda não substitui as 3 semeadas.
- **Relatórios + PDF** (`relatorioRoutes`, `insightsService`, `pdfRelatorio`,
  `pdfLideranca`, `Relatorios.jsx`) — precisa de `pdfkit` (em falta no
  `package.json`) e de várias colunas novas em `tickets`.
- **Integração servidor-a-servidor** (`integracaoRoutes`, `apiKey`) — sistema
  externo preenche resultado/valor de venda via `x-api-key`; precisa de
  `conversation_id`, `resultado_venda`, `valor_venda`.
- **Parametrização** (gestão de utilizadores) e **KPIs da fila** — dependem de
  endpoints possivelmente incompletos (ex.: `/api/tickets/meus-kpis`).

### 0.3 Limpeza do repositório
- Removida a pasta aninhada `ticket-system/` (uma cópia do *commit* inicial,
  redundante face à raiz). Os documentos de *handoff* que só existiam nessa cópia
  (`CLAUDE.md`, `MELHORIAS.md`, `HISTORICO.md`) foram **movidos para a raiz** e
  actualizados. O antigo arquivo `docs/conversa/` (transcrições em bruto) foi
  **descartado** — continua recuperável pela história do git se necessário.

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

## 3. O que foi construído (versão inicial)
Aplicação completa e funcional:
- **Backend** — serviços de SLA, triagem, Microsoft Graph e tickets; rotas de
  autenticação, tickets, utilizadores e webhooks; modelos com SQL escrito à mão;
  migração e seed (1 administrador, operadores por categoria e regras de
  triagem). Testes de SLA (7 casos). *(Ver secção 0 para a evolução posterior.)*
- **Frontend** — páginas de login, fila do operador e painel do supervisor;
  componentes de cronómetro de SLA, cartão de ticket, detalhe com leitura e
  resposta ao email pelo Outlook, e alertas em três níveis (cartão a laranja,
  aviso sonoro nos 30 min finais, e alerta intermitente quando o SLA é
  ultrapassado).
- **Documentação** — `README.md`, `COMECAR.md`, e os ficheiros de handoff para o
  Claude Code (`CLAUDE.md` e `MELHORIAS.md`).

## 4. Validação (versão inicial)
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

> Nota: a validação acima é da versão inicial. A autenticação evoluiu desde
> então para email + palavra-passe (ver secção 0.1).

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

## 6. Estado à data da versão inicial (30 Jun 2026)
A aplicação estava completa, validada de ponta a ponta e pronta a testar em
qualquer máquina com Docker. A partir daqui, a evolução está descrita na
secção 0 (topo) e o backlog actualizado em `MELHORIAS.md`.
