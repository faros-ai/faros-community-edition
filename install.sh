#!/bin/bash

git clone https://github.com/faros-ai/faros-community-edition.git || true
cd faros-community-edition && git pull || exit
./start.sh --run-cli "$@"
