# CLAUDE.md — Central de Tickets (SLA & Equipa)

Contexto persistente para o Claude Code (lido no início de cada sessão).
Detalhe completo em `README.md`; backlog priorizado em `MELHORIAS.md`;
histórico de decisões e validação em `HISTORICO.md`.

*Última actualização: 3 de Julho de 2026.*

## O que é
App web que transforma o fluxo de emails de uma caixa partilhada do Outlook
(Office 365) em tickets, com triagem automática por categoria, SLA em horas
úteis, distribuição/bloqueio em tempo real e alertas. Alvo: 500–10 000
emails/dia, ~10 operadores divididos por categorias.

## Stack
- Backend: Node.js 18+ + Express + Socket.io (**CommonJS**, sem TypeScript).
- BD: PostgreSQL 16 (driver `pg`, **SQL escrito à mão**).
- Frontend: React 18 + Vite + Tailwind 3 (JS + JSX, sem TypeScript).
- Integração: Microsoft Graph (app-only, `fetch` nativo, sem SDK).
- IA (opcional): Anthropic Claude via `@anthropic-ai/sdk` (análise de tickets).
- Docker: `docker compose up` sobe db+backend+frontend → http://localhost:8080.

## Dependências (mínimas, por opção)
`backend/package.json`: `express`, `pg`, `socket.io`, `jsonwebtoken`,
`bcryptjs`, `cors`, `dotenv`. **Nada de** helmet/pdfkit/zod/express-rate-limit.
- **`@anthropic-ai/sdk`** — necessário para a análise por IA. **Não** está no
  `package.json`; é carregado com *require* preguiçoso (o backend arranca sem
  ele e só falha, com mensagem clara, quando a análise é usada). Instalar à mão.
- **`pdfkit`** — importado pelos serviços de PDF da segunda vaga (ver abaixo);
  também **não** está no `package.json`.

## Comandos
- Tudo em Docker: `docker compose up` (app em :8080).
- Só BD (modo manual): `docker compose -f docker-compose.db.yml up -d`.
- Backend: `cd backend && npm install && npm run db:reset && npm run dev` (:4000).
- Frontend: `cd frontend && npm install && npm run dev` (:5173).
- Testes: `cd backend && TZ=Europe/Lisbon npm test` (Node test runner nativo,
  `node --test`; 12 casos: SLA + normalização da triagem).
- BD: `npm run migrate` / `npm run seed` / `npm run db:reset` (no backend).
- Super admin: `npm run create-admin` (ou via `SUPER_ADMIN_EMAIL`/`_PASSWORD`).
- Graph: `npm run graph:subscribe` (subscrição manual; o arranque também a cria).

## Estrutura (o que está LIGADO ao `server.js`)
Rotas montadas: `/api/auth`, `/api/usuarios`, `/api/tickets`,
`/api/webhooks`, `/api/analise` (+ `/api/dev/mock-ticket` fora de produção).
- `backend/src/services/` — slaService, triageService, graphService,
  ticketService (lógica central), userService (auth/super admin),
  analiseIaService (Claude).
- `backend/src/routes/` — auth, users, tickets, webhooks (Graph), analise.
- `backend/src/models/` — userModel, ticketModel (SQL).
- `backend/src/middleware/` — auth (JWT), seguranca (cabeçalhos + rate-limit),
  apiKey (integração externa).
- `backend/src/db/` — migrations/001_init.sql, seeds/seed.sql, seed.js, demo.js.
- `backend/src/utils/` — feriados.js (PT: fixos + móveis), password.js (bcrypt),
  papeis.js, limitador.js.
- `frontend/src/pages/` — Login, Queue (operador), AdminDashboard (supervisor).
- `frontend/src/components/` — SlaTimer, TicketCard, TicketDetail, AlertasSla,
  Navbar, AnaliseIA, KpisFila.

