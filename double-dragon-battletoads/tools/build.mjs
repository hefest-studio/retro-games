#!/usr/bin/env node
/**
 * Сборка одного автономного HTML-файла из исходников.
 *
 *   node double-dragon-battletoads/tools/build.mjs
 *
 * src/template.html содержит два маркера:
 *   <!--__STYLE__-->  -> src/style.css
 *   <!--__SCRIPT__--> -> src/*.js в фиксированном порядке, внутри <script>
 *
 * Результат: double-dragon-battletoads/index.html (file://, без внешних файлов).
 */
import { readFileSync, writeFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "src");
const OUT = join(ROOT, "index.html");

/** Порядок подключения — менять только вместе с docs/CONTRACT.md */
const SCRIPTS = [
  "font.js",
  "i18n.js",
  "audio.js",
  "game.js",
  "render-retro.js",
  "render-modern.js",
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
  "/* DOUBLE DRAGON × BATTLE TOADS: NEON RAGE — сгенерировано tools/build.mjs, не редактировать вручную */",
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
console.log(`✓ index.html — ${kb} KB, скриптов: ${SCRIPTS.length}, css: ${(css.length / 1024).toFixed(1)} KB`);
