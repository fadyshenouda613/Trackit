# The server, built from the repository root:
#
#   docker build -f apps/server/Dockerfile -t trackit-server .
#
# The context has to be the root because npm workspaces resolve from the
# root lockfile, and @trackit/shared is a workspace package the build
# bundles in. Only the server workspace is installed: the desktop's Electron
# never enters the image.
#
# --ignore-scripts, because nothing here needs a build step: argon2 ships
# prebuilt binaries (musl included) that node-gyp-build finds at require
# time. Without it npm runs its implicit `node-gyp rebuild` for every
# package with a binding.gyp, and better-sqlite3, which the desktop pins and
# drizzle-orm lists as an optional peer, reaches this tree through the
# shared lockfile and fails to compile on an image with no Python.

FROM node:22-alpine AS build
WORKDIR /repo
ENV ELECTRON_SKIP_BINARY_DOWNLOAD=1
COPY package.json package-lock.json ./
COPY apps/server/package.json apps/server/
COPY apps/desktop/package.json apps/desktop/
COPY packages/shared/package.json packages/shared/
RUN npm ci --ignore-scripts --workspace @trackit/server
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
RUN npm ci --ignore-scripts --omit=dev --workspace @trackit/server && npm cache clean --force
COPY --from=build /repo/apps/server/dist apps/server/dist
COPY --from=build /repo/apps/server/drizzle apps/server/drizzle
WORKDIR /repo/apps/server
USER node
EXPOSE 4000
CMD ["node", "dist/index.js"]
