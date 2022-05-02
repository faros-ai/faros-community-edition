FROM flyway/flyway:8.5.9 as faros-init
USER root
RUN apk --update --no-cache add bash curl jq nodejs npm postgresql-client
RUN adduser -S faros
RUN chown -R faros /flyway
USER faros
WORKDIR /home/faros
COPY init/.tsconfig.json init/package.json init/package-lock.json ./
COPY init/resources ./resources
COPY init/src ./src
RUN npm ci
COPY canonical-schema ./canonical-schema
COPY init/scripts ./scripts
WORKDIR /home/faros/scripts
ENTRYPOINT ["./entrypoint.sh"]
