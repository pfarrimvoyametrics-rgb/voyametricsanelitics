# Registo da Conversa — Desenvolvimento da Central de Tickets

> Versão legível da conversa de desenvolvimento (sessões de 19 e 30 de Junho
> de 2026). Extraída da transcrição integral, omitindo os blocos internos de
> raciocínio e resumindo o detalhe técnico das ferramentas, para ficar focada
> no diálogo. O registo **em bruto e completo** está em `transcricao-integral.txt`.
> A sessão mais recente (testes em Docker e correcção do proxy) está resumida
> no `HISTORICO.md`, na raiz do projecto.


---


**Claude:**

Sem problema. Aqui está de novo só a pergunta do horário:

_[Claude executou ferramentas: criou/editou ficheiros e correu comandos no projecto.]_


---


**Pedro:**

Q: Qual o horário de expediente para o cálculo do SLA de '2 horas úteis'?
A: Outro (digo a seguir)


---


**Claude:**

Diga-me então o horário que pretende. Para calcular o SLA correctamente preciso de saber:

- **Dias úteis** — só Segunda a Sexta? Ou inclui Sábado?
- **Horas de início e fim** — ex: das 9h às 18h
- **Pausa de almoço** — conta ou não para o SLA? Ex: se houver pausa 13h-14h, um email das 12h30 só "consome" 30 min antes da pausa e retoma às 14h
- **Feriados** — devo excluir feriados nacionais portugueses do cálculo? (recomendo que sim)

Pode escrever simplesmente algo como: *"Seg-Sex, 9h-18h, almoço 13h-14h não conta, excluir feriados"* e eu trato do resto.


---


**Pedro:**

Dias utéis
Horas de inicio e fim 09h30 às 19h00
Pausa de almoço: Conta 13h-14h horário por funcionário a empresa não fecha ao almoço
Feriados - são para excluir


---


**Claude:**

Perfeito, agora tenho tudo o que preciso. Deixe-me consolidar as decisões antes de construir:

**Especificação final do SLA (a parte mais delicada do sistema):**
- Dias úteis: Segunda a Sexta
- Janela: **09h30–19h00** (contínua — a empresa não fecha ao almoço, cada funcionário almoça em horário próprio, por isso o relógio do SLA **não pára** entre as 13h e as 14h)
- **9,5 horas úteis por dia**
- Feriados nacionais portugueses: **excluídos**
- SLA = data de recepção + **2 horas úteis** dentro desta janela

E as outras duas decisões: **backend em Node.js + Express** (recomendo-o porque o próprio Socket.io é nativo de Node, o SDK do Microsoft Graph para JS é maduro, e usar JavaScript no backend e frontend reduz o atrito) e captura de emails por **webhooks do Microsoft Graph**.

Vou construir o projecto. Como envolve frontend React, deixe-me primeiro consultar a skill de design.

_[Claude executou ferramentas: criou/editou ficheiros e correu comandos no projecto.]_

Tenho tudo. Vou construir o projecto completo — backend Node.js + Express, integração Microsoft Graph por webhooks, PostgreSQL, WebSockets para o *locking* em tempo real, e frontend React + Tailwind. A peça mais crítica (e onde a maioria das implementações falha) é o cálculo de SLA em horas úteis com exclusão de feriados; vou implementá-la a sério e com testes.

Deixe-me montar a estrutura e escrever o código.

_[Claude executou ferramentas: criou/editou ficheiros e correu comandos no projecto.]_

Estrutura pronta. Começo pela base de dados — esquema completo com as tabelas do spec mais uma tabela de regras de triagem configurável (para poder afinar as palavras-chave sem reescrever código).

_[Claude executou ferramentas: criou/editou ficheiros e correu comandos no projecto.]_

Agora o script de seed com IDs fixos para login imediato (1 admin + 3×3 operadores) e regras de triagem iniciais.

