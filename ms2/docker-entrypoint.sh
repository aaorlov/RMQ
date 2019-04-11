#!/bin/sh -e

if [ "$@" = "start" ]; then
  echo "Starting expressjs app..."
  exec ./bin/www
fi

exec "$@"
