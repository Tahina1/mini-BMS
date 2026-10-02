FROM node:20-alpine
WORKDIR /app
# package.json ET package-lock.json, même astuce de cache qu'en Python
COPY package*.json ./
# installe les dépendances DANS l'image (pas celles de ta machine)
RUN npm install --omit=dev
COPY . .
CMD ["node", "index.js"]