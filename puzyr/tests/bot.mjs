/* ПУЗЫРЬ · tests/bot.mjs — «человеческий» бот для проверки баланса и проходимости (переделка 2026-11: хлопок и ванны).
   Без читов: видит то же, что на экране (платформы, ванны, врагов, искры, капли), управляет как игрок —
   setInput(направление, прыжок зажат, кнопка хлопка зажата): удержание раздувает пузырь, отпускание — хлопок.
   Человеческие ограничения: решает раз в `react` (0.12–0.22 с), между решениями держит клавиши; иногда «зевает» (blunder);
   ходит по графу платформ (как человек «видит», куда можно запрыгнуть/спрыгнуть); силу хлопка подбирает на глаз (±20 %).
   Стратегия: опасность рядом → хлопнуть в неё (хлопок и защищает) или уйти → выбрать врага → встать за ним так, чтобы хлопок
   гнал его к ванне (на полу) или с края платформы → раздуть пузырь на нужную силу и хлопнуть. Котёл: отражать капли в него.
   opts: { players=1, levels=31, startLevel=1, lives=3, react:[0.12,0.22], blunder=0.01, maxLevelT=180, perfect=false } */

export function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}

export function makeBrain(Z, game, pi, brng, opts = {}){
  const L = Z.logic, S = game.state(), perfect = !!opts.perfect;
  const [r0, r1] = opts.react || [0.12, 0.22];
  const react = perfect ? 1 / 60 : r0 + brng() * (r1 - r0);
  const blunder = perfect ? 0 : (opts.blunder == null ? 0.01 : opts.blunder);
  let nextDecide = 0, dir = 0, jumpT = 0, jumpRel = 0, edge = null, edgeFrom = null, goalX = null, mode = 'idle', blind = 0;
  let blowT = 0, faceWant = 0, landed = false, blocked = 0, lastD = 0;
  const me = () => S.players[pi];
  const FLOOR = L.ROWS - 1;

  function curSeg(p){
    if (!p.ground) return null;
    const r = Math.round(p.y);
    return L.segAt(S.segs, p.x, r) || S.segs.filter(s => s.row === r).sort((a, b) => Math.abs((a.lo + a.hi) / 2 - p.x) - Math.abs((b.lo + b.hi) / 2 - p.x))[0] || null;
  }
  function segOf(e){ return L.segAt(S.segs, e.x, Math.round(e.y)) || L.landing(S.segs, e.x, e.y - 0.5); }
  function pressJump(t){ if (jumpRel <= 0 && jumpT <= 0) jumpT = t || 0.45; }
  function walkers(){ return S.enemies.filter(e => e.spawnT <= 0 && e.mode === 'walk'); }
  function dangerous(){ return walkers().filter(e => !(e.wake > 0)); }
  // хлопнуть: развернуться к dirF и держать кнопку hold секунд
  function blowAt(dirF, hold){ if (me().cd > 0 || blowT > 0) return false; faceWant = dirF; blowT = Math.max(1 / 60, hold) * (perfect ? 1 : 0.85 + brng() * 0.35); return true; }
  function holdFor(pw){ return Math.max(0, (pw - L.P_MIN) / (1 - L.P_MIN)) * L.CHARGE_MAX; }
  function nearVat(x){ return L.inVat(S.vats, x); }
  function inBand(p, y, h){ return !(y - h > p.y + 0.4 || y < p.y - L.PH - 0.6); }

  function hazards(){
    const out = [];
    for (const e of S.enemies.filter(q => q.spawnT <= 0 && (q.mode === 'walk' || (q.mode === 'daze' && q.daze < 0.7)))){
      const vx = e.mode === 'daze' ? e.dir * e.speed : (e.vx || e.dir * e.speed);
      out.push({ x: e.x, y: e.y, vx, w: e.w, h: e.h, e });
      if (e.charge > 0 && e.ground) out.push({ x: e.x + e.dir * 3, y: e.y, vx: e.dir * 6.5, w: 0.6, h: 0.6, shot: true });
      for (const k of [0.2, 0.4]) out.push({ x: e.x + vx * k, y: e.y + (e.fly ? e.vy * k : e.ground ? 0 : Math.min(13, e.vy) * k + 35 * k * k), vx, w: e.w, h: e.h, e, pred: true });
    }
    for (const s of S.shots){
      if (s.back) continue;
      if (s.kind === 'drop'){ for (const k of [0, 0.25, 0.5]) out.push({ x: s.x + s.vx * k, y: s.y + s.vy * k + 0.4, vx: s.vx, w: 0.8, h: 0.8, drop: true, s }); continue; }
      out.push({ x: s.x, y: s.y + 0.3, vx: s.vx, w: 0.6, h: 0.6, shot: true, s });
    }
    const B = S.boss; if (B && B.alive && !B.dying && B.spawnT <= 0) out.push({ x: B.x, y: B.y, vx: B.vx, w: B.w, h: B.h, boss: true });
    return out;
  }
  function pathClear(p, e){
    const to = S.segs[e.to], lx = e.type === 'fall' ? e.land : e.tx, top = Math.min(to.row, p.y) - 2.2, bot = Math.max(to.row, p.y) + 0.5;
    for (const en of walkers()){
      if (en.y < top || en.y - en.h > bot) continue;
      const lo = Math.min(p.x, lx) - 2.8, hi = Math.max(p.x, lx) + 2.8;
      if (en.x > lo && en.x < hi && Math.abs(en.y - p.y) > 0.9) return false;
    }
    return true;
  }
  // куда и откуда гнать врага на его сегменте: {d, sx, dist}
  function plan(e, es){
    const opts2 = [];
    for (const d of [-1, 1]){
      let target;
      if (es.row === FLOOR){
        const hasVat = d < 0 ? es.c0 > L.WL : es.c1 < L.WR - 1;
        if (!hasVat){
          // у стены — «от борта»: хлопнуть в стену, враг отскочит назад к ванне
          const wallX = d < 0 ? L.WL : L.WR, gap = Math.abs(e.x - wallX);
          const other = d < 0 ? es.c1 < L.WR - 1 : es.c0 > L.WL;
          if (gap < 3.2 && other) opts2.push({ d, dist: 99, room: 9, bank: true, sx: Math.max(es.slo + 0.05, Math.min(es.shi - 0.05, e.x - d * 1.6)) });
          continue;
        }
        target = d < 0 ? es.c0 : es.c1 + 1;
      } else {
        if (d < 0 ? es.c0 <= L.WL : es.c1 >= L.WR - 1) continue;      // у стены края нет
        target = d < 0 ? es.c0 - 0.2 : es.c1 + 1.2;
      }
      const dist = Math.abs(target - e.x), room = d > 0 ? e.x - es.slo : es.shi - e.x;
      opts2.push({ d, dist, room, sx: Math.max(es.slo + 0.05, Math.min(es.shi - 0.05, e.x - d * 2.0)) });
    }
    if (!opts2.length) return null;
    // за врагом нужно встать (≥ 0,9 клетки до борта); «от борта» — только если иначе не встать
    const cost = o => o.bank ? (opts2.some(q => !q.bank && q.room >= 0.9) ? 1e9 : 50) : o.dist + (o.room >= 0.9 ? 0 : 30);
    opts2.sort((a, b) => cost(a) - cost(b));
    return opts2[0];
  }
  function pushPower(e, dx, dist){
    const k = L.WEIGHT[e.type] || 1, fr = Math.round(e.y) === FLOOR ? L.FRICT_FLOOR : L.FRICT, need = Math.sqrt(2 * fr * (dist + 1.2)) / k;   // скорость, чтобы доскользить
    let pw = Math.max((dx + 0.9 - 2.6) / 3.4, (need / (1 - 0.4 * Math.min(1, dx / 4)) - 8) / 10);
    return Math.max(L.P_MIN, Math.min(1, pw));
  }

  function decide(){
    const p = me(); if (!p.alive){ dir = 0; return; }
    if (blowT > 0) return;                                 // раздуваю — не отвлекаюсь
    if (blind > 0) blind -= react;
    else if (brng() < blunder) blind = 0.5 + brng() * 0.6;
    const seg = curSeg(p), onFloor = seg && seg.row === FLOOR;
    // капля/искра летит в меня и уже в волне хлопка — отразить
    if (p.cd <= 0) for (const s2 of S.shots){
      if (s2.back) continue;
      const dx = s2.x - p.x, toward = Math.sign(s2.vx) === -Math.sign(dx) || Math.abs(s2.vx) < 2;
      if ((toward || s2.vy > 0) && Math.abs(dx) < 3.8 && Math.abs(dx) > 0.3 && s2.y > p.y - L.PH - L.SHOT_TOP + 0.2 && s2.y < p.y + 0.3){ blowAt(Math.sign(dx), 0.02); dir = 0; mode = 'reflect'; return; }
    }
    // 1) опасность — хлопок в неё или уход
    if (blind <= 0 && p.inv <= 0.2){
      let threat = null, td = 1e9;
      for (const h of hazards()){
        const dx = h.x - p.x, vOver = h.y - h.h < p.y + 0.4 && p.y - p.h < h.y + 0.4;
        const near = Math.abs(dx) - (h.w + p.w) / 2;
        const coming = h.drop || Math.sign(h.vx || 0) === -Math.sign(dx) || Math.abs(dx) < 1.5;
        const lim = h.shot ? 3.2 : h.drop ? 2.4 : h.boss ? 3 : 2.6;
        if (vOver && near < lim && (coming || near < 1) && near < td){ td = near; threat = h; }
        else if (!vOver && !h.pred && h.e && !h.e.fly && !h.e.ground && h.y < p.y - 0.8 && h.y > p.y - 7){
          const e = h.e, dy = p.y - e.y, tt = (-e.vy + Math.sqrt(e.vy * e.vy + 2 * L.G * dy)) / L.G, xa = e.x + e.vx * tt;
          if (tt < 0.9 && Math.abs(xa - p.x) < 2.3 && near + 1 < td){ td = near + 1; threat = Object.assign({}, h, { x: xa }); }
        }
      }
      if (threat){
        const dx = threat.x - p.x, sd = Math.sign(dx) || p.face;
        if (!threat.boss && p.cd <= 0 && (threat.e || threat.s) && inBand(p, threat.y, threat.h)){ blowAt(sd, threat.drop ? 0.05 : 0.12); dir = 0; mode = 'fight'; edge = null; return; }
        if (threat.shot && p.ground){ pressJump(); dir = 0; mode = 'dodge'; edge = null; return; }
        let fd = -sd;
        if (onFloor && nearVat(p.x + fd * 1.6)) fd = 0;
        dir = fd; mode = 'flee'; edge = null;
        if (p.ground && (threat.boss || threat.drop || fd === 0)) pressJump();
        return;
      }
    }
    if (!seg) return;
    // 2) Котёл: встать сбоку на полу и ждать капли (отразятся хлопком)
    const B = S.boss;
    if (B && B.alive && !B.dying){
      const sx = Math.max(seg.slo + 0.3, Math.min(seg.shi - 0.3, B.x + (p.x < B.x ? -6 : 6)));
      if (seg.row !== FLOOR){ const fl = S.segs.filter(s => s.row === FLOOR)[0]; const rt = fl && L.route(S.segs, seg.id, fl.id); if (rt){ edge = rt; edgeFrom = seg.id; mode = 'route'; return; } }
      goalX = sx; mode = 'local'; faceWant = Math.sign(B.x - p.x); return;
    }
    // 3) цель: враг, которого можно погнать к ванне / с края
    let best = null, bv = 1e9;
    for (const e of S.enemies){
      if (e.spawnT > 0 || e.mode === 'tumble') continue;
      const flying = e.fly && !e.downed;
      let es = flying ? L.landing(S.segs, e.x, e.y - 0.5) : segOf(e);
      if (!es) continue;
      const pl = flying ? { d: e.x < 16 ? -1 : 1, sx: Math.max(es.slo, Math.min(es.shi, e.x + (e.x < 16 ? 2.5 : -2.5))), dist: 3 } : plan(e, es);
      if (!pl) continue;
      const rt = es.id === seg.id ? null : L.route(S.segs, seg.id, es.id);
      if (es.id !== seg.id && !rt) continue;
      const v = (Math.abs(pl.sx - p.x) + Math.abs(es.row - seg.row) * 1.5) * 0.2 + (flying ? 3 : 0) + (e.mode === 'daze' ? -2 : 0) + brng() * 0.5;
      if (v < bv){ bv = v; best = { e, es, pl, rt, flying }; }
    }
    if (!best){ edge = null; goalX = 16; mode = 'idle'; return; }
    const { e, es, pl, rt, flying } = best;
    if (rt){ edge = rt; edgeFrom = seg.id; mode = 'route'; return; }
    edge = null; mode = 'local';
    const dxE = (e.x - p.x) * pl.d;
    // враг впереди в нужную сторону и в полосе хлопка — раздуть на нужную силу
    if (dxE > -0.3 && dxE < L.blastRange(1) + 0.4 && inBand(p, e.y, e.h) && p.cd <= 0){
      const pw = flying || pl.bank ? 1 : pushPower(e, dxE, pl.dist);
      if (dxE <= L.blastRange(pw) + 0.3){ blowAt(pl.d, holdFor(pw)); dir = 0; return; }
    }
    goalX = pl.sx;
    // враг между мной и точкой — перепрыгнуть его
    if (!flying && e.mode === 'walk' && Math.sign(goalX - p.x) === Math.sign(e.x - p.x) && Math.abs(e.x - p.x) < Math.abs(goalX - p.x) && Math.abs(e.x - p.x) < 2.4 && p.ground && !nearVat(p.x + Math.sign(goalX - p.x) * 2)) pressJump(0.45);
    if (Math.abs(goalX - p.x) < 0.4) faceWant = pl.d;
  }

  function steer(dt){
    const p = me();
    if (!p.alive){ game.setInput(pi, 0, false, false); jumpT = 0; blowT = 0; return; }
    let d = dir, j = false, b = false;
    if (blowT > 0 && !p.ground){ d = lastD; b = true; blowT -= dt; }   // в воздухе — держу курс
    else if (blowT > 0){
      // повернуться (короткий шаг в нужную сторону), затем держать кнопку стоя
      if (p.face !== faceWant && faceWant){ d = faceWant; b = true; }   // поворот на месте, уже раздувая
      else {
        d = 0; b = true; blowT -= dt;
        // враг вот-вот коснётся — хлопнуть сейчас
        if (p.charging && p.face === faceWant && (dangerous().some(e => Math.abs(e.x - p.x) < 1.9 && inBand(p, e.y, e.h)) || S.shots.some(q => !q.back && Math.abs(q.x - p.x) < 2.2 && q.y > p.y - L.PH - 1 && q.y < p.y + 0.3))){ b = false; blowT = 0; }
      }
    } else if (mode === 'route' && edge){
      if (p.ground){ const sg = curSeg(p); if (sg && sg.id !== edgeFrom){ edge = null; mode = 'wait'; d = 0; landed = true; blocked = 0; } }
      if (edge){
        const c = L.drive(p, edge); d = c.dir;
        if (p.ground && (c.jump || edge.type === 'fall') && !pathClear(p, edge) && blocked < 3){ d = 0; blocked += dt; }
        else if (c.jump && p.ground) pressJump(edge.type === 'hop' ? L.HOP_HOLD / 60 + 0.005 : 0.45);
      }
    } else if ((mode === 'local' || mode === 'idle') && goalX != null){
      const dx = goalX - p.x; d = Math.abs(dx) > (mode === 'idle' ? 1 : 0.25) ? Math.sign(dx) : 0;
      if (!d && faceWant && p.face !== faceWant && p.ground) d = faceWant;   // повернуться лицом
    }
    // в воздухе над ванной — подруливать к ближайшему краю пола (человек видит, куда падает)
    if (!p.ground && p.vy > -4 && p.y > FLOOR - 4){
      const tf = Math.max(0.05, (FLOOR - p.y) / Math.max(4, p.vy)), lx = p.x + p.vx * tf, v = nearVat(lx);
      if (v && !L.landing(S.segs, lx, p.y - 0.5)) d = lx < v.x ? -1 : 1;
    }
    // не шагнуть в ванну по полу
    if (d && !p.charging && p.ground && Math.round(p.y) === FLOOR && !(mode === 'route' && edge && edge.type !== 'fall') && nearVat(p.x + d * 0.95)) d = 0;
    if (jumpT > 0){ j = true; jumpT -= dt; if (jumpT <= 0) jumpRel = 0.05; }
    else if (jumpRel > 0) jumpRel -= dt;
    if (p.ground || d) lastD = d;
    game.setInput(pi, d, j, b);
  }

  return {
    react,
    get mode(){ return mode; },
    tick(t, dt){
      if (landed){ landed = false; nextDecide = Math.min(nextDecide, t + react * 0.5); }
      if (t >= nextDecide){ nextDecide = t + react; decide(); }
      steer(dt);
    }
  };
}

