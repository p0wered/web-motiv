#!/bin/sh
set -e

# Каталог данных монтируется с хоста и может принадлежать root: отдаём его пользователю node
# (рекурсивно — только если он ещё не его, например при первом запуске) и запускаем
# приложение уже от node. Других прав контейнеру не нужно (cap_add в docker-compose.yml).
mkdir -p /app/data
if [ "$(stat -c %U /app/data)" != "node" ]; then
  chown -R node:node /app/data
fi

exec setpriv --reuid=node --regid=node --init-groups "$@"
