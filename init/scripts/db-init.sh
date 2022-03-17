#!/bin/sh

faros_db_name=${FAROS_DB_NAME}
faros_db_host=${FAROS_DB_HOST}
faros_db_port=${FAROS_DB_PORT}
faros_db_user=${FAROS_DB_USER}
faros_db_pass=${FAROS_DB_PASS}

hasura_db_name=${HASURA_DB_NAME}
hasura_db_host=${HASURA_DB_HOST}
hasura_db_port=${HASURA_DB_PORT}
hasura_db_user=${HASURA_DB_USER}
hasura_db_pass=${HASURA_DB_PASS}

metabase_db_name=${METABASE_DB_NAME}
metabase_db_host=${METABASE_DB_HOST}
metabase_db_port=${METABASE_DB_PORT}
metabase_db_user=${METABASE_DB_USER}
metabase_db_pass=${METABASE_DB_PASS}

n8n_db_name=${N8N_DB_NAME}
n8n_db_host=${N8N_DB_HOST}
n8n_db_port=${N8N_DB_PORT}
n8n_db_user=${N8N_DB_USER}
n8n_db_pass=${N8N_DB_PASS}

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
  -locations="filesystem:/home/faros/canonical-schema" \
  -url="jdbc:postgresql://$faros_db_host:$faros_db_port/$faros_db_name" \
  -user="$faros_db_user" \
  -password="$faros_db_pass" \
  migrate

create_database "$hasura_db_name" "$hasura_db_host" "$hasura_db_port" "$hasura_db_user" "$hasura_db_pass"
create_database "$metabase_db_name" "$metabase_db_host" "$metabase_db_port" "$metabase_db_user" "$metabase_db_pass"
create_database "$n8n_db_name" "$n8n_db_host" "$n8n_db_port" "$n8n_db_user" "$n8n_db_pass"
