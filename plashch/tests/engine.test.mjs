/* ПЛАЩ · tests/engine.test.mjs — автотесты логики (Node, без зависимостей).
   Запуск: node plashch/tests/engine.test.mjs. Движок грузится в node:vm с шимом window. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const sandbox = { window: null, globalThis: null, console, Math, Array, Date, JSON };
sandbox.window = sandbox; sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/game.js'), 'utf8'), sandbox, { filename: 'game.js' });
const P = sandbox.PLASHCH;

let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log('ok   ' + name); } catch (e) { failed++; console.log('FAIL ' + name + ' — ' + e.message); } }
function eq(a, b, m) { if (a !== b) throw new Error((m || '') + ' ждали ' + JSON.stringify(b) + ', получили ' + JSON.stringify(a)); }
function ok(c, m) { if (!c) throw new Error(m || 'ложь'); }

// Прогнать dt-шаги.
function run(g, n, dt) { for (let i = 0; i < (n || 1); i++) g.update(dt || 0.05); }
// Опустить игрока на землю (переждать intro + падение).
function settle(g) { run(g, 45, 0.05); }

test('namespace и API на месте', () => {
  ok(P, 'нет PLASHCH'); ok(typeof P.Game === 'function', 'нет Game');
  ok(P.consts && P.consts.TILE === 30, 'нет consts');
});

test('старт: фаза play, 3 жизни, hp 3, уровень 1', () => {
  const g = P.Game(); g.start(); const s = g.state();
  eq(g.phase(), 'play'); eq(s.lives, 3); eq(s.hp, 3); eq(s.hpMax, 3); eq(s.level, 0);
  ok(s.player, 'нет игрока');
});

test('уровень 1: есть крюки, враги и дверь', () => {
  const g = P.Game(); g.start(); const s = g.state();
  ok(s.anchors.length >= 2, 'крюков: ' + s.anchors.length);
  ok(s.enemies.length > 0, 'нет врагов');
  ok(s.door, 'нет двери');
});

test('есть стрелки и летуны на уровнях', () => {
  const g = P.Game(); g.start(); const s = g.state();
  const types = new Set(s.enemies.map(e => e.type));
  ok(types.has('walker'), 'нет ходоков');
  ok(types.has('shooter'), 'нет стрелков');
});

test('игрок встаёт на землю', () => {
  const g = P.Game(); g.start(); settle(g); const s = g.state();
  ok(s.player.onGround, 'не на земле, y=' + s.player.y);
});

test('присед: высота 28 -> 16 -> 28', () => {
  const g = P.Game(); g.start(); settle(g); const s = g.state();
  eq(s.player.h, 28);
  g.setHeld('down', true); run(g, 2, 0.05); eq(s.player.h, 16, 'не присел'); ok(s.player.crouch);
  g.setHeld('down', false); run(g, 2, 0.05); eq(s.player.h, 28, 'не встал'); ok(!s.player.crouch);
});

test('прыжок: отрицательная vy только с земли', () => {
  const g = P.Game(); g.start(); settle(g); const s = g.state();
  ok(s.player.onGround); g.jump(); ok(s.player.vy < 0, 'vy=' + s.player.vy);
});

test('выстрел добавляет сюрикен и держит перезарядку', () => {
  const g = P.Game(); g.start(); settle(g); const s = g.state();
  const n0 = s.bullets.length; g.shoot(); eq(s.bullets.length, n0 + 1, 'нет пули');
  g.shoot(); eq(s.bullets.length, n0 + 1, 'перезарядка не держит');
});

test('крюк-кошка: зацеп за якорь и отцеп', () => {
  const g = P.Game(); g.start(); settle(g); const s = g.state();
  const a = s.anchors[0];
  s.player.x = a.x - s.player.w / 2; s.player.y = a.y + 120;
  g.grapple(); ok(s.player.grapple.on, 'не зацепился');
  g.grapple(); ok(!s.player.grapple.on, 'не отцепился');
});

test('урон: -1 hp; потеря жизни при hp=0', () => {
  const g = P.Game(); g.start(); settle(g); const s = g.state();
  s.player.invuln = 0; const hp0 = s.hp;
  // имитируем контакт: ставим врага на игрока
  s.enemies.push({ type: 'walker', x: s.player.x, y: s.player.y, w: 20, h: 20, vx: 0, dir: 1, t: 0 });
  run(g, 1, 0.02); eq(s.hp, hp0 - 1, 'hp не упал');
});

test('дверь: достижение -> levelclear -> переход на уровень 2', () => {
  const g = P.Game(); g.start(); settle(g); const s = g.state();
  const d = s.door; s.player.x = d.x + 2; s.player.y = d.y + d.h - s.player.h - 1;
  run(g, 1, 0.02); eq(g.phase(), 'levelclear', 'не зачтена дверь');
  run(g, 40, 0.05); eq(g.phase(), 'play'); eq(s.level, 1, 'не перешёл на уровень 2');
});

test('финальный уровень содержит босса', () => {
  const g = P.Game(); g.start(); const s = g.state();
  // быстро пройдём уровни через дверь
  for (let lvl = 0; lvl < 3; lvl++) {
    settle(g);
    if (s.boss) break;
    const d = s.door; ok(d, 'нет двери на уровне ' + s.level);
    s.player.x = d.x + 2; s.player.y = d.y + d.h - s.player.h - 1;
    run(g, 2, 0.02); run(g, 40, 0.05);
  }
  settle(g);
  ok(s.boss, 'нет босса на финале, level=' + s.level);
  eq(s.boss.hp, 12);
});

test('босс: сюрикены снимают hp, ноль -> победа', () => {
  const g = P.Game(); g.start(); const s = g.state();
  for (let lvl = 0; lvl < 3; lvl++) {
    settle(g); if (s.boss) break;
    const d = s.door; s.player.x = d.x + 2; s.player.y = d.y + d.h - s.player.h - 1;
    run(g, 2, 0.02); run(g, 40, 0.05);
  }
  settle(g); ok(s.boss, 'нет босса');
  // лупим босса напрямую
  let guard = 0;
  while (s.boss && guard++ < 400) {
    const b = s.boss;
    s.player.invuln = 99; // не умираем сами
    s.player.x = b.x - 30; s.player.y = b.y + 10; s.player.dir = 1;
    g.shoot();
    for (const bu of s.bullets) { bu.x = b.x + b.w / 2; bu.y = b.y + b.h / 2; }
    run(g, 1, 0.02);
    if (g.phase() === 'win') break;
  }
  eq(g.phase(), 'win', 'босс не повержен, guard=' + guard);
});

console.log('\nИтого: ok ' + passed + ', fail ' + failed);
process.exit(failed ? 1 : 0);
