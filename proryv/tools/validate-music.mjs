#!/usr/bin/env node
/**
 * Офлайн-проверка музыкальных данных proryv/src/audio.js.
 *
 *   node proryv/tmp/validate-music.mjs
 *
 * Блок между [MUSIC-DATA-BEGIN] / [MUSIC-DATA-END] исполняется в Node
 * (без WebAudio), после чего проверяются:
 *   - длины паттернов и каналов, кратность такту, длительность лупов/джинглов;
 *   - гармония по тактам: бас и арпеджио обязаны попадать в аккорд,
 *     в мелодии на сильных долях допустимы только аккордовые тона/краски,
 *     одновременное звучание не должно давать малых секунд/больших септим;
 *   - диапазон нот, целостность фразы на стыке лупа.
 *
 * Коды выхода: 0 — всё хорошо, 1 — есть ошибки гармонии/структуры.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = readFileSync(resolve(ROOT, "src/audio.js"), "utf8");

const begin = SRC.indexOf("/* [MUSIC-DATA-BEGIN] */");
const end = SRC.indexOf("/* [MUSIC-DATA-END] */");
if (begin < 0 || end < 0) {
  console.error("✗ не найдены маркеры MUSIC-DATA");
  process.exit(1);
}
const dataSrc = SRC.slice(begin, end);

const exported = new Function(
  dataSrc + "\nreturn { TRACKS: TRACKS, NOTE_RE: NOTE_RE, midiOf: midiOf, NOTE_BASE: NOTE_BASE };"
)();
const TRACKS = exported.TRACKS;
const NOTE_RE = exported.NOTE_RE;
const midiOf = exported.midiOf;

const errors = [];
const warns = [];
const info = [];

function err(msg) { errors.push(msg); }
function warn(msg) { warns.push(msg); }

/* ---------- аккорды (pitch classes, 0 = C) ---------- */

const MIDI_PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
function pc(name, acc = 0) { return (((MIDI_PC[name] + acc) % 12) + 12) % 12; }

const CHORDS = {
  Am: [pc("A"), pc("C"), pc("E")],
  F: [pc("F"), pc("A"), pc("C")],
  G: [pc("G"), pc("B"), pc("D")],
  C: [pc("C"), pc("E"), pc("G")],
  Dm: [pc("D"), pc("F"), pc("A")],
  E7: [pc("E"), pc("G", 1), pc("B"), pc("D")],
  Bb: [pc("B", -1), pc("D"), pc("F")],
  Gm: [pc("G"), pc("B", -1), pc("D")],
  A7: [pc("A"), pc("C", 1), pc("E"), pc("G")]
};

function shiftChord(chord, semitones) {
  return chord.map((p) => (((p + semitones) % 12) + 12) % 12);
}

const GAME_CHORDS = [
  "Am", "Am", "F", "G", "Am", "Am", "F", "E7",
  "Dm", "Dm", "Am", "Am", "F", "G", "E7", "E7",
  "Am", "Am", "F", "G", "Am", "Am", "F", "E7",
  "F", "G", "Am", "Am", "F", "G", "E7", "Am"
].map((n) => CHORDS[n]);

const TITLE_CHORDS = [
  "Am", "F", "G", "Am",
  "Am", "Am", "F", "G", "Am", "Am", "F", "E7",
  "Am", "F", "G", "E7"
].map((n) => CHORDS[n]);

const CLEAR_CHORDS = ["C", "C"].map((n) => CHORDS[n]);
const GAMEOVER_CHORDS = ["Dm", "Dm"].map((n) => CHORDS[n]);
const WIN_CHORDS = ["C", "F", "G", "C"].map((n) => CHORDS[n]);

/* ---------- утилиты ---------- */

function tokensOf(pattern) {
  return pattern.split(/\s+/).filter((t) => t && t !== "|");
}

function parsePulseChannel(def) {
  const events = [];
  let step = 0;
  let last = null;
  for (const name of def.order) {
    const pat = def.patterns[name];
    if (typeof pat !== "string") {
      err(`паттерн "${name}" отсутствует`);
      continue;
    }
    const tokens = tokensOf(pat);
    for (let i = 0; i < tokens.length; i++) {
      const tok = tokens[i];
      if (tok === "-") {
        if (last) last.dur += 1;
      } else if (tok === ".") {
        /* пауза */
      } else {
        const m = NOTE_RE.exec(tok);
        if (!m) {
          err(`не разобрана нота "${tok}" (паттерн ${name})`);
          continue;
        }
        last = { step: step + i, midi: midiOf(m[2], m[3], m[4]), dur: 1 };
        events.push(last);
      }
    }
    step += tokens.length;
  }
  return { events, steps: step };
}

