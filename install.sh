#!/bin/bash

git clone https://github.com/faros-ai/faros-community-edition.git || true
cd faros-community-edition || exit
./start.sh --run-cli "$@"
