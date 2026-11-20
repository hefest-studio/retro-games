/* КАМЕРТОН · tests/engine.test.mjs — автотесты физики, механики камертона (настройка, переключение, строй, вороты, звук),
   света и тени, опасностей, гибели/рестарта, сохранения, проходимости каждой головоломки, музыки, страницы и правила имён
   (Node, без зависимостей). Запуск: node kamerton/tests/engine.test.mjs   (QUICK=1 — без долгих прогонов бота). */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { playBot } from './bot.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const box = { console, Math, JSON, Array, Object };
box.window = box; box.globalThis = box; vm.createContext(box);
for (const f of ['js/i18n.js', 'js/levels.js', 'js/game.js', 'js/render.js', 'js/audio.js']) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), box, { filename: f });
const K = box.KAMER, C = K.C, LV = K.LEVELS, KIND = K.KIND;

let passed = 0, failed = 0;
function test(name, fn){ try { fn(); passed++; console.log('ok   ' + name); } catch (e){ failed++; console.log('FAIL ' + name + ' — ' + e.message); } }
function eq(a, b, m){ const A = JSON.stringify(a), B = JSON.stringify(b); if (A !== B) throw new Error((m || '') + ' ждали ' + B + ', получили ' + A); }
function ok(c, m){ if (!c) throw new Error(m || 'ложь'); }

// ---------- помощники ----------
function mk(z, cp = 0){ const log = []; const g = K.Game({ save: { z, cp, snap: null }, onEvent: (t, d) => log.push([t, d]) }).start(); g.log = log; g.has = t => log.some(e => e[0] === t); return g; }
function run(g, sec, inp, fn){ for (let i = 0; i < sec * 120; i++){ g.setInput(typeof inp === 'function' ? inp(i) : (inp || {})); if (fn && fn(g.state()) === false) break; g.step(); } }
function put(o, cx, feet){ o.x = cx - o.w / 2; o.y = (feet || 440) - o.h; o.vx = 0; o.vy = 0; o.gr = true; }
function tap(g, key){ g.setInput({ [key]: true }); g.step(); g.setInput({}); g.step(); }

// ---------- данные зон ----------
test('зоны: 6, у каждой отметки по возрастанию x, выход дальше последней, мир замкнут стенками, финал — последняя', () => {
  eq(LV.length, 6);
  LV.forEach((L, i) => {
    ok(L.cps.length >= 4, 'отметок мало на ' + i);
    for (let k = 1; k < L.cps.length; k++) ok(L.cps[k].x > L.cps[k - 1].x, 'порядок отметок ' + i);
    ok(L.exit > L.cps[L.cps.length - 1].x && L.exit < L.w, 'выход ' + i);
    ok(L.solids.some(s => s[0] === -40) && L.solids.some(s => s[0] === L.w), 'стенки ' + i);
    (L.dolls || []).forEach(d => ok(KIND[d.kind], 'вид куклы ' + d.kind));
  });
  ok(LV[5].final && !LV.slice(0, 5).some(L => L.final), 'финал');
  const kinds = new Set(LV.flatMap(L => (L.dolls || []).map(d => d.kind))); eq([...kinds].sort(), ['dancer', 'giant', 'porter', 'soldier'], 'все виды кукол');
});
test('отметки безопасны: подмастерье на любом фонарике стоит на тверди и не гибнет 2 с (свет, молоты, падение)', () => {
  LV.forEach((L, z) => L.cps.forEach((c, k) => {
    const g = mk(z, k); let died = null;
    run(g, 2, {}, s => { if (s.dead) died = s.dead.cause; });
    const h = g.hero(); ok(!died && h.gr && Math.abs(h.x + h.w / 2 - c.x) < 2, `зона ${z + 1} отм.${k}: ${JSON.stringify({ x: h.x, y: h.y, gr: h.gr, died })}`);
  }));
});