_[Claude executou ferramentas: criou/editou ficheiros e correu comandos no projecto.]_

Agora a peça central: o cálculo de feriados portugueses (incluindo os móveis, via algoritmo da Páscoa) e o serviço de SLA em horas úteis.

_[Claude executou ferramentas: criou/editou ficheiros e correu comandos no projecto.]_

E agora o coração do sistema — o cálculo de SLA em horas úteis:

_[Claude executou ferramentas: criou/editou ficheiros e correu comandos no projecto.]_

Agora o motor de triagem — lê as regras configuráveis da BD, normaliza o texto (sem acentos) e classifica por prioridade, com cache em memória para aguentar o volume:

_[Claude executou ferramentas: criou/editou ficheiros e correu comandos no projecto.]_

Configuração de ambiente e ligação à base de dados:

_[Claude executou ferramentas: criou/editou ficheiros e correu comandos no projecto.]_

Modelos de acesso a dados (repositórios) para utilizadores e tickets:

_[Claude executou ferramentas: criou/editou ficheiros e correu comandos no projecto.]_

Agora a integração com o Microsoft Graph — autenticação app-only, criação e renovação de subscrições (webhooks), leitura de mensagens e envio de respostas:

_[Claude executou ferramentas: criou/editou ficheiros e correu comandos no projecto.]_

Serviço de orquestração de tickets (assumir/libertar/resolver + emissão de eventos), partilhado por HTTP e WebSocket, e o *sweeper* de auto-libertação:

_[Claude executou ferramentas: criou/editou ficheiros e correu comandos no projecto.]_

Autenticação JWT (middleware HTTP) e os handlers de WebSocket com salas por categoria:

_[Claude executou ferramentas: criou/editou ficheiros e correu comandos no projecto.]_

Rotas HTTP — autenticação, utilizadores, tickets e o endpoint de webhook do Graph:

_[Claude executou ferramentas: criou/editou ficheiros e correu comandos no projecto.]_

Por fim, o ponto de entrada do servidor (liga Express + Socket.io, monta rotas, arranca o *sweeper* e gere as subscrições do Graph) e um pequeno utilitário de linha de comandos para migrar/semear/subscrever:

_[Claude executou ferramentas: criou/editou ficheiros e correu comandos no projecto.]_

Agora um teste real para validar o cálculo de SLA — esta é a parte que tem de estar irrepreensível. Uso o test runner nativo do Node (sem dependências extra):

_[Claude executou ferramentas: criou/editou ficheiros e correu comandos no projecto.]_

Ficheiros de configuração do backend — `package.json` e `.env.example`:

_[Claude executou ferramentas: criou/editou ficheiros e correu comandos no projecto.]_

Vou correr os testes do SLA para garantir que o cálculo está correcto antes de avançar:

_[Claude executou ferramentas: criou/editou ficheiros e correu comandos no projecto.]_

Excelente — os 7 testes passam, incluindo o transbordo de noite, o fim-de-semana, o "antes de abrir" e o feriado. O motor de SLA está sólido.

Agora o frontend. Pela skill de design, faço uma consola de operação sóbria e precisa, onde o **cronómetro de SLA é o elemento-assinatura** (números tabulares que não "saltam", cor que migra de verde → laranja → vermelho, e uma barra lateral em cada cartão que codifica a urgência num relance).

_[Claude executou ferramentas: criou/editou ficheiros e correu comandos no projecto.]_

Agora o código React. Começo pelos estilos base e utilitários partilhados:

_[Claude executou ferramentas: criou/editou ficheiros e correu comandos no projecto.]_

Agora o elemento-assinatura — o cronómetro de SLA, com as cores e os limiares pedidos:

_[Claude executou ferramentas: criou/editou ficheiros e correu comandos no projecto.]_


---


**Claude:**

