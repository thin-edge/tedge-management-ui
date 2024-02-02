#!/bin/sh
[ -f /app/tedge/tedge-mgm-env ] && . /app/tedge/tedge-mgm-env

if [ -z "$MONGO_HOST" ] &&   [ -z "$MONGO_PORT" ];  then
  echo "MONGO_HOST or MONGO_PORT are not set, please set it in /app/tedge/tedge-mgm" >&2
  exit 1
fi

exec node /app/tedge/server/dist/server.js