function parseDrumChannel(def) {
  let step = 0;
  const hits = [];
  for (const name of def.order) {
    const tokens = tokensOf(def.patterns[name] || "");
    if (tokens.length % 16 !== 0) err(`барабаны: паттерн ${name} = ${tokens.length} шагов (не кратно 16)`);
    for (let i = 0; i < tokens.length; i++) {
      if (tokens[i] === ".") continue;
      if (!/^[KSHOCTkshoct]$/.test(tokens[i])) {
        err(`неизвестный барабанный символ "${tokens[i]}" (паттерн ${name})`);
      } else {
        hits.push({ step: step + i, hit: tokens[i] });
      }
    }
    step += tokens.length;
  }
  return { steps: step, hits };
}

function pad(ch, n) { return String(ch).padEnd(n); }
function pcName(p) {
  const names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  return names[p];
}
function midiName(midi) {
  return pcName(((midi % 12) + 12) % 12) + (Math.floor(midi / 12) - 1);
}
function intervalSemis(a, b) {
  const d = Math.abs(a - b) % 12;
  return Math.min(d, 12 - d);
}

/* ---------- проверка одного трека ---------- */

function checkTrack(id, def, chords) {
  const bpm = def.bpm;
  const lead = parsePulseChannel(def.lead);
  const harm = parsePulseChannel(def.harm);
  const bass = parsePulseChannel(def.bass);
  const drums = parseDrumChannel(def.drums);
  const total = lead.steps;

  const bars = total / 16;
  const seconds = total * (60 / bpm / 4);

  info.push(
    `${pad(id, 9)} ${pad(bpm + " BPM", 9)} ${pad(bars + " такт.", 9)} ` +
    `${pad(seconds.toFixed(2) + " c", 9)} луповый=${def.loop !== false}`
  );

  // структура
  if (total % 16 !== 0) err(`${id}: длина ${total} шагов не кратна такту (16)`);
  if (lead.steps !== total || harm.steps !== total || bass.steps !== total || drums.steps !== total) {
    err(`${id}: длины каналов не совпадают: lead=${lead.steps} harm=${harm.steps} bass=${bass.steps} drums=${drums.steps}`);
  }
  if (def.loop !== false) {
    if (bars < 16 || bars > 32) err(`${id}: луп ${bars} тактов — контракт требует 16–32`);
  }
  if (id === "clear" && !(seconds >= 2 && seconds <= 3.2)) err(`${id}: длительность ${seconds.toFixed(2)} c не 2–3 c`);
  if (id === "gameover" && !(seconds >= 2 && seconds <= 3.2)) err(`${id}: длительность ${seconds.toFixed(2)} c не 2–3 c`);
  if (id === "win" && !(seconds >= 6 && seconds <= 8.2)) err(`${id}: длительность ${seconds.toFixed(2)} c не 6–8 c`);

  // длины паттернов и все ноты в разумном диапазоне
  for (const chName of ["lead", "harm", "bass"]) {
    const ch = def[chName];
    for (const name of ch.order) {
      const n = tokensOf(ch.patterns[name]).length;
      if (n % 16 !== 0) err(`${id}/${chName}: паттерн ${name} = ${n} шагов (не кратно 16)`);
      else if (n !== 16) warn(`${id}/${chName}: паттерн ${name} = ${n} шагов (не один такт)`);
    }
    for (const ev of (chName === "lead" ? lead : chName === "harm" ? harm : bass).events) {
      if (ev.midi < 24 || ev.midi > 100) err(`${id}/${chName}: ${midiName(ev.midi)} вне диапазона 24..100`);
    }
  }

  if (chords && chords.length !== bars) {
    err(`${id}: аккордовая карта ${chords.length} тактов, а трек ${bars}`);
  }

  // проверка по тактам
  const barIssues = [];
  for (let bar = 0; bar < Math.min(bars, chords ? chords.length : bars); bar++) {
    const chord = chords[bar];
    const chordSet = new Set(chord);
    const from = bar * 16;
    const to = from + 16;
    const label = `${id} такт ${bar + 1}`;

    // бас — только аккордовые тона (у нас — прима/октава/квинта)
    for (const ev of bass.events) {
      if (ev.step >= from && ev.step < to) {
        const p = ((ev.midi % 12) + 12) % 12;
        if (!chordSet.has(p)) barIssues.push(`${label}: БАС ${midiName(ev.midi)} вне аккорда [${chord.map(pcName).join(" ")}]`);
      }
    }
    // гармония — строго аккордовые тона
    for (const ev of harm.events) {
      if (ev.step >= from && ev.step < to) {
        const p = ((ev.midi % 12) + 12) % 12;
        if (!chordSet.has(p)) barIssues.push(`${label}: АРП ${midiName(ev.midi)} вне аккорда [${chord.map(pcName).join(" ")}]`);
      }
    }
    // мелодия: сильные доли — аккордовый тон или допустимая краска (9-я/7-я)
    for (const ev of lead.events) {
      if (ev.step >= from && ev.step < to) {
        const rel = ev.step - from;
        if (rel % 4 === 0) {
          const p = ((ev.midi % 12) + 12) % 12;
          const tension = chord.some((c) => intervalSemis(p, c) === 2 || intervalSemis(p, c) === 10);
          if (!chordSet.has(p) && !tension) {
            warn(`${label}: мелодия на сильной доле ${midiName(ev.midi)} не в аккорде и не краска`);
          }
        }
      }
    }
  }

  // хвосты нот не должны вылезать за границу лупа (движок их обрежет — лучше не иметь)
  for (const [name, ch] of [["lead", lead], ["harm", harm], ["bass", bass]]) {
    for (const ev of ch.events) {
      if (ev.step + ev.dur > total) {
        warn(`${id}/${name}: нота на шаге ${ev.step} длиннее остатка лупа (${ev.dur})`);
      }
    }
  }

  // первый бас такта должен совпадать с корнем аккорда (страховка от сдвига карты)
  for (let bar = 0; bar < Math.min(bars, chords ? chords.length : bars); bar++) {
    const from = bar * 16;
    const first = bass.events.find((e) => e.step >= from && e.step < from + 16);
    if (first) {
      const p = ((first.midi % 12) + 12) % 12;
      if (p !== chords[bar][0]) {
        err(`${id} такт ${bar + 1}: бас начинается с ${midiName(first.midi)}, а корень аккорда ${pcName(chords[bar][0])}`);
      }
    }
  }

  // одновременные звуки: запрет малых секунд/больших септим
  const pulseEvents = []
    .concat(lead.events.map((e) => ({ ...e, ch: "lead" })))
    .concat(harm.events.map((e) => ({ ...e, ch: "harm" })))
    .concat(bass.events.map((e) => ({ ...e, ch: "bass" })));
  for (let s = 0; s < total; s++) {
    const sounding = pulseEvents.filter((e) => e.step <= s && s < e.step + e.dur);
    for (let i = 0; i < sounding.length; i++) {
      for (let j = i + 1; j < sounding.length; j++) {
        const a = ((sounding[i].midi % 12) + 12) % 12;
        const b = ((sounding[j].midi % 12) + 12) % 12;
        const d = Math.abs(a - b) % 12;
        if (d === 1 || d === 11) {
          barIssues.push(
            `шаг ${s} (такт ${Math.floor(s / 16) + 1}): ${sounding[i].ch} ${midiName(sounding[i].midi)} ` +
            `× ${sounding[j].ch} ${midiName(sounding[j].midi)} — полутон`
          );
          j = sounding.length;
          i = sounding.length;
        }
      }
    }
  }

  return { lead, harm, bass, drums, total, bars, seconds, barIssues };
}

