#!/bin/sh

while (($#)); do
  case "$1" in
    --m1)
        m1=1
        shift ;;
    *) echo "Unrecognized arg: $1"; exit 1;
  esac
done

email_prompt() {
  read -p "Please provide us with your email address: " EMAIL
  while true; do
    read -p "Is this email correct? $EMAIL - [y/n]: " yn
    case $yn in
        [Yy]*) break  ;;
        [Nn]*) email_prompt; exit 1 ;;
    esac
  done
  printf "Thank you! 🙏\n"
}

EMAIL_FILE=".faros-email"
if [[ -f $EMAIL_FILE ]];then
    EMAIL=$(cat $EMAIL_FILE)
else
    printf "Hello 👋 Welcome to Faros Community Edition! 🤗\n\n"
    printf "Want to stay up to date with the latest community news? (we won't spam you)\n"
    email_prompt
    echo $EMAIL > $EMAIL_FILE
fi

export FAROS_EMAIL=$EMAIL

if !(($m1)); then
    docker-compose up --build --remove-orphans
else
    # Use Airbyte in dev mode to be able to run in Apple M1
    VERSION=dev docker-compose up
fi
