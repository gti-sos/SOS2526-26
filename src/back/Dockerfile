# Usamos una imagen ligera de Node
FROM node:18-alpine

# Directorio de trabajo
WORKDIR /app

# Copiamos archivos de dependencias
COPY package*.json ./

# Instalamos dependencias
RUN npm install

# Copiamos el resto del código
COPY . .

# Exponemos el puerto que usa tu API (ej: 3000)
EXPOSE 3000

# Comando para arrancar
CMD ["node", "index.js"]