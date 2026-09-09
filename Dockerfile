# Etapa 1: build del frontend
FROM node:20-alpine AS frontend
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend .
RUN npm run build

# Etapa 2: backend + frontend estático
FROM node:20-alpine

# La app razona en hora de Buenos Aires. Node lo resuelve solo (Intl trae sus
# propias zonas), pero SQLite pide la hora al sistema: sin tzdata, los
# `datetime('now','localtime')` de los DEFAULT quedarían en UTC y un registro
# de las 22 h figuraría creado al día siguiente.
RUN apk add --no-cache tzdata
ENV TZ=America/Argentina/Buenos_Aires

WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm install --omit=dev
COPY backend .
COPY --from=frontend /app/frontend/dist /app/frontend/dist

ENV DB_PATH=/data/recomp.db
ENV PORT=3001
EXPOSE 3001
CMD ["node", "src/server.js"]
