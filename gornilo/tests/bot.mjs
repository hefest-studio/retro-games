/* ГОРНИЛО · tests/bot.mjs — «человеческий» бот для проверки баланса и проходимости.
   Без читов: управляет только как игрок — setMove(pi, dx, dy) и setAim(pi, dx, dy) (по 8 направлений, как клавиши),
   cont() (продолжение). Состояние читает «глазами»:
   - решения раз в 150–250 мс (реакция), между решениями держит прежние клавиши;
   - вражескую пулю замечает не сразу: при каждом «взгляде» пропускает её с вероятностью opts.miss (0.35);
   - целится только в 8 направлениях (как стрелки), с упреждением «на глаз»;
   - уворот — перебор 9 вариантов ходьбы (8 сторон + стоять) с оценкой опасности на 0.15 и 0.3 с вперёд;
   - после зачистки собирает трофеи и выбирает выход по значку награды (жизнь > оружие > слитки) и опасности.
   opts: { startStage=1, stages, players=1, miss=0.35, react:[0.15,0.25], maxStageT=600, continues=true, invuln=false } */

export function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}

const OCT = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
function oct(dx, dy){ const a = Math.atan2(dy, dx); return OCT[((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8]; }

export function playGornilo(G, seed, opts = {}){
  const L = G.logic, start = opts.startStage || 1;
  const stages = opts.stages || (L.MAX_STAGE - start + 1);
  const brng = mulberry32(seed * 7919 + 101);
  const [r0, r1] = opts.react || [0.15, 0.25];
  const miss = opts.miss != null ? opts.miss : 0.35;
  const maxT = opts.maxStageT || 600;
  const ev = { deaths: 0, why: {}, clears: [], conts: 0, rooms: 0, powers: 0 };
  let tm = 0;
  const game = G.Game({ rng: mulberry32(seed), seed, players: opts.players || 1, stage: start, maxStage: start + stages - 1,
    onEvent: (t, d) => {
      if (t === 'heroDie'){ ev.deaths++; ev.why[d.src] = (ev.why[d.src] || 0) + 1; }
      else if (t === 'clear') ev.clears.push({ stage: d.stage, t: tm });
      else if (t === 'continue') ev.conts++;
      else if (t === 'roomClear') ev.rooms++;
      else if (t === 'power') ev.powers++;
    } }).start();
  const S = game.state(), dt = 1 / 60;
  const ctl = S.heroes.map(() => ({ seen: new WeakMap(), next: 0, mv: [0, 0], aim: [0, 0] }));
  let stageT = 0, curStage = S.stage, stuck = false, contAt = -1, peak = 0;
  if (opts.invuln) S.heroes.forEach(h => { h.inv = 1e9; });

  // ---- поиск пути по клеткам 16 px (наковальни раздуты на радиус героя) ----
  const CS = 16, GW = L.W / CS, GH = L.H / CS;
  function solidCell(cx, cy, gate){
    const x = cx * CS + CS / 2, y = cy * CS + CS / 2, r = L.HERO_R + 1;
    if (gate){ const g = L.GATES[gate];
      if (g.nx ? Math.abs(y - g.y) < L.GATE_HALF - r && (g.nx > 0 ? x < L.IX0 + r : x > L.IX1 - r) : Math.abs(x - g.x) < L.GATE_HALF - r && y < L.IY0 + r) return false; }
    if (x < L.IX0 + r || x > L.IX1 - r || y < L.IY0 + r || y > L.IY1 - r) return true;
    return !!game._inBlock(x, y, r - 2);
  }
  function route(h, gx, gy, gate){
    const sc = Math.floor(h.x / CS), sr = Math.floor(h.y / CS), tc = Math.floor(gx / CS), tr = Math.floor(gy / CS);
    const prev = new Map(), k0 = sc + sr * GW, q = [k0]; prev.set(k0, -1); let found = -1;
    while (q.length){
      const k = q.shift(), c = k % GW, r = (k - c) / GW;
      if (c === tc && r === tr){ found = k; break; }
      for (const [ax, ay] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]){
        const nc = c + ax, nr = r + ay; if (nc < 0 || nr < 0 || nc >= GW || nr >= GH) continue;
        const nk = nc + nr * GW; if (prev.has(nk)) continue;
        if (solidCell(nc, nr, gate) && !(nc === tc && nr === tr)) continue;
        if (ax && ay && (solidCell(c + ax, r, gate) || solidCell(c, r + ay, gate))) continue;
        prev.set(nk, k); q.push(nk);
      }
    }
    if (found < 0) return [gx - h.x, gy - h.y];
    let k = found, path = [];
    while (k >= 0){ path.push(k); k = prev.get(k); }
    path.reverse();
    const nk = path[Math.min(1, path.length - 1)], c = nk % GW, r = (nk - c) / GW;
    const tx = path.length <= 1 ? gx : c * CS + CS / 2, ty = path.length <= 1 ? gy : r * CS + CS / 2;
    return [tx - h.x, ty - h.y];
  }

  // ---- оценка опасности точки ----
  function danger(h, C, x, y, tau){
    let d = 0;
    const R = L.HERO_R, cx = Math.max(L.IX0 + R, Math.min(L.IX1 - R, x)), cy = Math.max(L.IY0 + R, Math.min(L.IY1 - R, y));
    if (cx !== x || cy !== y){ d += 20; x = cx; y = cy; }   // упрётся в стену — почти стоит на месте
    if (game._inBlock(x, y, R)) d += 60;
    const wm = Math.min(x - L.IX0, L.IX1 - x, y - L.IY0, L.IY1 - y);
    if (wm < 56 && S.enemies.some(e => !e.dead)) d += (56 - wm) * 0.6;   // в бою не загонять себя в угол
    for (const e of S.enemies){
      if (e.dead) continue;
      let ex = e.x, ey = e.y;
      if (e.type === 'roller' && e.state === 'charge'){ ex += e.vx * tau; ey += e.vy * tau; }
      else if (!e.enter && e.type !== 'turret'){ const a = Math.atan2(h.y - e.y, h.x - e.x); ex += Math.cos(a) * e.speed * tau; ey += Math.sin(a) * e.speed * tau; }
      const dd = Math.hypot(x - ex, y - ey), rad = e.r + L.HIT_R;
      if (e.type === 'runner'){ const R = e.fuse > 0 ? 58 : 34; if (dd < R) d += 900 * (1 - dd / R) + 300; }
      if (dd < rad + 6) d += 2000;
      else if (dd < rad + 40) d += 40 * (rad + 40 - dd) / 40 * (e.type === 'roller' ? 3 : 1);
      d += 600 / (dd + 20);
      if (e.type === 'roller' && (e.state === 'wind' || e.state === 'charge')){
        const ux = Math.cos(e.ang), uy = Math.sin(e.ang), px = x - e.x, py = y - e.y, along = px * ux + py * uy, perp = Math.abs(-px * uy + py * ux);
        if (along > -10 && perp < e.r + 16) d += 1500;
      }
    }
    for (const b of S.ebullets){
      if (!C.seen.get(b)){ if (brng() < miss) continue; C.seen.set(b, true); }
      for (const t of [tau * 0.5, tau]){ const bx = b.x + b.vx * t, by = b.y + b.vy * t; const dd = Math.hypot(x - bx, y - by); if (dd < 16) d += 1200 * (1 - dd / 16) + 200; }
    }
    for (const s of S.slams) if (Math.hypot(x - s.x, y - s.y) < s.r + 12) d += 2500;
    for (const bm of S.booms) if (bm.enemy && Math.hypot(x - bm.x, y - bm.y) < bm.r) d += 400;
    const B = S.boss;
    if (B && !B.dead){
      const dd = Math.hypot(x - B.x, y - B.y);
      if (dd < B.r + 30) d += 3000; else if (dd < B.r + 110) d += (B.r + 110 - dd) * 4;
    }
    return d;
  }

  function target(h){
    let best = null, bs = 1e9;
    const B = S.boss;
    if (B && !B.dead && B.intro <= 0){
      for (const p of B.parts) if (!p.dead){ const s = Math.hypot(p.x - h.x, p.y - h.y); if (s < bs){ bs = s; best = p; } }
      if (!best && !B.armored) { best = B; bs = Math.hypot(B.x - h.x, B.y - h.y); }
      if (best) bs = Math.max(0, bs - 140);   // мелочь рядом — важнее
    }
    for (const e of S.enemies){
      if (e.dead || e.enter && Math.hypot(e.x - h.x, e.y - h.y) > 200) continue;
      let s = Math.hypot(e.x - h.x, e.y - h.y);
      if (e.type === 'runner') s *= 0.6;
      if (e.type === 'turret') s *= e.rise > 0.3 ? 4 : 0.9;
      if (e.type === 'shield'){ const a = Math.atan2(h.y - e.y, h.x - e.x); if (Math.abs(L.angDiff(a, e.ang)) < 1.1) s *= 2.2; }
      if (s < bs){ bs = s; best = e; }
    }
    return best;
  }

  // 8 направлений стрельбы: если цель не на линии прицела — встать на ближайшую линию (как игрок)
  function misses(h, tg, aim){
    const n = Math.hypot(aim[0], aim[1]) || 1, ux = aim[0] / n, uy = aim[1] / n, px = tg.x - h.x, py = tg.y - h.y;
    return Math.abs(px * uy - py * ux) > (tg.r || 10) * 0.8 + 2 || px * ux + py * uy < 0;
  }
  function align(h, tg){
    const d0 = Math.max(110, Math.min(220, Math.hypot(tg.x - h.x, tg.y - h.y)));
    let best = null, bd = 1e9;
    for (const [ax, ay] of OCT){
      const n = Math.hypot(ax, ay), x = tg.x - ax / n * d0, y = tg.y - ay / n * d0;
      if (x < L.IX0 + 20 || x > L.IX1 - 20 || y < L.IY0 + 20 || y > L.IY1 - 20 || game._inBlock(x, y, 14) || !game._los(x, y, tg.x, tg.y, 3)) continue;
      const d = Math.hypot(x - h.x, y - h.y); if (d < bd){ bd = d; best = [x, y]; }
    }
    return best;
  }

  function decide(pi){
    const h = S.heroes[pi], C = ctl[pi];
    if (!h.alive){ C.mv = [0, 0]; C.aim = [0, 0]; return; }
    const enemies = S.enemies.filter(e => !e.dead).length + (S.boss && !S.boss.dead ? 1 : 0);
    // прицел
    const tg = target(h);
    if (tg){
      const d = Math.hypot(tg.x - h.x, tg.y - h.y), sp = (L.GUN[h.weapon] || L.GUN.base).speed, lead = d / sp;
      let tx = tg.x, ty = tg.y;
      if (tg.type && tg.type !== 'turret' && !tg.parts){ const a = Math.atan2(h.y - tg.y, h.x - tg.x); tx += Math.cos(a) * (tg.speed || 0) * lead; ty += Math.sin(a) * (tg.speed || 0) * lead; }
      C.aim = oct(tx - h.x, ty - h.y);
      if (h.weapon === 'flame' && d > 160) C.aim = oct(tx - h.x, ty - h.y);
    } else C.aim = [0, 0];
    // цель ходьбы
    let goal = null, gate = null;
    if (S.roomState === 'cleared' && !enemies){
      const pk = S.pickups.slice().sort((a, b) => Math.hypot(a.x - h.x, a.y - h.y) - Math.hypot(b.x - h.x, b.y - h.y))[0];
      if (pk) goal = [pk.x, pk.y];
      else {
        let bestG = null, bv = -1e9;
        for (const g in S.room.exits){
          const ex = S.room.exits[g], rm = L.roomAt(S.map, ex.l, ex.c);
          const v = (rm.reward === 'life' ? 3 : rm.reward === 'weapon' ? 2 : rm.reward === 'gold' ? 1 : 0) - rm.danger * 0.6 + brng() * 0.8;
          if (v > bv){ bv = v; bestG = g; }
        }
        if (C.gate && S.room.exits[C.gate] && C.room === S.room) bestG = C.gate;
        C.gate = bestG; C.room = S.room; gate = bestG;
        const G0 = L.GATES[bestG]; goal = [G0.x - G0.nx * 4, G0.y - G0.ny * 4];
      }
    } else {
      // трофей рядом и безопасно — подобрать; иначе держать дистанцию от толпы
      const pk = S.pickups.find(p => Math.hypot(p.x - h.x, p.y - h.y) < 170);
      if (pk && (h.weapon === 'base' || pk.kind === 'gold' || pk.kind === 'life' || pk.kind === 'ring' || pk.kind === 'hammers')) goal = [pk.x, pk.y];
      else if (tg && !game._los(h.x, h.y, tg.x, tg.y, 3)) goal = [tg.x, tg.y];
      else if (tg && tg.type === 'shield' && Math.abs(L.angDiff(Math.atan2(h.y - tg.y, h.x - tg.x), tg.ang)) < 1.2){
        // щитовик смотрит на нас — обойти сбоку
        const s1 = [tg.x + Math.cos(tg.ang + 1.9) * 110, tg.y + Math.sin(tg.ang + 1.9) * 110], s2 = [tg.x + Math.cos(tg.ang - 1.9) * 110, tg.y + Math.sin(tg.ang - 1.9) * 110];
        const inA = p => p[0] > L.IX0 + 24 && p[0] < L.IX1 - 24 && p[1] > L.IY0 + 24 && p[1] < L.IY1 - 24;
        goal = inA(s1) && (!inA(s2) || Math.hypot(s1[0] - h.x, s1[1] - h.y) < Math.hypot(s2[0] - h.x, s2[1] - h.y)) ? s1 : inA(s2) ? s2 : [320, 240];
      }
      else if (tg && misses(h, tg, C.aim)) goal = align(h, tg) || [320, 240];
      else goal = [320, 240];
    }
    const dir = goal ? route(h, goal[0], goal[1], gate) : [0, 0];
    const gl = Math.hypot(dir[0], dir[1]) || 1, gx = dir[0] / gl, gy = dir[1] / gl;
    if (!enemies && !S.ebullets.length){ C.mv = Math.hypot(dir[0], dir[1]) > 2 ? oct(dir[0], dir[1]) : [0, 0]; return; }
    let best = [0, 0], bd = 1e18;
    const cands = OCT.concat([[0, 0]]);
    for (const c of cands){
      const n = Math.hypot(c[0], c[1]) || 1, ux = c[0] / n, uy = c[1] / n;
      if (gate && c[0] === 0 && c[1] === 0) continue;
      let v = 0;
      if (gate){
        const x1 = h.x + ux * L.SPEED * 0.15, y1 = h.y + uy * L.SPEED * 0.15;
        v = -(ux * gx + uy * gy) * 50;
        if (x1 > L.IX0 && x1 < L.IX1 && y1 > L.IY0 && game._inBlock(x1, y1, L.HERO_R)) v += 1e6;
      } else {
        v = danger(h, C, h.x + ux * L.SPEED * 0.15, h.y + uy * L.SPEED * 0.15, 0.15) + danger(h, C, h.x + ux * L.SPEED * 0.3, h.y + uy * L.SPEED * 0.3, 0.3) * 0.7;
        v -= (ux * gx + uy * gy) * (enemies ? 6 : 40);
        if (!c[0] && !c[1]) v += 3;
      }
      if (v < bd){ bd = v; best = c; }
    }
    C.mv = best;
  }

  let t = 0;
  while (true){
    if (S.phase === 'won' || S.phase === 'over') break;
    if (S.phase === 'cont'){
      if (opts.continues === false){ game.update(dt); t += dt; tm += dt; continue; }
      if (contAt < 0) contAt = t + 0.8 + brng() * 0.6;
      if (t >= contAt){ game.cont(); contAt = -1; }
    }
    for (let pi = 0; pi < S.heroes.length; pi++){
      const C = ctl[pi];
      if (t >= C.next){ decide(pi); C.next = t + r0 + brng() * (r1 - r0); }
      game.setMove(pi, C.mv[0], C.mv[1]); game.setAim(pi, C.aim[0], C.aim[1]);
    }
    game.update(dt); t += dt; tm += dt; stageT += dt;
    const a = S.enemies.reduce((n, e) => n + (e.dead ? 0 : 1), 0); if (a > peak) peak = a;
    if (opts.invuln) S.heroes.forEach(h => { h.inv = 1e9; });
    if (S.stage !== curStage){ curStage = S.stage; stageT = 0; }
    if (stageT > maxT){ stuck = true; break; }
  }
  return { seed, won: S.phase === 'won', passed: ev.clears.length, score: S.score, deaths: ev.deaths, why: ev.why, conts: ev.conts,
    rooms: ev.rooms, peak, stuck, time: t, stage: S.stage, roomNo: S.roomNo, powers: ev.powers };
}
