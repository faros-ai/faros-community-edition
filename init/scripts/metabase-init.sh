#!/usr/bin/env bash

[[ -z "$METABASE_URL" ]] && echo "METABASE_URL not set" && exit 1
[[ -z "$METABASE_USER" ]] && echo "METABASE_USER not set" && exit 1
[[ -z "$METABASE_PASSWORD" ]] && echo "METABASE_PASSWORD not set" && exit 1

db_host=$FAROS_DB_HOST
db_port=$FAROS_DB_PORT
db_name=$FAROS_DB_NAME
db_user=$FAROS_DB_USER
db_password=$FAROS_DB_PASSWORD

mb_url=$METABASE_URL
mb_user=$METABASE_USER
mb_password=$METABASE_PASSWORD

mb_db_payload=$(jq -n \
--arg db_host "$db_host" \
--arg db_port "$db_port" \
--arg db_name "$db_name" \
--arg db_user "$db_user" \
--arg db_password "$db_password" \
'{
  "engine": "postgres",
  "name": "Faros Data",
  "details": {
    "host": $db_host,
    "port": $db_port,
    "dbname": $db_name,
    "user": $db_user,
    "password": $db_password,
    "ssl": false,
    "additional-options": null,
    "tunnel-enabled": false,
    "let-user-control-scheduling": false
  },
  "auto_run_queries": false,
  "is_full_sync": false,
  "schedules": {}
}')

# Set up Metabase
if [[ "$(curl -o /dev/null -s -w "%{http_code}\n" "$mb_url"/health)" != "200" ]]
then
  echo "Metabase instance must be running: $mb_url/health did not return 200"
  exit 1
fi

setup_token=$(curl -s "$mb_url"/api/session/properties | jq -r '."setup-token"')
if [[ "$setup_token" == "null" ]]; then
  session_id=$(curl -s \
    -X POST \
    -H "Content-Type: application/json" \
    -d "{\"username\": \"$mb_user\", \"password\": \"$mb_password\"}" \
    "$mb_url"/api/session \
    | jq -r '.id'
  )
  if [[ "$session_id" == "null" ]]
  then
    echo "Unable to authenticate with Metabase API"
    exit 1
  fi

  db_setup=$(curl -s \
    -H "Content-Type: application/json" \
    -H "X-Metabase-Session: $session_id" \
    "$mb_url"/api/database \
    | jq -r ".data | \
      any(.details.dbname == \"$db_name\" and \
          .details.host == \"$db_host\")")
  if ! $db_setup; then
    echo "Configuring Faros database in Metabase"
    post_db_status=$(curl -o /dev/null -s \
      -w "%{http_code}\n" \
      -X POST \
      -H "Content-Type: application/json" \
      -H "X-Metabase-Session: $session_id" \
      -d "$mb_db_payload" \
      "$mb_url"/api/database)

    if [[ "$post_db_status" != "200" ]]
    then
      echo "Faros database setup failed with status: $post_db_status"
      exit 1
    fi
  fi
else
  echo "Setting up Metabase"
  setup_status=$(curl -o /dev/null -s \
    -w "%{http_code}\n" \
    -X POST \
    -H "Content-Type: application/json" \
    -d "
    {
      \"token\": \"$setup_token\",
      \"database\": $mb_db_payload,
      \"prefs\": {
        \"site_name\": \"Faros AI\",
        \"site_locale\": \"en\",
        \"allow_tracking\": \"false\"
      },
      \"user\": {
        \"first_name\": \"Faros\",
        \"last_name\": \"User\",
        \"email\": \"$mb_user\",
        \"password\": \"$mb_password\",
        \"site_name\": \"Faros AI\"
      }
    }" "$mb_url"/api/setup)

  if [[ "$setup_status" != "200" ]]
  then
    echo "Metabase setup failed with response code: $setup_status"
    exit 1
  fi

  echo "Importing dashboards"
  node ../lib/metabase/init.js "$mb_url" "$mb_user" "$mb_password" import
fi

echo "Attached Faros database to Metabase"
