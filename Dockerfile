FROM node:22-alpine
WORKDIR /app
COPY . .
CMD ["sh", "-c", "node scripts/validate-data.js && node --test tests/*.test.js"]
