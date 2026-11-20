/* ПОЛУУСТАВ · tests/bot.mjs — «человеческий» бот: проходит рукопись, управляя только как игрок.
   Ввод — setInput({x, y, jump, up, act}) — те же клавиши, что у человека (◀▶, прыжок, ▲/▼ на верёвке, действие).
   Реакция: решения раз в 150–250 мс (между ними держит прежние клавиши). Как человек, «рассчитывает» момент:
   отпустить стрелку или нажать прыжок он может заранее (погрешность ±25 мс).
   Решение каждой головоломки — сценарий шагов (SOL[страница][отметка]); после смерти бот начинает
   участок от отметки заново. Те же сценарии — «скриптовое решение» в тестах проходимости. */

export function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}

// ---------- шаги сценария ----------
// каждый шаг: { name, tick(b) → true, когда готово } ; b — контекст бота
const cx = s => s.hero.x + 9;
export const S_ = {
  go(x, tol = 6){ return { name: 'go ' + x, tick(b){
    const s = b.S(), h = s.hero, d = x - cx(s);
    if (Math.abs(d) < tol && Math.abs(h.vx) < 25){ b.keys.x = 0; return true; }
    if (Math.abs(d) < tol){ b.keys.x = 0; return false; }
    const v = Math.max(60, Math.abs(h.vx)), dir = Math.sign(d);
    b.keys.x = dir;
    const tRel = (Math.abs(d) - (v * v) / 3000) / v;                    // успеть отпустить с учётом торможения
    if (tRel < b.nextGap()) b.at(Math.max(0, tRel), () => { b.keys.x = 0; });
    return false;
  } }; },
  // разбег и прыжок, когда центр героя пересечёт x; держать направление в полёте, пока не приземлится
  jump(x, dir = 1, hold = 2, aim = null){ let phase = 0, t0 = 0; return { name: 'jump ' + x, tick(b){
    const s = b.S(), h = s.hero;
    if (phase === 0){
      b.keys.x = dir; const d = (x - cx(s)) * dir;
      if (d <= 2){ b.tap('jump'); phase = 1; t0 = b.t; return false; }
      const v = Math.max(80, Math.abs(h.vx)), tt = d / v;
      if (tt < b.nextGap()){ b.at(tt, () => b.tap('jump')); phase = 1; t0 = b.t + tt; }
      return false;
    }
    b.keys.x = h.st === 'mantle' ? 0 : dir;
    if (aim && b.t > t0){ const tx = aim(s), e = tx - cx(s); b.keys.x = Math.abs(e) < 8 ? 0 : Math.sign(e); }   // руление в полёте к цели
    if (b.t - t0 > 0.15 && (h.gr || h.st === 'rope') && h.st !== 'mantle'){ if (phase === 1){ b.keys.x = 0; return true; } }
    if (b.t - t0 > hold){ b.keys.x = 0; return true; }
    return false;
  } }; },
  // прыжок с места (вверх/в стенку) с удержанием направления — подтягивание
  hop(dir = 0, hold = 0.8){ let t0 = -1; return { name: 'hop', tick(b){
    const h = b.S().hero;
    if (t0 < 0){ b.keys.x = dir; b.tap('jump'); t0 = b.t; return false; }
    b.keys.x = h.st === 'mantle' ? 0 : dir;                              // подтянулся — отпускает стрелку
    if (b.t - t0 > 0.2 && h.gr && h.st === 'run'){ b.keys.x = 0; return true; }
    if (b.t - t0 > hold + 0.6){ b.keys.x = 0; return true; }
    return false;
  } }; },
  act(){ return { name: 'act', tick(b){ b.keys.x = 0; b.tap('act'); return true; } }; },
  wait(sec){ let t0 = -1; return { name: 'wait ' + sec, tick(b){ b.keys.x = 0; if (t0 < 0) t0 = b.t; return b.t - t0 >= sec; } }; },
  until(fn, name = 'until', max = 30){ let t0 = -1; return { name, tick(b){ b.keys.x = 0; if (t0 < 0) t0 = b.t; return fn(b.S(), b.game) || b.t - t0 > max; } }; },
  // толкать ящик id до x (левый край ящика)
  push(id, x, tol = 4){ let dir0 = 0; return { name: 'push ' + id, tick(b){
    const s = b.S(), bx = s.d.boxes.find(q => q.id === id); if (!dir0) dir0 = Math.sign(x - bx.x) || 1; const dir = dir0;
    if (Math.abs(x - bx.x) < tol || (x - bx.x) * dir < 0 || bx.gone || !bx.gr){ b.keys.x = 0; return true; }
    b.keys.x = dir; const v = 85, tt = Math.abs(x - bx.x) / v;
    if (tt < b.nextGap()) b.at(Math.max(0, tt - 0.02), () => { b.keys.x = 0; });
    return false;
  } }; },
  // тянуть ящик id до x: встать вплотную, держать действие и идти от ящика
  pull(id, x, tol = 4){ return { name: 'pull ' + id, tick(b){
    const s = b.S(), h = s.hero, bx = s.d.boxes.find(q => q.id === id), dir = Math.sign(x - bx.x);
    if (Math.abs(x - bx.x) < tol){ b.keys.x = 0; b.keys.act = false; return true; }
    const adj = b.game.adjacentBox();
    if (!adj || adj.b !== bx){ b.keys.act = false; const spot = dir > 0 ? bx.x + bx.w + 9.5 : bx.x - 9.5; b.redo = S_.go(spot, 1.2); return false; }
    b.keys.act = true; b.keys.x = dir; const tt = Math.abs(x - bx.x) / 70;
    if (tt < b.nextGap()) b.at(Math.max(0, tt - 0.02), () => { b.keys.x = 0; });
    return false;
  } }; },
  // верёвка: прыжок с края (x, dir) → раскачка → отпустить, когда угол (по направлению dir) пройдёт rel
  rope(edgeX, dir, rel = 0.55, minAmp = 0.75){ let phase = 0, amp = 0, t0 = 0, rope0 = -1; return { name: 'rope', tick(b){
    const s = b.S(), h = s.hero;
    if (phase === 0 && h.st === 'rope') phase = 2;                       // уже висим (перелёт с верёвки на верёвку)
    if (phase === 0){ b.redo = S_.jump(edgeX, dir, 1.4); phase = 1; t0 = b.t; return false; }
    if (phase === 1){ if (h.st === 'rope'){ phase = 2; } else if (h.gr && b.t - t0 > 0.5) return true; else return false; }
    if (phase === 3 && h.st === 'rope' && h.rope !== rope0) return true;  // перехватился за следующую верёвку
    if (phase === 2 && rope0 < 0) rope0 = h.rope;
    if (h.st !== 'rope') return h.gr;
    if (phase === 3) return false;
    const rd = s.d.ropes[h.rope], th = rd.th * dir, om = rd.om * dir;
    amp = Math.max(amp * 0.995, Math.abs(rd.th));
    b.keys.x = Math.sign(rd.om) || dir;                                    // качать в такт
    if (amp >= minAmp && om > 0.5 && th > -0.2){
      const tt = (rel - th) / om;
      if (tt <= 0) { b.tap('jump'); b.keys.x = dir; phase = 3; }
      else if (tt < b.nextGap()){ b.at(tt, () => { b.tap('jump'); b.keys.x = dir; }); phase = 3; }
    }
    return false;
  } }; },
  // после отрыва от верёвки держать направление до приземления
  fly(dir, max = 2){ let t0 = -1; return { name: 'fly', tick(b){ const h = b.S().hero; if (t0 < 0) t0 = b.t; b.keys.x = dir; if (b.t - t0 > 0.1 && h.gr && h.st === 'run'){ b.keys.x = 0; return true; } return b.t - t0 > max; } }; },
  lamp(){ return { name: 'lamp', tick(b){ b.keys.x = 0; b.tap('act'); return true; } }; },
  // бросок лампады: короткое нажатие стрелки dir + действие
  throwLamp(dir){ let t0 = -1; return { name: 'throw', tick(b){ if (t0 < 0){ t0 = b.t; b.keys.x = dir; b.at(0.05, () => b.tap('act')); b.at(0.12, () => { b.keys.x = 0; }); return false; } return b.t - t0 > 0.6; } }; }
};

