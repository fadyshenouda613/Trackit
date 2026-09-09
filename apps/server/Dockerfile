# The server, built from the repository root:
#
#   docker build -f apps/server/Dockerfile -t trackit-server .
#
# The context has to be the root because npm workspaces resolve from the
# root lockfile, and @trackit/shared is a workspace package the build
# bundles in. Only the server workspace is installed: the desktop's Electron
# and native modules never enter the image.

FROM node:22-alpine AS build
WORKDIR /repo
ENV ELECTRON_SKIP_BINARY_DOWNLOAD=1
COPY package.json package-lock.json ./
COPY apps/server/package.json apps/server/
COPY apps/desktop/package.json apps/desktop/
COPY packages/shared/package.json packages/shared/
RUN npm ci --workspace @trackit/server
COPY packages/shared packages/shared
COPY apps/server apps/server
RUN npm run build --workspace @trackit/server

FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /repo
ENV ELECTRON_SKIP_BINARY_DOWNLOAD=1
COPY package.json package-lock.json ./
COPY apps/server/package.json apps/server/
COPY apps/desktop/package.json apps/desktop/
COPY packages/shared/package.json packages/shared/
RUN npm ci --omit=dev --workspace @trackit/server && npm cache clean --force
COPY --from=build /repo/apps/server/dist apps/server/dist
COPY --from=build /repo/apps/server/drizzle apps/server/drizzle
WORKDIR /repo/apps/server
USER node
EXPOSE 4000
CMD ["node", "dist/index.js"]
