FROM node:22-bookworm-slim
WORKDIR /app
ENV PLAYWRIGHT_BROWSERS_PATH=/opt/playwright
COPY package.json package-lock.json ./
RUN npm ci \
    && npx playwright install --with-deps chromium \
    && apt-get update && apt-get install -y --no-install-recommends gosu tini \
    && rm -rf /var/lib/apt/lists/*
COPY tsconfig.json vite.config.ts index.html ./
COPY src ./src
COPY public ./public
COPY server ./server
COPY shared ./shared
COPY examples ./examples
COPY demo ./demo
RUN npm run build
COPY deploy/entrypoint.sh /usr/local/bin/accessfix-entrypoint
RUN chmod 755 /usr/local/bin/accessfix-entrypoint
ENV NODE_ENV=production ACCESSFIX_MODE=hosted HOST=0.0.0.0 PORT=3001 ACCESSFIX_DATA_DIR=/var/data/accessfix
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["tini", "--", "accessfix-entrypoint"]
CMD ["node", "--import", "tsx", "server/index.ts"]