/* ---------- прогон ---------- */

const checked = {};
const order = ["title", "game", "exo", "final", "clear", "gameover", "win"];

const CHORD_MAP = {
  title: TITLE_CHORDS,
  game: GAME_CHORDS,
  exo: GAME_CHORDS,
  clear: CLEAR_CHORDS,
  gameover: GAMEOVER_CHORDS,
  win: WIN_CHORDS
};

// final = материал game, транспонированный: аккорды берём по имени первого паттерна
// мелодии (каждая строка order у final ссылается на game-паттерн).
const finalOrder = TRACKS.final.lead.order;
const finalChords = finalOrder.map((name) => {
  const gi = TRACKS.game.lead.order.indexOf(name);
  if (gi < 0) {
    err(`final: паттерн ${name} не найден в game`);
    return CHORDS.Am;
  }
  return shiftChord(GAME_CHORDS[gi], -7);
});
CHORD_MAP.final = finalChords;

for (const id of order) {
  const def = TRACKS[id];
  if (!def) { err(`нет трека ${id}`); continue; }
  const res = checkTrack(id, def, CHORD_MAP[id]);
  checked[id] = res;
  for (const issue of res.barIssues) err(issue);
}

// стык лупа: сравним последний и первый такт (информативно)
for (const id of ["title", "game", "exo", "final"]) {
  const res = checked[id];
  if (!res) continue;
  const lastBar = res.total / 16 - 1;
  const chordNow = CHORD_MAP[id][lastBar];
  const chordNext = CHORD_MAP[id][0];
  info.push(
    `стык лупа ${pad(id, 7)}: [${chordNow.map(pcName).join(" ")}] -> [${chordNext.map(pcName).join(" ")}]`
  );
}

