/* КАМЕРТОН · tests/bot.mjs — «человеческий» бот: проходит все зоны, управляя только как игрок.
   Ввод — setInput({x, y, up, jump, act, sw}) — те же клавиши, что у человека (◀▶, ▲▼, прыжок, действие, переключение).
   Реакция: решения раз в 150–250 мс (между ними держит прежние клавиши); отпустить стрелку или нажать прыжок он может
   «рассчитать» заранее (погрешность ±25 мс). Решение каждой головоломки — сценарий шагов SOL[зона][отметка];
   после гибели бот начинает участок от отметки заново. Те же сценарии — «скриптовое решение» в тестах проходимости. */

export function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}

const cx = o => o.x + o.w / 2;
// тело, которым сейчас управляет игрок (для строя — первый солдатик или указанный who)
function lead(b, who){ const g = b.game; if (who) return g.body(who); return g.ctlBodies()[0] || g.hero(); }
const RUN = { hero: 150, porter: 95, dancer: 165, giant: 65, soldier: 115 };

export const S_ = {
  go(x, tol = 5, who = null){ return { name: 'go ' + x + (who ? ' ' + who : ''), tick(b){
    const o = lead(b, who), d = x - cx(o);
    if (Math.abs(d) < tol){ b.keys.x = 0; return Math.abs(o.vx) < 20; }
    const v = Math.max(40, Math.abs(o.vx)), dir = Math.sign(d);
    b.keys.x = dir;
    const tRel = (Math.abs(d) - (v * v) / 2800) / v;
    if (tRel < b.nextGap()) b.at(Math.max(0, tRel), () => { b.keys.x = 0; });
    return false;
  } }; },
  // разбег и прыжок, когда центр тела пересечёт x; держать направление в полёте до приземления
  jump(x, dir = 1, hold = 2){ let phase = 0, t0 = 0; return { name: 'jump ' + x, tick(b){
    const o = lead(b);
    if (phase === 0){
      b.keys.x = dir; const d = (x - cx(o)) * dir;
      if (d <= 2){ b.tap('jump'); phase = 1; t0 = b.t; return false; }
      const v = Math.max(80, Math.abs(o.vx)), tt = d / v;
      if (tt < b.nextGap()){ b.at(tt, () => b.tap('jump')); phase = 1; t0 = b.t + tt; }
      return false;
    }
    b.keys.x = dir;
    if (b.t - t0 > 0.15 && o.gr){ b.keys.x = 0; return true; }
    if (b.t - t0 > hold){ b.keys.x = 0; return true; }
    return false;
  } }; },
  // прыжок с места, удерживая направление (на куклу, на карниз)
  hop(dir = 0, hold = 1.2){ let t0 = -1; return { name: 'hop ' + dir, tick(b){
    const o = lead(b);
    if (t0 < 0){ b.keys.x = dir; b.tap('jump'); t0 = b.t; return false; }
    b.keys.x = dir;
    if (b.t - t0 > 0.2 && o.gr){ b.keys.x = 0; return true; }
    if (b.t - t0 > hold){ b.keys.x = 0; return true; }
    return false;
  } }; },
  act(){ return { name: 'act', tick(b){ b.keys.x = 0; b.tap('act'); return true; } }; },
  // переключить управление на to ('hero' | id куклы | 'squad')
  sw(to){ let t = -1; return { name: 'sw ' + to, tick(b){ b.keys.x = 0; if (b.game.state().d.ctl === to) return true; if (t < 0 || b.t - t > 0.15){ b.tap('sw'); t = b.t; } return false; } }; },
  // по лестнице вверх до верха / вниз до земли
  climb(dirUp = true){ let t0 = -1; return { name: 'climb', tick(b){ const h = b.game.hero(); if (t0 < 0) t0 = b.t; b.keys.x = 0;
    if (dirUp){ b.keys.up = true; if (b.t - t0 > 0.3 && h.climb < 0 && h.gr){ b.keys.up = false; return true; } }
    else { b.keys.y = 1; if (b.t - t0 > 0.3 && h.climb < 0 && h.gr){ b.keys.y = 0; return true; } }
    return b.t - t0 > 6; } }; },
  wait(sec){ let t0 = -1; return { name: 'wait ' + sec, tick(b){ b.keys.x = 0; if (t0 < 0) t0 = b.t; return b.t - t0 >= sec; } }; },
  until(fn, name = 'until', max = 30){ let t0 = -1; return { name, tick(b){ b.keys.x = 0; if (t0 < 0) t0 = b.t; return fn(b.S(), b.game) || b.t - t0 > max; } }; }
};

