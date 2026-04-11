# --- ETAPA 1: Construcción ---
FROM node:20-alpine AS build-stage
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

# 1. Declaramos que vamos a recibir estos argumentos desde fuera
ARG PUBLIC_AUTH0_DOMAIN_MGN
ARG PUBLIC_AUTH0_CLIENT_ID_MGN

# 2. Los convertimos en variables de entorno para que Svelte/Vite los use al compilar
ENV PUBLIC_AUTH0_DOMAIN_MGN=$PUBLIC_AUTH0_DOMAIN_MGN
ENV PUBLIC_AUTH0_CLIENT_ID_MGN=$PUBLIC_AUTH0_CLIENT_ID_MGN
RUN npm run build

# --- ETAPA 2: Producción ---
# Usamos Nginx para servir el contenido estático de Svelte
FROM nginx:stable-alpine
# Copiamos los archivos construidos desde la etapa anterior
# Nota: Asegúrate de que tu build de Svelte genere la carpeta 'build' o 'dist'
COPY --from=build-stage /app/build /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]