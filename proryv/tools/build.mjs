#!/usr/bin/env node
/**
 * ПРОРЫВ: сборка js/game.js и css/style.css из исходников src/ (раньше — монолит index.html).
 *
 *   node proryv/tools/build.mjs           # записать js/game.js и css/style.css
 *   node proryv/tools/build.mjs --check   # только сравнить с src (код выхода 1 при расхождении)
 *
 * После порта на движок v2 страницы подключают собранные файлы:
 *   index.html  — движок v2 (engine.js + js/host.js) поверх js/game.js;
 *   legacy.html — старая страница со своим меню, тот же js/game.js;
 *   обе — css/style.css.
 * js/game.js — все src/*.js в фиксированном порядке (classic script, работает по file://).
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "src");
const CHECK = process.argv.includes("--check");

/** Порядок подключения — менять только вместе с docs/CONTRACT.md */
const SCRIPTS = [
  "font.js",
  "i18n.js",
  "audio.js",
  "levels.js",
  "game.js",
  "render-retro.js",
  "render-modern.js",
  "main.js",
];

const read = (p) => readFileSync(p, "utf8");

const parts = [];
for (const name of SCRIPTS) {
  const path = join(SRC, name);
  if (!existsSync(path)) { console.error(`✗ нет файла src/${name}`); process.exit(1); }
  const code = read(path);
  if (/^\s*import\s|^\s*export\s/m.test(code)) {
    console.error(`✗ src/${name}: ES-модули запрещены (нужен file://)`);
    process.exit(1);
  }
  if (/<\/script/i.test(code)) { console.error(`✗ src/${name}: содержит '</script>'`); process.exit(1); }
  parts.push(`/* ==== src/${name} ==== */\n${code.trim()}\n`);
}

const js = [
  "/* ПРОРЫВ HTML5 — сгенерировано tools/build.mjs, не редактировать вручную */",
  "'use strict';",
  ...parts,
].join("\n") + "\n";
const css = read(join(SRC, "style.css"));

const out = { "js/game.js": js, "css/style.css": css };
let bad = 0;
for (const [rel, text] of Object.entries(out)) {
  const file = join(ROOT, rel);
  if (CHECK) {
    const same = existsSync(file) && read(file) === text;
    console.log(`${same ? "✓" : "✗"} ${rel} ${same ? "совпадает с src" : "отличается от src — запустите без --check"}`);
    if (!same) bad++;
  } else {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, text);
    console.log(`✓ ${rel} — ${(Buffer.byteLength(text) / 1024).toFixed(1)} KB`);
  }
}
process.exit(bad ? 1 : 0);