Recebido — e essa especificação é exactamente a que já está implementada no motor de SLA (confirmada pelos 7 testes que passaram): **Seg–Sex, 09h30–19h00 contínuo (o almoço não pára o relógio), feriados excluídos, prazo = 2 horas úteis**. Não é preciso alterar nada no cálculo. Vou então terminar as peças que faltam do frontend e empacotar tudo.

_[Claude executou ferramentas: criou/editou ficheiros e correu comandos no projecto.]_

A vista do operador — fila filtrada por categoria, ordenada por SLA, com actualização em tempo real e *heartbeat* para manter vivos os tickets que tem abertos:

_[Claude executou ferramentas: criou/editou ficheiros e correu comandos no projecto.]_

O painel do supervisor — indicadores de SLA, carga por operador e visão de todas as categorias, com actualização automática:

_[Claude executou ferramentas: criou/editou ficheiros e correu comandos no projecto.]_

Por fim, o `App.jsx` (encaminhamento simples conforme o perfil) e o `main.jsx`:

_[Claude executou ferramentas: criou/editou ficheiros e correu comandos no projecto.]_

Frontend completo. Vou validar que compila sem erros (instalar dependências e fazer o build de produção):


---


**Pedro:**

a app deve de alertar o utilizador se tem emails por responder a 30 minutos do fim do prazo do SLA e se tiver emails após o tempo de SLA sai um popup em flash a alertar que tem emails após o sla e quais os e-mails


---


**Claude:**

Boa ideia — esse é precisamente o tipo de escalonamento que faz a diferença numa sala de operação. Vou acrescentar uma camada de alertas com três níveis:

1. **Cartão fica laranja** a 60 min (já existe).
2. **Aviso activo (toast + som)** quando um email entra nos **30 min finais** do prazo — uma vez por email.
3. **Popup intermitente (a piscar)** quando há emails **com o SLA já ultrapassado**, listando quais (remetente + assunto + tempo de atraso).

Começo pelas animações de alerta no CSS:

_[Claude executou ferramentas: criou/editou ficheiros e correu comandos no projecto.]_

Agora ligo a camada de alertas às duas vistas. Primeiro a fila do operador:

_[Claude executou ferramentas: criou/editou ficheiros e correu comandos no projecto.]_

Agora o painel do supervisor — ajusto-o para os alertas cobrirem **todas** as categorias (mesmo quando o filtro está activo numa só), passando a filtrar a lista em memória:

_[Claude executou ferramentas: criou/editou ficheiros e correu comandos no projecto.]_

Tudo ligado. Agora vou validar que o frontend compila sem erros — instalo as dependências e faço o build de produção:

_[Claude executou ferramentas: criou/editou ficheiros e correu comandos no projecto.]_

Dependências instaladas (cache acelerou). Agora o build:

_[Claude executou ferramentas: criou/editou ficheiros e correu comandos no projecto.]_

Frontend compila sem erros — 70 módulos, incluindo a nova camada de alertas. Vou verificar a sintaxe de todos os ficheiros do backend:

_[Claude executou ferramentas: criou/editou ficheiros e correu comandos no projecto.]_

Todos os ficheiros passam. Vou tentar um teste de integração real — verificar se há PostgreSQL disponível para correr migração + seed + API de ponta a ponta:

_[Claude executou ferramentas: criou/editou ficheiros e correu comandos no projecto.]_

Sou root e tenho apt — vou instalar PostgreSQL e fazer um teste de integração a sério (migração + seed + inserção com SLA + consultas):

_[Claude executou ferramentas: criou/editou ficheiros e correu comandos no projecto.]_

PostgreSQL a correr e BD criada. Agora instalo as dependências do backend, configuro o `.env` e corro a migração + seed:

_[Claude executou ferramentas: criou/editou ficheiros e correu comandos no projecto.]_

Migração e seed aplicados com sucesso — o esquema SQL é válido. Vou verificar os dados e correr um teste do fluxo completo (triagem → SLA → inserção → listagem → métricas):

