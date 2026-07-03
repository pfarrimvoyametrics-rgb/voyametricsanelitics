# MELHORIAS — Backlog priorizado

Lista de evoluções recomendadas, por ordem de prioridade. Pensada para entregar
ao Claude Code: pode pedir, por exemplo, *"implementa o P0-0"* e ele tem o
contexto (ver `CLAUDE.md`) para o fazer respeitando as convenções do projecto.

Prioridades: **P0** = essencial antes de produção · **P1** = robustez/escala ·
**P2** = produto e qualidade.

Estado: ✅ feito · ⚠️ parcial · ❌ por fazer.

*Última actualização: 3 de Julho de 2026.*

---

## P0 — Antes de ir para produção

### P0-0 · ❌ Integrar (ou remover) a "segunda vaga" de funcionalidades
- **Porquê:** existe no repo um conjunto de funcionalidades **meio-construídas**
  cujo código (rotas, models, serviços, páginas) já está escrito mas que **não
  estão montadas** no `server.js` e cujas **tabelas/colunas não existem** na
  migração. Como estão, não funcionam — e dão a falsa impressão de estarem
  prontas. É preciso decidir, uma a uma: **concluir e integrar** ou **remover**.
- **O quê (para concluir cada uma):**
  - **CSAT** — criar coluna `tickets.csat` (e o método `registarCsat` no
    `ticketModel`); montar `csatRoutes` no `server.js`; rota pública do frontend.
  - **Canais / SLA por canal** — criar tabela `canais_sla`; montar `canalRoutes`;
    fazer o `slaService` usar o SLA por canal; **reconciliar as categorias** (o
    módulo usa 7 categorias; a triagem semeia 3).
  - **Relatórios + PDF** — acrescentar `pdfkit` ao `package.json`; criar as
    colunas em falta (`data_primeira_atribuicao`, `minutos_uteis_resolucao`,
    `resultado_venda`, `valor_venda`, `bilhetes_emitidos`, `bilhetes_com_erro`);
    montar `relatorioRoutes`.
  - **Integração servidor-a-servidor** — criar `tickets.conversation_id`,
    `resultado_venda`, `valor_venda`; definir `INTEGRACAO_API_KEY`; montar
    `integracaoRoutes` (protegida por `x-api-key`).
  - **Parametrização / KPIs da fila** — confirmar/implementar os endpoints que a
    UI consome (ex.: `/api/tickets/meus-kpis`, CRUD de utilizadores).
- **Onde:** `db/migrations/` (nova migração), `server.js` (montar rotas),
  `package.json` (`pdfkit`, `@anthropic-ai/sdk`), respectivos models/serviços.
- **Nota:** faz-se muito melhor **depois** da P1-1 (migrações versionadas).

### P0-1 · ✅ Autenticação real (feito) — falta endurecer a API
- **Feito:** login por **email + palavra-passe** com hash **bcrypt**
  (`bcryptjs`, `utils/password.js`, coluna `senha_hash`); papéis
  `operador`/`admin`/`super_admin`; super admin por ambiente; erro de login
  genérico (anti-enumeração).
- **Falta (⚠️):**
  - Aplicar `middleware/seguranca.js` — pôr `cabecalhosSeguranca` global no
    `server.js` e `limitadorPedidos` no `/api/auth/login` (hoje só o CSAT o usa).
  - Validação de entrada mais rigorosa nas rotas; forçar HTTPS; `JWT_SECRET`
    forte em produção.
  - **Opcional:** SSO/Entra ID (a empresa já usa Office 365 — OpenID Connect).
- **Onde:** `server.js`, `routes/authRoutes.js`, `middleware/seguranca.js`.

### P0-2 · ❌ Registar e auditar as respostas enviadas
- **Porquê:** ao resolver, a resposta segue para o Outlook mas **não fica
  guardada** — não há histórico do que foi respondido a quem.
- **O quê:** persistir o texto/data/autor da resposta; mostrar o histórico no
  painel de detalhe do ticket.
- **Onde:** nova migração (`respostas` ou colunas em `tickets`),
  `models/ticketModel.js`, `routes/ticketRoutes.js`, `components/TicketDetail.jsx`.

### P0-3 · ⚠️ Resiliência da subscrição do Microsoft Graph
- **Estado:** a subscrição é criada no arranque e renovada de 24 em 24 h, com
  recriação em caso de falha — mas vive **em memória**. Um reinício perde a
  referência até à próxima renovação, e não há tratamento de *lifecycle* nem
  *delta sync*.
- **O quê:** persistir o `subscriptionId` na BD; tratar os
  `lifecycleNotifications` (`reauthorizationRequired`); reconciliar no arranque;
  e um *delta sync* periódico (ex.: de 10 em 10 min) como rede de segurança para
  apanhar emails perdidos.
- **Onde:** `services/graphService.js`, `server.js`, nova tabela `subscricoes`,
  job agendado.

---

## P1 — Robustez e escala

### P1-1 · ❌ Migrações versionadas
- **Porquê:** hoje há um único `001_init.sql` com `IF NOT EXISTS`; não há controlo
  de versões de esquema — e a "segunda vaga" (P0-0) vai precisar de várias
  alterações de esquema.
- **O quê:** adoptar `node-pg-migrate` (ou Knex) com tabela de migrações e
  comandos `migrate up/down`. (Alternativa leve, fiel à filosofia do projecto:
  um *runner* caseiro que aplique ficheiros `NNN_*.sql` por ordem e registe os
  já aplicados.)
- **Onde:** `backend/` (configuração + pasta de migrações), `cli.js`, `package.json`.

