FROM flyway/flyway:8.5.10 as faros-init
USER root
RUN apt-get update && apt-get --assume-yes install bash curl jq nodejs npm postgresql-client
RUN adduser --system faros
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
