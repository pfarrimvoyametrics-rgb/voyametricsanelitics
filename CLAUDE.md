# CLAUDE.md — Central de Tickets (SLA & Equipa)

Contexto persistente para o Claude Code (lido no início de cada sessão).
Detalhe completo em `README.md`; backlog priorizado em `MELHORIAS.md`;
histórico de decisões e validação em `HISTORICO.md`.

*Última actualização: 3 de Julho de 2026 (consolidação multi-tenant).*

## O que é
App web **multi-tenant** que transforma o fluxo de emails de uma caixa
partilhada do Outlook (Office 365) em tickets, com triagem automática por
categoria, SLA em horas úteis (configurável por organização), distribuição/
bloqueio em tempo real e alertas. Cada **organização** (cliente) tem os seus
utilizadores, tickets e regras, isolados dos restantes. Alvo: 500–10 000
emails/dia, ~10 operadores por organização.

## Stack
- Backend: Node.js 18+ + Express + Socket.io (**CommonJS**, sem TypeScript).
- BD: PostgreSQL 16 (driver `pg`, **SQL escrito à mão**).
- Frontend: React 18 + Vite + Tailwind 3 (JS + JSX, **sem React Router** —
  navegação por estado em `App.jsx`).
- Integração: Microsoft Graph (app-only, `fetch` nativo, sem SDK).
- IA (opcional): Anthropic Claude via `@anthropic-ai/sdk` (análise de tickets).
- PDF: `pdfkit` (relatórios).
- Docker: `docker compose up` sobe db+backend+frontend → http://localhost:8080.

## Dependências
`backend/package.json`: `express`, `pg`, `socket.io`, `jsonwebtoken`,
`bcryptjs`, `pdfkit`, `cors`, `dotenv`.
- **`@anthropic-ai/sdk`** — necessário para a análise por IA. **Não** está no
  `package.json`; é carregado com *require* preguiçoso (o backend arranca sem
  ele e só falha, com mensagem clara, quando a análise é usada). Instalar à mão.
- Sem helmet/express-rate-limit/zod por opção (soluções caseiras em `middleware/`).

## Comandos
- Tudo em Docker: `docker compose up` (app em :8080).
- Só BD (modo manual): `docker compose -f docker-compose.db.yml up -d`.
- Backend: `cd backend && npm install && npm run db:reset && npm run dev` (:4000).
- Frontend: `cd frontend && npm install && npm run dev` (:5173).
- Testes: `cd backend && TZ=Europe/Lisbon npm test` (Node test runner, `node --test`).
- BD: `npm run migrate` / `npm run seed` / `npm run db:reset` (aplica as migrações
  `db/migrations/00N_*.sql` por ordem, via `cli.js`).
- Super admin: `npm run create-admin` (ou `SUPER_ADMIN_EMAIL`/`_PASSWORD`).
- Graph: `npm run graph:subscribe`.

## Multi-tenant — como funciona (LER antes de tocar em rotas/models)
- Tabela `organizacoes`; coluna `organizacao_id` em `usuarios`, `tickets`,
  `regras_triagem`, `canais_sla` (NOT NULL, exceto `usuarios` do super_admin,
  que é NULL — é da plataforma). FKs com `ON DELETE CASCADE`.
- **`middleware/auth.js` › `resolverOrg`** resolve a org-alvo para `req.orgId`:
  - admin/operador: **sempre** a org do próprio token; qualquer `x-org-id`
    enviado pelo cliente é **ignorado** (barreira anti-cross-tenant).
  - super_admin: a org indicada no header **`x-org-id`** (validada: existe+ativa).
- **Regra de ouro**: qualquer rota autenticada que toque em dados de org usa
  `exigirAutenticacao` → `resolverOrg`, e **todas** as queries de model filtram
  por `organizacao_id = $orgId`. Ao criar código novo, seguir este padrão.
- Sockets: salas por org — `org:<orgId>:cat:<categoria>` (operadores) e
  `org:<orgId>:admins` (admins). Helpers `salaCategoria`/`salaAdmins` no
  `ticketService`. O super_admin observa uma org com o evento `org:entrar`.

