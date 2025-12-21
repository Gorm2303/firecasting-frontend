FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .

RUN npm run build

FROM node:20-alpine
RUN npm i -g serve
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh
EXPOSE 3000
ENTRYPOINT ["/app/docker-entrypoint.sh"]
