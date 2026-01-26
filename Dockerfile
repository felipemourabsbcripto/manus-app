# Estágio de Build
FROM node:20-alpine AS builder

WORKDIR /app

# Instalar dependências (usando install para evitar erro de lockfile)
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
