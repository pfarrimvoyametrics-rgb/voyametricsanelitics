# Integração com o Microsoft Graph (Office 365)

Guia de configuração da ligação à caixa de correio **partilhada** do Outlook
para captação de emails em tempo real (webhook), leitura e resposta.

A aplicação usa o fluxo **app-only (client credentials)** — sem utilizador
interactivo — pelo que precisa de permissões de **aplicação** com consentimento
de administrador.

---

## 1. Registo da aplicação no Azure AD (Microsoft Entra ID)

1. Portal do Azure → **Microsoft Entra ID** → **App registrations** → **New registration**.
2. Nome: `Central de Tickets` (ou outro). Conta: *Single tenant*. **Register**.
3. Em **Overview**, copie:
   - **Application (client) ID** → `MS_CLIENT_ID`
   - **Directory (tenant) ID** → `MS_TENANT_ID`
4. **Certificates & secrets** → **New client secret** → copie o **Value**
   (não o *Secret ID*) → `MS_CLIENT_SECRET`. Defina um prazo e agende a rotação.

## 2. Permissões de aplicação

**API permissions** → **Add a permission** → **Microsoft Graph** →
**Application permissions**:

| Permissão | Para quê |
|---|---|
| `Mail.Read` | Ler as mensagens da caixa partilhada |
| `Mail.Send` | Enviar as respostas (mantém a thread) |
| `Mail.ReadWrite` | *(opcional)* marcar como lido |

Depois, **Grant admin consent for <tenant>** (botão). Sem o consentimento de
administrador, o token não terá estas permissões.

> Subscrições de mensagens de caixas partilhadas exigem `Mail.Read` ao nível de
> **aplicação** — as permissões **delegadas** `Mail.Read.Shared` **não**
> suportam *change notifications*.

## 3. Restringir o acesso à caixa certa (Application Access Policy)

Por omissão, uma app com `Mail.Read` de aplicação acede a **todas** as caixas
do tenant. Restrinja-a à caixa partilhada com uma *Application Access Policy*
(Exchange Online PowerShell):

```powershell
# 1) Grupo de segurança com a(s) caixa(s) permitida(s) como membro(s)
New-DistributionGroup -Name "TicketsMailboxes" -Type Security
Add-DistributionGroupMember -Identity "TicketsMailboxes" -Member "suporte@empresa.pt"

# 2) Política que limita a app a esse grupo
New-ApplicationAccessPolicy -AppId "<MS_CLIENT_ID>" `
  -PolicyScopeGroupId "TicketsMailboxes" `
  -AccessRight RestrictAccess `
  -Description "Central de Tickets: apenas caixas de suporte"

# 3) Validar
Test-ApplicationAccessPolicy -Identity "suporte@empresa.pt" -AppId "<MS_CLIENT_ID>"
```

## 4. Variáveis de ambiente (`backend/.env`)

```
MS_TENANT_ID=...
MS_CLIENT_ID=...
MS_CLIENT_SECRET=...
MS_SHARED_MAILBOX=suporte@empresa.pt
MS_WEBHOOK_URL=https://o-seu-dominio.pt/api/webhooks/graph
MS_CLIENT_STATE=um-segredo-aleatorio-qualquer
GRAPH_CATCHUP=25
```

`MS_WEBHOOK_URL` tem de ser **pública e HTTPS**. Em desenvolvimento, use um
túnel:

```bash
ngrok http 4000
# usar o URL https://....ngrok.io/api/webhooks/graph em MS_WEBHOOK_URL
```

## 5. Arranque e subscrição

Com o `.env` preenchido, ao iniciar o backend (`npm run dev`) acontece:

1. **garantirSubscricao()** — reutiliza uma subscrição existente para esta
   caixa+URL (renovando-a) e remove duplicados; só cria nova se não houver.
   Isto evita a acumulação de subscrições a cada reinício.
2. **Catch-up de arranque** — lê as últimas `GRAPH_CATCHUP` mensagens da Inbox
   e cria os tickets em falta (idempotente por `outlook_message_id`), apanhando
   emails chegados enquanto o servidor esteve em baixo.
3. **Renovação automática** a cada 24 h (as subscrições de mensagens duram no
   máximo ~4230 min ≈ 3 dias).

Em alternativa, criar a subscrição manualmente: `npm run graph:subscribe`.

## 6. Validação e notificações

- **Validação:** ao criar a subscrição, a Graph faz `POST` com
  `?validationToken=...`; o `/api/webhooks/graph` devolve-o em texto simples
  (200). Vale tanto para a `notificationUrl` como para a `lifecycleNotificationUrl`.
- **Mensagens novas:** a Graph envia `value[]` com `resourceData.id`; validamos
  o `clientState`, respondemos **202** de imediato e processamos em segundo
  plano (triagem → SLA → gravação idempotente → tempo real), com concorrência
  limitada (`WEBHOOK_CONCORRENCIA`) e *retry/backoff* a 429/5xx (`GRAPH_TENTATIVAS`).
- **Ciclo de vida:** notificações com `lifecycleEvent` são tratadas
  automaticamente —
  `reauthorizationRequired`/`missed` renovam a subscrição;
  `subscriptionRemoved` recria-a. Sem isto, uma subscrição de longa duração
  pode morrer em silêncio.

## 7. Resolução de problemas

| Sintoma | Causa provável |
|---|---|
| `Falha ao criar subscrição (403)` | Falta consentimento de admin ou a Application Access Policy bloqueia a caixa |
| Validação falha ao criar subscrição | `MS_WEBHOOK_URL` não é pública/HTTPS ou o servidor não respondeu em <10 s |
| Recebe notificações mas `obterMensagem` dá 404 | `MS_SHARED_MAILBOX` errado, ou a policy não inclui essa caixa |
| Tickets duplicados | Não deve acontecer — a gravação é idempotente em `outlook_message_id` |
| Subscrição "desaparece" ao fim de dias | Lifecycle não chegava à app; confirmar `lifecycleNotificationUrl` acessível |
