FROM node:22-bookworm-slim AS build
WORKDIR /source
ENV NEXT_TELEMETRY_DISABLED=1 NODE_OPTIONS=--max-old-space-size=640
COPY . .
RUN node deploy/physics/stage.mjs /build
WORKDIR /build
RUN npm install --no-audit --no-fund
RUN npm run build

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3001 HOSTNAME=0.0.0.0 \
    PHYSICS_PYTHON=/opt/venv/bin/python PHYSICS_ROOT=/data/physics \
    PHYSICS_BANK_ROOT=/data/physics/question-bank PHYSICS_FAMILY_DB=/data/physics/_state/family/study.db
RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-venv poppler-utils \
    && rm -rf /var/lib/apt/lists/* && python3 -m venv /opt/venv
COPY physics-exam-papers/_scripts/requirements.txt /tmp/requirements.txt
RUN /opt/venv/bin/pip install --no-cache-dir -r /tmp/requirements.txt
COPY --from=build /build/.next/standalone ./
COPY --from=build /build/.next/static ./.next/static
COPY --from=build /build/public ./public
COPY physics-exam-papers/_scripts ./physics-exam-papers/_scripts
RUN mkdir -p /data/physics && chown node:node /data/physics
USER node
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s CMD node -e "fetch('http://127.0.0.1:3001/api/physics/bootstrap').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node","server.js"]
