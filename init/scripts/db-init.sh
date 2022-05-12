#!/bin/bash

set -eo pipefail

faros_db_name=${FAROS_DB_NAME}
faros_db_host=${FAROS_DB_HOST}
faros_db_port=${FAROS_DB_PORT}
faros_db_user=${FAROS_DB_USER}
faros_db_pass=${FAROS_DB_PASSWORD}

cfg_db_host=${FAROS_CONFIG_DB_HOST}
cfg_db_port=${FAROS_CONFIG_DB_PORT}
cfg_db_user=${FAROS_CONFIG_DB_USER}
cfg_db_pass=${FAROS_CONFIG_DB_PASSWORD}

hasura_db_name=${HASURA_DB_NAME}
metabase_db_name=${METABASE_DB_NAME}
n8n_db_name=${N8N_DB_NAME}

create_database() {
  db_name=$1
  db_host=$2
  db_port=$3
  db_user=$4
  db_pass=$5
  db_url="postgres://$db_user:$db_pass@$db_host:$db_port"

  if [ "$( psql "$db_url" -tAc "SELECT 1 FROM pg_database WHERE datname='$db_name'" )" = '1' ]
  then
      echo "Database $db_name already exists"
  else
      echo "Creating database $db_name"
      PGPASSWORD=$db_pass createdb -h "$db_host" -U "$db_user" -p "$db_port" "$db_name"
  fi
}

create_database "$faros_db_name" "$faros_db_host" "$faros_db_port" "$faros_db_user" "$faros_db_pass"

echo "Applying Flyway migrations"
flyway \
  -locations="filesystem:/flyway/faros/canonical-schema" \
  -url="jdbc:postgresql://$faros_db_host:$faros_db_port/$faros_db_name" \
  -user="$faros_db_user" \
  -password="$faros_db_pass" \
  migrate

create_database "$hasura_db_name" "$cfg_db_host" "$cfg_db_port" "$cfg_db_user" "$cfg_db_pass"
create_database "$metabase_db_name" "$cfg_db_host" "$cfg_db_port" "$cfg_db_user" "$cfg_db_pass"
create_database "$n8n_db_name" "$cfg_db_host" "$cfg_db_port" "$cfg_db_user" "$cfg_db_pass"
