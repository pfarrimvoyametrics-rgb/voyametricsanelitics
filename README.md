# Central de Tickets · Gestão de SLA e Distribuição de Equipa

Sistema web para transformar o fluxo de emails de uma caixa partilhada do
**Microsoft Outlook (Office 365)** em tickets, com **triagem automática por
categoria**, **cálculo de SLA em horas úteis**, **distribuição/bloqueio em tempo
real** entre operadores e **alertas visuais e sonoros** quando os prazos se
aproximam ou são ultrapassados.

Preparado para o volume indicado (500 a 10 000 emails/dia) e ~10 operadores em
simultâneo, repartidos por categorias.

---

## 1. Arquitectura

```
                      ┌───────────────────────────┐
   Office 365         │     Microsoft Graph        │
  (caixa partilhada)  │  (subscrição / webhook)    │
                      └────────────┬──────────────┘
                                   │ notificação "novo email"
                                   ▼
   ┌──────────────────────────────────────────────────────────────┐
   │                    BACKEND  (Node.js + Express)                │
   │                                                                │
   │   webhookRoutes ─► graphService.obterMensagem()                │
   │        │                                                       │
   │        ├─► triageService  (regras configuráveis -> categoria)  │
   │        ├─► slaService      (data_rececao + 2 h ÚTEIS)          │
   │        └─► ticketModel.criar()  ──►  PostgreSQL                 │
   │                                   │                            │
   │   ticketService  ──── emite ─────►│  Socket.io (salas/categoria)│
   │   sweeper (libertação auto.)      │                            │
   └───────────────────────────────────┼────────────────────────────┘
                                        │ WebSocket (tempo real)
                                        ▼
   ┌──────────────────────────────────────────────────────────────┐
   │                  FRONTEND  (React + Tailwind)                  │
   │   Operador: a sua fila, ordenada por SLA + cronómetro + alertas │
   │   Supervisor: KPIs de SLA, carga por operador, todas as filas  │
   └──────────────────────────────────────────────────────────────┘
```

**Porquê Node.js?** O Socket.io (pedido no enunciado) é nativo de Node, o
acesso à Graph faz-se com `fetch` sem SDKs pesados, e usar JavaScript no backend
e no frontend reduz o atrito. Captura de email por **webhook** (e não *polling*),
para escalar sem desperdício.

---

## 2. Componentes principais

| Camada | Ficheiro(s) | Responsabilidade |
|---|---|---|
| **SLA** | `services/slaService.js`, `utils/feriados.js` | Cálculo do prazo em horas úteis, com feriados (fixos e móveis). |
| **Triagem** | `services/triageService.js`, tabela `regras_triagem` | Classifica o email numa categoria por palavras-chave configuráveis. |
| **Graph** | `services/graphService.js`, `routes/webhookRoutes.js` | Autenticação app-only, subscrições, leitura e envio de emails. |
| **Tempo real / Locking** | `services/ticketService.js`, `sockets/index.js` | Atribuição atómica, eventos por categoria, libertação automática. |
| **API REST** | `routes/*.js` | Login, fila, ações sobre tickets, métricas. |
| **Dados** | `db/migrations/001_init.sql`, `db/seeds/seed.sql` | Esquema, índices, dados iniciais. |
| **Frontend** | `frontend/src/**` | Login, fila do operador, painel do supervisor, alertas. |

---

## 3. O cálculo de SLA (horas úteis)

Esta é a regra mais sensível do sistema e está implementada e **testada**
(`backend/tests/sla.test.js`, 7 casos).

- **Dias úteis:** Segunda a Sexta.
- **Janela:** **09h30 → 19h00, contínua.** A empresa não fecha ao almoço (cada
  funcionário almoça em horário próprio), por isso o relógio do SLA **não pára**
  entre as 13h e as 14h → **9,5 horas úteis por dia**.
- **Feriados nacionais** portugueses são **excluídos**, incluindo os móveis
  (Sexta-Feira Santa, Páscoa e Corpo de Deus), calculados pelo algoritmo da
  Páscoa — não há tabelas a manter.
- **Prazo:** `sla_limite = data_rececao + 2 horas úteis`.