## Estrutura (todas as rotas ligadas ao `server.js`)
Rotas montadas: `/api/auth`, `/api/usuarios`, `/api/organizacoes`,
`/api/regras`, `/api/config`, `/api/tickets`, `/api/webhooks`, `/api/analise`,
`/api/canais`, `/api/csat`, `/api/relatorios`, `/api/integracoes`
(+ `/api/dev/mock-ticket` fora de produção).
- `services/` — slaService (SLA por org), triageService (regras por org, cache),
  graphService, ticketService (locking, salas, sweeper), userService (auth/orgs),
  analiseIaService (Claude), insightsService, pdfRelatorio, pdfLideranca.
- `routes/` — auth, users, org, regra, config, tickets, webhooks, analise,
  canal, csat, relatorio, integracao.
- `models/` — userModel, ticketModel, orgModel, regraModel, canalModel,
  relatorioModel (todo o SQL escopado por org).
- `middleware/` — auth (JWT + `resolverOrg`), seguranca (cabeçalhos + rate-limit),
  apiKey (integração, `timingSafeEqual`).
- `db/migrations/` — `001_init.sql`, `002_multitenant.sql`, `003_sla_por_org.sql`,
  `004_relatorios_csat.sql`. `db/seed.js`, `db/demo.js` (gerador de demonstração).
- `frontend/src/pages/` — Login, Queue (operador), AdminDashboard, Parametrizacao,
  Organizacoes (super_admin), Relatorios, Canais, CsatPublic.
- `frontend/src/components/` — SlaTimer, TicketCard, TicketDetail, AlertasSla,
  Navbar, AnaliseIA, KpisFila, ConfigSla, GestaoUtilizadores, RegrasTriagem.

## Papéis (`funcao`)
- **`operador`** — vê e trata a fila da sua categoria (na sua org).
- **`admin`** — vê tudo da sua org; gere utilizadores, regras de triagem, SLA.
- **`super_admin`** — plataforma (sem org própria); cria/ativa organizações e
  opera sobre uma org via `x-org-id`.

## CONVENÇÕES — IMPORTANTE, seguir sempre
- **Idioma**: TODA a documentação, comentários, textos de UI e mensagens em
  **português de Portugal ANTES do Acordo Ortográfico de 1990** (ex.: "facto",
  "acção", "óptimo", "directo", "contacto", "perspectiva"). NUNCA usar a grafia
  do Acordo nem português do Brasil nos textos.
- **Nomes da base de dados**: tabelas/colunas seguem a especificação original e
  algumas estão em pt-BR (`usuarios`, `remetente`, `categoria_ticket`,
  `data_rececao`, `organizacao_id`). **NÃO renomear "para corrigir"** — quebra o
  esquema e o seed. Manter exactamente como está.
- Identificadores de código em português (funções, variáveis).
- Backend é **CommonJS** (`require`/`module.exports`) — não converter para ESM.
- Frontend é JS+JSX e **Tailwind 3** (sem bibliotecas de componentes; sem router).
- Models usam SQL à mão; não introduzir ORM sem necessidade clara.
- **Dependências mínimas por filosofia** — preferir soluções caseiras.
- **Isolamento por tenant é inegociável**: toda a leitura/escrita de dados de org
  filtra por `organizacao_id`; nunca confiar em org vinda do cliente.

## REGRAS DE NEGÓCIO — SLA (núcleo do sistema)
- Dias úteis: Segunda a Sexta.
- Janela **por omissão**: **09:30–19:00, CONTÍNUA** (a empresa não fecha ao
  almoço → 9,5 h úteis/dia). Cada organização pode redefinir início/fim.
- Prazo por omissão: **120 minutos úteis** (`SLA_MINUTOS_UTEIS`); configurável
  por org.
- Feriados nacionais PT excluídos, **incluindo móveis** (Sexta-Feira Santa,
  Páscoa, Corpo de Deus — `utils/feriados.js`). Cada org pode ter `feriados_extra`.
- Configuração por org (colunas `sla_hora_inicio`/`sla_hora_fim`/
  `sla_minutos_uteis`/`feriados_extra` em `organizacoes`); **NULL = usar o valor
  global do ambiente**. Cálculo em `slaService.configDaOrg(org)` +
  `slaService.calcularSlaLimite(dataRececao, config)` — nota: `calcularSlaLimite`
  espera um **objecto config**, não um número.
