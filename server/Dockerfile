FROM node:20-slim
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

COPY src ./src

ENV NODE_ENV=production \
    DATA_DIR=/data \
    PORT=3000

VOLUME /data
EXPOSE 3000

CMD ["node", "src/index.js"]
