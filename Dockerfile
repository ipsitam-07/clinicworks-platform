FROM node:20-alpine AS web-build
WORKDIR /app/apps/web
COPY apps/web/package*.json ./
RUN npm ci
COPY apps/web ./
RUN npm run build

FROM node:20-alpine AS api-build
WORKDIR /app/apps/api
COPY apps/api/package*.json ./
RUN npm ci
COPY apps/api ./
RUN npm run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY apps/api/package*.json ./
RUN npm ci --omit=dev
COPY --from=api-build /app/apps/api/dist ./dist
COPY --from=web-build /app/apps/web/dist ./public

EXPOSE 3000
CMD ["node", "dist/server.js"]