- Correr em **`TZ=Europe/Lisbon`** (a janela é hora local).
- Qualquer alteração ao cálculo exige actualizar os testes em `backend/tests/`
  (`sla.test.js` + `extras.test.js`).

## Subsistemas a conhecer
- **Autenticação**: login por **email + palavra-passe** com hash **bcrypt**
  (`utils/password.js`, `bcryptjs`); JWT de 12 h com `organizacao_id` no payload
  (`middleware/auth.js`). O super admin é criado no arranque
  (`SUPER_ADMIN_EMAIL`/`_PASSWORD`, mín. 8 chars); demo semeada por código com
  `SEED_DEMO_PASSWORD` (`demo1234`).
- **Triagem por org**: `triageService.triar(email, orgId)` lê as `regras_triagem`
  ativas da org (cache `Map` orgId→regras, TTL 60 s), devolve a categoria da 1.ª
  regra que casa por prioridade; omissão `comercial`. Geridas na UI
  (`/api/regras`, `RegrasTriagem.jsx`), com `invalidarCache(orgId)` a cada mudança.
- **Locking / tempo real**: atribuição **atómica** em SQL (só se `pendente`,
  escopada à org). Eventos por sala de org/categoria. Sweeper (30 s) liberta
  bloqueios expirados (`LOCK_RELEASE_MINUTES`, def. 5) — corre global e emite à
  sala certa via `organizacao_id`.
- **Alertas** (`AlertasSla.jsx`): cartão laranja <60 min; toast+som nos 30 min
  finais; popup intermitente quando o SLA é ultrapassado. Respeita
  `prefers-reduced-motion`.
- **Graph**: OAuth client-credentials; webhook em `/api/webhooks/graph`. A org do
  email é resolvida pelos **destinatários** (To+Cc) e, em último caso, pelo
  **remetente**, casando com os `email_dominios` de cada organização
  (`orgModel.escolherOrgPorEnderecos`); sem correspondência cai em
  `INGESTAO_ORG_PADRAO` (def. `demo`). Subscrição criada no arranque e renovada de
  24 em 24 h, **em memória**.
- **Análise por IA** (`analiseIaService.js`, `/api/analise`): o Claude analisa o
  **volume de tickets por equipa** num laço agêntico com ferramentas read-only
  parametrizadas (nunca escreve SQL); resposta completa e em *streaming* (SSE).
  `ANTHROPIC_MODEL` (`claude-opus-4-8`); precisa de `ANTHROPIC_API_KEY` + SDK.
- **Relatórios + PDF** (`/api/relatorios`, admin): agregações por período/âmbito,
  insights e PDFs (`pdfRelatorio`, `pdfLideranca`) via `pdfkit`.
- **Canais** (`/api/canais`, admin): alvo de SLA por categoria por org
  (`canais_sla`) — hoje **informativo para relatórios**; não alimenta o cálculo
  real do SLA (esse usa `configDaOrg`). Valida contra uma lista fixa de 7
  categorias no `canalRoutes`.
- **CSAT** (`/api/csat/:id`, **público**): inquérito 1–5 + comentário, por UUID
  do ticket (a credencial é o id), com rate-limit e proteção contra duplicação.
- **Integração S2S** (`/api/integracoes`, header `x-api-key`): sistema externo
  preenche resultado/valor da venda e emissão de bilhetes. `INTEGRACAO_API_KEY`
  (sem ela, 503). Comparação da chave em tempo constante (`timingSafeEqual`).

## ⚠️ Limitações conhecidas (ver `MELHORIAS.md`)
- **Uma caixa partilhada**: a ingestão já roteia por organização
  (`email_dominios`, ver Graph acima), mas assume **uma** caixa/subscrição Graph
  partilhada — o roteamento depende de haver aliases por org nessa caixa. Uma
  caixa por organização fica para evolução futura.

> A dívida da consolidação (D-1…D-6) e o roteamento de ingestão (P0-4) foram
> **resolvidos** e validados (testes 21/21; E2E em Docker) — ver
> `HISTORICO.md §0.3`.

## Ao trabalhar neste repositório
- Explorar e **propor antes de implementar**; pedir confirmação em mudanças estruturais.
- Não comprometer segredos; `.env` está no `.gitignore`.
- Próximos passos priorizados: **`MELHORIAS.md`**.
