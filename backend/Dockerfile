# Build context = repo root (monorepo). Render field: Dockerfile Path = backend/Dockerfile,
# Root Directory left blank — see README's "Deploying the backend (Render)" section.
FROM node:22-slim AS base
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app/backend

COPY backend/package.json backend/package-lock.json ./
RUN npm ci

COPY backend/ ./
RUN npx prisma generate
RUN npm run build

ENV NODE_ENV=production
EXPOSE 4000
CMD ["node", "dist/index.js"]
