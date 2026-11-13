FROM node:22-bookworm-slim
RUN apt-get update \
 && apt-get install -y --no-install-recommends chromium fonts-dejavu-core ca-certificates \
 && rm -rf /var/lib/apt/lists/*
ENV CHROME_PATH=/usr/bin/chromium
WORKDIR /audit
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY run.mjs thresholds.json ./
# The site is mounted read-only at /site; reports go to /audit/out.
CMD ["node", "run.mjs"]