/* ---------- статические проверки исходника (SFX, API, отсутствие внешних зависимостей) ---------- */

const REQUIRED_SFX = [
  "laser", "grenade", "explosion", "bigexpl", "hit", "death", "pickup", "powerup", "teleport",
  "jump", "land", "exo", "menu", "select", "deny", "alarm", "missile", "crusher", "clear", "gameover", "win"
];
const tableStart = SRC.indexOf("const SFX_TABLE = {");
const tableEnd = SRC.indexOf("function sfx(", tableStart);
if (tableStart < 0 || tableEnd < 0) {
  err("не найден SFX_TABLE");
} else {
  const tableSrc = SRC.slice(tableStart, tableEnd);
  const found = [];
  const re = /^\s{4}([a-z]+): function \(t\)/gm;
  let m;
  while ((m = re.exec(tableSrc))) found.push(m[1]);
  for (const id of REQUIRED_SFX) {
    if (!found.includes(id)) err(`SFX_TABLE: нет эффекта "${id}"`);
  }
  for (const id of found) {
    if (!REQUIRED_SFX.includes(id)) err(`SFX_TABLE: лишний эффект "${id}"`);
  }
}

const REQUIRED_API = [
  "init", "unlock", "ready", "setMusic", "setSfx", "setVolume",
  "playMusic", "stopMusic", "sfx", "duck", "setIntensity"
];
for (const name of REQUIRED_API) {
  const re = new RegExp("^\\s{4}" + name + ": ", "m");
  if (!re.test(SRC)) err(`API: не найден метод ${name}`);
}
if (!/get: function \(\) \{ return musicOn; \}/.test(SRC)) err("API: нет boolean-геттера music");
if (!/window\.EX_AUDIO = api;/.test(SRC)) err("API: нет window.EX_AUDIO = api");

if (/console\.(warn|error|log)\(/.test(SRC)) err("в audio.js есть console.* (probe считает warning/error провалом)");
if (/^\s*(import|export)\s/m.test(SRC)) err("в audio.js есть import/export (запрещено)");
if (/https?:\/\//.test(SRC)) err("в audio.js есть внешний URL");
if (/\.(mp3|ogg|wav|mod|flac)\b/i.test(SRC)) err("в audio.js есть ссылка на аудиофайл (сэмплы запрещены)");

// итоговый отчёт
console.log("=== ТРЕКИ ===");
for (const line of info) console.log("  " + line);
console.log(`\n=== ПРОВЕРКИ: треков ${order.length} ===`);
if (warns.length) {
  console.log(`⚠ предупреждения (${warns.length}):`);
  for (const w of warns.slice(0, 40)) console.log("   " + w);
}
if (errors.length) {
  console.log(`✗ ошибки (${errors.length}):`);
  for (const e of errors.slice(0, 60)) console.log("   " + e);
  process.exitCode = 1;
} else {
  console.log("✓ структура и гармония в порядке");
}