// ---------- физика ----------
test('подмастерье: бег 150 px/с, прыжок ≈ 84 px вверх и ≈ 90–110 px в длину с разбега', () => {
  const g = mk(0); const h = g.hero(); put(h, 1100); let minY = 1e9;
  run(g, 1, { x: 1 }); ok(Math.abs(h.vx - KIND.hero.run) < 1, 'скорость ' + h.vx);
  const x0 = h.x; run(g, 0.03, { x: 1, jump: true }); run(g, 1.2, { x: 1 }, s => { minY = Math.min(minY, h.y); return !h.gr || h.y < 401; });
  ok(402 - minY > 78 && 402 - minY < 90, 'высота ' + (402 - minY)); ok(h.x - x0 > 90 && h.x - x0 < 115, 'длина ' + (h.x - x0));
});
test('нет туннелирования: падение 900 px/с на настил 14 px и на голову куклы; шаг ≤ тончайшей тверди', () => {
  const g = mk(1, 2); const h = g.hero(); put(h, 1700, 100); h.vy = 900; run(g, 0.6, {});
  ok(h.gr && Math.abs(h.y + h.h - 300) < 0.6, 'сквозь настил: ' + h.y);
  const g2 = mk(0, 1); const p = g2.body('p1'), h2 = g2.hero(); put(h2, 1180, 100); h2.vy = 900; run(g2, 0.6, {});
  ok(Math.abs(h2.y + h2.h - p.y) < 0.6, 'сквозь носильщика: ' + h2.y);
  const thin = Math.min(...LV.flatMap(L => L.solids.map(s => Math.min(s[2], s[3]))), ...LV.flatMap(L => (L.lifts || []).map(l => l.h)));
  ok(C.MAXF * K.Game().DT < thin, 'шаг ' + C.MAXF / 120 + ' ≥ ' + thin);
});
test('рост и прыжок кукол: подмастерье не берёт карниз 100 px, плясунья берёт; носильщик и тяжеловес не прыгают', () => {
  const g = mk(1, 1); const S = g.state(), h = g.hero(), d = g.body('d1'); put(h, 915); run(g, 0.03, { x: 1, jump: true }); run(g, 1.2, { x: 1 }); ok(h.y > 390, 'подмастерье залез: ' + h.y);
  d.att = true; put(h, 860); put(d, 915); g.setCtl('d1'); run(g, 0.03, { x: 1, jump: true }); run(g, 1.2, { x: 1 }, () => !(d.gr && d.y < 330)); ok(d.y + d.h <= 341, 'плясунья не залезла: ' + d.y);
  eq([KIND.porter.jump, KIND.giant.jump], [0, 0]);
  ok(KIND.dancer.h < 26 && KIND.hero.h > 26 && KIND.giant.wt >= 3 && KIND.porter.wt >= 2 && KIND.hero.wt < 2, 'роста/веса');
});

// ---------- камертон ----------
test('камертон: действие у спящей куклы настраивает её и передаёт ей управление; Q — по кругу; ввод идёт только управляемому', () => {
  const g = mk(0, 1); const S = g.state(), p = g.body('p1'), h = g.hero();
  put(h, 1170); tap(g, 'act'); ok(p.att && S.d.ctl === 'p1' && g.has('attune'), 'не настроилась');
  const hx = h.x; run(g, 0.5, { x: 1 }); ok(p.x > 1180 && Math.abs(h.x - hx) < 0.01, 'идёт не тот');
  tap(g, 'sw'); eq(S.d.ctl, 'hero'); tap(g, 'sw'); eq(S.d.ctl, 'p1'); eq(g.options(), ['hero', 'p1']);
});
test('звук камертона: кукла дальше LINK_R не слушается, управление возвращается к подмастерью', () => {
  const g = mk(0, 1); const S = g.state(), p = g.body('p1'), h = g.hero(); put(h, 1170); tap(g, 'act');
  put(h, 300); run(g, 0.05, { x: 1 }); eq(S.d.ctl, 'hero', 'не вернулось'); ok(g.has('unlink')); ok(!g.options().includes('p1'), 'в списке далёкая кукла');
});
test('строй: настроенные солдатики идут вместе; расстояние между ними задаёт игрок (настраивая по одному)', () => {
  const g = mk(2); const S = g.state(), s1 = g.body('s1'), s2 = g.body('s2'), h = g.hero();
  put(h, 305); tap(g, 'act'); ok(s1.att && !s2.att && S.d.ctl === 'squad', 'первый');
  run(g, 0.6, { x: -1 }); run(g, 0.5, {}); const gap0 = s2.x - s1.x;
  tap(g, 'sw'); put(h, 425); tap(g, 'act'); ok(s2.att && S.d.ctl === 'squad', 'второй');
  run(g, 1.5, { x: 1 }); run(g, 0.5, {}); ok(Math.abs((s2.x - s1.x) - gap0) < 0.5 && s1.x > 300, 'строй сбился: ' + (s2.x - s1.x) + ' vs ' + gap0);
  const g2 = mk(2, 2); put(g2.hero(), 1840); tap(g2, 'act'); ok(g2.body('s3').att && g2.body('s4').att, 'двое рядом — разом');
});
test('ворот: кукла держит его и после переключения; подмастерье с камертоном держать не может', () => {
  const g = mk(1, 2); const S = g.state(), d = g.body('d2'), h = g.hero(); put(h, 1475); tap(g, 'act');
  put(d, 1800); tap(g, 'act'); ok(d.hold === 2 && g.sig('h'), 'не держит'); tap(g, 'sw'); eq(S.d.ctl, 'hero');
  run(g, 1, {}); ok(g.sig('h') && S.d.doors[1].off > 60, 'отпустила / заслонка закрыта');
  const g2 = mk(1, 2); const h2 = g2.hero(); put(h2, 1800); g2.state().d.lampT = [0, 0]; tap(g2, 'act'); // подмастерье у ворота под фонарём — гибнет от света
  ok(g2.state().dead && g2.state().dead.cause === 'light', 'свет не остановил');
  const g3 = mk(4, 1); const S3 = g3.state(), h3 = g3.hero(), p = g3.body('p'); p.att = true; put(h3, 1100); tap(g3, 'act'); ok(h3.hold === 0, 'подмастерье не взялся');
  g3.setCtl('p'); ok(h3.hold === -1 && !g3.sig('up'), 'хват не снят при переключении');
});

