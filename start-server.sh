#!/bin/bash

if [[ -z "${NEW_RELIC_LICENSE_KEY}" ]]; then
  node server.js
else
  if [[ -n "${LOCAL}" ]]; then
    export NEW_RELIC_APP_NAME="Discovery API (local)"
  else
    if [[ -n "${NODE_ENV}" ]]; then
      export NEW_RELIC_APP_NAME="Discovery API (${NODE_ENV})"
    else
      export NEW_RELIC_APP_NAME="Discovery API (${ENV})"
    fi
  fi

  node -r newrelic server.js
fi
