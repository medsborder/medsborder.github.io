FROM node:22-alpine
WORKDIR /build
RUN npm install --no-audit --no-fund --no-save esbuild@0.25.10
COPY build.mjs .
WORKDIR /work
ENTRYPOINT ["node", "/build/build.mjs"]
