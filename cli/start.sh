#!/bin/bash

docker pull yandryperez/ce-cli \
&& docker run --network host -it  yandryperez/ce-cli

