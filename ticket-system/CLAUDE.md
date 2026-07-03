# CLAUDE.md — Central de Tickets (SLA & Equipa)

Contexto persistente para o Claude Code (lido no início de cada sessão).
Detalhe completo em `README.md`; backlog priorizado em `MELHORIAS.md`;
histórico de decisões e validação em `HISTORICO.md`.

## O que é
App web que transforma o fluxo de emails de uma caixa partilhada do Outlook
(Office 365) em tickets, com triagem automática por categoria, SLA em horas
úteis, distribuição/bloqueio em tempo real e alertas. Alvo: 500–10 000
emails/dia, ~10 operadores divididos por categorias.

## Stack
- Backend: Node.js 20 + Express + Socket.io (**CommonJS**, sem TypeScript).
- BD: PostgreSQL 16 (driver `pg`, **SQL escrito à mão**).
- Frontend: React 18 + Vite + Tailwind 3 (JS + JSX, sem TypeScript).
- Integração: Microsoft Graph (app-only, `fetch` nativo, sem SDK).
- Docker: `docker compose up` sobe db+backend+frontend → http://localhost:8080.

## Comandos
- Tudo em Docker: `docker compose up` (app em :8080).
- Só BD (modo manual): `docker compose -f docker-compose.db.yml up -d`.
- Backend: `cd backend && npm install && npm run db:reset && npm run dev` (:4000).
- Frontend: `cd frontend && npm install && npm run dev` (:5173).
- Testes: `cd backend && TZ=Europe/Lisbon npm test`.
- BD: `npm run migrate` / `npm run seed` / `npm run db:reset` (no backend).

## Estrutura
- `backend/src/services/` — slaService, triageService, graphService, ticketService (lógica central).
- `backend/src/routes/` — auth, tickets, users, webhooks (Graph).
- `backend/src/models/` — userModel, ticketModel (SQL).
- `backend/src/db/` — migrations/001_init.sql, seeds/seed.sql.
- `backend/src/utils/feriados.js` — feriados PT (fixos + móveis).
- `frontend/src/pages/` — Login, Queue (operador), AdminDashboard (supervisor).
- `frontend/src/components/` — SlaTimer, TicketCard, TicketDetail, AlertasSla, Navbar.

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

## REGRAS DE NEGÓCIO — SLA (núcleo do sistema)
- Dias úteis: Segunda a Sexta.
- Janela: **09:30–19:00, CONTÍNUA** — a empresa não fecha ao almoço, logo o
  relógio do SLA NÃO pára às 13–14h (9,5 h úteis/dia).
- Feriados nacionais PT excluídos, **incluindo móveis** (Sexta-Feira Santa,
  Páscoa, Corpo de Deus — calculados em `utils/feriados.js`).
- Prazo: `sla_limite = data_rececao + 2 horas úteis`.
- O processo TEM de correr em **`TZ=Europe/Lisbon`** (a janela é hora local).
  Já definido nos compose e no `.env.example`.
- Qualquer alteração ao cálculo de SLA exige actualizar/expandir
  `backend/tests/sla.test.js` (7 casos, todos a passar).

## Subsistemas a conhecer
- **Triagem**: regras palavra-chave→categoria na tabela `regras_triagem`
  (configuráveis), com cache em memória. Omissão: `comercial`. Texto comparado
  sem acentos e em minúsculas.
- **Locking / tempo real**: assumir é **atómico** em SQL (só se `pendente`).
  Eventos por sala de categoria + sala `admins`. Libertação automática via
  heartbeat (cliente) + sweeper (30 s) quando `data_bloqueio` expira
  (`LOCK_RELEASE_MINUTES`, def. 5).
- **Alertas** (`AlertasSla.jsx`): 3 níveis — cartão laranja a <60 min; toast+som
  nos 30 min finais (1×/email); popup intermitente quando o SLA é ultrapassado
  (lista os emails em atraso).
- **Responder**: o detalhe do ticket envia a resposta via Graph (`reply`) e
  resolve. Em dev, tickets `mock-*` saltam o envio real.
- **Graph**: OAuth client-credentials; webhook em `/api/webhooks/graph` (valida
  `validationToken` e `clientState`); subscrição criada/renovada no arranque se
  `MS_*` estiver configurado. Sem config, corre em modo local (sem Outlook).

## Segurança (estado atual)
- Login **simplificado por email** (sem password), só para demonstração. Antes
  de produção: password (argon2/bcrypt) ou SSO/Entra ID, rate limiting, helmet,
  HTTPS. Ver `MELHORIAS.md` (P0).

## Ao trabalhar neste repositório
- Explorar e **propor antes de implementar**; pedir confirmação em mudanças estruturais.
- Não comprometer segredos; `.env` está no `.gitignore`.
- Próximos passos priorizados: **`MELHORIAS.md`**.
