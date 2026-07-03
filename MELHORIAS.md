# MELHORIAS — Backlog priorizado

Lista de evoluções recomendadas, por ordem de prioridade. Pensada para entregar
ao Claude Code: pode pedir, por exemplo, *"implementa o D-1"* e ele tem o
contexto (ver `CLAUDE.md`) para o fazer respeitando as convenções do projecto.

Prioridades: **P0** = essencial antes de produção · **P1** = robustez/escala ·
**P2** = produto e qualidade · **D** = dívida deixada pela consolidação multi-tenant.

Estado: ✅ feito · ⚠️ parcial · ❌ por fazer.

*Última actualização: 3 de Julho de 2026 (pós-consolidação multi-tenant).*

---

## D — Dívida da consolidação multi-tenant (arrumar primeiro)

Pontas soltas identificadas na revisão do commit `8995aa5`. São pequenas e de
alto valor — convém fechar antes de construir mais por cima.

### D-1 · ❌ Integração emite para uma sala que já não existe
- **Sintoma:** após um registo de venda/emissão pela integração, **nenhum painel
  actualiza em tempo real**. `integracaoRoutes.js` faz
  `io.to(ticketService.SALA_ADMINS)…`, mas o `ticketService` já **não** exporta
  `SALA_ADMINS` (só `salaCategoria`/`salaAdmins`) → `io.to(undefined)`.
- **Correcção:** emitir para `salaAdmins(ticket.organizacao_id)`.
- **Onde:** `routes/integracaoRoutes.js` (~linhas 47 e 76).

### D-2 · ❌ Consulta de ticket por `ticketId` na integração devolve sempre 404
- **Sintoma:** `GET /api/integracoes/ticket?ticketId=…` chama
  `ticketModel.porId(ticketId)` sem `orgId`; a query é `... AND organizacao_id = $2`
  com `$2 = undefined` (→ NULL) e nunca casa.
- **Correcção:** ter uma leitura por id sem org para a integração (S2S), ou
  aceitar org explícita. O caminho por `conversationId` funciona.
- **Onde:** `routes/integracaoRoutes.js`, `models/ticketModel.js`.

### D-3 · ❌ `ingestaoService.js` órfão e com assinaturas antigas
- **Sintoma:** o "ponto único de ingestão" documentado **não é importado** por
  ninguém (o webhook tem a sua própria cópia da lógica). Além disso chama
  `triageService.triar({…})` sem `orgId` e `canalModel.mapaSla()` sem `orgId`, e
  passa um número a `calcularSlaLimite` (que espera um objecto config).
- **Correcção:** alinhar com `webhookRoutes.js` (multi-tenant) e reutilizá-lo, ou
  **remover** o ficheiro para não confundir.
- **Onde:** `services/ingestaoService.js`.

### D-4 · ❌ Gerador de demonstração (`db/demo.js`) desalinhado
- **Sintoma:** usa `canalModel.mapaSla()` sem `orgId` e `calcularSlaLimite(data,
  numero)` — assinaturas antigas; o `npm run` de demo provavelmente rebenta ou
  calcula SLA inválido.
- **Correcção:** passar `orgId` e usar `slaService.configDaOrg(org)`.
- **Onde:** `backend/src/db/demo.js`.

### D-5 · ⚠️ Ligar as páginas órfãs do frontend
- **Sintoma:** `Relatorios.jsx`, `Canais.jsx` e `CsatPublic.jsx` existem e têm
  backend, mas **não estão ligadas** ao `App.jsx`/`main.jsx`. O link público de
  CSAT (`?csat=<id>`) não é interpretado.
- **Correcção:** acrescentar as vistas de Relatórios/Canais ao painel de admin e
  montar o `CsatPublic` quando o URL traz `?csat=<id>` (antes do ecrã de login).
- **Onde:** `frontend/src/App.jsx`, `frontend/src/main.jsx`.