## ⚠️ Segunda vaga — presente no repo mas AINDA NÃO INTEGRADA
Existem ficheiros de funcionalidades adicionais que **não estão montados** no
`server.js` e cujo **esquema de BD não existe** na migração actual. Não assumir
que funcionam; antes de os usar é preciso criar as colunas/tabelas, montar as
rotas e instalar dependências. São eles:
- **CSAT** (`routes/csatRoutes.js`, `pages/CsatPublic.jsx`) — inquérito público
  pós-resolução. Falta a coluna `tickets.csat` e montar a rota.
- **Canais / SLA por canal** (`routes/canalRoutes.js`, `models/canalModel.js`,
  `pages/Canais.jsx`) — SLA configurável por categoria. Falta a tabela
  `canais_sla`. Usa um conjunto de **7 categorias** (`emergencias`,
  `alteracoes`, `cotacoes`, `reclamacoes`, `suporte_tecnico`, `faturacao`,
  `comercial`) — diferente das **3 realmente semeadas** hoje (ver Triagem).
- **Relatórios + PDF** (`routes/relatorioRoutes.js`, `models/relatorioModel.js`,
  `services/insightsService.js`, `services/pdfRelatorio.js`,
  `services/pdfLideranca.js`, `pages/Relatorios.jsx`) — analítica por período e
  PDFs. Precisa de `pdfkit` e de colunas ainda inexistentes
  (`data_primeira_atribuicao`, `minutos_uteis_resolucao`, `resultado_venda`,
  `valor_venda`, `bilhetes_emitidos`, `bilhetes_com_erro`).
- **Integração servidor-a-servidor** (`routes/integracaoRoutes.js`,
  `services/ingestaoService.js`, `middleware/apiKey.js`) — sistema externo
  preenche resultado/valor da venda via `x-api-key`. Precisa de
  `tickets.conversation_id`, `resultado_venda`, `valor_venda` e montar a rota.
- **Parametrização** (`pages/Parametrizacao.jsx`) e **KPIs da fila**
  (`components/KpisFila.jsx`) — dependem de endpoints que podem estar
  incompletos (ex.: `/api/tickets/meus-kpis`). Verificar antes de confiar.

Ver `MELHORIAS.md` (secção "P0-0 · Integrar a segunda vaga") para o caminho de
conclusão.

## CONVENÇÕES — IMPORTANTE, seguir sempre
- **Idioma**: TODA a documentação, comentários, textos de UI e mensagens em
  **português de Portugal ANTES do Acordo Ortográfico de 1990** (ex.: "facto",
  "acção", "óptimo", "directo", "contacto", "perspectiva"). NUNCA usar a grafia
  do Acordo nem português do Brasil nos textos.
- **Nomes da base de dados**: tabelas/colunas seguem a especificação original e
  algumas estão em pt-BR (`usuarios`, `remetente`, `categoria_ticket`,
  `data_rececao`). **NÃO renomear "para corrigir"** — quebra o esquema e o seed.
  Manter exactamente como está.
- Identificadores de código em português (funções, variáveis).
- Backend é **CommonJS** (`require`/`module.exports`) — não converter para ESM.
- Frontend é JS+JSX e **Tailwind 3** (classes utilitárias; sem bibliotecas de componentes).
- Models usam SQL à mão (padrão atual); não introduzir ORM sem necessidade clara.
- **Dependências mínimas por filosofia**: preferir soluções caseiras (ex.: o
  `middleware/seguranca.js` faz cabeçalhos e rate-limit sem helmet). Não
  acrescentar pacotes sem necessidade clara.

## REGRAS DE NEGÓCIO — SLA (núcleo do sistema)
- Dias úteis: Segunda a Sexta.
- Janela: **09:30–19:00, CONTÍNUA** — a empresa não fecha ao almoço, logo o
  relógio do SLA NÃO pára às 13–14h (9,5 h úteis/dia).
- Feriados nacionais PT excluídos, **incluindo móveis** (Sexta-Feira Santa,
  Páscoa, Corpo de Deus — calculados em `utils/feriados.js`).
