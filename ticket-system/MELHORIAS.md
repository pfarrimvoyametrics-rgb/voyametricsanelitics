# MELHORIAS — Backlog priorizado

Lista de evoluções recomendadas, por ordem de prioridade. Pensada para entregar
ao Claude Code: pode pedir, por exemplo, *"implementa o P0-1"* e ele tem o
contexto (ver `CLAUDE.md`) para o fazer respeitando as convenções do projecto.

Prioridades: **P0** = essencial antes de produção · **P1** = robustez/escala ·
**P2** = produto e qualidade.

---

## P0 — Antes de ir para produção

### P0-1 · Autenticação real e endurecimento da API
- **Porquê:** o login é por email, sem palavra-passe — inaceitável em produção.
- **O quê:** palavra-passe com hash (argon2 ou bcrypt) **ou**, de preferência,
  SSO/Entra ID (a empresa já usa Office 365 — usar OpenID Connect). Acrescentar
  *rate limiting* no login, `helmet`, validação de entrada (ex.: `zod`) e
  forçar HTTPS.
- **Onde:** `routes/authRoutes.js`, `middleware/auth.js`, `server.js`; nova
  coluna/тabela de credenciais ou integração OIDC.

### P0-2 · Registar e auditar as respostas enviadas
- **Porquê:** ao resolver, a resposta segue para o Outlook mas **não fica
  guardada** — não há histórico do que foi respondido a quem.
- **O quê:** persistir o texto/data/autor da resposta; mostrar o histórico no
  painel de detalhe do ticket.
- **Onde:** nova migração (`respostas` ou colunas em `tickets`),
  `models/ticketModel.js`, `routes/ticketRoutes.js`, `components/TicketDetail.jsx`.

### P0-3 · Resiliência da subscrição do Microsoft Graph
- **Porquê:** a subscrição vive em memória; se o servidor reiniciar perde-se a
  referência, e a Graph pode **falhar notificações** (emails que nunca viram ticket).
- **O quê:** persistir o `subscriptionId` na BD; tratar os
  `lifecycleNotifications` (`reauthorizationRequired`); reconciliar no arranque;
  e um *delta sync* periódico (ex.: de 10 em 10 min) como rede de segurança para
  apanhar emails perdidos.
- **Onde:** `services/graphService.js`, `server.js`, nova tabela `subscricoes`,
  job agendado.

---

## P1 — Robustez e escala

### P1-1 · Migrações versionadas
- **Porquê:** hoje há um único `001_init.sql` com `IF NOT EXISTS`; não há controlo
  de versões de esquema para evoluções futuras.
- **O quê:** adoptar `node-pg-migrate` (ou Knex) com tabela de migrações e
  comandos `migrate up/down`.
- **Onde:** `backend/` (configuração + pasta de migrações), `package.json`.

### P1-2 · Escala horizontal do tempo real
- **Porquê:** com mais do que uma instância do backend, o Socket.io precisa de
  um adaptador partilhado e o *sweeper* não pode correr em duplicado.
- **O quê:** adaptador **Redis** para Socket.io; garantir um único "líder" do
  sweeper (ex.: *advisory lock* do PostgreSQL) para não libertar tickets em duplicado.
- **Onde:** `server.js`, `sockets/index.js`, `services/ticketService.js`.

### P1-3 · Anexos de email
- **Porquê:** muitos emails trazem anexos; hoje são ignorados.
- **O quê:** ler anexos via Graph, guardar referência e permitir abri-los e
  anexá-los na resposta.
- **Onde:** `services/graphService.js`, `routes/webhookRoutes.js`,
  `components/TicketDetail.jsx`, possível tabela `anexos`.

### P1-4 · Conversação (threading)
- **Porquê:** hoje 1 email = 1 ticket; uma resposta do cliente cria um ticket novo.
- **O quê:** agrupar mensagens da mesma conversa (`conversationId` da Graph);
  uma resposta do cliente reabre/continua o ticket existente.
- **Onde:** esquema (`conversation_id`), `webhookRoutes.js`, `ticketModel.js`.

### P1-5 · Paginação e pesquisa server-side
- **Porquê:** em backlogs grandes não convém trazer listas inteiras.
- **O quê:** paginação e filtros (remetente, assunto, datas) no servidor;
  índices de apoio.
- **Onde:** `models/ticketModel.js`, `routes/ticketRoutes.js`, `pages/Queue.jsx`,
  `pages/AdminDashboard.jsx`.

### P1-6 · Reatribuição manual pelo supervisor
- **Porquê:** o admin liberta mas não consegue atribuir directamente a um operador.
- **O quê:** acção "atribuir a…" no painel do supervisor.
- **Onde:** `ticketService.js`, `ticketRoutes.js`, `AdminDashboard.jsx`.

### P1-7 · Observabilidade
- **Porquê:** falta logging estruturado e visibilidade de erros.
- **O quê:** `pino` para logs, endpoint de *readiness*, tratamento central de
  erros e integração de *error tracking* (ex.: Sentry).
- **Onde:** `server.js`, middleware de erros.

---

## P2 — Produto e qualidade

### P2-1 · Painel de métricas históricas (com gráficos)
- **O quê:** evolução do cumprimento de SLA ao longo do tempo, por categoria e
  por operador; tempo médio de resposta; tendência semanal/mensal.
- **Onde:** nova rota de agregação + componente de gráficos no `AdminDashboard.jsx`
  (ex.: Recharts).

### P2-2 · Gestão das regras de triagem na UI
- **O quê:** CRUD da tabela `regras_triagem` no painel admin, com invalidação de
  cache (`triageService.invalidarCache`).
- **Onde:** nova rota + ecrã admin.

### P2-3 · Notificações de browser e som configurável
- **O quê:** Web Notifications (alerta mesmo com o separador em segundo plano) e
  preferências de som por utilizador.
- **Onde:** `components/AlertasSla.jsx`, preferências do utilizador.

### P2-4 · Cobertura de testes + CI
- **O quê:** testes para `triageService`, `ticketModel` (atomicidade da
  atribuição), rotas (supertest) e sweeper; *pipeline* de CI (GitHub Actions) a
  correr testes + build.
- **Onde:** `backend/tests/`, `.github/workflows/`.

### P2-5 · Precisão do SLA na mudança de hora (DST)
- **O quê:** tornar exacto o cálculo nos dias de transição de hora de verão
  (hoje é aceitável; ver nota em `slaService.js`).
- **Onde:** `services/slaService.js`, `tests/sla.test.js`.

### P2-6 · Produção do frontend, acessibilidade e i18n
- **O quê:** compose de produção (`NODE_ENV=production`, segredos, backups da
  BD); rever acessibilidade (foco, ARIA, contraste); preparar i18n.
- **Onde:** `docker-compose` (variante de produção), componentes do frontend.

### P2-7 · Gestão de feriados
- **O quê:** *overrides* por ano e feriados municipais geridos por configuração/UI
  (já existe `FERIADOS_EXTRA` por variável de ambiente).
- **Onde:** `utils/feriados.js`, configuração.

---

### Sugestão de sequência
P0-1 → P0-2 → P0-3 → P1-1 → P1-2 → (restantes P1 conforme necessidade) → P2.
