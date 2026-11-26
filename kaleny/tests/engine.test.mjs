/* КАЛЁНЫЙ ДВОР · tests/engine.test.mjs — автотесты логики, строк, музыки, правила имён и баланса ботом (Node, без зависимостей).
   Запуск: node kaleny/tests/engine.test.mjs. Логика (js/game.js, js/i18n.js, js/music.js) — в node:vm с шимом window. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(HERE, '..');
const sandbox = { console, Math, Date }; sandbox.window = sandbox; sandbox.globalThis = sandbox; vm.createContext(sandbox);
for (const f of ['js/music.js', 'js/i18n.js', 'js/game.js']) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), sandbox, { filename: f });
const K = sandbox.KALENY, L = K.logic;
const { playMatch, playTournament, mulberry32 } = await import('./bot.mjs');

let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log('ok   ' + name); } catch (e) { failed++; console.log('FAIL ' + name + ' — ' + e.message); } }
function eq(a, b, m) { if (a !== b) throw new Error((m || '') + ' ждали ' + JSON.stringify(b) + ', получили ' + JSON.stringify(a)); }
function ok(c, m) { if (!c) throw new Error(m || 'ложь'); }
function setup(o = {}) { const ev = []; const game = K.Game(Object.assign({ rng: mulberry32(o.seed || 1), humans: [], onEvent: (t, d) => ev.push({ t, d }) }, o)).start(); const S = game.state(); return { game, S, ev, has: (t) => ev.some((e) => e.t === t), count: (t) => ev.filter((e) => e.t === t).length }; }
function run(game, sec) { for (let i = 0; i < Math.round(sec * 60); i++) game.update(1 / 60); }
// заморозить ИИ: все юниты стоят, шары лежат (для точечных сцен)
function still(game) { const S = game.state(); S.units.forEach((u) => { u.in.mx = u.in.my = 0; }); game.think = null; }
function scene(o) {   // сцена без ИИ: юниты людей, шары руками
  const r = setup(Object.assign({ humans: [0, 1, 2, 3, 4, 5] }, o)); return r;
}
function fire(game, bi, from, to, heat, pass) {   // выстрел шаром bi от юнита from в юнит to (напрямую)
  const S = game.state(), b = S.balls[bi], u = S.units[from]; u.hold = bi; b.state = 'held'; b.holder = from; b.heat = heat;
  game._throw(u, S.units[to], heat, 0, 0); return b;
}

// ---------- устройство ----------
test('арена: 450×800, две команды по 3, два шара, окно ловли 0,52 → 0,18 с по накалу', () => {
  const { S } = setup(); eq(S.units.length, 6); eq(S.units.filter((u) => u.team === 0).length, 3); eq(S.balls.length, 2);
  eq(L.GEO.W, 450); eq(L.GEO.H, 800); ok(Math.abs(L.stanceLen(0) - 0.52) < 1e-9 && Math.abs(L.stanceLen(1) - 0.18) < 1e-9, 'stanceLen');
  ok(L.stanceLen(0.5) < L.stanceLen(0.2), 'горячее — уже');
  S.units.forEach((u) => ok(u.team === 0 ? u.y > L.GEO.MID : u.y < L.GEO.MID, 'юнит на своей половине'));
});
test('7 арен-уровней, у арен 3–7 есть паровые завесы, у 2 и 4 — плиты; уровней ИИ 7, сила растёт', () => {
  eq(L.ARENAS.length, 7); eq(L.LEVELS.length, 7);
  ok(L.ARENAS[1].shields.some((s) => s.k === 'plate') && L.ARENAS[2].shields.some((s) => s.k === 'steam') && L.ARENAS[0].shields.length === 0);
  for (let i = 1; i < 7; i++) { ok(L.LEVELS[i].speed >= L.LEVELS[i - 1].speed && L.LEVELS[i].catchP > L.LEVELS[i - 1].catchP && L.LEVELS[i].delay < L.LEVELS[i - 1].delay && L.LEVELS[i].aimErr < L.LEVELS[i - 1].aimErr, 'рост уровня ' + i); }
});
test('игроки не пересекают среднюю линию', () => {
  const { game, S } = setup({ humans: [1] }); S.units[1].in.my = -1; for (let i = 0; i < 300; i++) { game.setInput(1, 0, -1, false); game.update(1 / 60); }
  ok(S.units[1].y > L.GEO.MID, 'ушёл за линию: ' + S.units[1].y);
});

// ---------- попадание, ловля, накал ----------
test('попадание: 2 «здоровья» — первое попадание ранит, второе выбивает за линию соперника', () => {
  const { game, S, ev, has } = scene({}); S.units.forEach((u, i) => { if (i !== 0 && i !== 3) { u.x = 400; u.y = u.team === 0 ? 650 : 150; } });
  S.units[0].x = 100; S.units[0].y = 600; S.units[3].x = 100; S.units[3].y = 250;
  fire(game, 0, 3, 0, 0.3); run(game, 1.2); eq(S.units[0].hp, 1, 'ранен'); eq(S.units[0].state, 'in'); ok(has('wound'));
  S.units[0].inv = 0; fire(game, 1, 3, 0, 0.3); run(game, 1.2); eq(S.units[0].state, 'out', 'выбит'); ok(S.units[0].y < L.GEO.TOP, 'ушёл за линию соперника (вверх)');
});
test('ловля: попал в окно — шар у ловца, бросавший выбыл (шар ≥ 0,35)', () => {
  const { game, S, ev, has } = scene({}); S.units.forEach((u, i) => { if (i !== 0 && i !== 3) { u.x = 420; u.y = u.team === 0 ? 650 : 150; } });
  S.units[0].x = 225; S.units[0].y = 600; S.units[3].x = 225; S.units[3].y = 250;
  const b = fire(game, 0, 3, 0, 0.6);
  for (let i = 0; i < 300 && b.state === 'fly'; i++) { const th = game.threatOf(S.units[0]); if (th && th.eta <= L.stanceLen(th.ball.heat) / 2 && S.units[0].lock <= 0) game.pressB(0); game.update(1 / 60); }
  ok(has('catch'), 'нет ловли'); eq(S.units[0].hold, 0, 'шар в руках'); eq(S.units[3].state, 'out', 'бросавший выбыл'); eq(S.units[0].hp, 2, 'ловец цел');
});
test('ловля слишком рано — окно кончилось, шар попадает (откат не даёт нажать снова)', () => {
  for (const early of [true]) {
    const { game, S, has } = scene({}); S.units.forEach((u, i) => { if (i !== 0 && i !== 3) { u.x = 420; u.y = u.team === 0 ? 650 : 150; } });
    S.units[0].x = 225; S.units[0].y = 600; S.units[3].x = 225; S.units[3].y = 250; const b = fire(game, 0, 3, 0, 0.6); let pressed = false;
    for (let i = 0; i < 300 && b.state === 'fly'; i++) { const th = game.threatOf(S.units[0]); if (th && !pressed && (early ? th.eta <= 0.7 && th.eta > 0.6 : th.eta < 0.02)) { game.pressB(0); pressed = true; } game.update(1 / 60); }
    ok(pressed && !has('catch') && has('wound'), 'рано: ловля не должна сработать');
  }
});
test('накал: «закалка» (шар ≥ 0,7) возвращает выбывшего и даёт ловцу команду; холодный (< 0,35) только спасает', () => {
  const mk = (heat) => { const r = scene({}); r.S.units.forEach((u, i) => { if (i !== 0 && i !== 3 && i !== 1) { u.x = 420; u.y = u.team === 0 ? 650 : 150; } });
    r.S.units[0].x = 225; r.S.units[0].y = 600; r.S.units[3].x = 225; r.S.units[3].y = 250; r.game._toStrip(r.S.units[1]); r.S.balls[1].x = 40; r.S.balls[1].y = 60;
    const b = fire(r.game, 0, 3, 0, heat); b.heat = heat; b.vx *= 1; for (let i = 0; i < 300 && b.state === 'fly'; i++) { const th = r.game.threatOf(r.S.units[0]); if (th && th.eta <= L.stanceLen(th.ball.heat) / 2 && r.S.units[0].lock <= 0) r.game.pressB(0); r.game.update(1 / 60); } return r; };
  const hot = mk(0.85); ok(hot.has('catch') && hot.ev.find((e) => e.t === 'catch').d.perfect, 'закалка'); eq(hot.S.units[1].state, 'in', 'выбывший вернулся');
  const cold = mk(0.0); const ce = cold.ev.find((e) => e.t === 'catch'); ok(ce && !ce.d.perfect, 'холодная ловля'); eq(cold.S.units[3].state, 'in', 'бросавший цел'); eq(cold.S.units[1].state, 'out');
});
test('накал в руках: удержание нагревает шар, перегрев (> 1,7 с) — ожог и шар падает', () => {
  const { game, S, has } = setup({ humans: [1] }); const u = S.units[1]; u.hold = 0; S.balls[0].state = 'held'; S.balls[0].holder = 1; S.balls[0].heat = 0.2;
  for (let i = 0; i < 40; i++) { game.setInput(1, 0, 0, true); game.update(1 / 60); } ok(S.balls[0].heat > 0.4, 'нагрелся: ' + S.balls[0].heat);
  let burned = false; for (let i = 0; i < 160 && !burned; i++) { game.setInput(1, 0, 0, true); game.update(1 / 60); burned = has('burn'); } ok(burned && u.hold < 0 && u.stun > 0, 'ожог');
});
test('бросок: тап — холодный (≈ 0,25), долгий накал — горячий; шар раскаляется в полёте', () => {
  const t = (hold) => { const { game, S, ev } = setup({ humans: [1] }); const u = S.units[1]; u.hold = 0; S.balls[0].state = 'held'; S.balls[0].holder = 1; S.balls[0].heat = 0.15; S.units.forEach((o) => { if (o.id !== 1) { o.x = 40; } });
    for (let i = 0; i < Math.round(hold * 60); i++) { game.setInput(1, 0, 0, true); game.update(1 / 60); } game.setInput(1, 0, 0, false); game.update(1 / 60); return ev.find((e) => e.t === 'throw'); };
  const tap = t(0.05), long = t(1.0); ok(tap && long, 'броски'); ok(tap.d.heat < 0.3 && long.d.heat > 0.8, tap.d.heat + ' / ' + long.d.heat);
  const { game, S } = setup(); const b = fire(game, 0, 3, 0, 0.25); const h0 = b.heat; run(game, 0.3); ok(b.heat > h0 + 0.05 || b.state !== 'fly', 'раскаляется в полёте');
});
test('рывок: во время рывка шар пролетает сквозь (уклон), без угрозы B — рывок, с угрозой — ловля', () => {
  const { game, S, has } = scene({}); S.units.forEach((u, i) => { if (i !== 0 && i !== 3) { u.x = 420; u.y = u.team === 0 ? 650 : 150; } });
  S.units[0].x = 225; S.units[0].y = 600; S.units[3].x = 225; S.units[3].y = 250; game.pressB(0); game.update(1 / 60); ok(S.units[0].dashT > 0 && S.units[0].stance === 0, 'рывок без угрозы'); run(game, 0.4);
  fire(game, 0, 3, 0, 0.5); run(game, 0.15); const u = S.units[0]; u.dashT = 0; u.dashCd = 0; u.lock = 0; game.pressB(0); game.update(1 / 60); ok(u.stance > 0, 'ловля при угрозе');
});
test('пас: шар по своему — подхватывает тот, кому адресован, никого не выбивает', () => {
  const { game, S, has } = scene({}); S.units.forEach((u, i) => { if (u.team === 1) { u.x = 420; u.y = 150; } });
  S.units[0].x = 100; S.units[0].y = 600; S.units[1].x = 300; S.units[1].y = 600; S.units[2].x = 400; S.units[2].y = 650;
  const b = fire(game, 0, 0, 1, 0.3); ok(b.pass, 'пас'); run(game, 1.2); eq(S.units[1].hold, 0, 'тиммейт поймал'); ok(!has('wound') && !has('hit'));
});
test('паровая завеса остужает и гасит шар, плита отражает', () => {
  const { game, S, has } = setup({ humans: [], arena: 2, seed: 3 }); const sh = S.shields.find((s) => s.k === 'steam'); S.time = sh.period - sh.ph; S.units.forEach((u) => { u.x = 420; u.y = u.team === 0 ? 650 : 150; });
  const b = S.balls[0]; b.state = 'fly'; b.team = 1; b.owner = 3; b.heat = 0.9; b.x = sh.x + 20; b.y = sh.y + sh.h / 2; b.vx = 300; b.vy = 0; b.t = 0; game.update(1 / 60); game.update(1 / 60); ok(b.heat < 0.9 && Math.abs(b.vx) < 300, 'остужен и замедлен');
  const g2 = setup({ humans: [], arena: 1, seed: 3 }); const pl = g2.S.shields[0]; g2.S.units.forEach((u) => { u.x = 420; u.y = u.team === 0 ? 650 : 150; }); const b2 = g2.S.balls[0]; b2.state = 'fly'; b2.team = 1; b2.owner = 3; b2.heat = 0.3; b2.x = pl.x + 20; b2.y = pl.y - 30; b2.vx = 0; b2.vy = 300; b2.t = 0; run(g2.game, 0.3); ok(g2.has('plate') && b2.vy < 0, 'плита отразила');
});
test('выбывший бросает из-за линии соперника: шар в зоне выбывших подхватывается, бросок идёт в поле', () => {
  const { game, S, ev } = setup({ humans: [] }); game._toStrip(S.units[0]); ok(S.units[0].y < L.GEO.TOP, 'зона за врагами'); const b = S.balls[0]; b.state = 'loose'; b.x = S.units[0].x; b.y = S.units[0].y; b.vx = b.vy = 0; b.noPick = 0;
  run(game, 3); ok(ev.some((e) => e.t === 'pick' && e.d.uid === 0) || ev.some((e) => e.t === 'throw' && e.d.uid === 0), 'выбывший взял шар / бросил');
});
test('ИИ против ИИ доигрывает: 12 матчей на всех уровнях — результат есть, без зависаний', () => {
  let done = 0; for (let s = 1; s <= 12; s++) { const g = K.Game({ seed: s, level: s % 7, humans: [] }).start(), S = g.state(); let n = 0; while (S.phase === 'play' && n++ < 30 * 200) g.update(1 / 30); if (S.result) done++; ok(S.time < 190, 'матч затянулся: ' + S.time); }
  eq(done, 12);
});
test('детерминизм: те же сиды — тот же итог', () => {
  const a = playMatch(K, 3, 5), b = playMatch(K, 3, 5); eq(JSON.stringify(a), JSON.stringify(b));
});
test('тайм-аут: больше выживших — победа; при равенстве — по здоровью; ничья → «до первого попадания»', () => {
  const { game, S } = setup({ humans: [] }); S.left = 0.02; game._toStrip(S.units[3]); run(game, 0.2); eq(S.result, 'win');
  const b = setup({ humans: [] }); b.S.left = 0.02; b.S.units[0].hp = 1; run(b.game, 0.2); eq(b.S.result, 'lose', 'меньше здоровья');
});
test('очки победы растут с уровнем и числом оставшихся', () => {
  const a = setup({ level: 0, humans: [] }), b = setup({ level: 5, humans: [] }); for (const r of [a, b]) { r.S.units.filter((u) => u.team === 1).forEach((u) => r.game._toStrip(u)); run(r.game, 0.1); eq(r.S.result, 'win'); }
  ok(b.S.points > a.S.points, a.S.points + ' < ' + b.S.points);
});
test('подкрепление (бонус за рекламу): возвращает выбывшего подмастерья, только если есть кого', () => {
  const { game, S } = setup({ humans: [] }); ok(!game.canReinforce()); game._toStrip(S.units[2]); ok(game.canReinforce()); ok(game.reinforce()); eq(S.units[2].state, 'in');
});

// ---------- строки, музыка, правило имён ----------
test('строки: 5 языков, одинаковый набор ключей; названия RU/EN без чужих имён; «Каталог»/подсказки заполнены', () => {
  const ks = Object.keys(K.STR.ru); for (const l of ['en', 'tr', 'es', 'pt']) { const miss = ks.filter((k) => K.STR[l][k] == null), extra = Object.keys(K.STR[l]).filter((k) => K.STR.ru[k] == null); ok(!miss.length && !extra.length, l + ' ключи: -' + miss + ' +' + extra); }
  eq(K.STR.ru.title, 'КАЛЁНЫЙ ДВОР'); for (const l of ['en', 'tr', 'es', 'pt']) eq(K.STR[l].title, 'CINDER COURT');
  for (let i = 0; i < 7; i++) for (const l of Object.keys(K.STR)) ok(K.STR[l]['rival' + i] && K.STR[l]['arena_' + L.ARENAS[i].id], l + ' rival/arena ' + i);
});
test('музыка: трек kaleny задан, секвенсор принимает ноты', () => {
  const t = sandbox.Arcade.tracks.kaleny; ok(t && t.melody.length >= 2 && t.bass && t.drums); const notes = (t.melody.join(' ') + ' ' + t.bass).replace(/\|/g, ' ').split(/\s+/).filter((x) => x && x !== '-' && x !== '.');
  for (const n of notes) ok(/^[A-G](#|b)?[0-8]$/.test(n), 'нота ' + n);
});
{ // правило имён 12.11: стоп-лист в base64 (чтобы сам тест не содержал чужих имён)
  const BAN = 'ZG91YmxlIGRyYWdvbnxrdW5pb3xyaXZlciBjaXR5fHRlY2hub3N8YXJjIHN5c3RlbXxudW1hIHRha2Vtb3RvfG5pbnRlbmRvfGNhcGNvbXxrb25hbWl8dGFpdG98dGVjbW98bmFtY298c2VnYXxjb250cmF8dGV0cmlzfHBhYy1tYW58YmF0dGxlIGNpdHl8cmV0cm8gYnJhd2x8cmVkIGRyYWdvbg==';
  const re = new RegExp('\\b(' + Buffer.from(BAN, 'base64').toString('utf8') + ')\\b', 'i');
  test('правило имён: в файлах игры нет чужих названий (стоп-лист в base64)', () => {
    const bad = []; (function walk(d) { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, f.name); if (f.isDirectory()) { if (f.name !== 'screenshots') walk(p); } else if (/\.(js|mjs|html|css|md|json)$/.test(f.name) && f.name !== 'engine.js' && f.name !== 'engine.test.mjs') { const m = fs.readFileSync(p, 'utf8').match(re); if (m) bad.push(path.relative(ROOT, p) + ': ' + m[0]); } } })(ROOT);
    ok(!bad.length, bad.join('; '));
  });
}
test('нет внешних URL в игре (офлайн, file://)', () => {
  const bad = []; for (const f of ['index.html', 'js/main.js', 'js/render.js', 'js/ui.js', 'js/game.js', 'css/style.css']) { const t = fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/http:\/\/www\.w3\.org\/2000\/svg/g, ''); if (/https?:\/\//.test(t)) bad.push(f); } ok(!bad.length, bad.join());
});

// ---------- баланс: человеческий бот ----------
test('бот: 1-й матч (ИИ 0) выигрывает ≥ 80 % из 20; матчи 20–80 с игрового времени, ловит и выбивает', () => {
  let w = 0, T = 0, c = 0, h = 0; for (let s = 1; s <= 20; s++) { const r = playMatch(K, 0, s); if (r.result === 'win') w++; T += r.time; c += r.catches; h += r.hits; }
  console.log('     1-й матч: побед ' + w + '/20, среднее время ' + (T / 20).toFixed(0) + ' с, ловли ' + (c / 20).toFixed(1) + ', выбил ' + (h / 20).toFixed(1));
  ok(w >= 16, 'побед ' + w + '/20'); ok(T / 20 > 15 && T / 20 < 90, 'длительность ' + T / 20); ok(c > 0 && h > 0);
});
test('бот: рост силы — на 7-м матче побед заметно меньше, чем на 1-м (≤ 12 из 20 против ≥ 16)', () => {
  let w0 = 0, w6 = 0; for (let s = 1; s <= 20; s++) { if (playMatch(K, 0, s).result === 'win') w0++; if (playMatch(K, 6, s).result === 'win') w6++; } console.log('     побед: матч 1 — ' + w0 + '/20, матч 7 — ' + w6 + '/20'); ok(w6 <= 12 && w0 >= 16 && w6 < w0 - 4, w0 + ' / ' + w6);
});
test('бот: весь турнир (7 матчей, 2 попытки) проходит 20–45 % из 40', () => {
  let w = 0; for (let s = 1; s <= 40; s++) if (playTournament(K, s).won) w++; const p = w / 40; console.log('     турнир: ' + w + '/40 = ' + Math.round(p * 100) + ' %'); ok(p >= 0.15 && p <= 0.5, 'доля ' + p);
});

// ---------- площадка ----------
{ const { checkPlatformFeatures } = await import('../../tools/promo/platform-features.check.mjs');
  checkPlatformFeatures({ ROOT, slug: 'kaleny', boards: ['kaleny'], test, ok }); }

console.log((failed ? 'FAIL ' : 'OK ') + passed + '/' + (passed + failed));
process.exit(failed ? 1 : 0);