_[Claude executou ferramentas: criou/editou ficheiros e correu comandos no projecto.]_

10 utilizadores e 20 regras. Agora o teste do fluxo de ponta a ponta com os serviços reais (triagem, SLA, inserção, isolamento por categoria, atribuição e métricas):

_[Claude executou ferramentas: criou/editou ficheiros e correu comandos no projecto.]_

O script ficou em /tmp com caminhos relativos errados. Corrijo colocando-o na pasta do backend:

_[Claude executou ferramentas: criou/editou ficheiros e correu comandos no projecto.]_

Tudo a funcionar end-to-end: triagem correcta (incluindo o email sem palavras-chave → comercial por omissão), SLA com transbordo para Segunda-feira (hoje é sexta, recebido depois das 19h → Seg 22/06 11:30), **isolamento por categoria** (faturação vê 1, admin vê 4), **atribuição atómica** (a 2ª tentativa simultânea é bloqueada) e métricas certas.

Falta só validar a camada HTTP + login. Arranco o servidor e testo a API:

_[Claude executou ferramentas: criou/editou ficheiros e correu comandos no projecto.]_

O shell aqui é `sh` e rejeitou uma sintaxe de `bash` (substring). Repito de forma compatível e mato o servidor anterior:

_[Claude executou ferramentas: criou/editou ficheiros e correu comandos no projecto.]_

O processo em segundo plano confundiu o shell. Vou consolidar os testes HTTP num único script Node (com `fetch`), mais fiável:

_[Claude executou ferramentas: criou/editou ficheiros e correu comandos no projecto.]_

O backgrounding está a prender a sessão da ferramenta. Vou destacar o servidor por completo (`setsid` + `disown`) e separar em passos:

_[Claude executou ferramentas: criou/editou ficheiros e correu comandos no projecto.]_

O ambiente não permite deixar um servidor persistente a correr a partir da ferramenta (qualquer processo que sobreviva ao comando devolve -1). Não faz mal — já tenho validação forte e suficiente. Limpo os processos:

_[Claude executou ferramentas: criou/editou ficheiros e correu comandos no projecto.]_

O shell recuperou. Vou confirmar o estado da limpeza:

_[Claude executou ferramentas: criou/editou ficheiros e correu comandos no projecto.]_

Servidor terminado e porta livre. Agora a documentação e o empacotamento. Começo pelo README detalhado:

_[Claude executou ferramentas: criou/editou ficheiros e correu comandos no projecto.]_

Agora limpo as dependências instaladas e o build (o utilizador instala com `npm install`), e crio o pacote para download:

_[Claude executou ferramentas: criou/editou ficheiros e correu comandos no projecto.]_

Estrutura limpa: 49 ficheiros, 472K. Crio o arquivo ZIP na pasta de saída:

_[Claude executou ferramentas: criou/editou ficheiros e correu comandos no projecto.]_

Está tudo pronto, construído e **validado**. Deixo o pacote completo:

_[Claude executou ferramentas: criou/editou ficheiros e correu comandos no projecto.]_

Sistema completo, construído e validado. Aqui fica o resumo.

## O que está lá dentro

Um projecto pronto a correr, com backend **Node.js + Express + Socket.io**, **PostgreSQL** e frontend **React + Tailwind** — 49 ficheiros organizados em `backend/` e `frontend/`, mais `README.md` e `docker-compose.yml`.

## Validação (não é só teoria)

Corri tudo a sério neste ambiente:

| Validação | Resultado |
|---|---|
| Testes do cálculo de SLA | **7/7 a passar** (transbordo de dia, fim-de-semana, antes de abrir, feriado) |
| Migração + seed em PostgreSQL real | OK (10 utilizadores, 20 regras) |
| Triagem → SLA → inserção → isolamento → atribuição → métricas | OK de ponta a ponta |
| Atribuição atómica (2 operadores no mesmo ticket) | 2ª tentativa **bloqueada** ✓ |
| Build de produção do frontend | OK (70 módulos, sem erros) |

