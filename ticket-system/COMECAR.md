# Começar aqui — testar em 3 passos

Não precisa de instalar Node nem PostgreSQL. Só o **Docker**.

### 1. Instalar o Docker Desktop
Descarregue e instale: https://www.docker.com/products/docker-desktop/
- No **Windows**, aceite a instalação do *WSL2* se for pedida (e reinicie se necessário).
- Abra o Docker Desktop uma vez e espere que diga **“Engine running”**.

### 2. Arrancar a aplicação
Extraia este ZIP para uma pasta à sua escolha. Dentro dessa pasta (a que contém
o ficheiro `docker-compose.yml`), abra um terminal e escreva:

```
docker compose up
```

> Como abrir um terminal nessa pasta:
> - **Windows:** abra a pasta no Explorador, clique na barra de endereço, escreva `cmd` e Enter.
> - **Mac:** abra a aplicação *Terminal*, escreva `cd ` (com espaço), arraste a pasta para a janela e Enter.

Da **primeira vez** demora alguns minutos (descarrega e constrói tudo). Quando
vir as linhas a estabilizar, está pronto.

### 3. Abrir no browser
Vá a: **http://localhost:8080**

Entre com **`admin@empresa.pt`** (vê tudo) ou um operador, p. ex.
`sofia.suporte@empresa.pt`. Carregue em **“+ Ticket de teste”** para criar emails
de exemplo e ver as filas, os cronómetros de SLA e os alertas a funcionar.

---

**Parar:** carregue `Ctrl + C` no terminal, ou corra `docker compose down`.
**Recomeçar mais tarde:** `docker compose up` (já não terá de construir tudo de novo).

> **Rede corporativa com *proxy*?** Se o `docker compose up` falhar a instalar
> dependências com um erro de certificado (`SELF_SIGNED_CERT_IN_CHAIN`), é
> porque a rede da empresa intercepta o TLS. Nesse caso, arranque assim:
>
>     NPM_STRICT_SSL=false docker compose up --build
>
> No Windows PowerShell: `$env:NPM_STRICT_SSL="false"; docker compose up --build`

Quer ligar à caixa de email real do Outlook e pôr em produção? Veja o
**README.md**, secções 10 (Microsoft Graph) e 11 (Segurança).