// ---------- плиты, заслонки, ящики ----------
test('плиты по весу: подмастерье не жмёт плиту носильщика; носильщик жмёт; тяжёлую — только тяжеловес', () => {
  const g = mk(0, 1); const S = g.state(), h = g.hero(); put(h, 1352); run(g, 0.3, {}); ok(!S.d.plates[0].on, 'подмастерье прижал');
  const p = g.body('p1'); put(p, 1352); run(g, 0.3, {}); ok(S.d.plates[0].on, 'носильщик не прижал'); run(g, 1, {}); ok(S.d.doors[0].off > 100, 'дверь');
  const g2 = mk(3); const S2 = g2.state(); put(g2.body('g1'), 620); run(g2, 0.3, {}); ok(S2.d.plates[0].on, 'тяжеловес');
  const g3 = mk(3); put(g3.body('g1'), 200); put(g3.hero(), 620); run(g3, 0.3, {}); ok(!g3.state().d.plates[0].on, 'подмастерье на тяжёлой');
});
test('заслонка с зазором 26 px: плясунья проходит под ней, подмастерье — нет', () => {
  const g = mk(1); const h = g.hero(), d = g.body('d1'); put(h, 600); run(g, 1.5, { x: 1 }); ok(h.x + h.w <= 640.01, 'подмастерье прошёл: ' + h.x);
  d.att = true; put(h, 560); put(d, 600); g.setCtl('d1'); run(g, 1.2, { x: 1 }); ok(d.x > 700, 'плясунья застряла: ' + d.x);
});
test('ящики: подмастерье толкает ящик, но не болванку; тяжеловес толкает болванку, она сползает в яму и встаёт вровень', () => {
  const g = mk(0, 4); const c = g.state().d.crates[0]; run(g, 1, { x: 1 }); ok(c.x > 2450, 'ящик не едет');
  const g2 = mk(3, 1); const S2 = g2.state(), hb = S2.d.crates[0], h2 = g2.hero(); put(h2, 1080); run(g2, 1, { x: 1 }); ok(Math.abs(hb.x - 1100) < 0.01, 'подмастерье сдвинул болванку');
  const gi = g2.body('g2'); gi.att = true; put(h2, 900); g2.setCtl('g2'); run(g2, 8, { x: 1 });
  ok(Math.abs(hb.y - 440) < 0.6 && Math.abs(hb.x - 1200) < 4, 'болванка не в яме: ' + JSON.stringify({ x: hb.x, y: hb.y })); ok(gi.x > 1230 && gi.y < 380, 'тяжеловес не перешёл: ' + gi.x);
});
test('ступени в рост: подмастерье влезает на голову носильщика и оттуда на карниз 120 px', () => {
  const g = mk(0, 2); const h = g.hero(), p = g.body('p2'); p.att = true; put(p, 1936); put(h, 1900);
  run(g, 0.03, { x: 1, jump: true }); run(g, 1, { x: 1 }); ok(Math.abs(h.y + h.h - p.y) < 1, 'не на голове: ' + h.y);
  run(g, 0.03, { x: 1, jump: true }); run(g, 1, { x: 1 }); ok(Math.abs(h.y + h.h - 320) < 1, 'не на карнизе: ' + h.y);
});
test('подъёмник по плите везёт стоящего сверху; седок на тяжеловесе едет вместе с ним', () => {
  const g = mk(3, 3); const S = g.state(), h = g.hero(), gi = g.body('g3'); gi.att = true; put(h, 2090, 430); put(gi, 1910);
  run(g, 3.5, {}); ok(Math.abs(S.d.lifts[0].y - 250) < 1 && Math.abs(h.y + h.h - 250) < 1.5, 'не поднял: ' + JSON.stringify({ l: S.d.lifts[0].y, h: h.y }));
  const g2 = mk(3, 3); const h2 = g2.hero(), g4 = g2.body('g3'); g4.att = true; put(g4, 1820); put(h2, 1820, g4.y); g2.setCtl('g3'); run(g2, 1, { x: 1 }); ok(Math.abs(h2.x + h2.w / 2 - (g4.x + g4.w / 2)) < 2 && g4.x > 1840, 'седок отстал: ' + JSON.stringify({ h: h2.x, g: g4.x }));
});

