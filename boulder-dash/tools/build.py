#!/usr/bin/env python3
"""Inline CSS, levels and JS into one self-contained index.html."""
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SHELL = ROOT / "src" / "shell.html"
STYLE = ROOT / "src" / "style.css"
LEVELS = ROOT / "src" / "levels.js"
GAME = ROOT / "src" / "game.js"
OUT = ROOT / "index.html"

css = STYLE.read_text(encoding="utf-8")
levels = LEVELS.read_text(encoding="utf-8").strip()
game = GAME.read_text(encoding="utf-8")
html = SHELL.read_text(encoding="utf-8")

if "/*__LEVELS__*/" not in game:
    raise SystemExit("game.js: levels marker not found")
game = game.replace("/*__LEVELS__*/", levels)

if "/*__INLINE_CSS__*/" not in html or "/*__INLINE_JS__*/" not in html:
    raise SystemExit("shell.html: inline markers not found")

html = html.replace("/*__INLINE_CSS__*/", css)
html = html.replace("/*__INLINE_JS__*/", game)
if "__INLINE_CSS__" in html or "__INLINE_JS__" in html:
    raise SystemExit("unreplaced marker left in output")

OUT.write_text(html, encoding="utf-8")
print(f"built {OUT.relative_to(ROOT)} · {len(html):,} bytes")
