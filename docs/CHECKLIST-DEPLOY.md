# Checklist — Teste local e Deploy

Guia prático para (A) testar a app sem ligação ao email e (B) colocar em produção.

---

## A. Ambiente de teste (sem Outlook/Graph)

A app funciona sem o Microsoft Graph — basta a base de dados. Os relatórios
ganham vida com os dados de demonstração.

1. **Base de dados** (Docker):
   ```bash
   docker compose up -d        # PostgreSQL no fuso de Lisboa
   ```
2. **Backend**:
   ```bash
   cd backend
   cp .env.example .env        # NÃO preencher MS_* -> modo local, sem Graph
   npm install
   npm run db:reset            # aplica migrações (001, 002, 003) + seed
   npm run demo                # ~400 tickets de demonstração (ou: npm run demo 800)
   npm run dev                 # http://localhost:4000
   ```
3. **Frontend** (noutro terminal):
   ```bash
   cd frontend
   npm install
   npm run dev                 # http://localhost:5173
   ```
4. **Entrar e testar**:
   - `admin@empresa.pt` → separador **Relatórios**: experimentar períodos, âmbito
     (cliente / operador / equipa), **Excel** e **PDF**.
   - `carlos.fatura@empresa.pt` (operador) → fila, assumir, **resolver marcando
     venda** (ganho/perdido + valor) para alimentar a conversão.
   - Botão **"+ Ticket de teste"** (na fila, só em dev) injecta tickets ao vivo.
5. **Limpar a demonstração** quando quiser: `npm run demo:clear`.

> Checklist de teste: login (admin e operador) · fila em tempo real (abrir 2
> separadores) · assumir/libertar/resolver · alertas de SLA (30 min / vencido)
> · Relatórios com filtros · exportação Excel · exportação PDF (capa de marca).

---

## B. Pré-produção (antes de ir para o ar)

- [ ] `NODE_ENV=production` no `.env`.
- [ ] `JWT_SECRET` longo e aleatório (≥32 caracteres) — **o arranque é bloqueado** se for fraco.
- [ ] `DATABASE_URL` da base de dados de produção (utilizador dedicado, não o `ticket/ticket` de teste).
- [ ] `CLIENT_URL` = domínio público do frontend (para o CORS e o Socket.io).
- [ ] `TZ=Europe/Lisbon` no processo do backend (o SLA depende disto).
- [ ] Microsoft Graph configurado (ver `docs/INTEGRACAO-GRAPH.md`): `MS_*`, consentimento de admin e Application Access Policy.
- [ ] `MS_WEBHOOK_URL` aponta para o domínio público HTTPS real (`/api/webhooks/graph`).
- [ ] Migrações aplicadas em produção: `npm run migrate`.
- [ ] Seed de utilizadores reais (substituir os perfis de demonstração) e **não** correr `demo` em produção.
- [ ] Autenticação reforçada: idealmente SSO/Entra ID ou palavra-passe (o login por email é só para demonstração).
- [ ] Backups automáticos da base de dados.

---

## C. Opção 1 — Caddy + Docker (simples, HTTPS automático)

Caddy trata do certificado TLS e do reverse-proxy (incluindo o upgrade de
WebSocket, necessário para o tempo real).

`Caddyfile`:
```
tickets.suaempresa.pt {
    encode gzip
    # Frontend (build estático do Vite em frontend/dist)
    handle /assets/* { root * /var/www/tickets; file_server }
    handle / { root * /var/www/tickets; file_server }
    # API + WebSocket -> backend
    handle /api/* { reverse_proxy 127.0.0.1:4000 }
    handle /socket.io/* { reverse_proxy 127.0.0.1:4000 }
}
```

Passos:
1. `cd frontend && npm run build` → publicar `frontend/dist` em `/var/www/tickets`.
2. Correr o backend (PM2, systemd ou Docker) com o `.env` de produção e `TZ=Europe/Lisbon`.
3. `caddy run` (ou serviço) — HTTPS é emitido automaticamente.
4. Confirmar `https://tickets.suaempresa.pt/api/health` responde `{ ok: true }`.

---

## D. Opção 2 — Azure App Service

1. **PostgreSQL**: Azure Database for PostgreSQL Flexible Server.
2. **Backend**: App Service (Node 18+). Definir as variáveis de ambiente (`Application settings`)
   iguais ao `.env`, incluindo `WEBSITES_PORT=4000` e `TZ=Europe/Lisbon`.
   Garantir **Web Sockets: On** (Configuration → General settings) para o Socket.io.
3. **Frontend**: build do Vite publicado em Azure Static Web Apps (ou no mesmo App Service).
   Apontar o proxy/origem de `/api` e `/socket.io` para o backend.
4. **HTTPS** é fornecido pela plataforma; usar esse domínio em `MS_WEBHOOK_URL` e `CLIENT_URL`.
5. Aplicar migrações (`npm run migrate`) ligado à base de dados de produção.

---

## E. Pós-deploy (smoke test)

- [ ] `/api/health` OK.
- [ ] Login funciona; o tempo real liga (indicador "Em direto").
- [ ] Enviar um email de teste para a caixa partilhada → aparece um ticket em segundos.
- [ ] Resolver com resposta → a resposta chega ao remetente pelo Outlook (thread mantida).
- [ ] Relatórios geram e exportam (Excel/PDF).
- [ ] Reiniciar o backend → **não** se acumulam subscrições no Graph (reaproveita a existente) e o catch-up apanha emails da paragem.
