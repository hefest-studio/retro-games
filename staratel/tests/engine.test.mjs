/* СТАРАТЕЛЬ · tests/engine.test.mjs — автотесты логики шахты (js/mine.js), трека музыки и оболочки v2.
   Запуск: node staratel/tests/engine.test.mjs. Логика грузится в node:vm, случайность — детерминированная. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const sandbox = { console, Math, Array, Object };
sandbox.window = sandbox; sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/mine.js'), 'utf8'), sandbox, { filename: 'mine.js' });
const ST = sandbox.STARATEL, T = ST.T;

let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log('ok   ' + name); } catch (e) { failed++; console.log('FAIL ' + name + ' — ' + e.message); } }
function eq(a, b, m) { if (a !== b) throw new Error((m || '') + ' ждали ' + JSON.stringify(b) + ', получили ' + JSON.stringify(a)); }
function ok(c, m) { if (!c) throw new Error(m || 'ложь'); }
function rng(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function mk(seed, ev) { const g = ST.Game({ random: rng(seed || 7), onEvent: (t, d) => ev && ev.push(t) }); g.start(); return g; }
// пустая коробка: стены по краю, внутри пусто, без врагов — для точечных сценариев
function box(g) { const S = g.state; for (let y = 0; y < T.N; y++) for (let x = 0; x < T.N; x++) { S.grid[y][x] = (x === 0 || y === 0 || x === T.N - 1 || y === T.N - 1) ? T.WALL : T.EMPTY; S.fall[y][x] = false; } S.enemies = []; S.player.gx = 5; S.player.gy = 5; return S; }

test('уровень: поле 15×15, стены по краю, старт (1,1) пуст, есть выход, враги и норма', () => {
  for (let seed = 1; seed <= 30; seed++) {
    const g = mk(seed), S = g.state;
    eq(S.grid.length, 15); for (let i = 0; i < 15; i++) { eq(S.grid[0][i], T.WALL); eq(S.grid[14][i], T.WALL); eq(S.grid[i][0], T.WALL); eq(S.grid[i][14], T.WALL); }
    eq(S.grid[1][1], T.EMPTY); eq(S.grid[S.exitPos.gy][S.exitPos.gx], T.EXIT);
    eq(S.enemies.length, 2, 'врагов на ур.1 = min(1+1,5)'); ok(S.need >= 3 && S.need <= 14, 'норма ' + S.need);
    eq(S.lives, 3); eq(S.score, 0); ok(S.running);
  }
});
test('копка: порода → пусто, стена не пускает', () => {
  const g = mk(); const S = box(g); S.grid[5][6] = T.DIRT; S.grid[4][5] = T.WALL;
  g.move(1, 0); eq(S.player.gx, 6); eq(S.grid[5][6], T.EMPTY);
  g.move(-1, 0); g.move(0, -1); eq(S.player.gy, 5, 'прошёл сквозь стену');
});
test('валун толкается только вбок и только в пустоту', () => {
  const ev = []; const g = mk(3, ev); const S = box(g); S.grid[5][6] = T.BOULDER;
  g.move(1, 0); eq(S.grid[5][7], T.BOULDER); eq(S.player.gx, 6); ok(ev.includes('push'));
  S.grid[4][6] = T.BOULDER; g.move(0, -1); eq(S.player.gy, 5, 'вертикально толкать нельзя');
});
test('золото +100, кристалл +150, норма → событие quota', () => {
  const ev = []; const g = mk(4, ev); const S = box(g); S.need = 2; S.got = 0; S.score = 0;
  S.grid[5][6] = T.GOLD; S.grid[5][7] = T.GEM; g.move(1, 0); g.move(1, 0);
  eq(S.score, 250); eq(S.got, 2); ok(ev.includes('quota'));
});
test('выход закрыт до нормы; после — уровень +1 через 260 мс', () => {
  const ev = []; const g = mk(5, ev); const S = box(g); S.grid[5][6] = T.EXIT; S.need = 1; S.got = 0;
  g.move(1, 0); eq(S.player.gx, 5, 'вошёл в закрытый выход'); S.got = 1; g.move(1, 0);
  eq(S.level, 2); ok(!S.running, 'пауза перехода'); g.update(200); ok(!S.running); g.update(80); ok(S.running, 'уровень не начался'); eq(S.enemies.length, 3);
});
test('гравитация: валун падает в пустоту, давит голема (+250)', () => {
  const ev = []; const g = mk(6, ev); const S = box(g); S.player.gx = 2; S.player.gy = 12;
  S.grid[3][8] = T.BOULDER; S.enemies = [{ gx: 8, gy: 6, slow: 0 }];
  g._gravity(); eq(S.grid[4][8], T.BOULDER); ok(S.fall[4][8]);
  g._gravity(); g._gravity(); eq(S.enemies.length, 0, 'голем жив'); eq(S.score, 250); ok(ev.includes('crush'));
});
test('падающий валун бьёт шахтёра; неуязвимость 900 мс', () => {
  const ev = []; const g = mk(8, ev); const S = box(g); S.player.gx = 8; S.player.gy = 6;
  S.grid[4][8] = T.BOULDER; S.fall[4][8] = true; S.grid[5][8] = T.EMPTY;
  g._gravity(); g._gravity(); eq(S.lives, 2); ok(ev.includes('hit')); eq(S.player.gx, 1, 'не вернулся на старт');
  ok(S.inv > 0); const l = S.lives; S.enemies = [{ gx: 2, gy: 1 }]; g.move(1, 0); eq(S.lives, l, 'удар в неуязвимости');
});
test('голем, шагнувший на шахтёра, бьёт; 3 удара → gameover, логика встаёт', () => {
  // (как в оригинале: сам шаг игрока на голема удара не даёт — бьёт ход голема)
  const ev = []; const g = mk(9, ev); let S;
  for (let i = 0; i < 3; i++) {
    S = box(g); S.inv = 0; S.enemies = [{ gx: 6, gy: 5, slow: 0 }];
    S.grid[4][6] = T.WALL; S.grid[6][6] = T.WALL; S.grid[5][7] = T.WALL; // единственный ход — на игрока
    g._enemyStep();
  }
  eq(S.lives, 0); ok(S.over && !S.running); ok(ev.includes('gameover'));
});
test('физика: шаг 165 мс, враги ходят каждый 2-й шаг', () => {
  const g = mk(10); const S = box(g); S.enemies = [{ gx: 10, gy: 10, slow: 0 }]; S.acc = 0; S.phys = 0;
  g.update(164); eq(S.phys, 0); g.update(1); eq(S.phys, 1); eq(S.enemies[0].gx + S.enemies[0].gy, 20, 'враг пошёл на нечётном шаге');
  g.update(165); eq(S.phys, 2); ok(S.enemies[0].gx + S.enemies[0].gy === 19, 'враг не приблизился');
});
test('трек js/music.js: валидная нотация, 8 тактов, голоса кратны', () => {
  const sb = { window: { Arcade: {} } }; vm.createContext(sb);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/music.js'), 'utf8'), sb);
  const t = sb.window.Arcade.tracks.staratel; ok(t && t.bpm > 0, 'нет Arcade.tracks.staratel');
  const toks = (s) => (Array.isArray(s) ? s.join(' ') : s).replace(/\|/g, ' ').trim().split(/\s+/);
  const mel = toks(t.melody), bass = toks(t.bass), dr = toks(t.drums);
  eq(mel.length, 8 * t.div * 4, 'шагов мелодии'); ok(mel.length % bass.length === 0 && mel.length % dr.length === 0, 'не кратны');
  mel.concat(bass).forEach((x) => ok(x === '-' || x === '.' || /^[A-G][#b]?\d$/.test(x), 'плохой токен ' + x));
});
test('оболочка v2: engine.js → music.js первыми, DOM-HUD на месте, legacy.html и classic-loderunner.html целы', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const srcs = [...html.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1]);
  eq(srcs[0], './engine.js'); eq(srcs[1], './js/music.js');
  ['score', 'goal', 'level', 'lives'].forEach((id) => ok(html.includes('id="' + id + '"'), 'нет HUD #' + id));
  ['legacy.html', 'classic-loderunner.html', 'engine.js'].forEach((f) => ok(fs.existsSync(path.join(ROOT, f)), 'нет ' + f));
});
console.log(`\nOK ${passed}/${passed + failed}`);
process.exit(failed ? 1 : 0);
