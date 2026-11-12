#!/usr/bin/env node
/**
 * Сборка одного HTML-файла из исходников.
 *
 *   node lost-vikings/tools/build.mjs
 *
 * src/template.html содержит два маркера:
 *   <!--__STYLE__-->  -> src/style.css
 *   <!--__SCRIPT__--> -> все src/*.js в фиксированном порядке, внутри <script>
 *
 * Результат: lost-vikings/index.html (полностью автономный, работает по file://).
 */
import { readFileSync, writeFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "src");
/* Порт на движок v2: страница игры теперь index.html (оболочка) + js/game.js + css/style.css, а src/ —
 * исходники ДО ребрендинга (устарели). Чтобы сборка не затёрла index.html, файл-результат задаётся явно:
 *   node saga/tools/build.mjs <выходной.html>      (например, /tmp/saga-src.html) */
if (!process.argv[2]) {
  console.error("✗ укажите выходной файл: node saga/tools/build.mjs <out.html> (index.html не перезаписывается — см. README)");
  process.exit(1);
}
const OUT = resolve(process.argv[2]);

/** Порядок подключения — менять только вместе с docs/CONTRACT.md */
const SCRIPTS = [
  "i18n.js",
  "levels.js",
  "audio.js",
  "game.js",
  "render-retro.js",
  "render-modern.js",
  "ui.js",
  "main.js",
];

const read = (p) => readFileSync(p, "utf8");

const template = read(join(SRC, "template.html"));
const css = read(join(SRC, "style.css"));

const parts = [];
for (const name of SCRIPTS) {
  const path = join(SRC, name);
  let code;
  try {
    code = read(path);
  } catch {
    console.error(`✗ нет файла src/${name}`);
    process.exit(1);
  }
  if (/^\s*import\s|^\s*export\s/m.test(code)) {
    console.error(`✗ src/${name}: ES-модули запрещены (нужен file://)`);
    process.exit(1);
  }
  parts.push(`/* ==== src/${name} ==== */\n${code.trim()}\n`);
}

const js = [
  "/* LOST VIKINGS HTML5 — сгенерировано tools/build.mjs, не редактировать вручную */",
  "'use strict';",
  ...parts,
].join("\n");

let html = template
  .replace("<!--__STYLE__-->", css.trim())
  .replace("<!--__SCRIPT__-->", js);

if (html.includes("__STYLE__") || html.includes("__SCRIPT__")) {
  console.error("✗ в шаблоне остались маркеры");
  process.exit(1);
}

writeFileSync(OUT, html);

const kb = (statSync(OUT).size / 1024).toFixed(1);
console.log(`✓ ${OUT} — ${kb} KB, скриптов: ${SCRIPTS.length}, css: ${(css.length / 1024).toFixed(1)} KB`);