// ---------- решения: SOL[зона][отметка] = шаги до следующей отметки ----------
const { go, jump, hop, act, sw, climb, wait, until } = S_;
const lamp = (g, i) => g.lampState(i);
const crushP = (s, i) => { const c = s.L.crushers[i], t = s.d.crushers[i].t; return ((t / c.period + c.phase) % 1 + 1) % 1; };
const safe = (s, i) => { const p = crushP(s, i); return p > 0.82 && p < 0.94; };   // молот только что поднялся
export function buildSOL(){ return [
  [ // 1. Мастерская
    [jump(282, 1), go(420), jump(628, 1), go(884), climb(), go(960), go(1060)],
    [go(1180), act(), go(1352, 6), until(s => s.d.plates[0].on, 'plate'), sw('hero'), until(s => s.d.doors[0].off > 120, 'door'), go(1620)],
    [go(1700), act(), go(1935, 3), until((s, g) => g.body('p2').vx === 0, 'stop'), sw('hero'), go(1900), hop(1), hop(1), go(2150)],
    [go(2420)],
    [go(2418, 3), go(2702, 3), hop(1), hop(1), go(2960)]
  ],
  [ // 2. Часовая улица
    [go(300), act(), go(760, 4), act(), until(s => s.d.doors[0].off > 80, 'vent'), sw('hero'), go(860)],
    [sw('d1'), go(915, 4), hop(1), go(1000, 4), act(), until((s, g) => g.sig('b'), 'bridge'), sw('hero'), go(1400)],
    [go(1480), act(), go(1800, 4), act(), until((s, g) => g.sig('h'), 'hold'), sw('hero'), go(1586, 4), climb(), go(2205), go(2250)],
    [go(2330), act(), sw('hero'), go(2420, 4), sw('d3'), jump(2405, 1), go(2930, 4), act(), until((s, g) => g.sig('w'), 'watch off'), sw('hero'), jump(2425, 1), go(3350)]
  ],
  [ // 3. Ярмарка
    [go(308), act(), go(268, 3), sw('hero'), go(428), act(), go(708, 4, 's1'), until(s => s.d.plates[0].on && s.d.plates[1].on, 'plates'), sw('hero'), until(s => s.d.doors[0].off > 120, 'door'), go(1100)],
    [go(1240, 4), until((s, g) => g.moverRect(0).x < 1262, 'boat', 12), jump(1244, 1, 1), until((s, g) => g.moverRect(0).x > 1555, 'ride', 12), go(1700), go(1720)],
    [go(1840), act(), go(1900, 3, 's4'), act(), go(2150, 3, 's3'), act(), until((s, g) => g.sig(['r', 's']), 'cranks'), sw('hero'), until(s => s.d.doors[1].off > 120, 'door'), go(2400)],
    [go(2490), until(s => safe(s, 0), 'c1'), go(2630), until(s => safe(s, 1), 'c2'), go(2850)],
    [go(3110)]
  ],
  [ // 4. Колокольный двор
    [go(300), act(), go(620, 4), until(s => s.d.plates[0].on, 'plate'), sw('hero'), until(s => s.d.doors[0].off > 120, 'door'), go(900)],
    [go(990), act(), go(1280, 3), until((s, g) => g.body('g2').vx === 0 && s.d.crates[0].y > 430, 'pit'), sw('hero'), go(1220), hop(1), hop(1), go(1500)],
    [go(1710), go(1780)],
    [go(1820), act(), sw('hero'), go(2090, 6), sw('g3'), go(1910, 4), until(s => Math.abs(s.d.lifts[0].y - 250) < 1, 'lift'), sw('hero'), go(2440), go(2470)],
    [go(2510), act(), go(2890, 3), until((s, g) => g.body('g4').vx === 0, 'wall'), sw('hero'), go(2876, 3), hop(1), hop(1), go(3310)]
  ],
  [ // 5. Депо
    [go(370), until(s => safe(s, 0), 'c1'), go(510), until(s => safe(s, 1), 'c2'), go(670), until(s => safe(s, 2), 'c3'), go(900)],
    [go(1020), act(), sw('hero'), go(1240, 4), sw('p'), go(1100, 3), act(), until(s => s.d.lifts[0].y < 281, 'lift'), sw('hero'), go(1960)],
    [jump(2272, 1), jump(2492, 1), go(2700)],
    [go(2760), act(), go(3330, 4), act(), until((s, g) => g.sig('cs'), 'stop'), sw('hero'), until(s => s.d.crushers[3].off < 1 && s.d.crushers[4].off < 1 && s.d.crushers[5].off < 1, 'up'), go(3660)]
  ],
  [ // 6. Башня часовщика
    [go(300), act(), go(492, 4), sw('hero'), go(360), act(), go(740, 4), act(), until(s => s.d.doors[0].off > 80, 'door'), sw('hero'), go(860)],
    [go(1000), act(), sw('hero'), go(1250, 6), sw('g'), go(1130, 4), until(s => Math.abs(s.d.lifts[0].y - 220) < 1, 'lift'), sw('hero'), go(1810), go(1880)],
    [go(1945), act(), go(2120, 3, 's2'), act(), go(2380, 3, 's1'), act(), until((s, g) => g.sig(['c1', 'c2']), 'cranks'), sw('hero'), go(1986, 4), climb(), go(2895), go(2950)],
    [go(3050), act(), sw('hero'), go(3350, 6), sw('g2'), go(3180, 4), until(s => Math.abs(s.d.lifts[1].y - 200) < 1, 'lift'), sw('hero'), go(3810)]
  ]
]; }

