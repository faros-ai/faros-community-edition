FROM flyway/flyway:8.5.10 as faros-init
USER root
RUN curl -fsSL https://deb.nodesource.com/setup_17.x | bash -
RUN apt-get update \
  && apt-get -y install jq nodejs postgresql-client netcat wget \
  && apt-get clean
USER flyway
RUN mkdir -p /flyway/faros
WORKDIR /flyway/faros
COPY init/.tsconfig.json init/package.json init/package-lock.json ./
COPY init/resources ./resources
COPY init/src ./src
RUN npm ci
COPY canonical-schema ./canonical-schema
COPY init/scripts ./scripts
WORKDIR /flyway/faros/scripts
ENTRYPOINT ["./entrypoint.sh"]
