/* МЕДНИЦА · сборка прототипа под площадку штатным tools/platform-build.mjs (он собирает только игры из корня репо: slug без «/»).
   Делает временное «зеркало» вне репо: tools/ + _shared/ (копии) + mednitsa/ (копия этой папки) + promo/mednitsa/promo.json
   (названия для <title>) — и запускает сборщик из зеркала. Репо не меняется.
   Запуск: node _proto/mednitsa/tests/build-platform.mjs [yandex|gamepush|web] [/home/claude/platform-builds] */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url)), GAME = path.resolve(HERE, '..'), REPO = path.resolve(GAME, '..', '..');
const platform = process.argv[2] || 'yandex', out = path.resolve(process.argv[3] || '/home/claude/platform-builds');
const mirror = fs.mkdtempSync(path.join(os.tmpdir(), 'mednitsa-build-'));
const cp = (a, b) => fs.cpSync(path.join(REPO, a), path.join(mirror, b || a), { recursive: true });
cp('tools/platform-build.mjs'); cp('tools/lib');
for (const f of ['engine.js', 'platform.js', 'aspect.js']) cp('_shared/' + f);
fs.cpSync(GAME, path.join(mirror, 'mednitsa'), { recursive: true });
fs.mkdirSync(path.join(mirror, 'promo', 'mednitsa'), { recursive: true });
fs.writeFileSync(path.join(mirror, 'promo', 'mednitsa', 'promo.json'), JSON.stringify({ names: { ru: 'МЕДНИЦА', en: 'BOILERWRIGHT' } }, null, 2));
try {
  const r = execFileSync('node', [path.join(mirror, 'tools/platform-build.mjs'), 'mednitsa', platform, out], { env: Object.assign({}, process.env, { PROMO_DIR: path.join(mirror, 'promo') }), encoding: 'utf8' });
  process.stdout.write(r);
} catch (e) { process.stdout.write(String(e.stdout || '')); process.stderr.write(String(e.stderr || '')); process.exitCode = 1; }
finally { fs.rmSync(mirror, { recursive: true, force: true }); }