// ---------- решения: SOL[страница][отметка] = шаги до следующей отметки ----------
const { go, jump, hop, act, wait, until, push, pull, rope, fly, lamp, throwLamp } = S_;
export function buildSOL(){ return [
  [ // 1. Заставка
    [jump(392, 1), go(668), jump(676, 1), go(940), go(1010)],
    [jump(1290, 1), go(1470), push('b1', 1760), go(1700), jump(1712, 1), hop(1), go(1860)],
    [go(2016), act(), until(s => s.d.doors[0].off > 100, 'door'), go(2340)],
    [jump(2592, 1), go(3180)],
    [go(3270), push('b2', 3500), until(s => s.d.boxes[1].fixed, 'trap'), go(3480), go(3530), jump(3536, 1), go(3700)],
    [go(4570)]
  ],
  [ // 2. Мельница
    [go(440), until(s => s.d.logs[0].st === 3, 'log'), go(1010)],
    [go(1096), rope(1094, 1, 0.5, 0.7), fly(1), go(1370)],
    [jump(1500, 1), go(1625), pull('b1', 1742), hop(-1), hop(1), go(1860)],
    [go(1990), until(s => s.d.saws[0].t % 2.6 > 2.2 || s.d.saws[0].t % 2.6 < 0.05, 'saw1'), go(2100, 4),
     until(s => { const p = (s.d.saws[1].t / 2.6 + 0.5) % 1; return p > 0.82 || p < 0.02; }, 'saw2'), go(2240), go(2340)],
    [jump(2474, 1), go(2600), jump(2614, 1), go(3140)],
    [go(3200), go(3296), rope(3294, 1, 0.45, 0.7), rope(0, 1, 0.5, 0.75), fly(1), go(3860)],
    [go(4470)]
  ],
  [ // 3. Река
    [go(360), push('b1', 482), until(s => s.d.boxes[0].wet && s.d.boxes[0].x > 512, 'float'), jump(492, 1, 2, s => s.d.boxes[0].x + 20 + s.d.boxes[0].vx * 0.3), go(0, 1e9), until(s => s.d.boxes[0].x > 760, 'drift', 12),
     go(870), go(920)],
    [go(1100), act(), until(s => s.d.doors[0].off > 120, 'dock'), until(s => s.d.boxes[1].x > 1185, 'raft', 6), jump(1150, 1, 2, s => s.d.boxes[1].x + 20 + s.d.boxes[1].vx * 0.3), until(s => s.d.boxes[1].x > 1430 && Math.abs(s.d.boxes[1].vx) < 5, 'pile', 20),
     go(1468), jump(1474, 1), go(1496), rope(1500, 1, 0.55, 0.75), fly(1), go(1840)],
    [go(2180), go(2212, 3), push('b3', 2380), go(2340), hop(1), act(), until(s => s.d.water[3].y < 334, 'flood', 12), hop(1), go(2470)],
    [jump(2736, 1), go(3320)],
    [go(3350), act(), until(s => s.d.boxes[3].vx > 20, 'tide', 5), jump(3374, 1, 2, s => s.d.boxes[3].x + 20 + s.d.boxes[3].vx * 0.3), go(0, 1e9), until(s => s.d.boxes[3].x > 3740, 'cross', 15), go(3860)],
    [go(4470)]
  ],
  [ // 4. Звонница
    [go(735), jump(745, 1), until(s => s.d.scales[0].o < -105, 'sink', 8), go(868, 4), act(), until(s => s.d.scales[0].o > 105, 'rise', 12), hop(1), go(950), jump(955, 1), go(1110)],
    [go(1150), until(s => { const s1 = s.d.saws[0]; const ph = (s1.t / 3.2) % 1; return ph > 0.22 && ph < 0.3; }, 'patrol', 8), jump(1175, 1, 1.4), go(1475)],
    [go(1480), push('b2', 1604), go(1560), jump(1580, 1), until(s => s.d.saws[1].ret > 85, 'retract'), go(2000)],
    [jump(2276, 1), go(2880)],
    [go(2980), act(), go(3460)],
    [jump(3576, 1), go(4070)]
  ],
  [ // 5. Разлив
    [go(380), push('b1', 525), until(s => s.d.ink[0].dried, 'dry'), go(730)],
    [go(860), until(s => { const p = ((s.time / 1.5) % 1); return p > 0.45 && p < 0.5; }, 'drip', 6), go(1090)],
    [go(1300), go(1530), jump(1538, 1), go(1680), hop(1), go(1740)],
    [go(1860), push('b2', 2001), until(s => s.d.boxes[1].gr && s.d.boxes[1].y > 280, 'sink'), go(1990), jump(1992, 1, 2, s => s.d.boxes[1].x + 20), go(2028), jump(2033, 1), go(2190)],
    [jump(2576, 1), go(3260)],
    [go(3390), push('b3', 3800), until(s => s.d.ink[3].dried, 'dried', 4), go(3900)],
    [go(4270)]
  ],
  [ // 6. Перо
    [go(520), act(), go(860)],
    [go(980), push('b1', 1240), go(1210), jump(1220, 1), go(1600)],
    [go(1950), act(), jump(1995, 1), jump(2105, 1), jump(2225, 1), jump(2345, 1), jump(2465, 1), go(2540)],
    [go(3320)],
    [go(3380), act(), push('b2', 3720), hop(1), hop(1), go(3810)],
    [go(4470)]
  ],
  [ // 7. Лампада
    [go(300), lamp(), go(790)],
    [go(1072), throwLamp(1), until(s => s.d.boxes[0].gr, 'land'), go(1320), go(1340), lamp(), go(1680)],
    [go(1760), jump(1770, 1, 2, () => 1832), go(1840), jump(1846, 1, 2, () => 1912), go(1920), jump(1926, 1, 2, () => 2000), go(2120), go(2270), throwLamp(1), until(s => s.d.boxes[0].gr, 'land'), go(2180), rope(2294, 1, 0.5, 0.8), fly(1), go(2700), go(3320)]
  ]
]; }

