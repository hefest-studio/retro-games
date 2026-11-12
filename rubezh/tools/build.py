#!/usr/bin/env python3
"""РУБЕЖ: сборка js/ и css/ из src/ (раньше — монолит index.html из src/shell.html).

После порта на движок v2 страницы подключают собранные файлы:
  index.html  — движок v2 (engine.js + js/host.js) поверх js/audio.js + js/game.js;
  legacy.html — старая страница со своим меню, те же js/audio.js + js/game.js;
  обе — css/style.css.

  src/audio.js  -> js/audio.js
  src/game.js   -> js/game.js
  src/style.css -> css/style.css

Запуск:  python3 tools/build.py [--check]   (--check: только сравнить, код выхода 1 при расхождении)

Проверки перед записью: JS проходит `node --check` (если node есть), в коде нет '</script>',
нет внешних ссылок (игра работает офлайн и по file://).
"""
from __future__ import annotations

import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "src"
OUT = {
    ROOT / "js" / "audio.js": SRC / "audio.js",
    ROOT / "js" / "game.js": SRC / "game.js",
    ROOT / "css" / "style.css": SRC / "style.css",
}
EXTERNAL = re.compile(r"""(?:src|href)\s*=\s*["']https?://|@import\s+url\(\s*["']?https?://|fetch\s*\(\s*["']https?://""", re.I)


def fail(msg: str) -> None:
    print(f"  ✗ {msg}")
    sys.exit(1)


def check_js(name: str, text: str) -> None:
    if "</script" in text.lower():
        fail(f"{name}: содержит '</script>'")
    node = shutil.which("node")
    if not node:
        return
    with tempfile.NamedTemporaryFile("w", suffix=".js", delete=False, encoding="utf-8") as tmp:
        tmp.write(text)
        tmp_path = Path(tmp.name)
    try:
        proc = subprocess.run([node, "--check", str(tmp_path)], capture_output=True, text=True)
    finally:
        tmp_path.unlink(missing_ok=True)
    if proc.returncode != 0:
        fail(f"{name}: node --check не прошёл\n{proc.stderr.strip()}")


def main() -> None:
    check = "--check" in sys.argv
    print("РУБЕЖ build")
    bad = 0
    for out, src in OUT.items():
        if not src.exists():
            fail(f"нет {src.relative_to(ROOT)}")
        text = src.read_text(encoding="utf-8")
        if src.suffix == ".js":
            check_js(src.name, text)
        m = EXTERNAL.search(text)
        if m:
            fail(f"{src.name}: внешняя ссылка {text[max(0, m.start()-40):m.start()+60]!r}")
        rel = out.relative_to(ROOT)
        if check:
            same = out.exists() and out.read_text(encoding="utf-8") == text
            print(("  ✓ " if same else "  ✗ ") + f"{rel} {'совпадает с src' if same else 'отличается от src — запустите без --check'}")
            bad += 0 if same else 1
        else:
            out.parent.mkdir(parents=True, exist_ok=True)
            out.write_text(text, encoding="utf-8")
            print(f"  · {rel}: {len(text.splitlines())} строк, {len(text) / 1024:.1f} КБ")
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
