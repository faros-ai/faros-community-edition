FROM node:16-alpine

WORKDIR /home/node/cli

COPY .tsconfig.json package.json package-lock.json ./
COPY src ./src
COPY bin ./bin
RUN npm ci

ENTRYPOINT ["/home/node/cli/bin/main"]
