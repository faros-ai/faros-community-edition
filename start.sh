#!/bin/bash

set -eo pipefail

email_prompt() {
  read -p "Please provide us with your email address: " EMAIL
  while true; do
    if [ -z "$EMAIL" ]
    then
      break
    fi
    read -p "Is this email correct? $EMAIL - [y/n]: " yn
    case $yn in
        [Yy]*) break  ;;
        [Nn]*) email_prompt; exit 1 ;;
    esac
  done
  printf "Thank you! 🙏\n"
}

function setDefaults() {
  :
}

function parseFlags() {
    while (($#)); do
        case "$1" in
            --run-cli)
                run_cli=1
                shift 1 ;;
            *)
                echo "Unrecognized arg: $1"
                shift ;;
        esac
    done
}

main() {
  setDefaults
  parseFlags "$@"

  EMAIL_FILE=".faros-email"
  if [[ -f "$EMAIL_FILE" ]]; then
      EMAIL=$(cat $EMAIL_FILE)
  else
      printf "Hello 👋 Welcome to Faros Community Edition! 🤗\n\n"
      printf "Want to stay up to date with the latest community news? (we won't spam you)\n"
      email_prompt
      echo "$EMAIL" > $EMAIL_FILE
  fi

  export FAROS_EMAIL=$EMAIL

  # Ensure we're using the latest faros-init image
  export FAROS_INIT_IMAGE=farosai.docker.scarf.sh/farosai/faros-ce-init:latest

  docker-compose pull faros-init

  if [[ $(uname -m 2> /dev/null) == 'arm64' ]]; then
      # Use Metabase images built for Apple M1
      METABASE_IMAGE="farosai.docker.scarf.sh/farosai/metabase-m1" \
      docker-compose up --build --remove-orphans --detach && docker-compose logs --follow faros-init
  else
      docker-compose up --build --remove-orphans --detach && docker-compose logs --follow faros-init
  fi

  if ((run_cli)); then
    faros_init_exit=$(docker-compose ps faros-init --format json | grep -Eo '"ExitCode"[^,]*' | grep -Eo '[^:]*$')
    if [ $faros_init_exit != 0 ]; then
      printf "an error occured during startup, exiting... \n"
      exit 1
    fi
    docker pull farosai/faros-ce-cli:latest
    AIRBYTE_URL=$(grep "^WEBAPP_URL" .env| sed 's/^WEBAPP_URL=//')
    METABASE_PORT=$(grep "^METABASE_PORT" .env| sed 's/^METABASE_PORT=//')
    docker run --network host -it farosai/faros-ce-cli pick-source --airbyte-url "$AIRBYTE_URL" --metabase-url "http://localhost:$METABASE_PORT"
  fi
}

main "$@"; exit
