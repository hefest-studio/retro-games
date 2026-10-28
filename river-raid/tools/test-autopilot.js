/* Автопилот: оценка баланса. Бот держится коридора, обходит острова/врагов,
   стреляет вперёд и проходит мосты. Запуск:
   node tools/cdp.mjs eval --page index.html --script tools/test-autopilot.js --wait 500 */
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

function segmentsAhead(S) {
  const margin = 15;
  let lo = -1e9, hi = 1e9;
  for (const dy of [4, 60, 120, 180, 240]) {
    const r = RR.riverAt(S.camY + dy);
    lo = Math.max(lo, r.L + margin);
    hi = Math.min(hi, r.R - margin);
  }
  let segs = [[lo, hi]];
  const cut = (a, b) => {
    const out = [];
    for (const [s, e] of segs) {
      if (b <= s || a >= e) { out.push([s, e]); continue; }
      if (a > s) out.push([s, a]);
      if (b < e) out.push([b, e]);
    }
    segs = out;
  };
  for (const is of S.islands) {
    if (is.y + is.ry > S.camY + 4 && is.y - is.ry < S.camY + 270) cut(is.x - is.rx - 18, is.x + is.rx + 18);
  }
  for (const e of S.enemies) {
    if (!e.dead && e.y > S.camY + 4 && e.y < S.camY + 240) cut(e.x - 25, e.x + 25);
  }
  segs = segs.filter(([a, b]) => b - a > 24);
  if (!segs.length) {
    const r = RR.riverAt(S.camY);
    return clamp(S.planeX, r.L + 18, r.R - 18);
  }
  segs.sort((p, q) => Math.abs((p[0] + p[1]) / 2 - S.planeX) - Math.abs((q[0] + q[1]) / 2 - S.planeX));
  const [a, b] = segs[0];
  return clamp((a + b) / 2, a + 4, b - 4);
}

function runOne(maxSeconds) {
  RR.test.startGame();
  const S = RR.S;
  let t = 0, lastLevel = 1, prevTx = S.planeX;
  const events = [];
  while (t < maxSeconds) {
    if (S.mode === 'over') break;
    if (S.mode === 'play' && !S.paused) {
      const tx = segmentsAhead(S);
      prevTx = prevTx * 0.45 + tx * 0.55;
      RR.test.hold('left', S.planeX > prevTx + 5);
      RR.test.hold('right', S.planeX < prevTx - 5);
      RR.test.hold('fire', true);
      RR.test.hold('up', S.fuel < 14);
    }
    RR.test.update(1 / 60);
    t += 1 / 60;
    if (S.level !== lastLevel) {
      events.push({ level: S.level, at: Math.round(t), fuel: Math.round(S.fuel), lives: S.lives });
      lastLevel = S.level;
    }
  }
  RR.test.hold('fire', false); RR.test.hold('left', false); RR.test.hold('right', false); RR.test.hold('up', false);
  return {
    seconds: Math.round(t), mode: S.mode, level: S.level, score: S.score, lives: S.lives,
    fuel: Math.round(S.fuel), deaths: 3 - S.lives, reason: S.deathReason, events,
  };
}

const runs = [];
for (let i = 0; i < 3; i++) runs.push(runOne(150));
return {
  runs,
  levels: runs.map((r) => r.level),
  avgSeconds: Math.round(runs.reduce((a, r) => a + r.seconds, 0) / runs.length),
};
