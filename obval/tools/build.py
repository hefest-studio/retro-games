#!/usr/bin/env python3
"""ОБВАЛ: сборка js/game.js и css/style.css из src/ (раньше — монолит index.html).

После порта на движок v2 страницы подключают собранные файлы:
  index.html  — движок v2 (engine.js + js/host.js) поверх js/game.js;
  legacy.html — старая страница со своим меню, тот же js/game.js;
  обе — css/style.css.

  src/game.js (+ src/levels.js по маркеру /*__LEVELS__*/) -> js/game.js
  src/style.css                                          -> css/style.css

Запуск:  python3 tools/build.py [--check]   (--check: только сравнить, код выхода 1 при расхождении)
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "src"

game = (SRC / "game.js").read_text(encoding="utf-8")
levels = (SRC / "levels.js").read_text(encoding="utf-8").strip()
if "/*__LEVELS__*/" not in game:
    raise SystemExit("src/game.js: нет маркера /*__LEVELS__*/")
if "</script" in game.lower():
    raise SystemExit("src/game.js: содержит '</script>'")
out = {
    ROOT / "js" / "game.js": game.replace("/*__LEVELS__*/", levels),
    ROOT / "css" / "style.css": (SRC / "style.css").read_text(encoding="utf-8"),
}

check = "--check" in sys.argv
bad = 0
for path, text in out.items():
    rel = path.relative_to(ROOT)
    if check:
        same = path.exists() and path.read_text(encoding="utf-8") == text
        print(("  ✓ " if same else "  ✗ ") + f"{rel} {'совпадает с src' if same else 'отличается от src — запустите без --check'}")
        bad += 0 if same else 1
    else:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text, encoding="utf-8")
        print(f"built {rel} · {len(text):,} bytes")
sys.exit(1 if bad else 0)