### D-6 · ⚠️ Comentário obsoleto no `middleware/auth.js`
- **Sintoma:** o cabeçalho ainda descreve "login simplificado só por email, sem
  palavra-passe" — falso desde que o `authRoutes` passou a usar bcrypt.
- **Correcção:** actualizar o comentário (trivial).
- **Onde:** `backend/src/middleware/auth.js` (topo).

---

## P0 — Antes de ir para produção

### P0-0 · ✅ Integrar a segunda vaga (feito)
Multi-tenant, SLA por org, regras na UI, CSAT, relatórios+PDF, canais e
integração S2S foram integrados na consolidação `8995aa5`. Ver `HISTORICO.md §0.2`.
Restam as pontas soltas na secção **D** acima.

### P0-1 · ✅ Autenticação real (feito) — falta endurecer a API
- **Feito:** login por **email + palavra-passe** (bcrypt); papéis
  `operador`/`admin`/`super_admin`; super admin por ambiente; multi-tenant no JWT.
- **Falta (⚠️):**
  - Aplicar `middleware/seguranca.js` — `cabecalhosSeguranca` global no
    `server.js` e `limitadorPedidos` no `/api/auth/login` (hoje só o CSAT o usa).
  - Validação de entrada mais rigorosa; forçar HTTPS; `JWT_SECRET` forte.
  - **Opcional:** SSO/Entra ID (OpenID Connect).
- **Onde:** `server.js`, `routes/authRoutes.js`, `middleware/seguranca.js`.

### P0-2 · ❌ Registar e auditar as respostas enviadas
- **Porquê:** ao resolver, a resposta segue para o Outlook mas **não fica
  guardada** — não há histórico do que foi respondido a quem. (Nota: existe
  `adicionarSeguimento`, mas é para emails de seguimento do cliente, não para a
  resposta enviada pelo operador.)
- **O quê:** persistir texto/data/autor da resposta; histórico no detalhe.
- **Onde:** migração (`respostas` ou colunas em `tickets`),
  `models/ticketModel.js`, `routes/ticketRoutes.js`, `components/TicketDetail.jsx`.

### P0-3 · ⚠️ Resiliência da subscrição do Microsoft Graph
- **Estado:** subscrição criada no arranque e renovada de 24 em 24 h, com
  recriação em caso de falha — mas **em memória**, sem tratamento de *lifecycle*
  nem *delta sync*.
- **O quê:** persistir o `subscriptionId`; tratar `lifecycleNotifications`;
  reconciliar no arranque; *delta sync* periódico de segurança.
- **Onde:** `services/graphService.js`, `server.js`, tabela `subscricoes`, job.

### P0-4 · ❌ Roteamento de ingestão por organização
- **Porquê:** o webhook atribui **todos** os emails à org `demo` (hardcoded em
  `webhookRoutes.js`). Com >1 organização real, é uma falha de isolamento dos
  dados de ingestão.
- **O quê:** rotear o email para a org certa (por destinatário/alias/domínio, ou
  uma caixa por org), antes de criar o ticket.
- **Onde:** `routes/webhookRoutes.js`, `models/orgModel.js`.

---

## P1 — Robustez e escala

### P1-1 · ⚠️ Migrações versionadas
- **Estado:** já há migrações **numeradas e sequenciais** (`001`–`004`),
  idempotentes, aplicadas por `cli.js`. Falta um registo de versões aplicadas e
  `down`/rollback.
- **O quê:** tabela de migrações aplicadas (ou adoptar `node-pg-migrate`/Knex).
- **Onde:** `backend/src/cli.js`, `db/migrations/`, `package.json`.

### P1-2 · ❌ Escala horizontal do tempo real
- **Porquê:** com >1 instância do backend, o Socket.io precisa de adaptador
  partilhado e o *sweeper* não pode correr em duplicado.
- **O quê:** adaptador **Redis**; um único "líder" do sweeper (*advisory lock* PG).
- **Onde:** `server.js`, `sockets/index.js`, `services/ticketService.js`.

