# Contentor do servidor (Node.js)
FROM node:20-alpine
WORKDIR /app

# Em modo de teste/desenvolvimento (mock-tickets activos; Graph opcional).
ENV NODE_ENV=development

# Instalar dependências primeiro (aproveita a cache do Docker).
ENV NPM_CONFIG_UPDATE_NOTIFIER=false NPM_CONFIG_FUND=false NPM_CONFIG_AUDIT=false
# Atrás de um proxy que intercepta TLS (rede corporativa)? Ver docker-compose.yml.
ARG NPM_STRICT_SSL=true
COPY package*.json ./
RUN npm config set strict-ssl ${NPM_STRICT_SSL} && npm ci --omit=dev --no-audit --no-fund

# Copiar o resto do código.
COPY . .

EXPOSE 4000

# Ao arrancar: aplicar esquema + seed e iniciar o servidor.
# (migrate e seed são idempotentes — seguro repetir em reinícios.)
CMD ["sh", "-c", "node src/cli.js migrate && node src/cli.js seed && node src/server.js"]
