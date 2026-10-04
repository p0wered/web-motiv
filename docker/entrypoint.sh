#!/bin/sh
set -e

# Каталог данных (и отдельный каталог копий, если задан BACKUP_DIR) монтируется с хоста и может
# принадлежать root: отдаём его пользователю node
# (рекурсивно — только если он ещё не его, например при первом запуске) и запускаем
# приложение уже от node. Других прав контейнеру не нужно (cap_add в docker-compose.yml).
for dir in /app/data ${BACKUP_DIR:-}; do
  mkdir -p "$dir"
  if [ "$(stat -c %U "$dir")" != "node" ]; then
    chown -R node:node "$dir"
  fi
done

exec setpriv --reuid=node --regid=node --init-groups "$@"
