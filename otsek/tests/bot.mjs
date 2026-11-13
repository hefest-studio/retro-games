/* ОТСЕК · tests/bot.mjs — «человеческий» бот для проверки баланса и проходимости.
   Без читов: управляет только как игрок — setMove(pi, dx, dy) (8 направлений, как клавиши), setFire(pi, on), use(pi),
   swap(pi), а в терминале — termMove/termTab/termBuy/termClose. Знание палубы — как у игрока, купившего «Карту палубы»
   (первым делом бот покупает её на стартовом терминале за 40 жетонов): видит двери, карты, терминалы и пульт.
   - решения раз в 150–250 мс (реакция), между решениями держит прежние клавиши; поворот к цели — короткое касание
     стрелки (60–100 мс), затем огонь со стрейфом (огонь зажат — направление не меняется);
   - врага замечает не сразу: при каждом «взгляде» пропускает его с вероятностью opts.miss (0.3); видит только в луче
     фонаря / рядом с собой (как игрок в темноте);
   - карты не тратит на кладовые; покупает патроны, аптечки и карту, если своих не хватает;
   - на тревоге — бегом к шлюзу, стреляет только в тех, кто на пути.
   opts: { startDeck=1, decks, players=1, miss=0.3, react:[0.15,0.25], maxDeckT=600, invuln=false } */

export function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}