- Prazo: `sla_limite = data_rececao + 2 horas úteis`.
- O processo TEM de correr em **`TZ=Europe/Lisbon`** (a janela é hora local).
  Já definido nos compose e no `.env.example`.
- Qualquer alteração ao cálculo de SLA exige actualizar/expandir os testes em
  `backend/tests/` (`sla.test.js` + `extras.test.js`, 12 casos, todos a passar).

## Subsistemas a conhecer
- **Autenticação**: login por **email + palavra-passe** com hash **bcrypt**
  (`utils/password.js`, `bcryptjs`); JWT de 12 h (`middleware/auth.js`). Papéis:
  `operador` / `admin` / `super_admin`. O super admin é criado no arranque a
  partir de `SUPER_ADMIN_EMAIL`/`SUPER_ADMIN_PASSWORD` (ou `npm run create-admin`);
  os perfis de demonstração são semeados por código com `SEED_DEMO_PASSWORD`
  (por omissão `demo1234`). A mensagem de erro do login é genérica (não revela
  se falhou o email ou a palavra-passe).
- **Triagem**: regras palavra-chave→categoria na tabela `regras_triagem`
  (configuráveis), com cache em memória. Categorias **realmente semeadas**:
  `suporte_tecnico`, `faturacao`, `comercial` (esta é a de omissão). Texto
  comparado sem acentos e em minúsculas. (Nota: ainda não há UI para gerir as
  regras — mexe-se por SQL/seed.)
- **Locking / tempo real**: atribuição **atómica** em SQL (só se `pendente`).
  Eventos por sala de categoria + sala `admins`. Libertação automática via
  heartbeat (cliente) + sweeper (30 s) quando `data_bloqueio` expira
  (`LOCK_RELEASE_MINUTES`, def. 5).
- **Alertas** (`AlertasSla.jsx`): 3 níveis — cartão laranja a <60 min; toast+som
  nos 30 min finais (1×/email); popup intermitente quando o SLA é ultrapassado
  (lista os emails em atraso). Respeita `prefers-reduced-motion`.
- **Responder**: o detalhe do ticket envia a resposta via Graph (`reply`) e
  resolve. Em dev, tickets `mock-*` saltam o envio real. **Atenção**: a resposta
  enviada **não é guardada** na BD (ver `MELHORIAS.md`, P0-2).
- **Graph**: OAuth client-credentials; webhook em `/api/webhooks/graph` (valida
  `validationToken` e `clientState`); subscrição criada no arranque se `MS_*`
  estiver configurado e renovada de 24 em 24 h. **Em memória** — um reinício
  perde a referência (recria na próxima falha de renovação). Sem config, corre
  em modo local (sem Outlook).
- **Análise por IA** (`analiseIaService.js`, `/api/analise`): o Claude analisa o
  **volume de tickets por equipa** (= `categoria_ticket`) num laço agêntico com
  ferramentas **read-only e parametrizadas** (o modelo nunca escreve SQL). Há
  resposta completa e variante em *streaming* (SSE). Modelo por omissão em
  `ANTHROPIC_MODEL` (`claude-opus-4-8`); precisa de `ANTHROPIC_API_KEY` e do SDK.

## Segurança (estado actual)
- Login já usa **palavra-passe com hash bcrypt** (P0-1 essencialmente feito;
  falta, opcionalmente, SSO/Entra ID).
- `middleware/seguranca.js` oferece cabeçalhos de segurança e um rate-limiter
  por IP, **mas ainda não estão aplicados globalmente nem no login** — só o CSAT
  (não montado) os usa. Aplicar `cabecalhosSeguranca` no `server.js` e
  `limitadorPedidos` no `/api/auth/login` é um passo pendente (ver `MELHORIAS.md`).
- `JWT_SECRET` tem de ser trocado em produção; HTTPS obrigatório.

## Ao trabalhar neste repositório
- Explorar e **propor antes de implementar**; pedir confirmação em mudanças estruturais.
- Não comprometer segredos; `.env` está no `.gitignore`.
- Próximos passos priorizados: **`MELHORIAS.md`**.