### P1-3 · ❌ Anexos de email
- **O quê:** ler anexos via Graph, guardar referência, abrir/anexar na resposta.
- **Onde:** `services/graphService.js`, `routes/webhookRoutes.js`,
  `components/TicketDetail.jsx`, tabela `anexos`.

### P1-4 · ⚠️ Conversação (threading)
- **Estado:** já existe `conversation_id` e `ticketModel.porConversaAberta`, mas
  a lógica de reabrir/continuar não está fechada no fluxo do webhook.
- **O quê:** uma resposta do cliente na mesma conversa reabre/continua o ticket.
- **Onde:** `routes/webhookRoutes.js`, `models/ticketModel.js`.

### P1-5 · ⚠️ Paginação e pesquisa server-side
- **Estado:** listas de resolvidos com `LIMIT`, sem *offset*/cursor nem pesquisa.
- **O quê:** paginação e filtros (remetente/assunto/datas) no servidor; índices.
- **Onde:** `models/ticketModel.js`, `routes/ticketRoutes.js`, `pages/Queue.jsx`,
  `pages/AdminDashboard.jsx`.

### P1-6 · ❌ Reatribuição manual pelo supervisor
- **O quê:** acção "atribuir a…" no painel do supervisor (hoje só liberta).
- **Onde:** `ticketService.js`, `ticketRoutes.js`, `AdminDashboard.jsx`.

### P1-7 · ❌ Observabilidade
- **O quê:** logging estruturado (ex.: `pino` ou logger caseiro em JSON),
  endpoint de *readiness*, tratamento central de erros, *error tracking*.
- **Onde:** `server.js`, middleware de erros.

---

## P2 — Produto e qualidade

### P2-1 · ⚠️ Painel de métricas históricas (com gráficos)
- **Estado:** `Relatorios.jsx` + `relatorioModel`/`insightsService` já produzem
  agregações, insights e PDFs — mas a página ainda **não está ligada** (ver D-5).
- **O quê:** ligar a vista e cobrir evolução de SLA por categoria/operador.

### P2-2 · ✅ Gestão das regras de triagem na UI (feito)
CRUD por org com provador e invalidação de cache (`/api/regras`,
`RegrasTriagem.jsx`). Concluído na consolidação.

### P2-3 · ⚠️ Notificações de browser e som configurável
- **Estado:** alertas com som e popup de SLA já existem (`AlertasSla.jsx`).
- **Falta:** Web Notifications (separador em segundo plano) e som por utilizador.

### P2-4 · ⚠️ Cobertura de testes + CI
- **Estado:** testes de SLA + triagem (`sla.test.js`, `extras.test.js`), sem CI.
- **O quê:** testes de isolamento por org, `ticketModel` (atomicidade), rotas
  (supertest) e sweeper; CI (GitHub Actions) a correr testes + build.
- **Onde:** `backend/tests/`, `.github/workflows/`.

### P2-5 · ❌ Precisão do SLA na mudança de hora (DST)
- **O quê:** exactidão nos dias de transição de hora de verão.
- **Onde:** `services/slaService.js`, `tests/sla.test.js`.

### P2-6 · ⚠️ Produção do frontend, acessibilidade e i18n
- **Estado:** `prefers-reduced-motion` já respeitado.
- **Falta:** compose de produção (segredos, backups da BD); acessibilidade
  (foco, ARIA, contraste); i18n.

### P2-7 · ⚠️ Gestão de feriados
- **Estado:** feriados fixos + móveis automáticos; cada org já tem `feriados_extra`.
- **Falta:** *overrides* por ano e feriados municipais geridos por UI.
- **Onde:** `utils/feriados.js`, `ConfigSla.jsx`.

---

### Sugestão de sequência
D-1…D-6 (fechar a dívida da consolidação) → P0-1 (endurecer) → P0-4 (ingestão
por org) → P0-2 → P0-3 → P1-1 → P1-2 → (restantes P1) → P2.
