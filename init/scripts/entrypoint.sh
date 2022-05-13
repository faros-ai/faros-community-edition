#!/bin/bash

airbyte_url=$AIRBYTE_URL
airbyte_force_setup=$AIRBYTE_FORCE_SETUP
airbyte_api_calls_concurrency=$AIRBYTE_API_CALLS_CONCURRENCY
airbyte_destination_hasura_url=$AIRBYTE_DESTINATION_HASURA_URL
hasura_admin_secret=$HASURA_GRAPHQL_ADMIN_SECRET
hasura_database_url=$HASURA_GRAPHQL_DATABASE_URL
hasura_url=$HASURA_URL
metabase_url=$METABASE_URL
db_host=$FAROS_DB_HOST
db_port=$FAROS_DB_PORT

# Prints a failure message and exits if the last command
# executed failed (i.e., its exit code was not 0).
function fail() {
    if [ $? -ne 0 ] ; then
        echo "$1"
        exit 1
    fi
}

./wait-for/wait-for.sh "$db_host":"$db_port"
fail "Timed out waiting for DB."

 ./db-init.sh
 fail "DB initialization failed."

airbyte_optional_args=()

if [ "${airbyte_force_setup}" = "true" ]; then
    airbyte_optional_args=(--force-setup)
fi

if [ -n "${airbyte_api_calls_concurrency}" ]; then
    airbyte_optional_args=("${airbyte_optional_args[@]}" --airbyte-api-calls-concurrency "${airbyte_api_calls_concurrency}")
fi

./wait-for/wait-for.sh "$airbyte_url"/api/v1/health -t 60
fail "Timed out waiting for Airbyte."

node ../lib/airbyte/init --airbyte-url "$airbyte_url" --airbyte-destination-hasura-url "$airbyte_destination_hasura_url" --hasura-admin-secret "$hasura_admin_secret" "${airbyte_optional_args[@]}"
fail "Airbyte initialization failed."

hasura_optional_args=()

if [ -n "${hasura_database_url}" ]; then
    hasura_optional_args=("${hasura_optional_args[@]}" --database-url "${hasura_database_url}")
fi

./wait-for/wait-for.sh "$hasura_url"/healthz -t 60
fail "Timed out waiting for Hasura."

node ../lib/hasura/init --hasura-url "$hasura_url" --admin-secret "$hasura_admin_secret" "${hasura_optional_args[@]}"
fail "Hasura initialization failed."

./wait-for/wait-for.sh "$metabase_url"/api/health -t 60
fail "Timed out waiting for Metabase."

./metabase-init.sh
fail "Metabase initialization failed."

node ../lib/banner
