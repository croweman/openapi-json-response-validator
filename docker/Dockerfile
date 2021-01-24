FROM node:14.15.1-alpine3.12 as base

WORKDIR /app

COPY .npmrc index.js package.json package-lock.json ./

RUN npm install --production

CMD [ "node", "./index.js"]