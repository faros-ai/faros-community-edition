#!/bin/sh

airbyte_url=$AIRBYTE_URL
airbyte_force_setup=$AIRBYTE_FORCE_SETUP
airbyte_api_calls_concurrency=$AIRBYTE_API_CALLS_CONCURRENCY
hasura_admin_secret=$HASURA_GRAPHQL_ADMIN_SECRET
hasura_database_url=$HASURA_DATABASE_URL
hasura_url=$HASURA_URL
metabase_url=$METABASE_URL
db_host=$FAROS_DB_HOST
db_port=$FAROS_DB_PORT

./wait-for/wait-for.sh "$db_host":"$db_port" -- ./db-init.sh

airbyte_optional_args=""

if [ "${airbyte_force_setup}" = "true" ]; then
    airbyte_optional_args="--force-setup"
fi

if ! [ -z "${airbyte_api_calls_concurrency}" ]; then
    airbyte_optional_args="${airbyte_optional_args} --airbyte-api-calls-concurrency ${airbyte_api_calls_concurrency}"
fi

./wait-for/wait-for.sh "$airbyte_url"/api/v1/health -t 60 -- node ../lib/airbyte/init --airbyte-url "$airbyte_url" ${airbyte_optional_args}

hasura_optional_args=""

if ! [ -z "${hasura_database_url}" ]; then
    hasura_optional_args="--database-url ${hasura_database_url}"
fi

./wait-for/wait-for.sh "$hasura_url"/healthz -t 60 -- node ../lib/hasura/init --hasura-url "$hasura_url" --admin-secret "$hasura_admin_secret" ${hasura_optional_args}
./wait-for/wait-for.sh "$metabase_url"/api/health -t 60 -- ./metabase-init.sh

node ../lib/banner