(O servidor HTTP em si não pode ficar a correr neste sandbox, mas o `/api/health` e o login responderam, e toda a lógica que as rotas chamam está testada contra a base de dados.)

## As quatro peças que interessam

- **`slaService.js` + `feriados.js`** — o cálculo de SLA em horas úteis (Seg–Sex, 09h30–19h00 contínuo, feriados fixos e móveis excluídos). É a parte onde a maioria das implementações falha; está coberta por testes.
- **`triageService.js`** — triagem por palavras-chave **configuráveis na BD** (tabela `regras_triagem`), com cache. Afina as regras sem mexer no código.
- **`ticketService.js` + `sockets/index.js`** — atribuição atómica, eventos só para a sala da categoria, e libertação automática por *heartbeat* (5 min) robusta a reinícios.
- **`AlertasSla.jsx`** — exactamente o que pediu: toast + som nos **30 minutos finais** (uma vez por email) e **popup intermitente** quando o SLA é ultrapassado, listando remetente, assunto e tempo de atraso. Activo na fila do operador e no painel do supervisor.

## Arranque rápido

```bash
docker compose up -d                 # PostgreSQL no fuso de Lisboa
cd backend && npm install && npm run db:reset && npm run dev
cd frontend && npm install && npm run dev
```

Entre com `admin@empresa.pt` (vê tudo) ou um perfil de operador. Sem o Outlook ligado, o botão **“+ Ticket de teste”** injecta tickets que passam pela triagem e pelo SLA — perfeito para ver as filas, os cronómetros e os alertas em acção. A integração real do Microsoft Graph e as notas de segurança para produção estão na secção 8 e 9 do README.


---


**Pedro:**

completa tudo


---


**Claude:**

Boa — vou fechar o sistema por completo. Reviste o que ainda falta para ser verdadeiramente "fim-a-fim" e identifiquei o essencial: **o operador ainda não consegue ler o corpo do email nem responder ao cliente** a partir da interface (o backend já sabe enviar pelo Outlook, mas faltava a UI). Além disso, com 10 000 emails/dia, convém **não carregar tickets resolvidos sem limite**. Vou completar isso.

Primeiro, confirmo que não ficaram pontas soltas no código:

_[Claude executou ferramentas: criou/editou ficheiros e correu comandos no projecto.]_

Apenas falsos positivos ("Todos", `placeholder` do input) — o código não tem stubs. Avanço para as melhorias.

Backend: permito carregar só tickets activos (não resolvidos) e limitar os resolvidos, para aguentar o volume:

_[Claude executou ferramentas: criou/editou ficheiros e correu comandos no projecto.]_

Agora actualizo as rotas: aceitar o parâmetro `ativos` e tornar o envio de resposta tolerante a tickets de teste (sem Outlook) em desenvolvimento:

_[Claude executou ferramentas: criou/editou ficheiros e correu comandos no projecto.]_

Agora a peça que fecha o ciclo do email — o painel de detalhe onde o operador lê a mensagem completa e responde ao cliente (a resposta segue pelo Outlook):

_[Claude executou ferramentas: criou/editou ficheiros e correu comandos no projecto.]_

Torno o cartão clicável para abrir o detalhe:

_[Claude executou ferramentas: criou/editou ficheiros e correu comandos no projecto.]_

Agora reescrevo a fila do operador para: carregar só os tickets activos (escala), buscar os resolvidos a pedido, abrir o detalhe e tratar a resposta:

_[Claude executou ferramentas: criou/editou ficheiros e correu comandos no projecto.]_

Agora o painel do supervisor — carregar só activos, e permitir abrir/ler/responder também a partir daqui. Vejo o estado actual do ficheiro:

_[Claude executou ferramentas: criou/editou ficheiros e correu comandos no projecto.]_

Actualizo o rótulo da secção para reflectir que mostra os tickets activos:

