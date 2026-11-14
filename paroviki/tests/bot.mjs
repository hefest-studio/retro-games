/* ПАРОВИКИ · tests/bot.mjs — «человеческий» бот для проверки баланса и проходимости.
   Управляет только как игрок: setMove(pi, dx, dy) по 8 сторонам (как клавиши), setFire(pi, on), special(pi), cont(),
   в лавке — buy/shopReady. Чтобы развернуться к цели, «тыкает» направление на 1 кадр, затем держит огонь (как человек).
   - решения раз в 150–250 мс (реакция), между решениями держит прежние клавиши;
   - вражеский снаряд замечает не всегда (зевок opts.miss = 0.35 на «взгляд»);
   - маршрут: ближайший неоткрытый вентиль → (если не дойти) ключ / рычаг → шлюз, когда открыт.
   Второго героя ведёт встроенный ИИ-напарник игры (players=1) либо второй такой же бот (players=2).
   Попутно меряет ИИ-напарника: «детектор застревания» (далеко от игрока без продвижения > 3.5 с, неподвижен вдали,
   внутри стены), телепорты, выбывания. opts: { world=1, lvl=1, levels=1, players=1, miss, react, maxLevelT=360,
   continues=true, invuln=false, heroes:[0,1], save (прогресс: мир, уровень, прокачка) } */