Exemplos validados nos testes:

| Email recebido | Prazo (SLA) |
|---|---|
| Segunda 10:00 | Segunda 12:00 |
| Segunda 18:00 | Terça 10:30 *(1 h hoje + 1 h amanhã)* |
| Sexta 18:30 | Segunda 11:00 *(transbordo de fim-de-semana)* |
| Sábado 14:00 | Segunda 11:30 |
| Véspera às 08:00 | mesmo dia 11:30 *(conta a partir das 09:30)* |
| Feriado 10 Jun | dia útil seguinte 11:30 |

> **Importante:** o processo deve correr em **`TZ=Europe/Lisbon`** (a janela é
> hora local). Está definido no `.env.example` e no `docker-compose.yml`.

---

## 4. Triagem automática (configurável)

Em vez de palavras-chave fixas no código, a triagem lê regras da tabela
`regras_triagem` (palavra-chave → categoria, com prioridade e campo-alvo). Assim
o gestor afina a classificação **sem alterar código**. As regras são lidas para
memória com *cache* de 60 s para aguentar o volume. Categoria por omissão quando
nada casa: `comercial` (configurável).

Texto comparado sem acentos e em minúsculas (ex.: "Factura" e "fatura" casam).

---

## 5. Tempo real e bloqueio (locking)

- Quando um operador **assume** um ticket, a operação é **atómica** em SQL (só
  funciona se ainda estiver `pendente`), eliminando a corrida entre dois cliques
  simultâneos.
- O evento de bloqueio é difundido **apenas à sala da categoria** (e aos
  administradores), pelo que os operadores só veem o que lhes diz respeito.
- **Libertação automática:** enquanto o operador tem o ticket aberto, o cliente
  envia *batimentos* (heartbeats) que mantêm o bloqueio vivo. Se fechar a página,
  os batimentos param e um *sweeper* devolve o ticket a `pendente` ao fim de
  **5 minutos** (configurável). Como se baseia no estado persistido
  (`data_bloqueio`), é robusto a reinícios do servidor.

---

## 6. Alertas de SLA (frontend)

Três níveis de escalonamento, na fila do operador e no painel do supervisor:

1. **Cartão fica laranja** quando falta menos de 1 hora.
2. **Aviso activo** (toast no canto + som curto) quando um email entra nos
   **30 minutos finais** do prazo — uma vez por email.
3. **Popup intermitente** (a piscar, com som) quando há emails com o **SLA já
   ultrapassado**, listando **quais** (remetente + assunto + tempo de atraso).
   Pode silenciar-se e dispensar-se; reaparece se surgir um novo email vencido.

Acessibilidade: respeita `prefers-reduced-motion` (sem animação, mantendo o
destaque visual) e os cronómetros usam algarismos tabulares (não "saltam").

---

## 7. Atender e responder ao email

Clicar num ticket abre o **detalhe**: o operador lê a mensagem completa (o HTML
do email é convertido em texto de forma segura, sem injecção no DOM), assume o
ticket e escreve a resposta. Ao **“Enviar resposta e resolver”**, a resposta
segue pela caixa partilhada via Microsoft Graph (`messages/{id}/reply`,
mantendo a *thread* no Outlook) e o ticket passa a `resolvido`. Há também
**“Resolver sem responder”** e **“Libertar”**. O supervisor pode fazer o mesmo a
partir do painel.

> Em desenvolvimento, os tickets de teste (`mock-*`) não existem no Outlook, por
> isso o envio real é saltado — o fluxo de resposta funciona na mesma para
> demonstração.

## 8. Escala para volumes elevados

Para aguentar o volume indicado, as filas carregam por omissão apenas os tickets
**por tratar** (não resolvidos) — a carga de trabalho corrente. Os resolvidos só
são pedidos quando se abre esse separador, e sempre com **LIMIT** (os mais
recentes primeiro). Os totais de resolvidos e a taxa de cumprimento vêm de uma
consulta **agregada** dedicada, pelo que os KPIs continuam exactos sem trazer
milhares de linhas para o browser. As regras de triagem usam *cache* em memória
e os índices cobrem os acessos críticos (fila por categoria+estado ordenada por
SLA, carga por operador, bloqueios expirados).

