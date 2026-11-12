#!/usr/bin/env bash
# build.sh — делает игры самодостаточными: копирует _shared/engine.js в каждую игру,
# которая его использует (ссылается на ./engine.js). Внешних зависимостей не добавляет.
set -euo pipefail
cd "$(dirname "$0")"
ENGINE="_shared/engine.js"
[ -f "$ENGINE" ] || { echo "нет $ENGINE"; exit 1; }
copied=0
for d in */; do
  idx="${d}index.html"
  [ -f "$idx" ] || continue
  # копируем только туда, где игра подключает ./engine.js
  if grep -q 'engine\.js' "$idx" 2>/dev/null; then
    cp "$ENGINE" "${d}engine.js"; copied=$((copied+1)); echo "→ ${d}engine.js"
  fi
done
echo "engine.js скопирован в $copied игр."