export function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
const OCT = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
function oct(dx, dy){ const a = Math.atan2(dy, dx); return OCT[((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8]; }

export function playParoviki(PV, seed, opts = {}){
  const L = PV.logic, T = L.T;
  const brng = mulberry32(seed * 7919 + 101);
  const [r0, r1] = opts.react || [0.15, 0.25];
  const miss = opts.miss != null ? opts.miss : 0.35;
  const maxT = opts.maxLevelT || 360, nLevels = opts.levels || 1;
  const ev = { deaths: 0, why: {}, conts: 0, valves: 0, aiDown: 0, warps: 0, levels: [] };
  const game = PV.Game({ rng: mulberry32(seed), seed, players: opts.players || 1, heroes: opts.heroes || [0, 1], world: opts.save ? undefined : opts.world || 1, lvl: opts.lvl || 1, save: opts.save,
    onEvent: (t, d) => {
      if (t === 'heroDie'){ if (d.ai) ev.aiDown++; else { ev.deaths++; ev.why[d.src] = (ev.why[d.src] || 0) + 1; } }
      else if (t === 'continue') ev.conts++;
      else if (t === 'valve') ev.valves++;
      else if (t === 'warp') ev.warps++;
    } }).start();
  const S = game.state(), dt = 1 / 60, nb = S.players;
  if (opts.invuln) S.heroes.forEach(h => { if (!h.ai) h.inv = 1e9; });
  const ctl = [0, 1].map(() => ({ next: 0, mv: [0, 0], fire: false, tap: null, seen: new WeakMap() }));
  let levelT = 0, done = 0, stuck = false, totalT = 0, curKey = S.world + '-' + S.lvl;
  const ai = { far: 0, stuckEv: 0, still: 0, stillEv: 0, inWall: 0, last: null, maxFar: 0 };

  function passFn(withDoors){
    const m = S.map;
    return (x, y) => {
      if (x < 0 || y < 0 || x >= m.TW || y >= m.TH) return false;
      const t = m.tiles[y * m.TW + x];
      if (t === L.TILE.DOOR) return withDoors;
      return !L.WALK_SOLID[t];
    };
  }
  function field(target, withDoors){ // BFS 8-связн. без срезания углов от цели
    const m = S.map, pass = passFn(withDoors), d = new Int16Array(m.TW * m.TH).fill(-1), t = L.tileOf(target), q = [t.y * m.TW + t.x];
    d[q[0]] = 0; let h = 0;
    while (h < q.length){
      const k = q[h++], x = k % m.TW, y = (k - x) / m.TW;
      for (const [dx, dy] of OCT){
        const nx = x + dx, ny = y + dy; if (!pass(nx, ny)) continue;
        if (dx && dy && (!pass(x + dx, y) || !pass(x, y + dy))) continue;
        const nk = ny * m.TW + nx; if (d[nk] >= 0) continue; d[nk] = d[k] + 1; q.push(nk);
      }
    }
    return d;
  }
  function at(f, o){ const m = S.map, t = L.tileOf(o); return f[t.y * m.TW + t.x]; }
  function step(f, h, withDoors){
    const m = S.map, t = L.tileOf(h), pass = passFn(withDoors); let best = null, bd = at(f, h);
    if (bd < 0) return null;
    for (const [dx, dy] of OCT){
      const nx = t.x + dx, ny = t.y + dy; if (!pass(nx, ny)) continue;
      if (dx && dy && (!pass(t.x + dx, t.y) || !pass(t.x, t.y + dy))) continue;
      const v = f[ny * m.TW + nx]; if (v >= 0 && v < bd){ bd = v; best = { x: nx * T + T / 2, y: ny * T + T / 2 }; }
    }
    if (!best && bd === 0) best = { x: t.x * T + T / 2, y: t.y * T + T / 2 };
    return best;
  }
  function pickGoal(h){
    if (S.exitOpen && !S.boss) return { o: S.map.exit, doors: false };
    if (S.exitOpen && S.boss && S.boss.dead) return { o: S.map.exit, doors: false };
    const fh = field(h, S.keys > 0);
    let best = null, bd = 1e9;
    const want = S.objs.filter(o => o.kind === 'valve' && !o.on);
    for (const o of want){ const d = at(fh, o); if (d >= 0 && d < bd){ bd = d; best = o; } }
    if (best) return { o: best, doors: S.keys > 0 };
    if (S.boss && !S.boss.dead) return null;   // вентили открыты — бьём механизм
    for (const o of S.objs){ if ((o.kind === 'key' || (o.kind === 'lever' && !o.on))){ const d = at(fh, o); if (d >= 0 && d < bd){ bd = d; best = o; } } }
    return best ? { o: best, doors: false } : null;
  }
  function decide(pi){
    const h = S.heroes[pi], c = ctl[pi];
    if (!h.alive || h.down){ c.mv = [0, 0]; c.fire = false; return; }
    // цель-враг
    let foe = null, fd = 270;
    for (const e of S.enemies){ const d = Math.hypot(e.x - h.x, e.y - h.y); if (d < fd && game._los(h, e)){ fd = d; foe = e; } }
    if (S.boss && !S.boss.dead && S.boss.intro <= 0){ const d = Math.hypot(S.boss.x - h.x, S.boss.y - h.y); if ((!foe || d < fd + 80) && game._los(h, S.boss)){ foe = S.boss; fd = d; } }
    // маршрут
    const g = pickGoal(h); let mv = [0, 0];
    if (g){
      if (!c.gf || c.gfo !== g.o || tm >= c.gft || c.gfd !== g.doors || at(c.gf, h) < 0){ c.gf = field(g.o, g.doors); c.gfo = g.o; c.gft = tm + 1.0; c.gfd = g.doors; }
      const w = step(c.gf, h, g.doors);
      if (w){ const dx = w.x - h.x, dy = w.y - h.y; if (Math.hypot(dx, dy) > 3) mv = oct(dx, dy); else mv = oct(g.o.x - h.x, g.o.y - h.y); }
      if (g.o.kind === 'valve' && Math.hypot(g.o.x - h.x, g.o.y - h.y) < 14) mv = [0, 0];
    } else if (S.boss && !S.boss.dead){ // кружим вокруг механизма на дистанции
      const dx = h.x - S.boss.x, dy = h.y - S.boss.y, d = Math.hypot(dx, dy) || 1;
      mv = d < 190 ? oct(dx, dy) : d > 260 ? oct(-dx, -dy) : oct(-dy, dx);
    }
    // ближний враг — отступить
    if (foe && foe !== S.boss && fd < 54 && foe.type !== 'nest') mv = oct(h.x - foe.x, h.y - foe.y);
    // уворот от снарядов (замечает не всегда)
    for (const b of S.eshots){
      if (!c.seen.has(b)) c.seen.set(b, brng() > miss);
      if (!c.seen.get(b)) continue;
      for (let k = 1; k <= 3; k++){ const t = k * 0.13, bx = b.x + b.vx * t, by = b.y + b.vy * t; if (Math.hypot(bx - h.x, by - h.y) < h.r + b.r + 8){ const sp = Math.hypot(b.vx, b.vy) || 1; mv = oct(-b.vy / sp + (h.x - bx) * 0.02, b.vx / sp + (h.y - by) * 0.02); k = 9; } }
    }
    for (const b of S.bombs){ if (Math.hypot(b.x - h.x, b.y - h.y) < b.r + 16) mv = oct(h.x - b.x, h.y - b.y); }
    // огонь: развернуться «тычком» и держать
    c.fire = false; c.tap = null;
    if (foe){
      const want = oct(foe.x - h.x, foe.y - h.y);
      if (h.face[0] === want[0] && h.face[1] === want[1]) c.fire = true; else { c.tap = want; c.fire = true; }
    }
    // спецприём
    const kind = L.HEROES[h.t.hid].spec, near = S.enemies.filter(e => e.type !== 'nest' && Math.hypot(e.x - h.x, e.y - h.y) < 200).length;
    if (h.t.spec > 0 && ((kind === 'heal' && h.hp < h.maxHp * 0.35) || (kind === 'shield' && h.hp < h.maxHp * 0.4 && near >= 2) || (kind === 'bomb' && (near >= 5 || h.hp < h.maxHp * 0.3 && near >= 2)) || (kind === 'chart' && levelT > 40 && S.chartT <= 0 && !S.boss)))
      game.special(pi);
    c.mv = mv;
  }
  function shop(){
    for (let pi = 0; pi < nb; pi++){
      if (S.aiOn && pi === 1) continue;
      const t = S.team[pi], tr = L.HEROES[t.hid].tree;
      if (t.hp != null && t.hp < game.maxHp(t) * 0.6) game.buy(pi, 'heal');
      for (let i = 0; i < 10; i++){ if (!['gun', 'hp', 'spec', tr[0], tr[1]].some(it => (it !== 'spec' || t.spec < 2) && game.buy(pi, it))) break; }
    }
    for (let pi = 0; pi < nb; pi++) game.shopReady(pi);
  }

  let tm = 0;
  while (true){
    const ph = S.phase;
    if (ph === 'won' || ph === 'over') break;
    if (ph === 'cont'){ if (opts.continues === false || !game.cont()){ while (S.phase === 'cont') game.update(dt); } continue; }
    if (ph === 'shop'){
      ev.levels.push({ key: curKey, t: levelT }); done++;
      if (done >= nLevels) break;
      shop(); levelT = 0; curKey = S.world + '-' + S.lvl; if (opts.invuln) S.heroes.forEach(h => { if (!h.ai) h.inv = 1e9; }); continue;
    }
    if (ph === 'clear'){ game.update(dt); continue; }
    for (let pi = 0; pi < nb; pi++){
      const c = ctl[pi];
      if (tm >= c.next){ decide(pi); c.next = tm + r0 + brng() * (r1 - r0); }
      if (c.tap){ game.setMove(pi, c.tap[0], c.tap[1]); game.setFire(pi, false); c.tapNow = true; }
      else { game.setMove(pi, c.mv[0], c.mv[1]); game.setFire(pi, c.fire); }
    }
    game.update(dt); tm += dt; levelT += dt; totalT += dt;
    for (let pi = 0; pi < nb; pi++) if (ctl[pi].tapNow){ ctl[pi].tap = null; ctl[pi].tapNow = false; }
    // детектор застревания ИИ-напарника
    if (S.aiOn){
      const A = S.heroes[1], P = S.heroes[0];
      if (A.alive && !A.down && P.alive && S.phase === 'play'){
        const f = S.field1, fdist = f ? game._fieldAt(f, A.x, A.y) : 0;
        ai.maxFar = Math.max(ai.maxFar, fdist);
        if (fdist < 0 || fdist > 6){ ai.far += dt; if (ai.far > 3.5 && !ai.farHit){ ai.stuckEv++; ai.farHit = true; } } else { ai.far = 0; ai.farHit = false; }
        if (ai.last && Math.hypot(A.x - ai.last.x, A.y - ai.last.y) < 0.5 && Math.hypot(A.x - P.x, A.y - P.y) > 5 * T){ ai.still += dt; if (ai.still > 3 && !ai.stillHit){ ai.stillEv++; ai.stillHit = true; } } else { ai.still = 0; ai.stillHit = false; }
        ai.last = { x: A.x, y: A.y };
        if (game._hitsWall(A.x, A.y, A.r - 2)) ai.inWall++;
      }
    }
    if (levelT > maxT){ stuck = true; break; }
  }
  return { seed, passed: done, won: S.phase === 'won', over: S.phase === 'over', stuck, conts: ev.conts, deaths: ev.deaths, why: ev.why, aiDown: ev.aiDown, warps: ev.warps,
    valves: ev.valves, levels: ev.levels, time: totalT, ai, score: S.score, money: S.team.map(t => t.money), game };
}
