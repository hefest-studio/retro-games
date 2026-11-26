/* КАТАКОМБЫ · tests/bot.mjs — «человеческий» бот для проверки баланса и проходимости (переделка 2026-11, «Огненный обруч»).
   Без читов: управляет только как игрок — setDir(pi, dx, dy) (стик, аналоговый), setFire(pi, held) (бросок — по нажатию),
   на прокачке — choose (как стрелки + огонь). Человеческие ограничения:
   - решения раз в react = [0.18, 0.3] с, между решениями держит прежний стик;
   - замечает только тварей в кадре; целится с разбросом ±0.1 рад (дальше помогает автоприцел игры, как игроку);
   - план этажа видит (как игрок, который смотрит на карту): идёт к горящей чаше окунуть обруч, затем к месту, откуда
     холодная чаша видна по прямой, и бросает; когда горят все — к печати. Мало здоровья — встаёт в свет.
   opts: { startFloor=1, floors, players=1, maxFloorT=240, react:[0.18,0.3] } */

export function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}

export function playKatakomby(K, seed, opts = {}){
  const L = K.logic, T = L.T, start = opts.startFloor || 1;
  const floors = opts.floors || (L.FLOORS.length - start + 1);
  const brng = mulberry32(seed * 7919 + 17);
  const [r0, r1] = opts.react || [0.18, 0.3];
  const maxFloorT = opts.maxFloorT || 240;
  const game = K.Game({ rng: mulberry32(seed), players: opts.players || 1, floor: start, maxFloor: start + floors - 1 }).start();
  const S = game.state(), h = 1 / 60;
  const ctl = S.heroes.map(() => ({ next: 0, dx: 0, dy: 0, fire: false, lx: 0, ly: 0, still: 0, jig: 0, jdx: 0, jdy: 0 }));
  let t = 0, tFloor = 0, curFloor = S.floor, stuck = false, kills = 0, bestMult = 1, lit = 0;
  const plan = ['bnc', 'arm', 'spd', 'arm', 'bnc', 'spd', 'arm', 'bnc'];

  const pass = (tx, ty) => { if (tx < 0 || ty < 0 || tx >= S.W || ty >= S.H) return false; const c = S.grid[ty * S.W + tx]; return c === '.' || c === 'E'; };
  function bfs(H){
    const n = S.W * S.H, d = new Int16Array(n).fill(-1), par = new Int32Array(n).fill(-1);
    const s = Math.floor(H.y / T) * S.W + Math.floor(H.x / T), q = [s]; d[s] = 0;
    for (let qi = 0; qi < q.length; qi++){
      const j = q[qi], x = j % S.W, y = (j / S.W) | 0;
      for (const [ox, oy] of [[1,0],[-1,0],[0,1],[0,-1]]){ const nx = x + ox, ny = y + oy, k = ny * S.W + nx; if (d[k] >= 0 || !pass(nx, ny)) continue; d[k] = d[j] + 1; par[k] = j; q.push(k); }
    }
    return { d, par, s };
  }
  function next(B, k){ let cur = k, prev = k; while (B.par[cur] >= 0 && B.par[cur] !== B.s){ prev = cur; cur = B.par[cur]; } if (cur === B.s) return prev === k && k === B.s ? null : (B.par[k] === B.s ? k : prev); return cur; }
  function steer(H, C, B, goals){   // goals: множество клеток; идём к ближайшей
    let best = -1, bd = 1e9; for (const k of goals) if (B.d[k] >= 0 && B.d[k] < bd){ bd = B.d[k]; best = k; }
    if (best < 0) return false;
    if (best === B.s){ const cx = (best % S.W) * T + T / 2, cy = ((best / S.W) | 0) * T + T / 2; C.dx = (cx - H.x) / 12; C.dy = (cy - H.y) / 12; clampDir(C); return 'here'; }
    const k = next(B, best); if (k == null) return false;
    const cx = (k % S.W) * T + T / 2, cy = ((k / S.W) | 0) * T + T / 2; const v = Math.hypot(cx - H.x, cy - H.y) || 1;
    C.dx = (cx - H.x) / v; C.dy = (cy - H.y) / v; return true;
  }
  function clampDir(C){ const l = Math.hypot(C.dx, C.dy); if (l > 1){ C.dx /= l; C.dy /= l; } }
  const inView = o => o.x > S.cam.x - T && o.x < S.cam.x + L.VIEW_W + T && o.y > S.cam.y - T && o.y < S.cam.y + L.VIEW_H + T;
  const los = (H, x, y) => L.losCells({ W: S.W }, Math.floor(H.x / T), Math.floor(H.y / T), Math.floor(x / T), Math.floor(y / T), S.grid);
  function aim(H, C, x, y){ const a = Math.atan2(y - H.y, x - H.x) + (brng() - 0.5) * 0.2; C.dx = Math.cos(a) * 0.12; C.dy = Math.sin(a) * 0.12; C.fire = true; }
  function spotsFor(l){   // клетки, откуда чаша видна по прямой и ближе 8 клеток
    const out = []; for (let y = Math.max(0, l.ty - 8); y <= Math.min(S.H - 1, l.ty + 8); y++) for (let x = Math.max(0, l.tx - 8); x <= Math.min(S.W - 1, l.tx + 8); x++){
      if (!pass(x, y) || Math.hypot(x - l.tx, y - l.ty) > 8 || Math.hypot(x - l.tx, y - l.ty) < 0.9) continue;
      if (L.losCells({ W: S.W }, x, y, l.tx, l.ty, S.grid)) out.push(y * S.W + x);
    }
    return out;
  }
  function adj(l){ const out = []; for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) if ((ox || oy) && pass(l.tx + ox, l.ty + oy)) out.push((l.ty + oy) * S.W + l.tx + ox); return out; }

  function decide(pi){
    const H = S.heroes[pi], C = ctl[pi]; C.fire = false;
    if (!H.alive){ C.dx = C.dy = 0; return; }
    const o = H.hoop, st = L.heroStats(H), B = bfs(H);
    const foes = S.enemies.filter(e => e.hp > 0 && inView(e)).map(e => ({ e, d: Math.hypot(e.x - H.x, e.y - H.y) })).sort((a, b) => a.d - b.d);
    // застрял — дёрнуться в сторону
    if (C.jig > 0){ C.jig -= 1; C.dx = C.jdx; C.dy = C.jdy; return; }
    // 1) бой: обруч в руке, тварь близко и видна — бросок в неё
    const threat = foes.find(f => f.d < 6 * T && los(H, f.e.x, f.e.y));
    if (o.state === 'held' && threat && !(S.boss && o.hot > 0 && foes[0].d > 2.5 * T)){ aim(H, C, threat.e.x, threat.e.y); return; }
    // обруч в полёте и тварь вплотную — пятиться
    if (o.state !== 'held' && foes.length && foes[0].d < 2.2 * T){ const f = foes[0].e, v = Math.hypot(H.x - f.x, H.y - f.y) || 1; C.dx = (H.x - f.x) / v; C.dy = (H.y - f.y) / v; return; }
    const litL = S.lamps.filter(l => l.lit), cold = S.lamps.filter(l => !l.lit);
    // 2) мало здоровья — в свет
    if (H.hp < st.maxHp * 0.4 && !S.boss){ const g = [].concat(...litL.map(adj)); if (steer(H, C, B, g)) return; }
    // 3) Страж: горящим обручем — в Стража, холодным — к огню
    if (S.boss && !S.boss.dead){
      const Bs = S.boss, d = Math.hypot(Bs.x - H.x, Bs.y - H.y);
      if (d < Bs.r + 2.5 * T){ const v = d || 1; C.dx = (H.x - Bs.x) / v * 0.7 - (Bs.y - H.y) / v * 0.7; C.dy = (H.y - Bs.y) / v * 0.7 + (Bs.x - H.x) / v * 0.7; clampDir(C); if (o.state === 'held' && o.hot > 0.3 && Bs.guardT <= 0) aim(H, C, Bs.x, Bs.y); return; }
      if (o.hot > 0.6 && o.state === 'held' && d < 9 * T && los(H, Bs.x, Bs.y)){ aim(H, C, Bs.x, Bs.y); return; }
      if (o.hot <= 0.6){ const g = [].concat(...litL.map(adj)); if (steer(H, C, B, g)) return; }
      else if (o.state === 'held'){ const bt = Math.floor(Bs.y / T) * S.W + Math.floor(Bs.x / T), g = []; for (let k = 0; k < S.W * S.H; k++){ const x = k % S.W, y = (k / S.W) | 0; if (pass(x, y) && Math.hypot(x * T + 16 - Bs.x, y * T + 16 - Bs.y) < 6 * T && Math.hypot(x * T + 16 - Bs.x, y * T + 16 - Bs.y) > 3.5 * T && L.losCells({ W: S.W }, x, y, bt % S.W, (bt / S.W) | 0, S.grid)) g.push(k); } if (steer(H, C, B, g)) return; }
      // держать дистанцию, обходя кругом
      const v = d || 1, k = d < 5 * T ? -1 : 1; C.dx = (Bs.x - H.x) / v * k * 0.6 + -(Bs.y - H.y) / v * 0.6; C.dy = (Bs.y - H.y) / v * k * 0.6 + (Bs.x - H.x) / v * 0.6; clampDir(C); return;
    }
    // 4) печать открыта — к спуску
    if (S.sealOpen && S.exit){ steer(H, C, B, [S.exit.ty * S.W + S.exit.tx]); return; }
    // 5) холодная чаша: горящим обручем — к месту броска; иначе — окунуть в огонь
    if (o.hot > 1 && cold.length){
      let bestL = null, bestK = -1, bd = 1e9;
      for (const l of cold) for (const k of spotsFor(l)) if (B.d[k] >= 0 && B.d[k] < bd){ bd = B.d[k]; bestL = l; bestK = k; }
      if (bestL){
        if (B.d[bestK] <= 0 || (Math.hypot(bestL.x - H.x, bestL.y - H.y) < 8 * T && los(H, bestL.x, bestL.y))){ if (o.state === 'held') aim(H, C, bestL.x, bestL.y); else { C.dx = C.dy = 0; } return; }
        steer(H, C, B, [bestK]); return;
      }
      if (steer(H, C, B, [].concat(...cold.map(adj)))) return;
    }
    if (o.state === 'held' && o.hot <= 1){ const g = [].concat(...litL.map(adj)); if (steer(H, C, B, g)) return; }
    C.dx = C.dy = 0;
  }

  game.update(h);
  while (!S.over){
    t += h; tFloor += h;
    if (S.floor !== curFloor){ curFloor = S.floor; tFloor = 0; }
    if (S.phase === 'upgrade'){
      S.heroes.forEach((H, i) => { if (!S.upDone[i]) game.choose(i, L.UPG.indexOf(plan[Math.min(plan.length - 1, S.floor - 1)])); });
      game.update(h); continue;
    }
    S.heroes.forEach((H, i) => {
      const C = ctl[i];
      if (t >= C.next){
        C.next = t + r0 + brng() * (r1 - r0);
        const moved = Math.hypot(H.x - C.lx, H.y - C.ly); C.lx = H.x; C.ly = H.y;
        if (Math.hypot(C.dx, C.dy) > 0.5 && moved < 2){ C.still++; if (C.still > 5){ C.still = 0; C.jig = 2; const a = brng() * 6.28; C.jdx = Math.cos(a); C.jdy = Math.sin(a); } } else C.still = 0;
        decide(i);
      } else if (C.fire){ C.fire = false; }   // нажатие — короткое
      game.setDir(i, C.dx, C.dy); game.setFire(i, C.fire);
    });
    game.update(h);
    if (tFloor > maxFloorT){ stuck = true; break; }
  }
  return { won: S.won, floor: S.floor, passed: S.won ? S.maxFloor - start + 1 : S.floor - start, stuck, score: S.score, t, deaths: S.heroes.reduce((a, H) => a + H.deaths, 0), boss: S.boss ? S.boss.hp : null };
}
