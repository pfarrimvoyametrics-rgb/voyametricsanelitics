# Contentor do servidor (Node.js)
FROM node:20-alpine
WORKDIR /app

# Em modo de teste/desenvolvimento (mock-tickets activos; Graph opcional).
ENV NODE_ENV=development

# Instalar dependências primeiro (aproveita a cache do Docker).
COPY package*.json ./
RUN npm install

# Copiar o resto do código.
COPY . .

EXPOSE 4000

# Ao arrancar: aplicar esquema + seed e iniciar o servidor.
# (migrate e seed são idempotentes — seguro repetir em reinícios.)
CMD ["sh", "-c", "node src/cli.js migrate && node src/cli.js seed && node src/server.js"]
