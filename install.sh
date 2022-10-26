#!/bin/bash

git clone https://github.com/faros-ai/faros-community-edition.git
cd faros-community-edition || exit
./start.sh --run-cli "$@"
