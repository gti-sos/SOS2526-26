# --- ETAPA 1: Construcción ---
FROM node:18-alpine AS build-stage
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# --- ETAPA 2: Producción ---
# Usamos Nginx para servir el contenido estático de Svelte
FROM nginx:stable-alpine
# Copiamos los archivos construidos desde la etapa anterior
# Nota: Asegúrate de que tu build de Svelte genere la carpeta 'build' o 'dist'
COPY --from=build-stage /app/build /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]