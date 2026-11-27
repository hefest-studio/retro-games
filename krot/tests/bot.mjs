/* МУРАВЕЙНИК · бот: «человек» для проверки баланса. Каждые 0.12 с строит путь Дейкстрой по сетке (земля дороже туннеля),
   несёт столько крошек, сколько вмещает колонна, обходит жуков (с вероятностью miss «не замечает» их в этом расчёте) и жмёт «Обвал»,
   когда охотник близко к хвосту — с задержкой react и успехом brakeOk. Запуск: node krot/tests/bot.mjs [партий=12] [seed=1] [miss] [react] [ok] */
import fs from 'node:fs'; import vm from 'node:vm'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
vm.runInThisContext(fs.readFileSync(path.join(here, '../js/game.js'), 'utf8'));
export const MU = globalThis.MURAV;
const DT = 1 / 30, { COLS, ROWS, DX, DY } = MU.consts;

function rng(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// Дейкстра от клетки: цена шага — 1 по туннелю, 2 по земле, +штраф у жуков
function dijkstra(S, sx, sy, danger, bodyArr) {
  const dist = new Map(), first = new Map(), key = (x, y) => y * 32 + x, pq = [[0, sx, sy, -1]]; dist.set(key(sx, sy), 0);
  const body = new Set((bodyArr || S.ants.slice(1)).map((a) => key(a.x, a.y)));
  while (pq.length) {
    let bi = 0; for (let i = 1; i < pq.length; i++) if (pq[i][0] < pq[bi][0]) bi = i;
    const [c, x, y, f] = pq.splice(bi, 1)[0]; if (c > dist.get(key(x, y))) continue;
    for (let d = 0; d < 4; d++) {
      const X = x + DX[d], Y = y + DY[d]; if (X < 0 || Y < 0 || X >= COLS || Y >= ROWS) continue; const ch = S.map[Y][X];
      if (ch === '#' || body.has(key(X, Y))) continue;
      const nc = c + (ch === '1' ? 2 : 1) + (danger[key(X, Y)] || 0);
      if (!dist.has(key(X, Y)) || nc < dist.get(key(X, Y))) { dist.set(key(X, Y), nc); first.set(key(X, Y), f < 0 ? d : f); pq.push([nc, X, Y, f < 0 ? d : f]); }
    }
  }
  return { dist, first, key };
}

export function play(seed, o = {}) {
  const R = rng(seed), miss = o.miss ?? 0.2, react = o.react ?? 0.35, okp = o.ok ?? 0.75, maxT = o.maxT ?? 1500;
  const stats = o.stats || {}, g = MU.Game({ seed, level: o.startLevel || 0, onEvent: (t, d) => { if (t === 'hurt' || t === 'bite' || t === 'entomb' || t === 'collapse') { const k = t + (d.by || ''); stats[k] = (stats[k] || 0) + 1; } } }), S = g.state(); let t = 0, nextThink = 0, blind = false, blindT = 0, colT = -1, perLevel = [], lvT = 0, lastL = 0, dirKeep = -1;
  const lvLimit = o.levels ? (o.startLevel || 0) + o.levels : 99;
  while (t < maxT && !g.isOver() && S.level < lvLimit) {
    if (S.level !== lastL) { perLevel.push(Math.round(t - lvT)); lvT = t; lastL = S.level; }
    if (S.mode === 'play' && t >= nextThink) {
      nextThink = t + 0.12 + R() * 0.1; blindT -= 0.15; if (blindT <= 0) { blind = R() < miss; blindT = 0.6 + R(); }
      const danger = {}, kk = (x, y) => y * 32 + x, hunters = S.beetles.filter((b) => b.st === 'walk');
      if (!blind) hunters.forEach((b) => { for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const dd = Math.abs(dx) + Math.abs(dy); if (dd <= 2) danger[kk(b.cx + dx, b.cy + dy)] = (danger[kk(b.cx + dx, b.cy + dy)] || 0) + (3 - dd) * 6; } });
      const load = S.ants.filter((a) => a.c).length, cap = S.ants.length, need = S.quota - S.got, crumbs = S.crumbs.filter((c) => c.on);
      const goHome = load >= Math.min(cap, need) || (!crumbs.length && load > 0);
      const head = S.ants[0], tail = S.ants[S.ants.length - 1]; const mvg = S.mv, hx = mvg ? mvg.tx : head.x, hy = mvg ? mvg.ty : head.y; let res = dijkstra(S, hx, hy, danger, mvg ? S.ants.slice(0, -1) : null), dirN = -1, tgt = null;
      const pick = (r) => { let best = null, bc = 1e9; if (goHome) { for (let x = 0; x < COLS; x++) { const c = r.dist.get(kk(x, 0)); if (c != null && c < bc) { bc = c; best = [x, 0]; } } }
        else crumbs.forEach((c) => { const v = r.dist.get(kk(c.x, c.y)); if (v != null && v < bc) { bc = v; best = [c.x, c.y]; } }); return best && { p: best, c: bc }; };
      tgt = pick(res);
      if (!tgt && S.ants.length > 1 && !mvg) { const r2 = dijkstra(S, tail.x, tail.y, danger), t2 = pick(r2); if (t2) { const nk = S.ants[1]; dirN = DX.findIndex((_, d) => head.x + DX[d] === nk.x && head.y + DY[d] === nk.y); } }
      else if (tgt) dirN = res.first.get(kk(tgt.p[0], tgt.p[1])) ?? -1;
      if (head.y === 0 && goHome && load) { const free = [1, 3].filter((d) => { const x = head.x + DX[d]; return x >= 0 && x < COLS && !S.ants.some((a) => a.x === x && a.y === 0); }); dirN = free.length ? free[(head.x < 5) ? 0 : free.length - 1] : -1; }
      else if (head.y === 0 && goHome) dirN = -1;
      if (dirN < 0 && head.y === 0 && !goHome) dirN = 2;
      if (process.env.DBG && t > +process.env.DBG && t < +process.env.DBG + 3) console.log(t.toFixed(2), "head", head.x, head.y, "dirN", dirN, "tgt", JSON.stringify(tgt), "flipN", goHome, "mv", JSON.stringify(S.mv && [S.mv.d, S.mv.t.toFixed(2)]));
      // жук спереди: развернуться (вход в «шею»), затем обвал позади нового хвоста
      if (!blind && S.ants.length > 1 && head.y > 0) {
        const seen = new Map([[kk(head.x, head.y), 0]]); let q = [[head.x, head.y]], thr = null;
        for (let dd = 1; dd <= 4 && !thr; dd++) { const nq = []; for (const [x, y] of q) for (let d = 0; d < 4; d++) { const X = x + DX[d], Y = y + DY[d]; if (X < 0 || Y < 1 || X >= COLS || Y >= ROWS || S.map[Y][X] !== '.' || seen.has(kk(X, Y))) continue; seen.set(kk(X, Y), dd); nq.push([X, Y]);
          if (S.beetles.some((b) => b.st === 'walk' && b.cx === X && b.cy === Y)) thr = { d: dd }; } q = nq; }
        if (thr && S.cd <= 0) { const nk = S.ants[1]; dirN = DX.findIndex((_, d) => head.x + DX[d] === nk.x && head.y + DY[d] === nk.y); if (colT < 0) colT = t + react; }
      }
      g.setDir(dirN);
      // обвал: охотник/грызун близко позади хвоста
      if (colT < 0 && S.cd <= 0) { const near = hunters.some((b) => b.t !== 'W' && Math.abs(b.cx - tail.x) + Math.abs(b.cy - tail.y) <= 4 && tail.y > 0 && (Math.abs(b.cx - tail.x) + Math.abs(b.cy - tail.y)) < (Math.abs(b.cx - head.x) + Math.abs(b.cy - head.y))); if (near) colT = t + react; }
    }
    if (colT >= 0 && t >= colT) { colT = -1; if (R() < okp) g.collapse(); }
    g.step(DT); t += DT;
  }
  perLevel.push(Math.round(t - lvT));
  return { win: S.mode === 'victory' || S.level >= lvLimit, level: S.level + 1, score: S.score, lives: S.lives, t: Math.round(t), perLevel, len: S.ants.length, S };
}

if (process.argv[1] && process.argv[1].endsWith('bot.mjs')) {
  const n = +process.argv[2] || 12, s0 = +process.argv[3] || 1, o = { miss: process.argv[4] != null ? +process.argv[4] : undefined, react: process.argv[5] != null ? +process.argv[5] : undefined, ok: process.argv[6] != null ? +process.argv[6] : undefined };
  let w = 0; const lv = [], stats = {}; o.stats = stats;
  for (let i = 0; i < n; i++) { const r = play(s0 * 100 + i, o); if (r.win) w++; lv.push(r.level); const {S: _s, ...rr} = r; console.log(JSON.stringify(rr)); }
  console.log(JSON.stringify(stats)); console.log('побед ' + w + '/' + n + ' (' + Math.round(100 * w / n) + '%), уровни: ' + lv.join(' '));
}
