# UNVERIFIED: no Docker daemon was available when this was written. Build and scan it in CI before use.
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src/lib/queue ./src/lib/queue
COPY worker ./worker
RUN npx esbuild worker/src/index.ts --bundle --platform=node --format=esm --target=node20 --packages=external --outfile=dist/worker/index.mjs

FROM node:22-bookworm-slim
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist/worker/index.mjs ./index.mjs
USER node
EXPOSE 8080
ENV WORKER_HOST=0.0.0.0 WORKER_PORT=8080
HEALTHCHECK --interval=30s --timeout=3s CMD node -e "fetch('http://127.0.0.1:8080/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "index.mjs"]
