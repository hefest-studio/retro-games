#!/usr/bin/env bash
# build.sh — делает игры самодостаточными: копирует общие файлы из _shared/ в игры, которые их подключают.
#   _shared/engine.js → <игра>/engine.js     (index.html ссылается на ./engine.js)
#   _shared/host.js   → <игра>/js/host.js    (index.html ссылается на ./js/host.js — «оболочка» поверх своей игры)
# Внешних зависимостей не добавляет. Копии в играх руками не правим — только _shared/.
set -euo pipefail
cd "$(dirname "$0")"
ENGINE="_shared/engine.js"
HOST="_shared/host.js"
[ -f "$ENGINE" ] || { echo "нет $ENGINE"; exit 1; }
[ -f "$HOST" ] || { echo "нет $HOST"; exit 1; }
copied=0; hosts=0
for d in */; do
  idx="${d}index.html"
  [ -f "$idx" ] || continue
  # копируем только туда, где игра подключает ./engine.js
  if grep -q 'src="\./engine\.js"' "$idx" 2>/dev/null; then
    cp "$ENGINE" "${d}engine.js"; copied=$((copied+1)); echo "→ ${d}engine.js"
  fi
  # и ./js/host.js — туда, где игра его подключает
  if grep -q 'src="\./js/host\.js"' "$idx" 2>/dev/null; then
    mkdir -p "${d}js"; cp "$HOST" "${d}js/host.js"; hosts=$((hosts+1)); echo "→ ${d}js/host.js"
  fi
done
echo "engine.js скопирован в $copied игр, host.js — в $hosts."
