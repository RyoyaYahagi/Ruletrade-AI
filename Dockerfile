# Ruletrade-AI を自分のPCで試すためのコンテナ定義
# データは SQLite ファイルに保存されるため、compose.yaml 側で
# /app/.data をボリュームに割り当てて永続化する。

FROM node:24-bookworm AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# better-sqlite3 のネイティブビルドに備えてビルド工具を入れる
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/* \
  && npm ci

FROM node:24-bookworm AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:24-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV RULETRADE_DATABASE_PATH=.data/ruletrade-mvp.sqlite

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.ts ./next.config.ts

RUN mkdir -p .data
EXPOSE 3000
CMD ["npm", "run", "start", "--", "-p", "3000", "-H", "0.0.0.0"]
