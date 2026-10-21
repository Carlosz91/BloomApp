# ==========================
# BLOOMAPP - Dockerfile (Backend)
# ==========================
# node:26 full image (Debian). The backend uses node-postgres (pg),
# a pure-JS driver: no native bindings or special libc required.
FROM node:26

WORKDIR /app

# Dependencies first (Docker layer cache).
COPY package*.json ./

RUN npm install --no-audit --no-fund

# Fail the build early if the pg driver cannot be loaded,
# instead of crashing later at runtime with an unclear error.
RUN node -e "const {Pool}=require('pg'); new Pool(); console.log('OK: pg loaded')"

# Copy the backend source
COPY src/ ./src/

EXPOSE 3000

CMD ["node", "src/server.js"]
