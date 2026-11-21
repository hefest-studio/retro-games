#!/usr/bin/env bash
# build.sh — делает игры самодостаточными: копирует общие файлы из _shared/ в игры, которые их подключают.
#   _shared/engine.js → <игра>/engine.js     (index.html ссылается на ./engine.js)
#   _shared/host.js   → <игра>/js/host.js    (index.html ссылается на ./js/host.js — «оболочка» поверх своей игры)
#   _shared/mouse.js  → <игра>/js/mouse.js   (только если js/mouse.js игры УЖЕ копия общего модуля — в нём есть метка
#                                             «Источник — _shared/mouse.js»; собственные модули мыши игр не затираются)
#   _shared/campaign-core.js, _shared/campaign-ui-kit.js → <игра>/js/<то же имя> (ядро кампаний стратегий и кит экранов — только
#                                             если игра подключает файл и он копия общего: метка «Источник — _shared/<файл>»)
#   _shared/platform.js → <игра>/js/platform.js (только если игра его подключает и файл — копия общего, метка
#                                             «Источник — _shared/platform.js»; обычно его кладёт tools/platform-build.mjs)
#   _shared/engine.js → _proto/<прототип>/engine.js (прототипы, где index.html подключает ./engine.js)
# Внешних зависимостей не добавляет. Копии в играх руками не правим — только _shared/.
set -euo pipefail
cd "$(dirname "$0")"
ENGINE="_shared/engine.js"
HOST="_shared/host.js"
MOUSE="_shared/mouse.js"
MOUSE_MARK="Источник — _shared/mouse.js"
PLATFORM="_shared/platform.js"
PLATFORM_MARK="Источник — _shared/platform.js"
CAMPAIGN_FILES="campaign-core.js campaign-ui-kit.js"   # общее ядро кампаний и кит экранов (_shared/<файл> → <игра>/js/<файл>)
[ -f "$ENGINE" ] || { echo "нет $ENGINE"; exit 1; }
[ -f "$HOST" ] || { echo "нет $HOST"; exit 1; }
[ -f "$MOUSE" ] || { echo "нет $MOUSE"; exit 1; }
copied=0; hosts=0; mice=0; plats=0; protos=0; camps=0
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
  # общий модуль мыши — только поверх своей же копии (по метке источника)
  if grep -q 'src="\./js/mouse\.js"' "$idx" 2>/dev/null && grep -qF "$MOUSE_MARK" "${d}js/mouse.js" 2>/dev/null; then
    cp "$MOUSE" "${d}js/mouse.js"; mice=$((mice+1)); echo "→ ${d}js/mouse.js"
  fi
  # ядро кампаний и кит экранов — только поверх своей копии (по метке источника)
  for cf in $CAMPAIGN_FILES; do
    if grep -q "src=\"\./js/${cf//./\\.}\"" "$idx" 2>/dev/null && grep -qF "Источник — _shared/$cf" "${d}js/$cf" 2>/dev/null; then
      cp "_shared/$cf" "${d}js/$cf"; camps=$((camps+1)); echo "→ ${d}js/$cf"
    fi
  done
  # адаптер площадок — тоже только поверх своей копии (по метке)
  if [ -f "$PLATFORM" ] && grep -q 'src="\./js/platform\.js' "$idx" 2>/dev/null && grep -qF "$PLATFORM_MARK" "${d}js/platform.js" 2>/dev/null; then
    cp "$PLATFORM" "${d}js/platform.js"; plats=$((plats+1)); echo "→ ${d}js/platform.js"
  fi
done
# прототипы: _proto/<имя>/engine.js — копия движка, если прототип его подключает
for d in _proto/*/; do
  idx="${d}index.html"
  [ -f "$idx" ] || continue
  if grep -q 'src="\./engine\.js"' "$idx" 2>/dev/null; then
    cp "$ENGINE" "${d}engine.js"; protos=$((protos+1)); echo "→ ${d}engine.js"
  fi
done
echo "engine.js скопирован в $copied игр и $protos прототип(ов), host.js — в $hosts, mouse.js — в $mice, platform.js — в $plats, файлы кампаний (campaign-core/ui-kit) — $camps."