export function playPuzyr(Z, seed, opts = {}){
  const levels = opts.levels || 31, start = opts.startLevel || 1;
  const brng = mulberry32(seed * 7919 + 13);
  const maxLevelT = opts.maxLevelT || 180;
  const deaths = {}, levelTime = {}, why = {};
  let S = null;
  const game = Z.Game({ rng: mulberry32(seed), players: opts.players || 1, level: start, maxLevel: start + levels - 1, lives: opts.lives || 3,
    onEvent: (t, d) => { if (t === 'die'){ deaths[S.level] = (deaths[S.level] || 0) + 1; why[d.why] = (why[d.why] || 0) + 1; } } }).start();
  S = game.state();
  const h = 1 / 60;
  const brains = S.players.map((p, i) => makeBrain(Z, game, i, brng, opts));
  let t = 0, tLevel = 0, cur = S.level, stuck = 0;
  while (!S.over){
    for (const b of brains) b.tick(t, h);
    game.update(h); t += h;
    if (S.phase === 'rest') game.proceed();
    if (S.level !== cur){ levelTime[cur] = tLevel; cur = S.level; tLevel = 0; }
    tLevel += h;
    if (tLevel > maxLevelT){ stuck = S.level; break; }
  }
  levelTime[cur] = tLevel;
  const passed = S.won ? levels : (S.level - start);
  return { passed, won: S.won, deaths, why, levelTime, stuck, score: S.score, react: brains[0].react, level: S.level, left: S.enemies.length };
}
