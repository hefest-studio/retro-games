/* КАТЫШ · бот: «человек» для проверки баланса. Перебирает наперёд 1–3 наката (клон состояния, коты считаются честно),
   но ошибается как человек: с вероятностью miss не замечает котов в расчёте (решение «вслепую»), реакцию на кота на пути (тормоз)
   запаздывает на react секунд и срабатывает не всегда (brakeOk). Запуск: node hrum/tests/bot.mjs [партий=12] [seed=1] [miss] [brakeOk] */
import fs from 'node:fs'; import vm from 'node:vm'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
vm.runInThisContext(fs.readFileSync(path.join(here, '../js/game.js'), 'utf8'));
export const KT = globalThis.KATYSH;
const DT = 1 / 30;

function rng(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
// число накатов до ближайшего наката, который заденет оставшееся семечко (BFS по графу остановок)
const nearest = (S) => {
  const on = new Set(S.seeds.filter((s) => s.on).map((s) => s.x + ',' + s.y)); if (!on.size) return 0;
  const { DX, DY, COLS, ROWS } = KT.consts, W = (x, y) => x < 0 || y < 0 || x >= COLS || y >= ROWS || S.map[y][x] === '#';
  const seen = new Set([S.hero.cx + ',' + S.hero.cy]); let fr = [[S.hero.cx, S.hero.cy]];
  for (let n = 1; n < 12; n++) { const nx = [];
    for (const [x0, y0] of fr) for (let d = 0; d < 4; d++) { let x = x0, y = y0, mv = 0, hit = false; while (!W(x + DX[d], y + DY[d])) { x += DX[d]; y += DY[d]; mv++; if (on.has(x + ',' + y)) hit = true; if (S.map[y][x] === 'h') break; }
      if (hit) return n; if (mv && !seen.has(x + ',' + y)) { seen.add(x + ',' + y); nx.push([x, y]); } }
    fr = nx; }
  return 12; };
// прогон: действие 0..3 — накат до остановки, 4 — ждать 0.5 с. Возвращает {dead, got, g}
function roll(g, a) {
  const S = g.state(), left0 = S.left, lives0 = S.lives; let t = 0;
  if (a === 4) { while (t < 0.5 && S.mode === 'play') { g.step(DT); t += DT; } }
  else { g.setDir(a); if (!S.hero.moving && S.want < 0) { /* упёрся */ return { dead: false, got: 0, noop: true }; } while (S.mode === 'play' && (S.hero.moving) && t < 4) { g.step(DT); t += DT; } }
  return { dead: S.mode !== 'play' && S.mode !== 'clear' || S.lives < lives0, got: left0 - S.left };
}
function search(g0, depth, ignoreCats, R) {
  const S0 = g0.state(); let best = { a: -1, v: -1e9 };
  const rec = (g, d, acc) => {
    let bv = -1e9;
    for (let a = 0; a < 5; a++) {
      const c = g.clone(); const r = roll(c, a); if (r.noop) continue;
      const S = c.state(); let v = acc + (R ? R() * 12 : 0) + r.got * 400 - (a === 4 ? 6 : 0) - S.time * 0.01;
      if (r.dead) v -= 2000; else if (S.mode === 'clear') v += 400; else if (d > 1) v = rec(c, d - 1, v); else v -= nearest(S) * 25;
      if (v > bv) bv = v; if (d === depth && v > best.v) best = { a, v };
    }
    return bv === -1e9 ? acc : bv;
  };
  const g = g0.clone(); if (ignoreCats) g.state().cats = [];
  rec(g, depth, 0); return best;
}
function danger(g, secs) { const c = g.clone(), S = c.state(), l = S.lives; for (let t = 0; t < secs && S.mode === 'play'; t += DT) c.step(DT); return S.lives < l || S.mode === 'dying'; }

export function play({ seed = 1, miss = 0.05, brakeOk = 0.82, react = 0.18, startLevel = 0, levels = 8, maxT = 600, depth = 2 } = {}) {
  const R = rng(seed * 7919), g = KT.Game({ level: startLevel, seed }), S = g.state(); let T = 0, brakeWait = 0, blind = false, lastGot = 0, lastLeft = S.left;
  const res = { levels: 0, win: false, score: 0, deaths: 0, time: 0 };
  while (T < maxT) {
    if (S.mode === 'gameover') break; if (S.mode === 'victory') { res.win = true; break; }
    if (S.level - startLevel >= levels) { res.win = true; break; }
    if (S.left !== lastLeft) { lastLeft = S.left; lastGot = T; }
    if (S.mode === 'play') {
      if (!S.hero.moving && S.want < 0) {
        blind = R() < miss; const b = search(g, T - lastGot > 8 ? 3 : depth, blind, R);
         if (b.a === 4) { for (let t = 0; t < 0.5 && S.mode === 'play'; t += DT) { g.step(DT); T += DT; } continue; }
        if (b.a >= 0) g.setDir(b.a); else g.setDir(Math.floor(R() * 4));
      } else if (S.hero.moving && !S.hero.stopNext && S.brakeC >= 1 && !blind) {
        if (brakeWait > 0) { brakeWait -= DT; if (brakeWait <= 0 && danger(g, 0.45)) g.brake(); }
        else if (danger(g, 0.6) && R() < brakeOk) brakeWait = react;
      } else brakeWait = 0;
    }
    g.step(DT); T += DT;
  }
  res.rem = S.seeds.filter(s=>s.on).map(s=>s.x+","+s.y).join(" "); res.levels = S.level + (S.mode === 'victory' ? 1 : 0) - startLevel; res.score = S.score; res.deaths = S.stats.deaths; res.time = Math.round(T); res.mode = S.mode;
  return res;
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const N = +process.argv[2] || 12, s0 = +process.argv[3] || 1, miss = process.argv[4] != null ? +process.argv[4] : 0.05, bo = process.argv[5] != null ? +process.argv[5] : 0.82;
  let wins = 0; const t0 = Date.now(), per = [];
  for (let i = 0; i < N; i++) { const r = play({ seed: s0 + i, miss, brakeOk: bo }); wins += r.win ? 1 : 0; per.push(r.levels + (r.win ? '!' : '')); }
  console.log('партий', N, 'побед', wins, '(' + Math.round(100 * wins / N) + '%)', 'уровней по партиям', per.join(' '), 'мс', Date.now() - t0);
}
