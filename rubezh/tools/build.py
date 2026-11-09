#!/usr/bin/env python3
"""Сборка CONTRA: src/shell.html + src/audio.js + src/game.js -> index.html (один файл).

Запуск:  python3 tools/build.py [--check]

Проверки:
  * на месте все фрагменты и маркеры <!--AUDIO--> / <!--GAME-->;
  * JavaScript проходит `node --check`;
  * в JS нет закрывающего тега </script> (иначе развалится инлайнинг);
  * extern-ссылки запрещены — порт должен работать офлайн с file://;
  * index.html перезаписывается только если все проверки прошли.
"""
from __future__ import annotations

import argparse
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "src"
OUT = ROOT / "index.html"

PARTS = {
    "AUDIO": SRC / "audio.js",
    "GAME": SRC / "game.js",
}

EXTERNAL = re.compile(r"""(?:src|href)\s*=\s*["']https?://|@import\s+url\(\s*["']?https?://|fetch\s*\(\s*["']https?://""", re.I)


def fail(msg: str) -> None:
    print(f"  ✗ {msg}")
    sys.exit(1)


def check_js(path: Path, text: str) -> None:
    if "</script" in text.lower():
        fail(f"{path.name}: содержит '</script>' — инлайн сломается")
    if not text.strip():
        fail(f"{path.name}: пустой файл")
    node = shutil.which("node")
    if node:
        with tempfile.NamedTemporaryFile("w", suffix=".js", delete=False, encoding="utf-8") as tmp:
            tmp.write(text)
            tmp_path = Path(tmp.name)
        try:
            proc = subprocess.run([node, "--check", str(tmp_path)], capture_output=True, text=True)
        finally:
            tmp_path.unlink(missing_ok=True)
        if proc.returncode != 0:
            fail(f"{path.name}: node --check не прошёл\n{proc.stderr.strip()}")
        print(f"  · {path.name}: node --check OK, {len(text.splitlines())} строк, {len(text) / 1024:.1f} КБ")
    else:
        print(f"  · {path.name}: {len(text.splitlines())} строк, {len(text) / 1024:.1f} КБ (node не найден, --check пропущен)")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true", help="только проверить, не писать index.html")
    args = ap.parse_args()

    shell_path = SRC / "shell.html"
    print("CONTRA build")
    if not shell_path.exists():
        fail("нет src/shell.html")
    shell = shell_path.read_text(encoding="utf-8")
    print(f"  · shell.html: {len(shell.splitlines())} строк")

    for marker in PARTS:
        if f"<!--{marker}-->" not in shell:
            fail(f"в shell.html нет маркера <!--{marker}-->")

    payload: dict[str, str] = {}
    for marker, path in PARTS.items():
        if not path.exists():
            fail(f"нет фрагмента src/{path.name}")
        text = path.read_text(encoding="utf-8")
        check_js(path, text)
        payload[marker] = f'<script data-part="{marker.lower()}">\n{text}\n</script>'

    html = shell
    for marker, block in payload.items():
        html = html.replace(f"<!--{marker}-->", block)
    if re.search(r"<!--(AUDIO|GAME)-->", html):
        fail("маркеры не подставились")

    m = EXTERNAL.search(html)
    if m:
        fail(f"внешняя ссылка в ассетах: {html[max(0, m.start()-40):m.start()+60]!r}")

    if "<style>" not in html or "<canvas" not in html:
        fail("shell.html повреждён: нет <style> или <canvas>")
    if html.count("<script") != 2:
        fail(f"ожидалось 2 инлайн-скрипта, найдено {html.count('<script')}")

    size = len(html.encode("utf-8"))
    print(f"  · результат: {len(html.splitlines())} строк, {size / 1024:.1f} КБ")

    if args.check:
        print("  ✓ проверки пройдены (index.html не изменён)")
        return

    OUT.write_text(html, encoding="utf-8")
    print(f"  ✓ записан {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