// ---------- свет и опасности ----------
test('свет: фонарь останавливает подмастерье; за ящиком — тень; куклы свету не подвластны; погашенный смотритель не видит', () => {
  const g = mk(0, 4); const h = g.hero(); put(h, 2620); ok(g.lit(h), 'на свету не видно');
  const c = g.state().d.crates[0]; c.x = 2640; put(h, 2625); ok(!g.lit(h), 'ящик не даёт тени');
  const g2 = mk(1, 2); const d = g2.body('d2'); put(d, 1800); d.att = true; run(g2, 1, {}); ok(!g2.state().dead, 'кукла погибла от света');
  const g3 = mk(1, 3); const S3 = g3.state(), h3 = g3.hero(); put(h3, 2700); S3.d.lampT[1] = 0.5; ok(g3.lit(h3), 'смотритель не видит');
  S3.d.levers[3].on = true; ok(!g3.lit(h3), 'погашенный видит');
  const g4 = mk(3, 4); const h4 = g4.hero(); put(h4, 2700); ok(g4.lit(h4), 'двор не освещён'); put(g4.body('g4'), 2760); ok(!g4.lit(h4), 'тяжеловес не заслоняет');
});
test('молоты: под опущенным молотом — остановка; плясунья проходит под низкими молотами депо; рычаг их останавливает', () => {
  const g = mk(4); const S = g.state(), h = g.hero(); put(h, 430); S.d.crushers[0].t = 0.45 * 2.0 + 0.1; run(g, 0.3, {}); ok(S.dead && S.dead.cause === 'crush', 'не задавило');
  const g2 = mk(4, 3); const d = g2.body('d'), h2 = g2.hero(); d.att = true; put(h2, 2900); put(d, 2960); g2.setCtl('d'); run(g2, 3, { x: 1 }); ok(!g2.state().dead && d.x > 3200, 'плясунья: ' + d.x);
  run(g2, 2, {}, () => { put(d, 3330); }); tap(g2, 'act'); run(g2, 2, {}); ok(g2.sig('cs') && g2.state().d.crushers.slice(3).every(c => c.off < 1), 'молоты не встали');
});
test('погоня: барабан катится за подмастерьем; догнал — остановка; в яму падает', () => {
  const g = mk(4, 2); const S = g.state(), h = g.hero(); run(g, 0.8, { x: 1 }); ok(S.d.drums[0].st === 1 && g.has('rumble'), 'не покатился');
  run(g, 4, {}, s => !s.dead); ok(S.dead && S.dead.cause === 'drum', 'не догнал: ' + JSON.stringify(S.dead));
  const g2 = mk(4, 2); const S2 = g2.state(); S2.d.drums[0].st = 1; S2.d.drums[0].x = 2500; put(g2.hero(), 2700); run(g2, 2, {}); ok(S2.d.drums[0].st >= 2 && !S2.dead, 'не упал');
});
test('гибель и рестарт: «завод остановился» → через 1.2 с у фонарика, куклы и механизмы — как на отметке', () => {
  const g = mk(0, 1); const S = g.state(), p = g.body('p1'); put(g.hero(), 1170); tap(g, 'act'); run(g, 1, { x: 1 }); const moved = p.x;
  put(g.hero(), 660); run(g, 0.6, {}); ok(S.dead && S.dead.cause === 'fall', 'не упал'); eq(S.deaths, 1);
  run(g, 1.3, {}); ok(!S.dead && g.has('respawn'), 'нет возврата'); const p2 = g.body('p1'); ok(!p2.att && Math.abs(p2.x + p2.w / 2 - 1180) < 0.01 && moved > 1180, 'кукла не откатилась');
  eq(S.d.ctl, 'hero'); ok(Math.abs(g.hero().x + 9 - LV[0].cps[1].x) < 0.01, 'не у фонарика');
  const g2 = mk(0, 1); const p3 = g2.body('p1'); p3.att = true; put(g2.hero(), 600); put(p3, 660); g2.setCtl('p1'); run(g2, 0.8, {}); ok(g2.state().dead && g2.state().dead.cause === 'doll', 'кукла в яме не остановила');
});
test('сохранение: фонарик пишет снимок; новая игра из снимка — та же зона, отметка, куклы и сигналы', () => {
  const g = mk(1, 0); const S = g.state(); const d = g.body('d1'); put(g.hero(), 290); tap(g, 'act'); put(d, 760); tap(g, 'act'); g.setCtl('hero'); run(g, 1, {});
  put(g.hero(), 870); run(g, 0.2, {}); eq(S.cp, 1); ok(g.has('checkpoint'));
  const sv = JSON.parse(JSON.stringify(g.saveData())); const g2 = K.Game({ save: sv }).start(); const S2 = g2.state();
  eq([S2.z, S2.cp], [1, 1]); ok(g2.body('d1').att && S2.d.levers[0].on && g2.sig('v'), 'состояние не восстановлено');
  const html = fs.readFileSync(path.join(ROOT, 'js/main.js'), 'utf8'); ok(/SAVE = 'kamerton\.save'/.test(html) && /writeSave\(sv\)/.test(html), 'ключ сохранения');
});

