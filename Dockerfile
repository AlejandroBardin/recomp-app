# Etapa 1: build del frontend
FROM node:20-alpine AS frontend
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend .
RUN npm run build

# Etapa 2: backend + frontend estático
FROM node:20-alpine
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm install --omit=dev
COPY backend .
COPY --from=frontend /app/frontend/dist /app/frontend/dist

ENV DB_PATH=/data/recomp.db
ENV PORT=3001
EXPOSE 3001
CMD ["node", "src/server.js"]
