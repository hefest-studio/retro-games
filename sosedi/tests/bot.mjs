/* СОСЕДИ · tests/bot.mjs — «человеческий» бот по настоящей логике игры (SOSEDI.Game).
   Каждые 150–250 мс (реакция) бот заново смотрит на мир и выбирает ввод, между решениями держит его.
   Цели по очереди: ближайший по пути ждущий сосед (до которого можно дойти; запертые дома — после ключа),
   ключ, если есть запертые двери, затем — открытый выход. Путь — BFS по клеткам (запертая дверь проходима, если есть ключ).
   Стрельба: игрушка ближе ~95 px — поворачивается к ней (огонь идёт по взгляду) и стреляет водой; мелочь — пузырями,
   толпа из 3+ — фейерверком. Человеческий шум: часть игрушек «не замечает» (miss), изредка засматривается (lapse).
   opts: { react:[0.15,0.25], miss=0.15, lapse=0.03, maxT=240, level=1, players=1, god=false } */

export function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}

const DIR8 = [[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1],[0,-1],[1,-1]];
function snap8(dx, dy){ const a = Math.atan2(dy, dx), k = ((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8; return DIR8[k]; }

// BFS по клеткам от (sx,sy); passDoor — запертые двери считаются проходимыми
export function pathTo(SO, M, sx, sy, goal, passDoor){
  const LV = SO.levels, T = LV.T, W = LV.MW, H = LV.MH, prev = new Int32Array(W * H).fill(-2), q = [sy * W + sx];
  prev[q[0]] = -1; const gk = goal.y * W + goal.x;
  for (let h = 0; h < q.length; h++){
    const k = q[h]; if (k === gk) break; const x = k % W, y = (k / W) | 0;
    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
      const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const nk = ny * W + nx, c = M.t[nk]; if (prev[nk] !== -2) continue;
      if (LV.WALK[c] || (passDoor && c === T.D)){ prev[nk] = k; q.push(nk); }
    }
  }
  if (prev[gk] === -2) return null;
  const out = []; for (let k = gk; k !== -1; k = prev[k]) out.push(k); out.reverse(); return out;
}

export function makeBot(SO, game, pi, rng, o = {}){
  const LV = SO.levels, TS = LV.TS, W = LV.MW, L = SO.logic;
  const react = o.react || [0.15, 0.25], miss = o.miss ?? 0.15, lapse = o.lapse ?? 0.03;
  let wait = 0, cur = { x: 0, y: 0, fire: false }, ignored = new Set(), stuckT = 0, last = null, jig = null;
  function think(){
    const S = game.state(), M = game.level(), h = S.heroes[pi];
    if (!h || !h.alive || S.phase !== 'play') return { x: 0, y: 0, fire: false };
    if (rng() < lapse) return { x: 0, y: 0, fire: false };
    const hx = Math.floor(h.x / TS), hy = Math.floor(h.y / TS);
    // угрозы: ближайшая замеченная игрушка
    let th = null, td = 1e9, crowd = 0;
    for (const t of S.toys){ if (t.rise > 0) continue; if (!ignored.has(t.id) && rng() < miss * 0.2) ignored.add(t.id); if (ignored.has(t.id)) continue;
      const d = Math.hypot(t.x - h.x, t.y - h.y); if (d < 60) crowd++; if (d < td){ td = d; th = t; } }
    const B = S.boss && !S.boss.dead ? S.boss : null;
    if (B){ const d = Math.hypot(B.x - h.x, B.y - h.y) - B.r; if (d < td){ td = d; th = B; } }
    if (th && td < (th === B ? 150 : 95)){
      const [fx, fy] = snap8(th.x - h.x, th.y - h.y);
      const small = th !== B && L.TY[th.type] && L.TY[th.type].small;
      let want = 0; // вода
      if (crowd >= 3 && h.ammo.fire > 0) want = 4; else if (small && h.ammo.bubble > 0 && td > 30) want = 3; else if (th === B && h.ammo.paint > 0 && td > 60) want = 1;
      if (h.w !== want) game.select(pi, want);
      // слишком близко — пятится, стреляя (сначала разворот к цели)
      const facing = Math.abs(h.fx - fx) < 0.5 && Math.abs(h.fy - fy) < 0.5;
      if (!facing) return { x: fx, y: fy, fire: true };
      if (td < (th === B ? 70 : 26)) return { x: -fx, y: -fy, fire: false };
      return { x: 0, y: 0, fire: true };
    }
    if (h.w !== 0) game.select(pi, 0);
    // цель
    const goals = [];
    for (const nb of S.neighbors) if (nb.state === 'wait' && !nb.secret) goals.push({ x: Math.floor(nb.x / TS), y: Math.floor(nb.y / TS), k: 'nb' });
    for (const p of S.pickups) if (p.kind === 'key') goals.push({ x: Math.floor(p.x / TS), y: Math.floor(p.y / TS), k: 'key' });
    if (S.exitOpen) goals.push({ x: M.exit.x, y: M.exit.y, k: 'exit' });
    // в коопе оба идут к цели, ближайшей к И1 (иначе разбегутся и упрутся в край кадра)
    const lead = pi > 0 && S.heroes[0].alive ? S.heroes[0] : h, lx = Math.floor(lead.x / TS), ly = Math.floor(lead.y / TS);
    let best = null;
    for (const g of goals){ const p = pathTo(SO, M, lx, ly, g, S.keys > 0); if (p && (!best || p.length < best.p.length)) best = { g, p }; }
    if (best && lead !== h){ const p = pathTo(SO, M, hx, hy, best.g, S.keys > 0); best = p ? { g: best.g, p } : null; }
    if (!best){ return { x: 0, y: 0, fire: false }; }
    const p = best.p; let nk = p[Math.min(1, p.length - 1)];
    const tx = (nk % W) * TS + TS / 2, ty = Math.floor(nk / W) * TS + TS / 2;
    let dx = tx - h.x, dy = ty - h.y; if (Math.abs(dx) < 2) dx = 0; if (Math.abs(dy) < 2) dy = 0;
    if (p.length <= 1){ dx = (best.g.x * TS + 8) - h.x; dy = (best.g.y * TS + 8) - h.y; }
    // застрял — небольшой «дёрг» в сторону
    if (last && Math.hypot(last.x - h.x, last.y - h.y) < 0.5) stuckT += 0.2; else stuckT = 0;
    last = { x: h.x, y: h.y };
    if (stuckT > 0.6){ stuckT = 0; jig = [rng() < 0.5 ? 1 : -1, rng() < 0.5 ? 1 : -1]; return { x: jig[0], y: jig[1], fire: false }; }
    const l = Math.hypot(dx, dy) || 1;
    return { x: dx / l, y: dy / l, fire: false };
  }
  return function tick(dt){
    wait -= dt;
    if (wait <= 0){ wait = react[0] + rng() * (react[1] - react[0]); cur = think(); }
    game.setInput(pi, cur);
  };
}

// Партия бота на одном уровне: → { cleared, lost, saved, over, time }
export function playLevel(SO, seed, o = {}){
  const rng = mulberry32(seed * 977 + 5);
  const game = SO.Game({ rng: mulberry32(seed), players: o.players || 1, level: o.level || 1 }).start();
  const S = game.state();
  const bots = S.heroes.map((h, i) => makeBot(SO, game, i, mulberry32(seed * 31 + i * 7 + 1), o));
  if (o.god) S.heroes.forEach(h => { h.lives = 99; });
  const dt = 1 / 60, maxT = o.maxT || 240, lvl = S.level;
  let t = 0;
  while (t < maxT){
    bots.forEach(b => b(dt)); game.update(dt); t += dt;
    if (o.god) S.heroes.forEach(h => { h.hp = 3; });
    if (S.phase === 'over' || S.phase === 'won') break;
    if (S.phase === 'clear' && !S.inBonus && S.level === lvl) return { cleared: true, lost: S.levelLost, saved: S.levelSaved, over: false, time: t, pool: S.pool, why: null };
  }
  return { cleared: false, lost: S.levelLost, saved: S.levelSaved, over: S.phase === 'over', time: t, pool: S.pool, why: S.why };
}

// Вся игра ботом (запас соседей и жизни переходят между уровнями): → { won, level, pool, why, saved, lost, score, time }
export function playGame(SO, seed, o = {}){
  const game = SO.Game({ rng: mulberry32(seed), players: o.players || 1, level: o.level || 1 }).start();
  const S = game.state();
  const bots = S.heroes.map((h, i) => makeBot(SO, game, i, mulberry32(seed * 31 + i * 7 + 1), o));
  const dt = 1 / 60, maxT = o.maxT || 3600; let t = 0, lvT = 0, lv = S.level, bonus = 0;
  while (t < maxT && S.phase !== 'over' && S.phase !== 'won'){
    bots.forEach(b => b(dt)); game.update(dt); t += dt; lvT += dt;
    if (S.level !== lv || S.inBonus){ if (S.inBonus && lvT > 0.1 && S.phase === 'intro' && S.phaseT < dt * 1.5) bonus++; if (S.level !== lv){ lv = S.level; lvT = 0; } }
    if (lvT > (o.lvMax || 300)) break;   // «завис» на уровне
  }
  return { won: S.phase === 'won', level: S.level, pool: S.pool, why: S.why || (S.phase === 'won' ? null : 'stuck'), saved: S.savedTotal, lost: S.lostTotal, score: S.score, time: t, bonus };
}
