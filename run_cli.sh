#!/bin/bash

RUNNING=$(docker compose ps -q --status=running | wc -l)
    if [ "$RUNNING" -lt 1 ]; then
        printf "Faros CE is not running. \n"
        printf "Use ./start.sh to start Faros. \n"
        exit 1
    fi

docker pull farosai.docker.scarf.sh/farosai/faros-ce-cli:latest
AIRBYTE_URL=$(grep "^WEBAPP_URL" .env | sed 's/^WEBAPP_URL=//')
METABASE_PORT=$(grep "^METABASE_PORT" .env | sed 's/^METABASE_PORT=//')
METABASE_USER=$(grep "^METABASE_USER" .env | sed 's/^METABASE_USER=//')
METABASE_PASSWORD=$(grep "^METABASE_PASSWORD" .env | sed 's/^METABASE_PASSWORD=//')
docker run --network host -it farosai.docker.scarf.sh/farosai/faros-ce-cli pick-source --airbyte-url "$AIRBYTE_URL" \
    --metabase-url "http://localhost:$METABASE_PORT" \
    --metabase-username "$METABASE_USER" \
    --metabase-password "$METABASE_PASSWORD"

exit