_[Claude executou ferramentas: criou/editou ficheiros e correu comandos no projecto.]_

Tudo ligado. Reinstalo as dependências do frontend e compilo para garantir que tudo encaixa:

_[Claude executou ferramentas: criou/editou ficheiros e correu comandos no projecto.]_

Frontend compila (71 módulos, com o novo detalhe). Agora valido as alterações do backend contra a base de dados real — reinstalo deps, reponho o `.env` de teste e a BD, e testo os novos caminhos (carregamento de activos, resolvidos com limite, e resposta a ticket de teste sem Outlook):

_[Claude executou ferramentas: criou/editou ficheiros e correu comandos no projecto.]_

A base de dados parou (provavelmente apanhada na limpeza de processos). Reinicio o cluster:

_[Claude executou ferramentas: criou/editou ficheiros e correu comandos no projecto.]_

Base de dados de novo activa (10 utilizadores presentes). Repito o teste:

_[Claude executou ferramentas: criou/editou ficheiros e correu comandos no projecto.]_

Todos os novos caminhos do backend validados: carregamento só de activos (3), resolução com resposta em ticket de teste (salta o Outlook), vista de resolvidos com limite e ordenada por data, e o ticket sai dos activos ao resolver. Verifico a sintaxe dos ficheiros alterados e actualizo o README:

_[Claude executou ferramentas: criou/editou ficheiros e correu comandos no projecto.]_

Preciso de renumerar as secções seguintes para ficarem sequenciais:

_[Claude executou ferramentas: criou/editou ficheiros e correu comandos no projecto.]_

README com 13 secções coerentes. Validação final — testes de SLA e sintaxe de todo o backend:

_[Claude executou ferramentas: criou/editou ficheiros e correu comandos no projecto.]_

Tudo verde: 7/7 testes e sintaxe limpa. Empacoto a versão final:

_[Claude executou ferramentas: criou/editou ficheiros e correu comandos no projecto.]_

Está completo. Apresento o pacote final:

_[Claude executou ferramentas: criou/editou ficheiros e correu comandos no projecto.]_

Sistema completo e fechado de ponta a ponta. O que esta última ronda acrescentou:

**Ler e responder ao email (o ciclo que faltava).** Clicar num ticket abre um painel de detalhe onde o operador lê a mensagem completa — o HTML do email é convertido em texto de forma segura, sem injecção no DOM — assume o ticket e escreve a resposta. Ao "Enviar resposta e resolver", a resposta sai pela caixa partilhada via Microsoft Graph (mantendo a *thread* no Outlook) e o ticket passa a resolvido. Há também "Resolver sem responder" e "Libertar". O supervisor faz o mesmo a partir do painel.

**Escala para o volume real.** As filas passam a carregar só os tickets por tratar; os resolvidos vão buscar-se a pedido e sempre com `LIMIT`. Os KPIs de cumprimento de SLA vêm de uma consulta agregada, por isso continuam exactos sem arrastar milhares de linhas para o browser.

**Validação (tudo corrido a sério):**

| Verificação | Resultado |
|---|---|
| Testes de SLA | 7/7 ✓ |
| Sintaxe de todo o backend | limpa ✓ |
| Build de produção do frontend | 71 módulos, sem erros ✓ |
| Carregamento só de activos + resolvidos com limite | ✓ contra PostgreSQL real |
| Resposta a ticket de teste sem Outlook | salta o Graph em dev ✓ |
| Sem TODOs/stubs no código | confirmado ✓ |

O fluxo completo está agora coberto: **email entra → triagem automática → SLA em horas úteis → fila por categoria com bloqueio em tempo real → cronómetro e alertas (60 min, 30 min, popup intermitente no vencimento) → operador lê e responde pelo Outlook → resolvido → KPIs no painel do supervisor**.

