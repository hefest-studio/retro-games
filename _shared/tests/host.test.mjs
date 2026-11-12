/* _shared/tests/host.test.mjs — общая «оболочка» _shared/host.js (Node, без зависимостей):
   каждая игра, подключающая ./js/host.js, держит точную копию _shared/host.js (её кладёт build.sh);
   host.js добавляет пункты меню публичным API движка (g.menu.addItem), а не через внутренности меню;
   опции адаптаций, которые передают игры, известны host.js. Поведение в браузере — тесты самих игр.
   Запуск: node _shared/tests/host.test.mjs */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const HOST = fs.readFileSync(path.join(ROOT, '_shared/host.js'), 'utf8');
const EXPECT = ['obval', 'rubikon', 'vihr', 'rubezh', 'proryv', 'saga', 'saga-2', 'neon-rage'];
let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log('ok   ' + name); } catch (e) { failed++; console.log('FAIL ' + name + ' — ' + e.message); } }
function ok(c, m) { if (!c) throw new Error(m || 'ложь'); }

const games = fs.readdirSync(ROOT, { withFileTypes: true }).filter(d => d.isDirectory() && fs.existsSync(path.join(ROOT, d.name, 'index.html')))
  .map(d => d.name).filter(n => /src="\.\/js\/host\.js"/.test(fs.readFileSync(path.join(ROOT, n, 'index.html'), 'utf8'))).sort();

test('host-игры: ровно 8 (' + EXPECT.join(', ') + ')', () => { ok(JSON.stringify(games) === JSON.stringify([...EXPECT].sort()), games.join(',')); });
for (const g of games) {
  test(g + ': js/host.js — копия _shared/host.js', () => { ok(fs.readFileSync(path.join(ROOT, g, 'js/host.js'), 'utf8') === HOST, 'рассинхрон — запусти bash build.sh'); });
  test(g + ': index.html не лезет во внутренности меню движка', () => { ok(!/_menu\.items\.splice/.test(fs.readFileSync(path.join(ROOT, g, 'index.html'), 'utf8'))); });
}
test('host.js: пункты меню — через g.menu.addItem', () => { ok(/g\.menu\.addItem\(/.test(HOST) && !/_menu\.items\.splice/.test(HOST)); });
test('host.js: все опции адаптаций на месте', () => {
  ['o.urlQuery', 'o.urlTheme', 'o.gameKeys', 'o.subKeys', 'o.rawGameKeys', 'o.soundFromEngine', 'o.bootKeep', 'o.bootAdopt', 'A.extraHint']
    .forEach(k => ok(HOST.includes(k), 'нет ' + k));
});
test('saga/saga-2/neon-rage включают свои адаптации', () => {
  const html = (g) => fs.readFileSync(path.join(ROOT, g, 'index.html'), 'utf8');
  ['saga', 'saga-2'].forEach(g => ['urlQuery: true', 'rawGameKeys: true', 'soundFromEngine: true', 'bootKeep: true'].forEach(o => ok(html(g).includes(o), g + ' без ' + o)));
  ok(html('neon-rage').includes('bootAdopt: true'), 'neon-rage без bootAdopt');
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
