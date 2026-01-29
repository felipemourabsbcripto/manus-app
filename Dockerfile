# Estágio de Build
FROM node:20-alpine AS builder

WORKDIR /app

# Instalar dependências de compilação para better-sqlite3
RUN apk add --no-cache python3 make g++ 

# Pular download do Chrome (não usado em produção)
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

# Instalar dependências
COPY package*.json ./
RUN npm install

# Copiar código fonte
COPY . .

# Build do Frontend (Vite)
RUN npm run build

# ---

# Estágio de Produção
FROM node:20-alpine

WORKDIR /app

# Instalar dependências de compilação para better-sqlite3
RUN apk add --no-cache python3 make g++

# Pular download do Chrome
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

# Instalar dependências de produção
COPY package*.json ./
RUN npm install --production

# Copiar server e banco de dados
COPY server ./server
# Copiar build do frontend
COPY --from=builder /app/dist ./dist

# Copiar .env se existir (opcional)
# COPY .env ./

# Variáveis de Ambiente
ENV NODE_ENV=production
ENV PORT=3000

# Porta
EXPOSE 3000

# Inicialização
CMD ["node", "server/index.js"]
