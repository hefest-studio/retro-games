#!/usr/bin/env node
/**
 * Сборка игры из исходников (движок v2, «хост поверх игры»).
 *
 *   node neon-rage/tools/build.mjs
 *
 *   src/*.js в фиксированном порядке -> js/game.js (один скрипт, IIFE-модули)
 *   src/style.css                    -> css/style.css
 *
 * Страница index.html (разметка + engine.js + js/host.js + адаптер) правится вручную.
 * legacy.html — прежний автономный монолит, сборкой не трогается.
 */
import { readFileSync, writeFileSync, statSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "src");
const OUT_JS = join(ROOT, "js", "game.js");
const OUT_CSS = join(ROOT, "css", "style.css");

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
  "/* НЕОН × ЯРОСТЬ: NEON YAROST — сгенерировано tools/build.mjs, не редактировать вручную */",
  "'use strict';",
  ...parts,
].join("\n");

mkdirSync(dirname(OUT_JS), { recursive: true });
mkdirSync(dirname(OUT_CSS), { recursive: true });
writeFileSync(OUT_JS, js + "\n");
writeFileSync(OUT_CSS, css.trim() + "\n");

const kb = (p) => (statSync(p).size / 1024).toFixed(1);
console.log(`✓ js/game.js — ${kb(OUT_JS)} KB, скриптов: ${SCRIPTS.length}; css/style.css — ${kb(OUT_CSS)} KB`);
