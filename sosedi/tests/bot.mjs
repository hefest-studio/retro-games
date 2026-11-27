/* ШПУЛЬКА · бот-«человек» для проверки баланса. Каждые ~1 с выбирает «макро-ход» (подождать w с, держать h с) перебором на клоне
   состояния (враги считаются честно), оценка: пуговицы, ушко, смерть, ближайшее сближение с целью. Человеческие ошибки: с вероятностью
   miss решает «вслепую» (враги в расчёте не видны), с вероятностью slip берёт случайный ход, реакция — решения только на границах ходов.
   Запуск: node sosedi/tests/bot.mjs [партий=10] [seed=1] [miss] [slip] */
import fs from 'node:fs'; import vm from 'node:vm'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
vm.runInThisContext(fs.readFileSync(path.join(here, '../js/game.js'), 'utf8'));
export const SP = globalThis.SPOOL;
const DT = 1 / 30;
function rng(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const WAITS = [0, 0.2, 0.45], HOLDS = [0.25, 0.5, 0.8, 1.2, 1.7];
const OPTS = [[1.0, 0]]; for (const w of WAITS) for (const h of HOLDS) OPTS.push([w, h]);
function target(S) { const t = []; for (const b of S.buttons) if (b.on) t.push([b.x, b.y]); if (!t.length && S.exitOpen) t.push([S.exit.x, S.exit.y]); return t; }
function near(S, ts) { let m = 1e9; for (const t of ts) m = Math.min(m, Math.hypot(S.hero.x - t[0], S.hero.y - t[1])); return m; }
// прогон макро-хода на клоне; возвращает оценку
function evalOpt(g0, o, blind) {
  const g = g0.clone(), S = g.state(); if (blind) S.foes = [];
  const left0 = S.left, lv0 = S.level, lives0 = S.lives; let t = 0, best = 1e9;
  const tg = target(S), seq = [[o[0], false], [o[1], true], [0.7, false]];
  for (const [dur, hold] of seq) { if (dur <= 0) continue; g.setHold(hold); for (let k = 0; k < dur / DT && S.mode === 'play'; k++) { g.step(DT); t += DT; if (S.level === lv0) best = Math.min(best, near(S, target(S).length ? target(S) : tg)); } }
  let v = (left0 - S.left) * 1000 - (S.mode === 'dying' || S.lives < lives0 ? 6000 : 0) - Math.min(best, 400) * 1.2;
  if (S.level !== lv0 || S.mode === 'clear' || S.mode === 'victory') v += 4000; else if (S.exitOpen && left0 > 0) v += 600;
  return v;
}
export function play({ seed = 1, miss = 0.06, slip = 0.05, startLevel = 0, levels = 8, maxT = 700, noFoes = false } = {}) {
  const R = rng(seed * 7919), g = SP.Game({ level: startLevel }), S = g.state(); let T = 0, committed = [];
  const res = { levels: 0, win: false, score: 0, deaths: 0, time: 0 };
  let lastLv = S.level;
  while (T < maxT) {
    if (S.mode === 'gameover') break; if (S.mode === 'victory') { res.win = true; break; }
    if (S.level - startLevel >= levels) { res.win = true; break; }
    if (S.level !== lastLv) { lastLv = S.level; committed = []; }
    if (S.mode !== 'play') { g.setHold(false); g.step(DT); T += DT; continue; }
    if (noFoes) S.foes = [];
    if (!committed.length) {
      const blind = R() < miss; let bi = 0, bv = -1e9;
      if (R() < slip) bi = Math.floor(R() * OPTS.length);
      else for (let i = 0; i < OPTS.length; i++) { const v = evalOpt(g, OPTS[i], blind) + R() * 30; if (v > bv) { bv = v; bi = i; } }
      const o = OPTS[bi]; committed = [[o[0], false], [o[1], true]];
    }
    const c = committed[0]; g.setHold(c[1]); const n = Math.max(1, Math.round(c[0] / DT)); for (let k = 0; k < n && S.mode === 'play'; k++) { g.step(DT); T += DT; } committed.shift(); g.setHold(false);
  }
  res.levels = S.level + (S.mode === 'victory' ? 1 : 0) - startLevel; res.score = S.score; res.deaths = S.stats.deaths; res.time = Math.round(T); res.mode = S.mode;
  return res;
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const N = +process.argv[2] || 10, s0 = +process.argv[3] || 1, miss = process.argv[4] != null ? +process.argv[4] : 0.06, slip = process.argv[5] != null ? +process.argv[5] : 0.05;
  let wins = 0; const t0 = Date.now(), per = [];
  for (let i = 0; i < N; i++) { const r = play({ seed: s0 + i, miss, slip }); wins += r.win ? 1 : 0; per.push(r.levels + (r.win ? '!' : '') + '/' + r.deaths + 'd'); }
  console.log('партий', N, 'побед', wins, '(' + Math.round(100 * wins / N) + '%)', 'уровней/смертей', per.join(' '), 'мс', Date.now() - t0);
}
