# ==========================
# BLOOMAPP - Dockerfile (Backend)
# ==========================
# node:26 full image (Debian, glibc).
# better-sqlite3 is a native module built for glibc; alpine (musl)
# causes SIGSEGV (ExitCode 139) at runtime.
FROM node:26

WORKDIR /app

# Dependencies first (Docker layer cache).
# The allowScripts field in package.json authorizes better-sqlite3's
# install script (node-gyp rebuild), which compiles the Linux binding.
COPY package*.json ./

RUN npm install --no-audit --no-fund

# Fail the build early if the native binding is missing or broken,
# instead of crashing later at runtime with an unclear error.
RUN node -e "const db = require('better-sqlite3')(':memory:'); db.exec('CREATE TABLE t (x INTEGER)'); console.log('OK: better-sqlite3 binding loaded')"

# Copy the backend source
COPY src/ ./src/

EXPOSE 3000

CMD ["node", "src/server.js"]
