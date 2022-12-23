#!/bin/bash

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
