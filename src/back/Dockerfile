FROM node:18-alpine

WORKDIR /app

# Copiamos el package.json que está en la raíz
COPY package.json ./

# Instalamos las dependencias
RUN npm install

# Copiamos todo lo de la raíz (incluyendo index.js y la carpeta src)
COPY . .

# Exponemos el puerto
EXPOSE 3000

# El comando para arrancar, asumiendo que index.js está en la raíz
CMD ["node", "index.js"]