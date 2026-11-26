/* ЭСКАДРИЛЬЯ · tests/bot.mjs — «человеческий» бот для проверки баланса и проходимости (переделка 2026-11: наводка и завеса).
   Без читов: видит то же, что на экране (враги, наземные цели, гондолы кузни, пули, бонусы, красные линии наводки, клубы дыма),
   управляет только как игрок — setDir(dx,dy), setSmoke(bool) (огонь автоматический).
   Человеческие ограничения:
   - реакция: видит картинку 150–250 мс давности, поправляет курс ~12 раз/с;
   - внимание: следит только за attn=6 ближайшими пулями, скорость пуль оценивает «на глаз» (±velErr), часть пуль не замечает;
   - дым включает, только когда видит линию наводки сверху/спереди (и не всегда успевает — smokeSkill), держит ≥ 0,35 с;
   - иногда «засматривается» (lapse — доля пропущенных решений); прицел с разбросом ±aimErr px.
   opts: { levels=8, startLevel=1, react:[0.15,0.25], aimErr=8, lapse=0.06, miss=0.05, smokeSkill=0.7, perfect=false, maxLevelT=300, power, noSmoke } */

export function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}

export function playEskadrilya(E, seed, opts = {}){
  const L = E.logic, perfect = !!opts.perfect, levels = opts.levels || 8, start = opts.startLevel || 1;
  const brng = mulberry32(seed * 7919 + 17);
  const gauss = () => { let u = 0; for (let i = 0; i < 4; i++) u += brng(); return (u - 2) / 0.577; };
  const [r0, r1] = opts.react || [0.15, 0.25];
  const react = perfect ? 0.1 : r0 + brng() * (r1 - r0);
  const aimErr = perfect ? 2 : (opts.aimErr == null ? 8 : opts.aimErr);
  const lapse = perfect ? 0 : (opts.lapse == null ? 0.06 : opts.lapse);
  const missP = perfect ? 0 : (opts.miss == null ? 0.05 : opts.miss);
  const smokeSkill = opts.noSmoke ? 0 : perfect ? 0.95 : (opts.smokeSkill == null ? 0.7 : opts.smokeSkill);
  const maxLevelT = opts.maxLevelT || 300;
  const attn = opts.attn || 6, hz = opts.hz || 12;
  const lost = {}, levelTime = {};
  let S = null, broken = 0, sooted = 0;
  const game = E.Game({ rng: mulberry32(seed), level: start, maxLevel: start + levels - 1, difficulty: opts.difficulty, noTut: opts.noTut,
    onEvent: (t, d) => { if (opts.onEvent) opts.onEvent(t, d, S); if (t === 'playerLost') lost[S.level] = (lost[S.level] || 0) + 1; if (t === 'aimBroken') broken++; if (t === 'sooted') sooted++; } }).start();
  S = game.state();
  if (opts.power) S.player.power = opts.power;   // как будто прилетел с прошлых перелётов
  const h = 1 / 60, hist = [];
  let t = 0, tLevel = 0, curLevel = S.level, stuck = 0, nextDecide = 0, mvx = 0, mvy = 0, noise = 0, aimKey = null, smokeUntil = 0;

  const seen = new WeakMap();
  const velErr = perfect ? 0.03 : (opts.velErr == null ? 0.12 : opts.velErr);
  function noticed(b){ if (!seen.has(b)) seen.set(b, brng() >= missP ? 1 + gauss() * velErr : 0); return seen.get(b); }
  function snap(){
    const v = { t, bullets: [], air: [], ground: [], pods: [], pickups: [], aims: S.aims.map(a => ({ x: a.x, y: a.y, k: a.k })) };
    for (const b of S.bullets){ const k = noticed(b); if (k) v.bullets.push({ x: b.x, y: b.y, vx: b.vx * k, vy: b.vy * k }); }
    for (const e of S.air) if (e.alive) v.air.push({ x: e.x, y: e.y, vx: e.type === 'swift' ? e.vx : 0, vy: e.type === 'swift' ? e.vy : (e.pat === 'sine' ? e.vy : e.type === 'blimp' ? e.vy : 0), type: e.type, big: e.type === 'blimp' });
    for (const g of S.ground) if (g.alive) v.ground.push({ x: g.x, y: game._sy(g.wy), type: g.type });
    const B = S.boss;
    if (B && B.alive && !B.falling && B.anchored){
      for (const p of B.pods) if (p.alive) v.pods.push({ x: B.x + p.dx, y: B.y + p.dy });
      if (B.core.open) v.pods.push({ x: B.x, y: B.y - 4, core: true });
    }
    for (const q of S.pickups) v.pickups.push({ x: q.x, y: q.y, kind: q.kind });
    return v;
  }
  function danger(view, px, py, dx, dy, hold){
    const age = t - view.t, len = Math.hypot(dx, dy) || 1, V = L.PLAYER_V;
    let c = 0;
    const bl = view.focus || view.bullets;
    for (let k = 1; k <= 6; k++){
      const tt = k * 0.09, mv = Math.min(tt, hold);
      const x = Math.max(L.PX0, Math.min(L.PX1, px + dx / len * V * mv)), y = Math.max(L.PY0, Math.min(L.PY1, py + dy / len * V * mv));
      for (const b of bl){
        const bx = b.x + b.vx * (tt + age), by = b.y + b.vy * (tt + age), d = Math.hypot(bx - x, by - y);
        if (d < 22) c += (22 - d) / (0.25 + tt) * 2;
      }
      for (const e of view.air){
        const ex = e.x + e.vx * (tt + age), ey = e.y + e.vy * (tt + age), r = e.big ? 50 : 30, d = Math.hypot(ex - x, ey - y);
        if (d < r) c += (r - d) / (0.3 + tt);
      }
    }
    return c;
  }
  function decide(view){
    if (brng() < lapse) return;
    const P = S.player, px = P.x, py = P.y;
    view.focus = view.bullets.slice().sort((a, b) => Math.hypot(a.x - px, a.y - py) - Math.hypot(b.x - px, b.y - py)).slice(0, attn);
    let goalX = px, goalY = 520;
    let best = null;
    const cand = [];
    for (const e of view.air) if (e.y < py - 30 && e.y > 20) cand.push({ x: e.x + e.vx * 0.15, y: e.y, w: e.big ? 3 : 1, id: 'a' + Math.round(e.x / 40) });
    for (const g of view.ground) if (g.y < py - 40 && g.y > 60) cand.push({ x: g.x, y: g.y, w: g.type === 'depot' ? 1.5 : 1, id: 'g' + Math.round(g.y / 40) });
    for (const p of view.pods) cand.push({ x: p.x, y: p.y, w: 2, id: 'p' + Math.round(p.x), pod: true });
    for (const c of cand){
      let cost = Math.abs(c.x - px) / 120 - c.w * 0.3 + (c.y < 120 ? 0.3 : 0);
      if (c.id === aimKey) cost -= 0.25;
      if (!best || cost < best.cost) best = { cost, c };
    }
    if (best){
      if (best.c.id !== aimKey){ aimKey = best.c.id; noise = gauss() * aimErr; }
      goalX = best.c.x + noise;
      if (best.c.pod) goalY = 470;
    }
    for (const q of view.pickups){
      if (q.y > 120 && Math.abs(q.x - px) < 220) { goalX = q.x; goalY = Math.max(L.PY0 + 40, q.y + 20); break; }
    }
    let bestM = null;
    for (const dx of [-1, 0, 1]) for (const dy of [-1, 0, 1]) for (const hold of [0.18, 0.45]){
      const d = danger(view, px, py, dx, dy, hold);
      const len = Math.hypot(dx, dy) || 1, ex = px + dx / len * L.PLAYER_V * hold, ey = py + dy / len * L.PLAYER_V * hold;
      const g = Math.abs(ex - goalX) / 60 + Math.abs(ey - goalY) / 140;
      const c = d * 3 + g;
      if (!bestM || c < bestM.c) bestM = { c, d, dx, dy };
    }
    if (bestM.d < 0.05 && Math.abs(goalX - px) < 4 && Math.abs(goalY - py) < 20) { mvx = 0; mvy = 0; }
    else { mvx = bestM.dx; mvy = bestM.dy; if (Math.abs(goalX - px) < 4 && bestM.d < 0.05) mvx = 0; }
    // дым: видна линия наводки, стрелок спереди (сверху, в конусе) — включить завесу
    if (t > smokeUntil && P.smoke > 12){
      const front = view.aims.some(a => a.y < py - 40 && Math.abs(a.x - px) < (py - a.y) * 0.55);
      if (front && brng() < smokeSkill) smokeUntil = t + 0.35 + brng() * 0.25;
    }
  }

  while (!S.over){
    hist.push(snap());
    while (hist.length > 30) hist.shift();
    let vi = hist.length - 1; while (vi > 0 && hist[vi].t > t - react) vi--;
    const view = hist[vi];
    if (t >= nextDecide){ nextDecide = t + 1 / hz; decide(view); }
    game.setDir(mvx, mvy);
    game.setSmoke(t < smokeUntil);
    game.update(h); t += h;
    if (S.level !== curLevel){ levelTime[curLevel] = tLevel; curLevel = S.level; tLevel = 0; hist.length = 0; }
    tLevel += h;
    if (tLevel > maxLevelT){ stuck = S.level; break; }
  }
  if (S.over || stuck) levelTime[curLevel] = tLevel;
  const passed = S.won ? levels : (S.level - start);
  return { passed, won: S.won, lost, levelTime, stuck, score: S.score, react, broken, sooted };
}
