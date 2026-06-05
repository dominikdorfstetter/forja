FROM node:24-slim AS build

WORKDIR /app

# Build local libs (dist/ is gitignored, must be built in Docker)
COPY libs/analytics/ /libs/analytics/
WORKDIR /libs/analytics
RUN npm ci && npm run build

COPY libs/client/ /libs/client/
WORKDIR /libs/client
RUN npm ci && npm run build

COPY libs/sections/ /libs/sections/
WORKDIR /libs/sections
RUN npm ci && npm run build

# Copy template source and install dependencies
WORKDIR /app
COPY templates/astro-blog/package.json ./

# Rewrite file: dependency paths for the container layout
RUN sed -i 's|file:../../libs/analytics|file:/libs/analytics|' package.json \
 && sed -i 's|file:../../libs/client|file:/libs/client|' package.json \
 && sed -i 's|file:../../libs/sections|file:/libs/sections|' package.json
RUN npm install

COPY templates/astro-blog/ ./
RUN npm run build

# --- Production stage ---
FROM node:24-slim

RUN groupadd --system forja && useradd --system --gid forja forja

WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=4321

# Copy built output and production dependencies
COPY --from=build --chown=forja:forja /app/dist ./dist
COPY --from=build --chown=forja:forja /app/node_modules ./node_modules

USER forja

EXPOSE 4321

CMD ["node", "./dist/server/entry.mjs"]
