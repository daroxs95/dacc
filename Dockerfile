FROM node:22-alpine AS build
RUN apk add --no-cache python3 make g++
WORKDIR /repo/apps/dacc
COPY apps/dacc/package*.json ./
RUN npm ci
COPY apps/dacc/ ./
COPY decss/ /repo/decss/
RUN npm run build

FROM node:22-alpine
WORKDIR /repo/apps/dacc
COPY --from=build /repo/apps/dacc/ ./
ENV NODE_ENV=production
ENV DATABASE_PATH=/data/dacc.sqlite
RUN mkdir /data && chown node:node /data
USER node
EXPOSE 3000
CMD ["npm", "start"]