// ---------- исполнитель ----------
export function playBot(K, seed, opts = {}){
  const rng = mulberry32(seed * 7919 + 13);
  const [r0, r1] = opts.react || [0.15, 0.25];
  const maxT = opts.maxT || 3600, DT = 1 / 120;
  const ev = { deaths: 0, causes: {}, resets: 0, zones: 0, won: false, cps: 0 };
  const game = K.Game({ zone: opts.zone || 0, save: opts.save, onEvent: (t, d) => {
    if (t === 'death'){ ev.deaths++; ev.causes[d.cause] = (ev.causes[d.cause] || 0) + 1; if (opts.trace) console.log('death', d.cause, d.who, Math.round(d.x), Math.round(d.y), 'z', game.state().z, 'cp', game.state().cp, game.state().d.bodies.map(q => q.id + ':' + Math.round(q.x) + ',' + Math.round(q.y)).join(' ')); }
    if (t === 'zoneEnd') ev.zones++;
    if (t === 'checkpoint') ev.cps++;
    if (t === 'win') ev.won = true;
  } }).start();
  const keys = { x: 0, y: 0, up: false, jump: false, act: false, sw: false };
  const b = { game, keys, t: 0, S: () => game.state(), sched: [], gap: 0.2,
    nextGap(){ return this.gap; },
    at(dt, fn){ this.sched.push({ t: this.t + Math.max(0, dt + (rng() - 0.5) * 0.05), fn }); },
    tap(k){ keys[k] = true; this.sched.push({ t: this.t + 0.09, fn: () => { keys[k] = false; } }); } };
  let segKey = '', steps = [], idx = 0, next = 0, stuckT = 0, lastSig = '';
  while (b.t < maxT && !ev.won){
    const s = game.state();
    if (opts.until && opts.until(s)) break;
    const key = s.z + ':' + s.cp + ':' + (s.dead ? 'd' : 'a') + ':' + ev.deaths;
    if (s.dead || s.phase === 'turn'){ keys.x = 0; keys.up = false; keys.y = 0; segKey = ''; b.sched = []; }
    else if (key !== segKey){ segKey = key; idx = 0; b.sched = []; next = b.t; keys.x = 0; keys.up = false; keys.y = 0; steps = buildSOL()[s.z][s.cp] || []; }
    if (b.t >= next && !s.dead && s.phase === 'play'){
      b.gap = r0 + rng() * (r1 - r0); next = b.t + b.gap;
      if (idx < steps.length){ if (steps[idx].tick(b)){ idx++; if (opts.trace) { const h = game.hero(); console.log('  ok', s.z, s.cp, steps[idx - 1].name, b.t.toFixed(1), 'hero', Math.round(h.x), Math.round(h.y), 'ctl', s.d.ctl); } } }
      else keys.x = s.d.ctl === 'hero' ? 1 : 0;                            // сценарий участка кончился — идём к отметке
    }
    for (let i = b.sched.length - 1; i >= 0; i--) if (b.sched[i].t <= b.t){ const f = b.sched[i].fn; b.sched.splice(i, 1); f(); }
    game.setInput(keys); game.step(); b.t += DT;
    const sig = s.z + ':' + s.cp + ':' + idx + ':' + ev.deaths;
    if (sig !== lastSig){ lastSig = sig; stuckT = 0; } else stuckT += DT;
    if (stuckT > 60) break;
  }
  const s = game.state(), h = game.hero();
  return { won: ev.won, time: b.t, deaths: ev.deaths, causes: ev.causes, zones: ev.zones, z: s.z, cp: s.cp, x: Math.round(h.x), y: Math.round(h.y), stuck: !ev.won && b.t < maxT && !opts.until, cps: ev.cps, step: steps[idx] && steps[idx].name };
}
