# MELHORIAS — Backlog priorizado

Lista de evoluções recomendadas, por ordem de prioridade. Pensada para entregar
ao Claude Code: pode pedir, por exemplo, *"implementa o D-1"* e ele tem o
contexto (ver `CLAUDE.md`) para o fazer respeitando as convenções do projecto.

Prioridades: **P0** = essencial antes de produção · **P1** = robustez/escala ·
**P2** = produto e qualidade · **D** = dívida deixada pela consolidação multi-tenant.

Estado: ✅ feito · ⚠️ parcial · ❌ por fazer.

*Última actualização: 3 de Julho de 2026 (pós-consolidação multi-tenant).*

---

## D — Dívida da consolidação multi-tenant ✅ RESOLVIDA

Pontas soltas identificadas na revisão do commit `8995aa5`, **todas corrigidas**
(ver `HISTORICO.md §0.3`). Registo para memória:

### D-1 · ✅ Integração emitia para uma sala que já não existe
- Era: `integracaoRoutes.js` fazia `io.to(ticketService.SALA_ADMINS)…` (undefined)
  → o painel não actualizava após venda/emissão.
- **Feito:** passou a emitir para `salaAdmins(ticket.organizacao_id)`.

### D-2 · ✅ `GET /api/integracoes/ticket?ticketId=…` devolvia sempre 404
- Era: `ticketModel.porId(ticketId)` sem `orgId` (a query filtra por org).
- **Feito:** novo `ticketModel.porIdGlobal(id)` (leitura sem org, uso restrito à
  integração S2S) + resolução unificada por `resolverReferencia`.

### D-3 · ✅ `ingestaoService.js` órfão removido
- Era: código não importado por ninguém (o webhook tem a sua própria lógica
  multi-tenant) e com assinaturas antigas de SLA/canal.
- **Feito:** ficheiro **removido**. O `webhookRoutes.js` é o ponto de ingestão.

### D-4 · ✅ Gerador de demonstração (`db/demo.js`) alinhado
- Era: `canalModel.mapaSla()` sem `orgId`, `calcularSlaLimite(data, número)`, e o
  INSERT nem incluía `organizacao_id` (NOT NULL) — rebentava.
- **Feito:** usa a org `demo` (`orgModel.porSlug`), `slaService.configDaOrg(org)`,
  o novo `slaService.minutosUteisEntre(...)` e inclui `organizacao_id` no INSERT.
  Comandos `demo`/`demo:clear` ligados no `cli.js` (estavam por expor). Validado
  E2E: `node src/cli.js demo 150` gera tickets contra Postgres real.

### D-5 · ✅ Páginas do frontend ligadas
- Era: `Relatorios`/`Canais`/`CsatPublic` existiam mas não estavam no `App.jsx`,
  e os métodos de API que consomem nem existiam no `client.js`.
- **Feito:** separadores "Relatórios" e "Canais" nos painéis de admin e
  super_admin; `CsatPublic` montado quando o URL traz `?csat=<id>` (antes do
  login); métodos em falta acrescentados ao `api/client.js` (`canais`,
  `atualizarCanal`, `csatObter`, `csatEnviar`, `relatorios`, `usuarios`,
  `baixarRelatorioPdf`/`baixarLiderancaPdf` com download binário); Chart.js e
  SheetJS carregados por CDN no `index.html`.

### D-6 · ✅ Comentário obsoleto no `middleware/auth.js` corrigido
- Era: descrevia "login só por email, sem palavra-passe".
- **Feito:** cabeçalho actualizado (email + palavra-passe bcrypt + multi-tenant).

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

### P0-4 · ✅ Roteamento de ingestão por organização (feito)
- Era: o webhook atribuía **todos** os emails à org `demo` (hardcoded).
- **Feito:** cada organização declara `email_dominios` (domínios/aliases); o
  webhook resolve a org pelos **destinatários** (To+Cc) e, em último caso, pelo
  **remetente** (`orgModel.escolherOrgPorEnderecos`, função pura testada). Sem
  correspondência, cai na org por omissão (`INGESTAO_ORG_PADRAO`, def. `demo`) —
  **retrocompatível**. `graphService.obterMensagem` passou a devolver os
  destinatários; UI para editar os domínios em `Organizacoes.jsx`
  (`PATCH /api/organizacoes/:id/email-dominios`, super_admin).
- **Nota:** continua a assumir **uma caixa partilhada** — o roteamento por
  destinatário exige aliases por organização nessa caixa. Uma caixa (subscrição
  Graph) por organização fica para evolução futura.
- **Onde:** `migrations/005_ingestao_por_org.sql`, `routes/webhookRoutes.js`,
  `models/orgModel.js`, `services/graphService.js`, `routes/orgRoutes.js`.

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
(A dívida **D-1…D-6** e a **P0-4** já estão fechadas.) P0-1 (endurecer) → P0-2
→ P0-3 → P1-1 → P1-2 → (restantes P1) → P2.
