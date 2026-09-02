FROM node:20-alpine AS base
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --ignore-scripts || npm install
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=base /app/package.json ./package.json
COPY --from=base /app/.next ./.next
COPY --from=base /app/public ./public
COPY --from=base /app/prisma ./prisma
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/next.config.js ./next.config.js
EXPOSE 3000
CMD ["npm", "start"]