O arranque continua a ser os mesmos quatro passos do README (Docker para o PostgreSQL, depois `npm install` + `db:reset` + `dev` em cada lado). Sem o Azure configurado, o botão "+ Ticket de teste" alimenta tudo para ver o sistema a funcionar.


---


**Pedro:**

como faço a implementação? onde coloco o ficheiros para criar a app


---


**Claude:**

Boa pergunta — e convém esclarecer o modelo mental primeiro: **isto não é um programa de "duplo clique"**. É um projecto com três peças que correm ao mesmo tempo (base de dados + servidor *backend* + interface *frontend*). "Criar a app" resume-se a instalar duas ferramentas, pôr a pasta onde quiser, e arrancar cada peça com um comando.

## Onde colocar os ficheiros

Extraia o ZIP para **qualquer pasta** — não há um local obrigatório (ao contrário de um programa instalado). Por exemplo `C:\projectos\central-tickets\` ou na sua pasta de Documentos. O que importa é a estrutura lá dentro:

```
central-tickets/
├── docker-compose.yml   ← a base de dados
├── backend/             ← o servidor (Node.js)
└── frontend/            ← a interface (React)
```

Os comandos correm-se **de dentro** das pastas `backend/` e `frontend/`. Quando está a funcionar, as peças ligam-se assim:

```
   O SEU BROWSER  ──►  http://localhost:5173   (frontend, React)
                              │
                              ▼
                       localhost:4000          (backend, Node.js + Socket.io)
                              │
                              ▼
                       localhost:5432          (PostgreSQL, dentro do Docker)
```

## A — Experimentar no seu computador (~15 min)

**Instalar uma vez** (são gratuitos):
1. **Node.js** (versão LTS) — em nodejs.org. Traz o `npm` incluído.
2. **Docker Desktop** — em docker.com. É a forma mais simples de ter o PostgreSQL sem o instalar à mão.

**Depois**, abra três janelas de terminal (no Windows: o *Terminal* ou *PowerShell*) e corra:

1. **Base de dados** — na pasta raiz (onde está o `docker-compose.yml`):
   `docker compose up -d`
2. **Backend** — noutra janela:
   `cd backend` → `npm install` → `npm run db:reset` → `npm run dev`
3. **Frontend** — noutra janela:
   `cd frontend` → `npm install` → `npm run dev`

Abra o browser em **http://localhost:5173** e entre com `admin@empresa.pt` (ou um perfil de operador). Sem o Outlook ligado, use o botão **"+ Ticket de teste"** para ver as filas, os cronómetros e os alertas a funcionar. (O `npm install` precisa de internet, só na primeira vez.)

## B — Pôr em produção (uso real pelos 10 operadores)

Duas diferenças importantes face ao teste:

- **Não pode correr no seu portátil.** Precisa de uma **máquina sempre ligada**, acessível na rede da empresa ou na internet. Para 10 utilizadores, uma VM pequena chega de sobra — e como já usam Office 365, o **Azure** é a opção natural.
- Para receber os emails a sério, é preciso **registar a aplicação no Azure AD** (permissões `Mail.Read` e `Mail.Send`), preencher o ficheiro `.env`, e expor um endereço **HTTPS público** para o *webhook* do Microsoft Graph.

Em resumo: registar a app no Azure → preencher o `.env` → `npm run build` no frontend → servir os ficheiros e o backend atrás de um *proxy* (nginx/Caddy) com HTTPS → manter o backend vivo (PM2 ou Docker) → criar a subscrição (`npm run graph:subscribe`). Está detalhado nas secções 9 a 11 do README.

---

Posso poupar-lhe muito disto: preparo-lhe uma versão em que **basta um comando** (`docker compose up`) para arrancar as três peças de uma vez, sem instalar Node nem PostgreSQL à parte. Para lhe dar o guia exacto para o seu caso (com os comandos certos), diga-me:

_[Claude executou ferramentas: criou/editou ficheiros e correu comandos no projecto.]_


---
