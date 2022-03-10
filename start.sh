#!/bin/bash

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

if [[ $(uname -m 2> /dev/null) == 'arm64' ]]; then
    # Use Airbyte and Metabase images built for Apple M1
    AIRBYTE_IMAGE_PREFIX="farosai/airbyte-" METABASE_IMAGE="farosai/metabase-m1" docker-compose up --build --remove-orphans
else
    # Ensure we're using the latest faros-init image
    docker-compose pull faros-init
    docker-compose up --build --remove-orphans
fi

