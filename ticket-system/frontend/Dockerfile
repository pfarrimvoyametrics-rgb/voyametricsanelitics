# 1) Construir a aplicação React
FROM node:20-alpine AS build
WORKDIR /app
ENV NPM_CONFIG_UPDATE_NOTIFIER=false NPM_CONFIG_FUND=false NPM_CONFIG_AUDIT=false
# Atrás de um proxy que intercepta TLS (ex.: rede corporativa)? Construa com:
#   NPM_STRICT_SSL=false docker compose up --build
ARG NPM_STRICT_SSL=true
COPY package*.json ./
RUN npm config set strict-ssl ${NPM_STRICT_SSL} && npm ci --no-audit --no-fund
COPY . .
RUN npm run build

# 2) Servir os ficheiros estáticos com nginx (+ proxy para o backend)
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
