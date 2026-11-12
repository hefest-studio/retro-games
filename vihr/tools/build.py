#!/usr/bin/env python3
"""ВИХРЬ: проверка исходников (раньше — сборка монолита index.html из src/shell.html).

После порта на движок v2 сборка не нужна: страницы подключают исходники напрямую —
  index.html  — движок v2 (engine.js + js/host.js) поверх src/audio.js + src/game.js;
  legacy.html — старая страница (своё меню), те же src/*.js;
  css/style.css — общие стили обеих страниц.

Запуск:  python3 tools/build.py   (код выхода 1 — есть проблема)

Проверки:
  * на месте src/audio.js, src/game.js, css/style.css, engine.js, js/host.js;
  * обе страницы подключают нужные скрипты;
  * внешние ссылки (http/https) в страницах, стилях и скриптах запрещены (офлайн, file://).
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
EXTERNAL = re.compile(r"""(?:src|href)\s*=\s*["']https?://|@import\s+url\(\s*["']?https?://""", re.I)
FILES = ["src/audio.js", "src/game.js", "css/style.css", "engine.js", "js/host.js", "index.html", "legacy.html"]
NEEDS = {
    "index.html": ["./engine.js", "./js/host.js", "src/audio.js", "src/game.js", "css/style.css"],
    "legacy.html": ["src/audio.js", "src/game.js", "css/style.css"],
}


def main() -> None:
    bad = 0
    print("ВИХРЬ · проверка исходников")
    for rel in FILES:
        p = ROOT / rel
        if not p.exists() or not p.read_text(encoding="utf-8").strip():
            print(f"  ✗ нет или пустой {rel}"); bad += 1; continue
        text = p.read_text(encoding="utf-8")
        m = EXTERNAL.search(text)
        if m:
            print(f"  ✗ {rel}: внешняя ссылка {text[max(0, m.start()-30):m.start()+60]!r}"); bad += 1
        else:
            print(f"  · {rel}: {len(text.splitlines())} строк")
    for page, refs in NEEDS.items():
        p = ROOT / page
        if not p.exists():
            continue
        html = p.read_text(encoding="utf-8")
        for ref in refs:
            if ref not in html:
                print(f"  ✗ {page}: не подключён {ref}"); bad += 1
    if bad:
        print(f"  ✗ проблем: {bad}"); sys.exit(1)
    print("  ✓ всё на месте")


if __name__ == "__main__":
    main()
