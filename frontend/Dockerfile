# ==========================================
# Etapa 1: Compilación de la aplicación Angular
# ==========================================
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ==========================================
# Etapa 2: Servidor Nginx ligero para producción
# ==========================================
FROM nginx:1.27-alpine

# Copiar configuración Nginx optimizada para Cloud Run
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copiar bundle compilado de Angular (SPA)
COPY --from=builder /app/dist/frontend/browser /usr/share/nginx/html

# Puerto de Google Cloud Run
EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