// ---------- проходимость: скриптовое решение каждой зоны (реакция 150–250 мс) ----------
test('каждая головоломка решаема скриптом: все 6 зон проходятся с начала зоны (сиды 1 и 2)', () => {
  for (let z = 0; z < LV.length; z++) for (const seed of [1, 2]) {
    const r = playBot(K, seed, { zone: z, maxT: 900, until: s => s.z !== z });
    ok(r.won || r.z === z + 1, `зона ${z + 1}, сид ${seed}: ${JSON.stringify({ z: r.z, cp: r.cp, x: r.x, step: r.step, causes: r.causes })}`);
  }
});

// ---------- i18n, музыка, страница ----------
test('языки: ru/en/tr/es/pt — одинаковые ключи, непустые; название RU КАМЕРТОН, прочие BRASSHUSH', () => {
  const ks = Object.keys(K.STR.en).sort().join(','); eq(Object.keys(K.STR).join(','), 'ru,en,tr,es,pt');
  for (const l of ['ru', 'tr', 'es', 'pt']) eq(Object.keys(K.STR[l]).sort().join(','), ks, l);
  for (const l in K.STR) for (const k in K.STR[l]) ok(String(K.STR[l][k]).trim(), l + ' пусто: ' + k);
  ['play', 'cont', 'restart', 'language', 'theme', 'sound', 'pause', 'resume', 'menu', 'win', 'best', 'score', 'title', 'subtitle', 'tapstart'].forEach(k => ok(K.STR.ru[k], 'ключ ' + k));
  eq(K.STR.ru.title, 'КАМЕРТОН'); for (const l of ['en', 'tr', 'es', 'pt']) eq(K.STR[l].title, 'BRASSHUSH', l);
});
function musicEnv(){
  const listeners = {}, timers = [];
  function param(v){ return { value: v, setValueAtTime(){}, linearRampToValueAtTime(){}, exponentialRampToValueAtTime(x){ if (!(x > 0)) throw new Error('exp ≤0'); }, setTargetAtTime(){} }; }
  function node(){ return { connect(){}, disconnect(){}, start(){}, stop(){}, frequency: param(440), detune: param(0), gain: param(1), Q: param(1), type: '' }; }
  class AC { constructor(){ this.currentTime = 0; this.state = 'running'; this.sampleRate = 8000; this.destination = {}; } createOscillator(){ return node(); } createGain(){ return node(); } createBiquadFilter(){ return node(); } createBufferSource(){ return node(); } createBuffer(c, len){ return { getChannelData: () => new Float32Array(len) }; } resume(){} suspend(){} }
  const win = { console, Math, Object, Array, JSON, Error, Float32Array, parseInt,
    localStorage: { _d: {}, getItem(k){ return this._d[k] ?? null; }, setItem(k, v){ this._d[k] = String(v); } },
    addEventListener(ev, fn){ (listeners[ev] = listeners[ev] || []).push(fn); }, setInterval(fn){ timers.push(fn); return timers.length; }, clearInterval(id){ timers[id - 1] = null; },
    setTimeout(){ return 0; }, requestAnimationFrame(){ return 0; }, cancelAnimationFrame(){}, performance: { now: () => 0 }, AudioContext: AC };
  const canvas = { width: 100, height: 100, style: {}, addEventListener(){}, getContext: () => ({ imageSmoothingEnabled: true }) };
  win.document = { querySelector: () => canvas, addEventListener(){}, hidden: false }; win.window = win; win.globalThis = win;
  vm.createContext(win);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'engine.js'), 'utf8'), win);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/music.js'), 'utf8'), win);
  return { win, fire: ev => (listeners[ev] || []).forEach(f => f({ code: 'Enter', preventDefault(){} })), tick: (ac, dt) => { ac.currentTime += dt; timers.forEach(t => t && t()); } };
}
test('музыка: процедурная «шкатулка» — 7 тем (6 зон + финал), 8–16 тактов, ноты в диапазоне, >30 нот в окне 10 с, без ошибок', () => {
  const env = musicEnv(), A = env.win.Arcade;
  ok(A.tracks.kamerton && A.kamerTracks.length === 7 && A.tracks.kamerton === A.kamerTracks[0], 'треки');
  A.kamerTracks.forEach((tr, i) => { const c = A.parseTrack(tr), perBar = c.div * 4, bars = c.melody.length / perBar;
    ok(bars >= 8 && bars <= 16 && Number.isInteger(bars), 'тема ' + (i + 1) + ': тактов ' + bars);
    ok(c.melody.length % c.bass.length === 0 && c.melody.length % c.drums.length === 0, 'тема ' + (i + 1) + ': голоса не кратны');
    [c.melody, c.bass].forEach(v => v.forEach(n => { if (n) ok(n.f > 40 && n.f < 2200, 'нота ' + n.f); })); });
  ok(JSON.stringify(A.kamerTracks[0]) !== JSON.stringify(A.kamerTracks[1]), 'темы одинаковые');
  const g = A.createGame({ canvas: '#c', gameId: 'kamerton' }); g.useStandardScreens(); g.scene('play', {}); g.goto('play'); env.fire('keydown');
  const ac = g.audio.ac; for (let i = 0; i < 200; i++) env.tick(ac, 0.05);
  ok(g.audio.music.stats.scheduled > 30 && g.audio.music.stats.errors === 0, JSON.stringify(g.audio.music.stats));
  A.kamerTracks.forEach(tr => { g.audio.setMusic(tr); for (let i = 0; i < 40; i++) env.tick(ac, 0.05); }); ok(g.audio.music.stats.errors === 0, 'смена темы');
});
test('звук среды: события логики имеют SFX-ветку и не падают без AudioContext', () => {
  const src = fs.readFileSync(path.join(ROOT, 'js/audio.js'), 'utf8');
  ['step', 'jump', 'land', 'attune', 'switch', 'unlink', 'lever', 'grab', 'door', 'slam', 'rumble', 'death', 'checkpoint', 'zoneEnd', 'win'].forEach(t => ok(src.includes("case '" + t + "'"), 'нет звука ' + t));
  const fake = { audio: { enabled: false } }; ['step', 'attune', 'death'].forEach(t => K.sfx(fake, t, {}));
});
test('страница: фавикон, «← Каталог» с data-catalog-back и data-en, canvas 960×540, порядок скриптов, тач ◀▲▼▶/прыжок/действие/переключение/пауза; engine.js = _shared', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  ok(/<link rel="icon"[^>]+data:image\/svg\+xml/.test(html), 'фавикон');
  ok(/class="back"[^>]*href="\.\.\/"[^>]*data-catalog-back="1"[^>]*data-en="← Catalog"/.test(html), 'ссылка в каталог');
  ok(/<canvas id="c" width="960" height="540"/.test(html), 'canvas');
  eq([...html.matchAll(/<script src="\.\/([^"]+)"/g)].map(m => m[1]), ['engine.js', 'js/music.js', 'js/i18n.js', 'js/levels.js', 'js/game.js', 'js/audio.js', 'js/render.js', 'js/main.js']);
  ['data-d="L"', 'data-d="R"', 'data-d="U"', 'data-d="D"', 'id="bJump"', 'id="bAct"', 'id="bSw"', 'id="bPause"'].forEach(s => ok(html.includes(s), 'кнопка ' + s));
  ok(fs.readFileSync(path.join(ROOT, 'engine.js'), 'utf8') === fs.readFileSync(path.join(ROOT, '..', '_shared', 'engine.js'), 'utf8'), 'engine.js не копия _shared');
  ok(!/(src|href)="https?:\/\/(?!arcade\.hefest\.ru)/.test(html), 'внешние ссылки');
  const css = fs.readFileSync(path.join(ROOT, 'css/style.css'), 'utf8'); ok(/a\.back\s*\{[^}]*position:\s*fixed/.test(css) && /z-index:\s*20/.test(css), 'ссылка видна поверх');
});
test('правило имён: в папке игры нет чужих названий игр/студий/персонажей (регистронезависимо, с транслитом)', () => {
  // стоп-лист хранится в base64, чтобы сами названия не попадали в текст репозитория (общий список + ориентиры жанра этой игры и их студии)
  const BASE = 'dGFpdG980YLQsNC50YLQvnxwYWMtP21hbnzQv9Cw0LrQvNCw0L18dGV0cmlzfNGC0LXRgtGA0LjRgXxcYmNvbnRyYVxifNC60L7QvdGC0YDQsCg/IVvQsC3Rj9GRXSl8a29uYW1pfNC60L7QvdCw0LzQuHxuYW1jb3zQvdCw0LzQutC+fGNhcGNvbXzQutCw0L/QutC+0Lx8bmludGVuZG980L3QuNC90YLQtdC90LTQvnxzZWdhXGJ80YHQtdCz0LAoPyFb0LAt0Y/RkV0pfHRlY21vfGRpenp5fGRlZXBzZWVrfHhvbml4fNC60YHQvtC90LjQutGBfGJhdHRsZSA/Y2l0eXxsb2RlID9ydW5uZXJ8Ym91bGRlciA/ZGFzaHxyaXZlciA/cmFpZHxleG9sb2580Y3QutGB0L7Qu9C+0L18dml0b3JjfNCy0LjRgtC+0YDQunxsb3N0ID92aWtpbmdzfGRvdWJsZSA/ZHJhZ29ufGJhdHRsZXRvYWRzfHNpbGt3b3JtfFxiZGlnZ2VyXGJ80LTQuNCz0LPQtdGAfGNoaXAgPyc/bic/ID9kYWxlfGRhcmt3aW5nfGdhbGFnfNCz0LDQu9Cw0LN8Z2FsYXhpYW58eWVzb2R80LnQtdGB0L7QtHx1bmRlcnd1cmxkZXxzYWJyZSA/d3VsZnxzYWJyZW1hbnxrbmlnaHQgP2xvcmV8bWFuaWMgP21pbmVyfGpldCA/c2V0ID93aWxseXxtaW5lciA/d2lsbHl8bW9udHkgP21vbGV80LzQvtC90YLQuCg/IVvQsC3Rj9GRXSl8c3RhcnF1YWtlfNGB0YLQsNGA0LrQstC10LnQunxtZXRyb2lkfNC80LXRgtGA0L7QuNC0fHNhbXVzfNGB0LDQvNGD0YF8c3BlbHVua3zRgdC/0LXQu9GD0L3QunxjYXN0bGV2YW5pYXxjeWJlcm5vaWR8amV0cGFjfGF0aWMgP2F0YWN8cGl0ZmFsbHxtb250ZXp1bWF80LzQvtC90YLQtdGB0YPQvHxpbXBvc3NpYmxlID9taXNzaW9ufGZvdGhlcmluZ2hhbXxyb2NrZm9yZHxkeW5hbWl0ZSA/ZGFufFxiZXhpbGVcYnxjaXRhZGVsfFxiYmxvYlxifGFsaWVuID9icmVlZHx0ZWFtID8tPzE3fFxiYWxpZW5zXGJ8eGVub21vcnBofGZhY2VodWdnZXJ8W9GN0LBd0Ltb0LjRjF3QtdC9ID/QsdGAW9C40Ytd0LR80YLQuNC8ID8tPzE3fFvRjdCwXdC7W9C40Yxd0LXQvdGBfNC60YHQtdC90L7QvNC+0YDRhHzRhNC1W9C50Lhd0YHRhdCw0LPQs9C10YB80LvQuNGG0LXRhdCy0LDRgg==';
  const GENRE = 'XGJpbnNpZGVcYnzQuNC90YHQsNC50LR8bGltYm980LvQuNC80LHQvnxwbGF5ID9kZWFkfNC/0Ltb0Y3QtV3QudC00LXQtHxsaXR0bGUgP25pZ2h0bWFyZXN8dGFyc2llcnxvZGR3b3JsZHxhYmUuP3MgP29kZD95c2VlfG1hY2hpbmFyaXVtfGFtYW5pdGF8c29tZXJ2aWxsZXxqdW1wc2hpcHxwbGFuZXQgP29mID9sYW5hfHVucmF2ZWx8dHlwb21hbnxcYmNvZ3NcYnxb0LXRkV3QtiA/0LIgP9GC0YPQvNCw0L3QtQ==';
  const u = b => Buffer.from(b, 'base64').toString('utf8');
  const BAD = new RegExp(u(BASE) + '|' + u(GENRE), 'i');
  const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
  const files = walk(ROOT).filter(f => !f.endsWith('engine.js') && /\.(js|mjs|html|css|md|json)$/.test(f));
  ok(files.length >= 10, 'файлов: ' + files.length);
  for (const f of files){ const m = fs.readFileSync(f, 'utf8').match(BAD); ok(!m, path.relative(ROOT, f) + ': «' + (m && m[0]) + '»'); }
  for (const f of walk(ROOT)) ok(!BAD.test(path.relative(ROOT, f)), 'имя файла: ' + f);
  // ловит ориентиры жанра и их студию (в base64), не ловит наши имена и обычные слова
  ['SU5TSURF', '0JjQvdGB0LDQudC0', 'TElNQk8=', 'UGxheWRlYWQ=', 'TGl0dGxlIE5pZ2h0bWFyZXM=', 'T2Rkd29ybGQ=', 'TWFjaGluYXJpdW0=', 'U29tZXJ2aWxsZQ=='].forEach(b => ok(BAD.test(u(b)), 'стоп-лист не ловит ориентир ' + u(b).length));
  ok(!BAD.test('КАМЕРТОН') && !BAD.test('BRASSHUSH') && !BAD.test('Гефест') && !BAD.test('insider') && !BAD.test('besides') && !BAD.test('outside'), 'без ложных срабатываний');
});

if (process.env.QUICK){ console.log(`\n${passed} прошло, ${failed} упало (без бота)`); process.exit(failed ? 1 : 0); }
const RUNS = [1, 2, 3, 4, 5, 6].map(sd => playBot(K, sd, { maxT: 3600 }));
test('бот (реакция 150–250 мс, только клавиши ◀▶▲▼, прыжок, действие, переключение) проходит все 6 зон в 6 партиях, без зависаний', () => {
  RUNS.forEach((r, i) => ok(r.won && !r.stuck, 'сид ' + (i + 1) + ': ' + JSON.stringify({ z: r.z, cp: r.cp, x: r.x, step: r.step })));
  RUNS.forEach(r => eq(r.zones, 5, 'переходов'));
});
test('смерть как подсказка: бот гибнет редко (≤ 15 остановок за партию), прохождение со знанием решений — 5–12 мин', () => {
  const mins = RUNS.map(r => +(r.time / 60).toFixed(1));
  console.log('     минуты (бот знает решения): ' + mins.join(', ') + '; остановок: ' + RUNS.map(r => r.deaths).join(',') + '; причины: ' + JSON.stringify(RUNS.map(r => r.causes)));
  ok(mins.every(m => m >= 5 && m <= 12), 'вне 5–12 мин'); ok(RUNS.every(r => r.deaths <= 15), 'много остановок');
});

console.log(`\n${passed} прошло, ${failed} упало`);
process.exit(failed ? 1 : 0);
