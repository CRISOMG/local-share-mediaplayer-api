#!/bin/bash

# docker exec -it express-api bash -c "yarn dev"
# docker exec -it express-api bash

if [[ $1  == "dev" ]]; then
    docker exec -it express-api bash -c "yarn dev"
else
    docker exec -it express-api bash
fi