// ---------- исполнитель ----------
export function playBot(P, seed, opts = {}){
  const rng = mulberry32(seed * 7919 + 13);
  const [r0, r1] = opts.react || [0.15, 0.25];
  const maxT = opts.maxT || 3600, DT = 1 / 120;
  const ev = { deaths: 0, causes: {}, resets: 0, pages: 0, won: false, cps: 0, log: [] };
  const game = P.Game({ zone: opts.zone || 0, save: opts.save, onEvent: (t, d) => {
    if (t === 'death'){ ev.deaths++; ev.causes[d.cause] = (ev.causes[d.cause] || 0) + 1; if (opts.trace) console.log('death', d.cause, Math.round(d.x), 'z', game.state().z); }
    if (t === 'reset') ev.resets++;
    if (t === 'page') ev.pages++;
    if (t === 'checkpoint') ev.cps++;
    if (t === 'win') ev.won = true;
  } }).start();
  const keys = { x: 0, y: 0, jump: false, up: false, act: false };
  const b = { game, keys, t: 0, S: () => game.state(), sched: [], redo: null, gap: 0.2,
    nextGap(){ return this.gap; },
    at(dt, fn){ this.sched.push({ t: this.t + Math.max(0, dt + (rng() - 0.5) * 0.05), fn }); },
    tap(k){ keys[k] = true; this.sched.push({ t: this.t + 0.09, fn: () => { keys[k] = false; } }); } };
  let segKey = '', steps = [], idx = 0, next = 0, stuckT = 0, lastX = 0;
  const until = opts.until;
  while (b.t < maxT && !ev.won){
    const s = game.state();
    if (until && until(s)) break;
    const key = s.z + ':' + s.cp + ':' + (s.hero.st === 'dead' ? 'd' : 'a') + ':' + ev.deaths + ':' + ev.resets;
    if (s.hero.st === 'dead' || s.phase === 'turn'){ keys.x = 0; keys.act = false; segKey = ''; b.sched = []; }
    else if (key !== segKey){ segKey = key; idx = 0; b.redo = null; b.sched = []; next = b.t;
      steps = buildSOL()[s.z][s.cp] || []; }   // у шагов внутреннее состояние — для повтора участка сценарий строится заново
    if (b.t >= next && s.hero.st !== 'dead' && s.phase === 'play'){
      b.gap = r0 + rng() * (r1 - r0); next = b.t + b.gap;
      if (opts.lazy && rng() < opts.lazy){ keys.x = 0; next += 0.4; }
      else if (b.redo){ if (b.redo.tick(b)) b.redo = null; }
      else if (idx < steps.length){ if (steps[idx].tick(b)) { idx++; if (opts.trace) console.log('  ok', s.z, s.cp, steps[idx - 1].name, b.t.toFixed(1), Math.round(s.hero.x), Math.round(s.hero.y), s.d.boxes.map(q => Math.round(q.x) + ',' + Math.round(q.y)).join(' ')); } }
      else keys.x = 1;                                                     // сценарий участка кончился — идём дальше к отметке
    }
    for (let i = b.sched.length - 1; i >= 0; i--) if (b.sched[i].t <= b.t){ const f = b.sched[i].fn; b.sched.splice(i, 1); f(); }
    game.setInput(keys); game.step(); b.t += DT;
    if (Math.abs(s.hero.x - lastX) > 2 || s.hero.st !== 'run'){ lastX = s.hero.x; stuckT = 0; } else stuckT += DT;
    if (stuckT > 60) break;
  }
  const s = game.state();
  return { won: ev.won, time: b.t, deaths: ev.deaths, causes: ev.causes, resets: ev.resets, pages: ev.pages, z: s.z, cp: s.cp, x: Math.round(s.hero.x), stuck: !ev.won && b.t < maxT && !until, cps: ev.cps, step: steps[idx] && steps[idx].name };
}