## 9. Como executar

### Opção A — Tudo em Docker, um único comando (recomendado)

Só precisa do **Docker Desktop** instalado. Na pasta do projecto (onde está o
`docker-compose.yml`):

```bash
docker compose up
```

Da primeira vez demora alguns minutos (descarrega e constrói as imagens).
Depois abra **http://localhost:8080**. Para parar: `Ctrl+C`, ou `docker compose down`.

### Opção B — À mão, com Node (para desenvolvimento/personalização)

Sobe apenas a base de dados em Docker e corre o backend/frontend localmente:

```bash
docker compose -f docker-compose.db.yml up -d   # só a base de dados
```
```bash
cd backend
cp .env.example .env        # (opcional) preencher MS_* para a integração real (ver §10)
npm install
npm run db:reset            # aplica migrações + seed
npm run dev                 # http://localhost:4000
```
```bash
cd frontend
npm install
npm run dev                 # http://localhost:5173
```

### Opção C — PostgreSQL próprio

Crie a base de dados e o utilizador, aponte `DATABASE_URL` no `.env` e corra
`npm run db:reset` no backend. O resto é igual à Opção B.

### Perfis de entrada (seed)

Login simplificado por email. Atalhos no ecrã de entrada:

| Email | Papel |
|---|---|
| `admin@empresa.pt` | Administrador (vê tudo) |
| `sofia.suporte@empresa.pt` | Operador · Suporte Técnico |
| `carlos.fatura@empresa.pt` | Operador · Faturação |
| `ines.comercial@empresa.pt` | Operador · Comercial |

> **Sem o Outlook configurado?** Em desenvolvimento, o botão **“+ Ticket de
> teste”** (na fila) injecta tickets fictícios que passam pela triagem e pelo
> cálculo de SLA — ideal para ver as filas, os cronómetros e os alertas a
> funcionar.

---

## 10. Integração com o Microsoft Graph

1. Registe uma aplicação no **Azure AD**.
2. Permissões de **aplicação** (com consentimento de administrador):
   `Mail.Read`, `Mail.Send` (e `Mail.ReadWrite` se quiser marcar como lido).
3. Preencha no `.env`: `MS_TENANT_ID`, `MS_CLIENT_ID`, `MS_CLIENT_SECRET`,
   `MS_SHARED_MAILBOX` (a caixa partilhada) e `MS_WEBHOOK_URL` (uma **URL pública
   HTTPS**; em desenvolvimento use um túnel, p. ex. ngrok, a apontar para
   `/api/webhooks/graph`).
4. Crie a subscrição: `npm run graph:subscribe` (ou deixe o servidor criá-la no
   arranque quando a configuração estiver completa). A renovação é automática.

---

## 11. Segurança (notas para produção)

O login é **simplificado** por email, conforme pedido para a demonstração. Antes
de produção, recomenda-se:

- Autenticação com **palavra-passe** (hash com bcrypt/argon2) ou, de preferência,
  **SSO/Entra ID** (a empresa já usa Office 365).
- `JWT_SECRET` longo e aleatório; HTTPS obrigatório; *rate limiting* no login.
- Validação adicional da origem das notificações do Graph (já validamos o
  `clientState`).

---

## 12. Modelo de dados (resumo)

- **`usuarios`** — operadores e administradores; cada um tem uma `categoria` e
  uma `funcao` (`operador`/`admin`).
- **`tickets`** — um por email; guarda `data_rececao`, `sla_limite`, `status`
  (`pendente`/`em_andamento`/`resolvido`), `categoria_ticket`, o operador
  atribuído e `data_bloqueio` (para o locking).
- **`regras_triagem`** — regras palavra-chave → categoria (configuráveis).

Índices pensados para os acessos reais: fila por categoria+estado ordenada por
SLA, carga por operador, e detecção de bloqueios expirados.

---

## 13. Testes

```bash
cd backend
TZ=Europe/Lisbon npm test     # 12 testes: cálculo de SLA + normalização da triagem
```
