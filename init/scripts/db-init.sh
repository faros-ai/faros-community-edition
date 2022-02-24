#!/bin/sh

db_host=${FAROS_DB_HOST}
db_port=${FAROS_DB_PORT}
db_user=${FAROS_DB_USER}
db_pass=${FAROS_DB_PASSWORD}
faros_db_name=${FAROS_DB_NAME}
hasura_db_name=${HASURA_DB_NAME}
metabase_db_name=${METABASE_DB_NAME}

db_url="postgres://$db_user:$db_pass@$db_host:$db_port"

create_database() {
  db_name=$1
  if [ "$( psql $db_url -tAc "SELECT 1 FROM pg_database WHERE datname='$db_name'" )" = '1' ]
  then
      echo "Database $db_name already exists"
  else
      echo "Creating database $db_name"
      PGPASSWORD=$db_pass createdb -h $db_host -U $db_user -p $db_port $db_name
  fi
}

create_database $faros_db_name

echo "Applying Flyway migrations"
flyway \
  -locations="filesystem:/home/faros/canonical-schema" \
  -url="jdbc:postgresql://$db_host:$db_port/$faros_db_name" \
  -user=$db_user \
  -password=$db_pass \
  migrate

create_database $hasura_db_name
create_database $metabase_db_name