### P1-2 · ❌ Escala horizontal do tempo real
- **Porquê:** com mais do que uma instância do backend, o Socket.io precisa de
  um adaptador partilhado e o *sweeper* não pode correr em duplicado.
- **O quê:** adaptador **Redis** para Socket.io; garantir um único "líder" do
  sweeper (ex.: *advisory lock* do PostgreSQL) para não libertar tickets em duplicado.
- **Onde:** `server.js`, `sockets/index.js`, `services/ticketService.js`.

### P1-3 · ❌ Anexos de email
- **Porquê:** muitos emails trazem anexos; hoje são ignorados.
- **O quê:** ler anexos via Graph, guardar referência e permitir abri-los e
  anexá-los na resposta.
- **Onde:** `services/graphService.js`, `routes/webhookRoutes.js`,
  `components/TicketDetail.jsx`, possível tabela `anexos`.

### P1-4 · ⚠️ Conversação (threading)
- **Porquê:** hoje 1 email = 1 ticket; uma resposta do cliente cria um ticket novo.
- **Estado:** parte da "segunda vaga" (`integracaoRoutes`/`ingestaoService`) já
  aceita `conversationId`, mas **não há coluna `conversation_id`** nem a lógica
  de reabrir/continuar. Alinhar com a P0-0.
- **O quê:** agrupar mensagens da mesma conversa (`conversationId` da Graph);
  uma resposta do cliente reabre/continua o ticket existente.
- **Onde:** esquema (`conversation_id`), `webhookRoutes.js`, `ticketModel.js`.

### P1-5 · ⚠️ Paginação e pesquisa server-side
- **Estado:** as listas de resolvidos já usam `LIMIT`, mas não há *offset*/cursor
  nem pesquisa por remetente/assunto/datas.
- **O quê:** paginação e filtros no servidor; índices de apoio.
- **Onde:** `models/ticketModel.js`, `routes/ticketRoutes.js`, `pages/Queue.jsx`,
  `pages/AdminDashboard.jsx`.

### P1-6 · ❌ Reatribuição manual pelo supervisor
- **Porquê:** o admin liberta mas não consegue atribuir directamente a um operador.
- **O quê:** acção "atribuir a…" no painel do supervisor.
- **Onde:** `ticketService.js`, `ticketRoutes.js`, `AdminDashboard.jsx`.

### P1-7 · ❌ Observabilidade
- **Porquê:** só há `console.log`/`error`; falta logging estruturado e
  visibilidade de erros.
- **O quê:** `pino` para logs, endpoint de *readiness*, tratamento central de
  erros e integração de *error tracking* (ex.: Sentry). (Se se quiser manter as
  dependências mínimas, um logger caseiro em JSON já ajuda.)
- **Onde:** `server.js`, middleware de erros.

---

## P2 — Produto e qualidade

### P2-1 · ⚠️ Painel de métricas históricas (com gráficos)
- **Estado:** existe a página `Relatorios.jsx` e o `relatorioModel`/`insightsService`
  com agregações e gráficos, mas fazem parte da "segunda vaga" **não integrada**
  (rota por montar, colunas em falta). Concluir via P0-0.
- **O quê:** evolução do cumprimento de SLA no tempo, por categoria e operador;
  tempo médio de resposta; tendência semanal/mensal.

### P2-2 · ❌ Gestão das regras de triagem na UI
- **Porquê:** a triagem funciona, mas reconfigurar exige SQL directo.
- **O quê:** CRUD da tabela `regras_triagem` no painel admin, com invalidação de
  cache (`triageService.invalidarCache`).
- **Onde:** nova rota + ecrã admin.

### P2-3 · ⚠️ Notificações de browser e som configurável
- **Estado:** os alertas com som e o popup de SLA já existem (`AlertasSla.jsx`).
- **Falta:** Web Notifications (alerta com o separador em segundo plano) e
  preferências de som por utilizador.
- **Onde:** `components/AlertasSla.jsx`, preferências do utilizador.

### P2-4 · ⚠️ Cobertura de testes + CI
- **Estado:** 12 testes (`sla.test.js` + `extras.test.js`), sem CI.
- **O quê:** testes para `triageService`, `ticketModel` (atomicidade da
  atribuição), rotas (supertest) e sweeper; *pipeline* de CI (GitHub Actions) a
  correr testes + build.
- **Onde:** `backend/tests/`, `.github/workflows/`.

### P2-5 · ❌ Precisão do SLA na mudança de hora (DST)
- **O quê:** tornar exacto o cálculo nos dias de transição de hora de verão
  (hoje é aceitável; ver nota em `slaService.js`).
- **Onde:** `services/slaService.js`, `tests/sla.test.js`.

### P2-6 · ⚠️ Produção do frontend, acessibilidade e i18n
- **Estado:** `prefers-reduced-motion` já é respeitado nos alertas.
- **Falta:** compose de produção (`NODE_ENV=production`, segredos, backups da
  BD); rever acessibilidade (foco, ARIA, contraste); preparar i18n.
- **Onde:** `docker-compose` (variante de produção), componentes do frontend.

### P2-7 · ❌ Gestão de feriados
- **O quê:** *overrides* por ano e feriados municipais geridos por configuração/UI
  (já existe `FERIADOS_EXTRA` por variável de ambiente).
- **Onde:** `utils/feriados.js`, configuração.

---

### Sugestão de sequência
P0-0 (decidir/integrar a segunda vaga) → P0-1 (endurecer) → P0-2 → P0-3 →
P1-1 (migrações, de preferência **antes** da P0-0) → P1-2 → (restantes P1) → P2.
