FROM flyway/flyway:8.5.10 as faros-init
USER root
RUN apt-get update -yq \
  && apt-get install -yq bash curl gnupg jq npm postgresql-client netcat wget
RUN curl -sL https://deb.nodesource.com/setup_17.x | bash && apt-get install -yq nodejs && apt-get clean
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
