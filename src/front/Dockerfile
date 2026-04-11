FROM node:20-alpine

WORKDIR /app
COPY package*.json ./
RUN npm install

# Copiamos el resto del código
COPY . .

# Recibimos las variables de Auth0
ARG PUBLIC_AUTH0_DOMAIN_MGN
ARG PUBLIC_AUTH0_CLIENT_ID_MGN
ENV PUBLIC_AUTH0_DOMAIN_MGN=$PUBLIC_AUTH0_DOMAIN_MGN
ENV PUBLIC_AUTH0_CLIENT_ID_MGN=$PUBLIC_AUTH0_CLIENT_ID_MGN

# Compilamos la aplicación
RUN npm run build

# Exponemos el puerto 80 (el mismo que usábamos con Nginx)
EXPOSE 80

# Configuramos Svelte para que escuche hacia afuera en el puerto 80
ENV HOST=0.0.0.0
ENV PORT=80

# Arrancamos el servidor compilado de Node
CMD ["node", "build/index.js"]