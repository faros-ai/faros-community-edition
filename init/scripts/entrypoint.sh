#!/bin/sh

airbyte_url=$AIRBYTE_URL
airbyte_force_setup=$AIRBYTE_FORCE_SETUP
faros_dest_version=$FAROS_AIRBYTE_DESTINATION_VERSION
hasura_url=$HASURA_URL
metabase_url=$METABASE_URL
db_host=$FAROS_DB_HOST
db_port=$FAROS_DB_PORT

./wait-for.sh $db_host:$db_port -- ./db-init.sh
./wait-for.sh $airbyte_url/api/v1/health -t 60 -- node ../lib/airbyte/init $airbyte_url $faros_dest_version $airbyte_force_setup
./wait-for.sh $hasura_url/healthz -t 60 -- node ../lib/hasura/init $hasura_url
./wait-for.sh $metabase_url/api/health -t 60 -- ./metabase-init.sh

node ../lib/banner