export function playOtsek(G, seed, opts = {}){
  const L = G.logic, T = L.T, start = opts.startDeck || 1;
  const decks = opts.decks || (L.MAX_DECK - start + 1);
  const brng = mulberry32(seed * 7919 + 101);
  const [r0, r1] = opts.react || [0.15, 0.25];
  const miss = opts.miss != null ? opts.miss : 0.3;
  const maxT = opts.maxDeckT || 600;
  const ev = { deaths: 0, why: {}, clears: [], blasts: 0, doors: 0, wasted: 0, buys: {} };
  let tm = 0;
  const game = G.Game({ rng: mulberry32(seed), seed, players: opts.players || 1, deck: start, maxDeck: start + decks - 1,
    onEvent: (t, d) => {
      if (t === 'heroDie'){ ev.deaths++; ev.why[d.src] = (ev.why[d.src] || 0) + 1; }
      else if (t === 'clear'){ ev.clears.push({ deck: game.state().deck, t: tm, left: d.left, blast: !!d.blast }); if (d.blast) ev.blasts++; }
      else if (t === 'door'){ ev.doors++; if (!d.path) ev.wasted++; }
      else if (t === 'buy') ev.buys[d.id] = (ev.buys[d.id] || 0) + 1;
    } }).start();
  const S = game.state(), dt = 1 / 60;
  if (opts.invuln) S.heroes.forEach(h => { h.inv = 1e9; });
  const ctl = S.heroes.map(() => ({ next: 0, mv: [0, 0], fire: false, seen: new Map(), lastPos: [0, 0], lastT: 0, jiggle: 0 }));
  let deckT = 0, curDeck = S.deck, stuck = false;

  const W = () => S.D.w;
  const tileOf = (x, y) => Math.floor(x / T) + Math.floor(y / T) * W();
  // достижимость по тайлам при закрытых дверях
  function reachSet(h){
    const w = W(), seen = new Uint8Array(w * S.D.h), q = [tileOf(h.x, h.y)]; seen[q[0]] = 1;
    for (let i = 0; i < q.length; i++){ const c = q[i], x = c % w, y = (c - x) / w;
      for (const [ox, oy] of [[1,0],[-1,0],[0,1],[0,-1]]){ const nx = x + ox, ny = y + oy; if (nx < 0 || ny < 0 || nx >= w || ny >= S.D.h) continue; const k = nx + ny * w; if (!seen[k] && S.tiles[k] === L.FLOOR){ seen[k] = 1; q.push(k); } } }
    return seen;
  }
  function route(h, gx, gy, door){
    const set = door ? new Set(door.tiles.map(q => q[0] + q[1] * W())) : null;
    return L.tilePath(S.D, S.tiles, h.x, h.y, gx, gy, set ? (k => set.has(k)) : null);
  }
  function steer(h, p, door){
    if (!p || p.tiles.length < 2) return null;
    let idx = Math.min(2, p.tiles.length - 1);
    if (door){ const set = new Set(door.tiles.map(q => q[0] + q[1] * W())); for (let i = 1; i < p.tiles.length; i++) if (set.has(p.tiles[i])){ idx = Math.max(1, Math.min(idx, i - 1)); break; } }
    // берём дальнюю точку пути в прямой видимости (до 4 шагов) — меньше дёрганий на 8 направлениях
    for (let i = Math.min(4, p.tiles.length - 1); i > idx; i--){ const k = p.tiles[i], x = (k % W()) * T + T / 2, y = Math.floor(k / W()) * T + T / 2; if (game._los(h.x, h.y, x, y) && !game._circleHits((h.x + x) / 2, (h.y + y) / 2, L.HERO_R)){ idx = i; break; } }
    const k = p.tiles[idx], x = (k % W()) * T + T / 2, y = Math.floor(k / W()) * T + T / 2;
    const dx = x - h.x, dy = y - h.y; if (Math.abs(dx) < 2 && Math.abs(dy) < 2) return null;
    return L.oct(dx, dy);
  }
  function visible(h, x, y){
    const d = Math.hypot(x - h.x, y - h.y); if (d < 64) return d < 14 || game._los(h.x, h.y, x, y);
    const lampR = 255 + S.lamp * 45, half = 0.6 + S.lamp * 0.1;
    if (d > lampR) return false;
    const a = Math.atan2(y - h.y, x - h.x), f = Math.atan2(h.face[1], h.face[0]);
    let da = a - f; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
    return Math.abs(da) < half + 0.1 && game._los(h.x, h.y, x, y);
  }
  function goalFor(h, pi){
    const D = S.D, reach = reachSet(h), inR = (x, y) => reach[tileOf(x, y)];
    if (S.alarm) { const A = D.airlock; return { x: (A.x0 + A.x1) / 2 + (pi ? -10 : 10), y: (A.y0 + A.y1) / 2 + (pi ? 10 : -10), kind: 'air' }; }
    if (pi === 1){ const lead = S.heroes[0]; if (lead.alive && !lead.out && Math.hypot(lead.x - h.x, lead.y - h.y) > 200 && S.term == null) return { x: lead.x, y: lead.y, kind: 'follow' }; }   // напарник держится ведущего (кадр общий)
    const terms = S.terminals.filter(t => inR(t.x, t.y)).sort((a, b) => Math.hypot(a.x - h.x, a.y - h.y) - Math.hypot(b.x - h.x, b.y - h.y));
    const nextDoor = S.doors.filter(d => d.path && !d.open).sort((a, b) => a.k - b.k)[0];
    const cards = S.cardsOnFloor.filter(c => !c.taken && inR(c.x, c.y)).sort((a, b) => Math.hypot(a.x - h.x, a.y - h.y) - Math.hypot(b.x - h.x, b.y - h.y));
    const o = D.objective, objR = inR(o.x, o.y);
    const needCard = nextDoor && !objR && S.cards < 1 && !cards.length;
    // мелочь рядом: аптечка/патроны/жетоны (только то, до чего рукой подать)
    const near = S.items.filter(i => !i.taken && i.kind !== 'cache' && inR(i.x, i.y) && Math.hypot(i.x - h.x, i.y - h.y) < 200 &&
      ((i.kind === 'med' && h.hp < 75) || (i.kind === 'ammo' && h.ammo < 150) || i.kind === 'tok'))
      .sort((a, b) => Math.hypot(a.x - h.x, a.y - h.y) - Math.hypot(b.x - h.x, b.y - h.y)).slice(0, 3)
      .find(i => { const p = route(h, i.x, i.y); return p && p.len < 280; });
    const wantTerm = (!S.mapOwned && S.tokens >= 40) || (h.ammo < 45 && S.tokens >= 60) || (needCard && S.tokens >= 150) || (h.hp < 45 && S.tokens >= 80 && !(near && near.kind === 'med'));
    if (wantTerm && terms.length) return { x: terms[0].x, y: terms[0].y + 14, kind: 'term', t: terms[0] };
    if (near) return { x: near.x, y: near.y, kind: 'item' };
    if (cards.length) return { x: cards[0].x, y: cards[0].y, kind: 'card' };
    if (objR){
      if (o.kind === 'console') return { x: o.x, y: o.y + 24, kind: 'console' };
      const B = S.boss; if (B && !B.dead){   // позиция для боя: проходимая точка в 110–150 px от босса, ближайшая к герою
        let best = null, bd = 1e9;
        for (let k = 0; k < 16; k++) for (const R of [150, 120]){ const a = k / 16 * Math.PI * 2, x = B.x + Math.cos(a) * R, y = B.y + Math.sin(a) * R;
          if (x < 0 || y < 0 || x >= S.D.pw || y >= S.D.ph || !reach[tileOf(x, y)] || game._circleHits(x, y, L.HERO_R + 2)) continue;
          const d = Math.hypot(x - h.x, y - h.y); if (d < bd){ bd = d; best = { x, y }; } }
        if (best) return { x: best.x, y: best.y, kind: 'boss' };
      }
    }
    if (nextDoor && S.cards > 0) return { x: nextDoor.x, y: nextDoor.y, kind: 'door', door: nextDoor };
    if (needCard && terms.length) return { x: terms[0].x, y: terms[0].y + 40, kind: 'wait' };   // копим жетоны у терминала
    return null;
  }
  function shop(pi){
    const h = S.heroes[pi], reserve = (S.cards < 1 && S.doors.some(d => d.path && !d.open) && !S.cardsOnFloor.some(c => !c.taken)) ? 150 : 0;
    const want = [];
    if (!S.mapOwned) want.push('map');
    if (reserve && S.tokens >= 150) want.push('card');
    if (h.hp < 60 && S.tokens - reserve >= 80) want.push('med');
    if ((h.ammo < 90 && S.tokens - reserve >= 60) || (h.ammo < 160 && S.tokens - reserve >= 220)) want.push('ammo');
    if (!h.guns.fan && S.tokens - reserve >= 450) want.push('fan');
    if (!h.armor && h.guns.fan && S.tokens - reserve >= 600) want.push('armor');
    if (h.armor && S.tokens - reserve >= 1100) want.push('life');
    for (const id of want) if (game.canBuy(pi, id) === 'ok'){ const i = L.SHOP.findIndex(s => s.id === id); S.term.sel = i; game.termBuy(); return; }
    game.termClose();
  }
  function decide(pi, c){
    const h = S.heroes[pi];
    if (S.phase === 'term'){ if (S.term.pi === pi) shop(pi); c.mv = [0, 0]; c.fire = false; return; }
    if (!h.alive || h.out){ c.mv = [0, 0]; c.fire = false; return; }
    // цели боя: что видно глазами
    const foes = S.enemies.filter(e => !e.dead && visible(h, e.x, e.y)).filter(e => { if (!c.seen.has(e.id)) c.seen.set(e.id, brng() > miss ? 1 : 0); else if (!c.seen.get(e.id) && brng() > miss) c.seen.set(e.id, 1); return c.seen.get(e.id); });
    const B = S.boss;
    if (B && !B.dead && B.active && B.intro <= 0){ const alive = B.nodes.some(e => !e.dead); if ((B.key === 'matka' ? !alive : (B.open || !alive)) && visible(h, B.x, B.y)) foes.push({ x: B.x, y: B.y, r: B.r, boss: true }); }
    foes.sort((a, b) => Math.hypot(a.x - h.x, a.y - h.y) - Math.hypot(b.x - h.x, b.y - h.y));
    const goal = goalFor(h, pi);
    let tgt = foes[0];
    if (tgt && S.alarm){ const d = Math.hypot(tgt.x - h.x, tgt.y - h.y); if (d > 110) tgt = null; }
    if (tgt && Math.hypot(tgt.x - h.x, tgt.y - h.y) > 250) tgt = null;
    if (tgt && h.ammo <= 0 && Math.hypot(tgt.x - h.x, tgt.y - h.y) > 34) tgt = null;   // без патронов — только ключом в упор, иначе к терминалу
    // уворот от искр
    const sp = S.sparks.find(s => { const d = Math.hypot(s.x - h.x, s.y - h.y); if (d > 90) return false; const t = ((h.x - s.x) * s.vx + (h.y - s.y) * s.vy) / (s.vx * s.vx + s.vy * s.vy); if (t < 0) return false; return Math.hypot(s.x + s.vx * t - h.x, s.y + s.vy * t - h.y) < 14 && brng() > miss; });
    c.tgt = tgt ? (tgt.type || 'boss') + '@' + tgt.x.toFixed(0) + ',' + tgt.y.toFixed(0) + ':' + (tgt.hp != null ? tgt.hp.toFixed(1) : '') : '';
    if (S.alarm && goal){   // эвакуация: бегом к шлюзу, стреляем только по ходу движения
      const p = route(h, goal.x, goal.y), mv = steer(h, p) || L.oct(goal.x - h.x, goal.y - h.y);
      c.mv = sp ? L.oct(-sp.vy, sp.vx) : mv;
      const ahead = tgt && L.oct(tgt.x - h.x, tgt.y - h.y);
      c.fire = !!(ahead && h.ammo > 0 && ahead[0] === h.face[0] && ahead[1] === h.face[1] && mv[0] === h.face[0] && mv[1] === h.face[1]);
      return;
    }
    if (tgt){
      const want = L.oct(tgt.x - h.x, tgt.y - h.y), d = Math.hypot(tgt.x - h.x, tgt.y - h.y);
      if (d < 20 && !tgt.boss){ c.mv = [0, 0]; c.fire = true; return; }   // вплотную — заклёпка в упор
      if (want[0] !== h.face[0] || want[1] !== h.face[1]){ c.mv = want; c.fire = false; c.next = 0.06 + brng() * 0.04; return; }
      c.fire = true;
      if (sp) c.mv = L.oct(-sp.vy, sp.vx);
      else if (d < (tgt.boss ? 120 : 62)) c.mv = [-want[0], -want[1]];
      else if (S.alarm && goal){ const p = route(h, goal.x, goal.y); c.mv = steer(h, p) || [0, 0]; }
      else c.mv = [0, 0];
      return;
    }
    c.fire = false;
    if (sp){ c.mv = L.oct(-sp.vy, sp.vx); return; }
    if (!goal){ c.mv = [0, 0]; return; }
    const gd = Math.hypot(goal.x - h.x, goal.y - h.y);
    if (goal.kind === 'term' && Math.hypot(goal.t.x - h.x, goal.t.y - h.y) < L.USE_R - 4){ game.use(pi); c.mv = [0, 0]; return; }
    if (goal.kind === 'console' && Math.hypot(S.D.objective.x - h.x, S.D.objective.y - h.y) < L.USE_R + 4){ game.use(pi); c.mv = [0, 0]; return; }
    if (goal.kind === 'door' && Math.hypot(goal.door.x - h.x, goal.door.y - h.y) < L.USE_R + 10){ game.use(pi); c.mv = [0, 0]; return; }
    if (goal.kind === 'wait' && gd < 30){ c.mv = [0, 0]; return; }
    if (goal.kind === 'boss' && gd < 40){ const Bq = S.boss; c.mv = Bq ? L.oct(Bq.x - h.x, Bq.y - h.y) : [0, 0]; c.next = 0.06; return; }
    const p = route(h, goal.x, goal.y, goal.door);
    c.mv = steer(h, p, goal.door) || L.oct(goal.x - h.x, goal.y - h.y);
    if (c.jiggle > 0){ c.mv = [Math.round(brng() * 2 - 1), Math.round(brng() * 2 - 1)]; c.jiggle--; }
  }
  for (let frame = 0; ; frame++){
    tm += dt; deckT += dt;
    if (S.phase === 'over' || S.phase === 'won') break;
    if (S.deck !== curDeck){ curDeck = S.deck; deckT = 0; if (opts.invuln) S.heroes.forEach(h => { h.inv = 1e9; }); }
    if (deckT > maxT){ stuck = true; break; }
    S.heroes.forEach((h, pi) => {
      const c = ctl[pi];
      c.next -= dt;
      if (c.next <= 0){ decide(pi, c); if (c.next <= 0) c.next = r0 + brng() * (r1 - r0); }
      if (tm - c.lastT > 4){ if (Math.hypot(h.x - c.lastPos[0], h.y - c.lastPos[1]) < 8 && (c.mv[0] || c.mv[1]) && !c.fire) c.jiggle = 3; c.lastPos = [h.x, h.y]; c.lastT = tm; }
      if (S.phase === 'play'){ game.setMove(pi, c.mv[0], c.mv[1]); game.setFire(pi, c.fire); }
      else { game.setMove(pi, 0, 0); game.setFire(pi, false); }
    });
    if (opts.trace && frame % (tm > (opts.traceFrom || 1e9) && tm < (opts.traceTo || 0) ? 15 : 300) === 0){ const h = S.heroes[0], gl = goalFor(h, 0); console.log('t', tm.toFixed(0), S.phase, 'h', h.x.toFixed(0), h.y.toFixed(0), 'hp', h.hp.toFixed(0), 'goal', gl && gl.kind, gl && gl.x.toFixed(0), gl && gl.y.toFixed(0), 'cards', S.cards, 'tok', S.tokens, 'doors', S.doors.map(d => (d.path ? 'P' : 'S') + (d.open ? 1 : 0)).join(''), 'alarm', S.alarm && S.alarm.t.toFixed(0), 'mv', ctl[0].mv, ctl[0].fire, 'face', h.face, 'inv', h.inv>1e8, 'ammo', h.ammo, 'tgt', ctl[0].tgt, 'en', S.enemies.filter(e=>Math.hypot(e.x-h.x,e.y-h.y)<260 && game._los(h.x,h.y,e.x,e.y)).map(e=>e.type+':'+e.x.toFixed(0)+','+e.y.toFixed(0)+':'+e.hp.toFixed(1)).join(' ')); }
    game.update(dt);
  }
  const passed = ev.clears.length;
  return { seed, won: S.phase === 'won', passed, deck: S.deck, deaths: ev.deaths, why: ev.why, clears: ev.clears, blasts: ev.blasts, stuck,
    score: S.score, tokens: S.tokens, wasted: ev.wasted, buys: ev.buys, time: tm, lives: S.heroes.map(h => h.lives) };
}
