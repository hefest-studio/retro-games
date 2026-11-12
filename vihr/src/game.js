/* ==========================================================================
   ВИХРЬ · ВИХРЬ — веб-оригинал аркадного скролл-шутера Гефест
   --------------------------------------------------------------------------
   Один файл, без зависимостей. Внутреннее разрешение 320×224 (аркадное поле
   + HUD). Два визуальных режима: 8-битный пиксельный и современный неоновый.
   Языки: русский (по умолчанию) и английский.
   ========================================================================== */
'use strict';
(function () {

/* -------------------------------------------------------------------------
   0. Отлов ошибок: любая проблема показывается поверх страницы, а не тонет
      в консоли — так порт проще отлаживать.
   ------------------------------------------------------------------------- */
const errEl = document.getElementById('err');
function reportError(msg) {
  try {
    if (!errEl) return;
    errEl.style.display = 'block';
    errEl.textContent += msg + '\n';
  } catch (e) { /* ignore */ }
}
window.addEventListener('error', ev => reportError('ОШИБКА: ' + (ev.message || ev.error)));
window.addEventListener('unhandledrejection', ev => reportError('PROMISE: ' + ev.reason));

/* -------------------------------------------------------------------------
   1. Геометрия и мелкие утилиты
   ------------------------------------------------------------------------- */
const W = 320, H = 224;          // логическое разрешение кадра
const TOP = 22;                  // высота HUD
const FIELD_TOP = TOP + 2;
const GND = 196;                 // линия земли
const TAU = Math.PI * 2;

const clamp = (v, a, b) => v < a ? a : (v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const sign = v => v < 0 ? -1 : (v > 0 ? 1 : 0);

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** Детерминированный генератор для декораций: одинаковый на каждом кадре. */
function hash01(n) {
  let x = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
  return x - Math.floor(x);
}
function aabb(a, b) {
  return Math.abs(a.x - b.x) * 2 < (a.w + b.w) && Math.abs(a.y - b.y) * 2 < (a.h + b.h);
}
function rectHit(x1, y1, w1, h1, x2, y2, w2, h2) {
  return Math.abs(x1 - x2) * 2 < (w1 + w2) && Math.abs(y1 - y2) * 2 < (h1 + h2);
}
const pad = (n, len) => {
  let s = String(Math.max(0, Math.floor(n)));
  while (s.length < len) s = '0' + s;
  return s;
};
const fmtScore = n => pad(n, 6);

function isTouchDevice() {
  return ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
}

/* -------------------------------------------------------------------------
   2. Локализация. Русский — основной, английский — переключаемый.
   ------------------------------------------------------------------------- */
const I18N = {
  ru: {
    start: 'НАЧАТЬ ИГРУ',
    graphics: 'ГРАФИКА',
    lang: 'ЯЗЫК',
    sound: 'ЗВУК',
    controls: 'УПРАВЛЕНИЕ',
    gfxRetro: '8-БИТ',
    gfxModern: 'СОВРЕМЕННАЯ',
    ru: 'РУССКИЙ',
    en: 'ENGLISH',
    on: 'ВКЛ',
    off: 'ВЫКЛ',
    pressEnter: 'НАЖМИТЕ ENTER',
    orTap: 'ИЛИ КОСНИТЕСЬ ЭКРАНА',
    record: 'РЕКОРД',
    unofficial: 'ОРИГИНАЛ СТУДИИ ГЕФЕСТ',
    hintKeys: 'G - ГРАФИКА   L - ЯЗЫК   M - ЗВУК',
    score: 'ОЧКИ',
    lives: 'ЖИЗНИ',
    zone: 'ЗОНА',
    weapon: 'ОРУЖИЕ',
    bombs: 'БОМБЫ',
    shield: 'ЩИТ',
    boss: 'БОСС',
    pause: 'ПАУЗА',
    resume: 'ПРОДОЛЖИТЬ - ENTER',
    toMenu: 'В МЕНЮ - ESC',
    gameover: 'ИГРА ОКОНЧЕНА',
    newRecord: 'НОВЫЙ РЕКОРД!',
    restart: 'ЗАНОВО - ENTER',
    victory: 'ПОБЕДА!',
    victorySub: 'ВСЕ ЧЕТЫРЕ ЗОНЫ ЗАЧИЩЕНЫ',
    stageClear: 'ЗОНА ЗАЧИЩЕНА',
    bonus: 'БОНУС',
    nextZone: 'СЛЕДУЮЩАЯ ЗОНА',
    warning: 'ВНИМАНИЕ',
    bossIncoming: 'БОСС ПРИБЛИЖАЕТСЯ',
    cores: 'ЯДРО',
    controlsTitle: 'УПРАВЛЕНИЕ',
    ctrlMove: 'ДВИЖЕНИЕ',
    ctrlFire: 'ОГОНЬ',
    ctrlBomb: 'БОМБА / ЩИТ',
    ctrlPause: 'ПАУЗА',
    ctrlGfx: 'ГРАФИКА',
    ctrlLang: 'ЯЗЫК',
    ctrlSound: 'ЗВУК',
    ctrlStart: 'СТАРТ / МЕНЮ',
    keysArrows: 'СТРЕЛКИ / WASD',
    ctrlTouch: 'ТАЧ: ВЕДИТЕ ПАЛЬЦЕМ - ОГОНЬ АВТО. ПАУЗА - ВЕРХНИЙ ПРАВЫЙ УГОЛ.',
    back: 'НАЗАД - ESC',
    ready: 'ПРИГОТОВЬТЕСЬ',
    pressKey: 'ENTER',
    p1: '1 ИГРОК',
    scoreUnit: 'ОЧК',
    hi: 'РЕКОРД',
    zoneIntro: 'ЗОНА',
    weaponUp: 'ОРУЖИЕ +',
    shieldUp: 'ЩИТ +',
    bombUp: 'БОМБА +',
    extraLife: '1UP',
    allClear: 'ЗАДАНИЕ ВЫПОЛНЕНО',
    thanks: 'СПАСИБО ЗА ИГРУ',
    retry: 'ENTER - ЕЩЁ РАЗ',
    twoPlayers: '2 ИГРОКА',
    developed: 'ПОРТ: HTML5 · ГРАФИКА И ЗВУК ГЕНЕРИРУЮТСЯ КОДОМ',
    loading: 'ЗАГРУЗКА…'
  },
  en: {
    start: 'START GAME',
    graphics: 'GRAPHICS',
    lang: 'LANGUAGE',
    sound: 'SOUND',
    controls: 'CONTROLS',
    gfxRetro: '8-BIT',
    gfxModern: 'MODERN',
    ru: 'РУССКИЙ',
    en: 'ENGLISH',
    on: 'ON',
    off: 'OFF',
    pressEnter: 'PRESS ENTER',
    orTap: 'OR TAP THE SCREEN',
    record: 'HI-SCORE',
    unofficial: 'ORIGINAL BY HEFEST',
    hintKeys: 'G - GRAPHICS   L - LANGUAGE   M - SOUND',
    score: 'SCORE',
    lives: 'LIVES',
    zone: 'ZONE',
    weapon: 'WEAPON',
    bombs: 'BOMBS',
    shield: 'SHIELD',
    boss: 'BOSS',
    pause: 'PAUSED',
    resume: 'RESUME - ENTER',
    toMenu: 'MENU - ESC',
    gameover: 'GAME OVER',
    newRecord: 'NEW HI-SCORE!',
    restart: 'RETRY - ENTER',
    victory: 'VICTORY!',
    victorySub: 'ALL FOUR ZONES CLEARED',
    stageClear: 'ZONE CLEARED',
    bonus: 'BONUS',
    nextZone: 'NEXT ZONE',
    warning: 'WARNING',
    bossIncoming: 'BOSS INCOMING',
    cores: 'CORE',
    controlsTitle: 'CONTROLS',
    ctrlMove: 'MOVE',
    ctrlFire: 'FIRE',
    ctrlBomb: 'BOMB / SHIELD',
    ctrlPause: 'PAUSE',
    ctrlGfx: 'GRAPHICS',
    ctrlLang: 'LANGUAGE',
    ctrlSound: 'SOUND',
    ctrlStart: 'START / MENU',
    keysArrows: 'ARROWS / WASD',
    ctrlTouch: 'TOUCH: DRAG TO FLY, AUTO-FIRE. PAUSE - TOP-RIGHT CORNER.',
    back: 'BACK - ESC',
    ready: 'GET READY',
    pressKey: 'ENTER',
    p1: '1 PLAYER',
    scoreUnit: 'PTS',
    hi: 'HI-SCORE',
    zoneIntro: 'ZONE',
    weaponUp: 'WEAPON +',
    shieldUp: 'SHIELD +',
    bombUp: 'BOMB +',
    extraLife: '1UP',
    allClear: 'MISSION COMPLETE',
    thanks: 'THANKS FOR PLAYING',
    retry: 'ENTER - AGAIN',
    twoPlayers: '2 PLAYERS',
    developed: 'HTML5 PORT · GRAPHICS AND SOUND GENERATED IN CODE',
    loading: 'LOADING…'
  }
};
let LANG = 'ru';
const t = key => (I18N[LANG] && I18N[LANG][key]) || (I18N.ru[key] || key);

/* -------------------------------------------------------------------------
   3. Настройки, рекорд и локальное хранилище
   ------------------------------------------------------------------------- */
const CFG_KEY = 'vihr.cfg.v1';
const HI_KEY = 'vihr.hi.v1';
// Устаревшие ключи (прежнее рабочее имя) — только для однократной миграции:
// старый → новый (если нового ещё нет) → удалить старый.
const LEGACY_KEYS = [['silkworm.cfg.v1', CFG_KEY], ['silkworm.hi.v1', HI_KEY]];
(function migrateStorage() {
  try {
    LEGACY_KEYS.forEach(([from, to]) => {
      const v = localStorage.getItem(from);
      if (v == null) return;
      if (localStorage.getItem(to) == null) localStorage.setItem(to, v);
      localStorage.removeItem(from);
    });
  } catch (e) { /* приватный режим */ }
})();
const CFG = { lang: 'ru', gfx: 'retro', sound: true }; // gfx живёт только в текущей сессии: при запуске всегда 8-бит

function loadCfg() {
  try {
    const raw = localStorage.getItem(CFG_KEY);
    if (raw) {
      const o = JSON.parse(raw);
      if (o && typeof o === 'object') {
        if (o.lang === 'ru' || o.lang === 'en') CFG.lang = o.lang;
        // gfx намеренно не восстанавливаем: игра всегда открывается в 8-битном режиме
        CFG.sound = o.sound !== false;
      }
    }
  } catch (e) { /* приватный режим — просто играем с дефолтами */ }
}
function saveCfg() {
  // сохраняем только язык и звук; режим графики по умолчанию всегда RETRO
  try { localStorage.setItem(CFG_KEY, JSON.stringify({ lang: CFG.lang, sound: CFG.sound })); } catch (e) { /* ignore */ }
}
function loadHi() {
  try { return Math.max(0, parseInt(localStorage.getItem(HI_KEY) || '0', 10) || 0); }
  catch (e) { return 0; }
}
function saveHi(v) {
  try { localStorage.setItem(HI_KEY, String(Math.max(0, Math.floor(v)))); } catch (e) { /* ignore */ }
}

/* -------------------------------------------------------------------------
   4. Конфигурация зон. Палитры подобраны отдельно под 8-бит и под неон.
   ------------------------------------------------------------------------- */
const ENEMY_KINDS = ['tank', 'aa', 'kite', 'jet', 'truck'];

const STAGES = [
  {
    ru: 'ДЮНЫ', en: 'DUNES', ruSub: 'ПУСТЫНЯ · ЗАКАТ', enSub: 'DESERT · SUNSET',
    bg: 'desert', seed: 11, scroll: 82, len: 5200,
    tipRu: 'Собирайте P - огонь сильнее. Щит можно сбить: он снесёт всех врагов.',
    tipEn: 'Grab P for more firepower. You can shoot the shield pod to wipe the screen.',
    retro: {
      sky: ['#2a1d3f', '#6b2f5a', '#c9553f', '#f2a65a'], sun: '#ffd98a',
      far: '#7a3550', mid: '#9c4a50', near: '#c46a4a',
      ground: ['#d69a58', '#a9723c', '#6d4a28']
    },
    modern: {
      sky: ['#0d0620', '#2c0f3f', '#7a2246', '#ff6b35'], sun: '#ffe9b0',
      far: '#3a1a55', mid: '#5a2158', near: '#7c2c50',
      ground: ['#160c1e', '#241030'], accent: '#ff7a3d', accent2: '#39e7ff',
      fog: 'rgba(255,120,90,.10)'
    },
    mix: [['tank', 4], ['kite', 3], ['truck', 2], ['aa', 2], ['jet', 1]],
    boss: { ru: 'ЖЕЛЕЗНЫЙ КОРШУН', en: 'IRON KITE', hp: 300, accent: '#ff8a3d' }
  },
  {
    ru: 'МОРСКОЙ ПАТРУЛЬ', en: 'SEA PATROL', ruSub: 'ПОБЕРЕЖЬЕ · ШТОРМ', enSub: 'COAST · STORM',
    bg: 'sea', seed: 37, scroll: 92, len: 5600,
    tipRu: 'Держитесь выше воды: зенитки бьют по низу экрана.',
    tipEn: 'Stay high above the water: AA guns hammer the lower screen.',
    retro: {
      sky: ['#0b2239', '#17415c', '#2c6b7a', '#5fa3a0'], sun: '#fff0b8',
      far: '#1a3b50', mid: '#25566a', near: '#2f7385',
      ground: ['#123c50', '#1c566b', '#0b2a39']
    },
    modern: {
      sky: ['#020914', '#04303f', '#0a6b78', '#19c2b8'], sun: '#e8fff6',
      far: '#03202e', mid: '#06404f', near: '#0a5c6b',
      ground: ['#021018', '#04222e'], accent: '#39e7ff', accent2: '#8affc1',
      fog: 'rgba(60,220,230,.10)'
    },
    mix: [['kite', 4], ['jet', 3], ['tank', 2], ['aa', 2], ['truck', 1]],
    boss: { ru: 'МОРСКОЙ ДЬЯВОЛ', en: 'SEA DEVIL', hp: 380, accent: '#39e7ff' }
  },
  {
    ru: 'НЕОНОВЫЙ ГОРОД', en: 'NEON CITY', ruSub: 'ГОРОД · НОЧЬ', enSub: 'CITY · NIGHT',
    bg: 'city', seed: 73, scroll: 104, len: 6000,
    tipRu: 'В городе много целей - не лезьте под перекрёстный огонь.',
    tipEn: 'Lots of targets in the city — do not get caught in crossfire.',
    retro: {
      sky: ['#070a1c', '#151238', '#2a1550', '#4a1c5a'], sun: '#e8e6ff',
      far: '#120e28', mid: '#1c1638', near: '#2a1c44',
      ground: ['#191426', '#221a34', '#0e0b16'], stars: true
    },
    modern: {
      sky: ['#04040f', '#0b1030', '#241456', '#4a1450'], sun: '#cfe9ff',
      far: '#0a0a22', mid: '#131238', near: '#1d1746',
      ground: ['#08060f', '#120c1e'], accent: '#ff2f9c', accent2: '#39e7ff',
      fog: 'rgba(255,47,156,.10)', stars: true
    },
    mix: [['tank', 3], ['aa', 4], ['kite', 3], ['jet', 3], ['truck', 2]],
    boss: { ru: 'НЕОНОВЫЙ ХИЩНИК', en: 'NEON PREDATOR', hp: 460, accent: '#ff2f9c' }
  },
  {
    ru: 'ЦИТАДЕЛЬ', en: 'CITADEL', ruSub: 'КРЕПОСТЬ · ГРОЗА', enSub: 'FORTRESS · STORM',
    bg: 'fortress', seed: 99, scroll: 112, len: 6400,
    tipRu: 'Финальная зона. Берегите бомбы для последнего боя.',
    tipEn: 'Final zone. Save your bombs for the last fight.',
    retro: {
      sky: ['#160f1e', '#2a1424', '#4a1c26', '#7a2a24'], sun: '#ffb26b',
      far: '#241626', mid: '#35192a', near: '#4a2222',
      ground: ['#2a1a1e', '#3a2224', '#160d10']
    },
    modern: {
      sky: ['#08040a', '#20060f', '#4a0f14', '#8a1f12'], sun: '#ffcf9a',
      far: '#1a0c16', mid: '#2c121c', near: '#401a20',
      ground: ['#0d0608', '#1a0c0e'], accent: '#ff4b2b', accent2: '#ffd166',
      fog: 'rgba(255,90,50,.10)', storm: true
    },
    mix: [['aa', 4], ['tank', 4], ['kite', 4], ['jet', 4], ['truck', 2]],
    boss: { ru: 'ГЕНЕРАЛ ВИХРЬ', en: 'GENERAL VIHR', hp: 560, accent: '#ff4b2b' }
  }
];
const stageCfg = () => STAGES[G.stage] || STAGES[0];

/* -------------------------------------------------------------------------
   5. Звук: тонкая обёртка над SWAudio. Если движок не загрузился — тишина.
   ------------------------------------------------------------------------- */
const Sound = {
  ready: false,
  track: null,
  unlock() {
    if (this.ready) return;
    try {
      if (window.SWAudio && typeof window.SWAudio.unlock === 'function') {
        window.SWAudio.unlock();
        this.ready = true;
        if (typeof window.SWAudio.setMusicVolume === 'function') window.SWAudio.setMusicVolume(0.55);
        if (typeof window.SWAudio.setSfxVolume === 'function') window.SWAudio.setSfxVolume(0.7);
        if (typeof window.SWAudio.setMuted === 'function') window.SWAudio.setMuted(!CFG.sound);
        if (CFG.sound && this.track) this.music(this.track, true);
      }
    } catch (e) { /* играем без звука */ }
  },
  music(name, force) {
    if (!CFG.sound) { this.track = name; return; }
    if (!this.ready) { this.track = name; return; }
    if (!force && this.track === name) return;
    this.track = name;
    try {
      if (window.SWAudio && typeof window.SWAudio.playMusic === 'function') {
        window.SWAudio.playMusic(name);
      }
    } catch (e) { /* ignore */ }
  },
  stop() {
    try {
      if (window.SWAudio && typeof window.SWAudio.stopMusic === 'function') window.SWAudio.stopMusic(200);
    } catch (e) { /* ignore */ }
  },
  sfx(name) {
    if (!CFG.sound || !this.ready) return;
    try {
      if (window.SWAudio && typeof window.SWAudio.sfx === 'function') window.SWAudio.sfx(name);
    } catch (e) { /* ignore */ }
  },
  applyMute() {
    try {
      if (window.SWAudio && typeof window.SWAudio.setMuted === 'function') window.SWAudio.setMuted(!CFG.sound);
    } catch (e) { /* ignore */ }
    if (!CFG.sound) this.stop();
    else if (this.track) this.music(this.track, true);
  }
};

/* -------------------------------------------------------------------------
   6. Ввод: клавиатура + минимальный тач (палец ведёт вертолёт, автоогонь)
   ------------------------------------------------------------------------- */
const Input = {
  down: Object.create(null),
  hit: Object.create(null),
  touch: { active: false, x: 0, y: 0, fire: false },
  init() {
    window.addEventListener('keydown', ev => {
      const k = normKey(ev);
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'Space'].indexOf(ev.key) >= 0 ||
          ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyB', 'KeyG', 'KeyL', 'KeyM', 'KeyP', 'KeyZ', 'KeyX', 'Enter', 'Escape'].indexOf(ev.code) >= 0) {
        ev.preventDefault();
      }
      if (!Input.down[k]) Input.hit[k] = true;
      Input.down[k] = true;
      Sound.unlock();
    }, { passive: false });
    window.addEventListener('keyup', ev => {
      const k = normKey(ev);
      Input.down[k] = false;
    });
    window.addEventListener('blur', () => { Input.down = Object.create(null); });
  },
  press(k) { return !!Input.down[k]; },
  just(k) {
    if (Input.hit[k]) { Input.hit[k] = false; return true; }
    return false;
  },
  anyJust() {
    const keys = Object.keys(Input.hit);
    if (keys.length) { keys.forEach(k => delete Input.hit[k]); return true; }
    return false;
  },
  endFrame() { Input.hit = Object.create(null); }
};
function normKey(ev) {
  const c = ev.code;
  if (c === 'Space') return 'fire';
  if (c === 'Enter' || c === 'NumpadEnter') return 'enter';
  if (c === 'Escape') return 'escape';
  if (c === 'KeyB') return 'bomb';
  if (c === 'KeyG') return 'gfx';
  if (c === 'KeyL') return 'lang';
  if (c === 'KeyM') return 'sound';
  if (c === 'KeyP') return 'pause';
  if (c === 'KeyZ') return 'fire';
  if (c === 'KeyX') return 'bomb';
  if (c === 'ArrowLeft' || c === 'KeyA') return 'left';
  if (c === 'ArrowRight' || c === 'KeyD') return 'right';
  if (c === 'ArrowUp' || c === 'KeyW') return 'up';
  if (c === 'ArrowDown' || c === 'KeyS') return 'down';
  return c || 'unknown';
}

/* -------------------------------------------------------------------------
   7. Холст, масштабирование, режимы графики
   ------------------------------------------------------------------------- */
const cv = document.getElementById('game');
const ctx = cv.getContext('2d');
const frameEl = document.getElementById('frame');
const stageEl = document.getElementById('stage');
const toastEl = document.getElementById('toast');
let BS = 1;                         // масштаб backing store (для неона)
let GFX = 'retro';                  // 'retro' | 'modern'
let cssScale = 1;

function setGfx(mode, silent) {
  GFX = mode === 'modern' ? 'modern' : 'retro';
  document.body.classList.toggle('modern', GFX === 'modern');
  document.body.classList.toggle('retro', GFX === 'retro');
  const chip = document.getElementById('chip-mode');
  if (chip) chip.innerHTML = '<span class="dot"></span><b>' + (GFX === 'modern' ? (LANG === 'ru' ? 'СОВР.' : 'MODERN') : '8-БИТ') + '</b> ' + (LANG === 'ru' ? 'ГРАФИКА' : 'GFX');
  if (!silent) toast((LANG === 'ru' ? 'Графика: ' : 'Graphics: ') + (GFX === 'modern' ? (LANG === 'ru' ? 'современная' : 'modern') : '8-bit'));
  resize();
}
function setLang(lang, silent) {
  LANG = lang === 'en' ? 'en' : 'ru';
  document.documentElement.lang = LANG;
  document.title = LANG === 'ru' ? 'ВИХРЬ · Над полем боя — HTML5' : 'ВИХРЬ · HTML5';
  const chip = document.querySelector('.chips .chip:nth-child(2) b');
  if (chip) chip.textContent = LANG.toUpperCase();
  document.querySelectorAll('[data-ru]').forEach(el => {
    const ru = el.getAttribute('data-ru'), en = el.getAttribute('data-en');
    if (ru !== null && en !== null) el.textContent = LANG === 'ru' ? ru : en;
  });
  const cvEl = document.getElementById('game');
  if (cvEl) cvEl.setAttribute('aria-label', LANG === 'ru' ? 'ВИХРЬ — игра' : 'ВИХРЬ — game');
  setGfx(GFX, true);
  if (!silent) toast(LANG === 'ru' ? 'Язык: русский' : 'Language: English');
  resize();
}
function toast(msg) {
  if (!toastEl) return;
  toastEl.textContent = msg;
  toastEl.classList.add('on');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => toastEl.classList.remove('on'), 1400);
}

function resize() {
  if (!stageEl || !frameEl) return;
  const availW = Math.max(120, stageEl.clientWidth);
  const availH = Math.max(90, stageEl.clientHeight);
  const fit = Math.min((availW - 6) / W, (availH - 6) / H);
  cssScale = GFX === 'retro' ? (fit >= 2 ? Math.floor(fit) : Math.max(1, fit)) : Math.max(0.6, fit);
  frameEl.style.width = Math.round(W * cssScale) + 'px';
  frameEl.style.height = Math.round(H * cssScale) + 'px';
  const dpr = window.devicePixelRatio || 1;
  const want = GFX === 'retro' ? 1 : clamp(Math.round(cssScale * dpr), 2, 5);
  if (cv.width !== W * want || cv.height !== H * want) {
    cv.width = W * want;
    cv.height = H * want;
  }
  BS = want;
}
window.addEventListener('resize', () => resize());

/* -------------------------------------------------------------------------
   8. Текст. В 8-битном режиме символы растрируются из системного шрифта
      в 1-битную маску и кешируются — получается настоящий пиксельный шрифт
      с кириллицей, без внешних файлов.
   ------------------------------------------------------------------------- */
const textCache = new Map();
function pixText(str, size, color) {
  const key = size + '|' + color + '|' + str;
  let c = textCache.get(key);
  if (c) return c;
  const padPx = 3;
  const off = document.createElement('canvas');
  const o = off.getContext('2d');
  const font = 'bold ' + size + 'px ui-monospace, Menlo, "Courier New", monospace';
  o.font = font;
  const tw = Math.max(1, Math.ceil(o.measureText(str).width));
  off.width = tw + padPx * 2;
  off.height = size + padPx * 2 + Math.ceil(size * 0.28);
  const c2 = off.getContext('2d');
  c2.font = font;
  c2.textBaseline = 'top';
  c2.fillStyle = '#ffffff';
  c2.fillText(str, padPx, padPx);
  const img = c2.getImageData(0, 0, off.width, off.height);
  const d = img.data;
  const rgb = hexToRgb(color);
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] > 120) { d[i] = rgb[0]; d[i + 1] = rgb[1]; d[i + 2] = rgb[2]; d[i + 3] = 255; }
    else { d[i + 3] = 0; }
  }
  c2.putImageData(img, 0, 0);
  c = { canvas: off, w: off.width, h: off.height, pad: padPx };
  if (textCache.size > 240) textCache.clear();
  textCache.set(key, c);
  return c;
}
function hexToRgb(hex) {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

/**
 * Универсальная надпись.
 * opts: size, color, align ('left'|'center'|'right'), alpha, glow, spacing,
 *       baseline ('top'|'middle'|'bottom'), weight, monospace
 */
function label(str, x, y, opts) {
  opts = opts || {};
  const size = opts.size || 8;
  const color = opts.color || '#ffffff';
  const alpha = opts.alpha === undefined ? 1 : opts.alpha;
  if (alpha <= 0.01) return 0;
  ctx.save();
  ctx.globalAlpha = alpha;
  let width = 0;
  if (GFX === 'retro') {
    const p = pixText(String(str), size, color);
    width = p.w - p.pad * 2;
    let dx = x - p.pad;
    if (opts.align === 'center') dx -= width / 2;
    else if (opts.align === 'right') dx -= width;
    let dy = y - p.pad;
    if (opts.baseline === 'middle') dy = y - p.h / 2 + 1;
    else if (opts.baseline === 'bottom') dy = y - p.h + p.pad;
    ctx.drawImage(p.canvas, Math.round(dx), Math.round(dy));
  } else {
    const weight = opts.weight || 600;
    ctx.font = weight + ' ' + size + 'px ui-monospace, "SF Mono", Menlo, Consolas, monospace';
    ctx.textAlign = opts.align === 'center' ? 'center' : (opts.align === 'right' ? 'right' : 'left');
    ctx.textBaseline = opts.baseline === 'middle' ? 'middle' : (opts.baseline === 'bottom' ? 'alphabetic' : 'top');
    if ('letterSpacing' in ctx) { try { ctx.letterSpacing = (opts.spacing || 0) + 'px'; } catch (e) { /* ignore */ } }
    if (opts.glow) {
      ctx.shadowColor = opts.glow === true ? color : opts.glow;
      ctx.shadowBlur = opts.glowSize || 8;
    }
    ctx.fillStyle = color;
    ctx.fillText(String(str), x, y);
    width = ctx.measureText(String(str)).width;
  }
  ctx.restore();
  return width;
}
function labelWidth(str, size, spacing) {
  if (GFX === 'retro') {
    const p = pixText(String(str), size || 8, '#ffffff');
    return p.w - p.pad * 2;
  }
  ctx.save();
  ctx.font = '600 ' + (size || 8) + 'px ui-monospace, Menlo, monospace';
  if ('letterSpacing' in ctx) { try { ctx.letterSpacing = (spacing || 0) + 'px'; } catch (e) { /* ignore */ } }
  const w = ctx.measureText(String(str)).width;
  ctx.restore();
  return w;
}

/* -------------------------------------------------------------------------
   9. Спрайты 8-битного режима: матрицы символов, запечённые в canvas.
   ------------------------------------------------------------------------- */
const PAL = {
  k: '#10140f', o: '#5b7a37', l: '#a8c25a', g: '#8a94a6', d: '#3a4150',
  r: '#e04a3a', R: '#7a1f1f', y: '#ffd166', w: '#e8f1f2', c: '#6fe3ff',
  b: '#7a5432', s: '#c49a62', p: '#ff2f9c', m: '#2a2f3a', n: '#c9d6e8'
};
const SPR = {};
function makeSprite(rows, pal) {
  const h = rows.length, w = rows[0].length;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const x = c.getContext('2d');
  for (let j = 0; j < h; j++) {
    const row = rows[j];
    for (let i = 0; i < w; i++) {
      const ch = row[i];
      if (!ch || ch === '.') continue;
      x.fillStyle = (pal && pal[ch]) || PAL[ch] || '#f0f';
      x.fillRect(i, j, 1, 1);
    }
  }
  return { w, h, canvas: c };
}
function defineSprites() {
  SPR.heli = makeSprite([
    '..........kkkkkk........',
    '.......kkkoooookk.......',
    '....kkkoooooooooookk....',
    '..kkooooooooollllllok...',
    '.kooooooooooollllllocck.',
    'kooooooooooollllllllllko',
    'kkkkkkkkkkkkkkkkkkkkkkkk',
    '...kkk......kkk.........',
    '..kkkkk....kkkkk........',
    '........................'
  ]);
  SPR.tank = makeSprite([
    '.......kkkkkk.......',
    '......koooooook.....',
    '.....kooooooooook...',
    '....kkooooooooookk..',
    '...kkooooooooooook..',
    '..kkkkkkkkkkkkkkkk..',
    '..koooooooooooooook.',
    '.kkdddddddddddddddkk',
    '.kkdkdkdkdkdkdkdkdkk',
    'kkkdkdkdkdkdkdkdkdkkk',
    'kkkkkkkkkkkkkkkkkkkkk'
  ]);
  SPR.aa = makeSprite([
    '....kkkkkkkk....',
    '...kddddddddk...',
    '..kddddddddddk..',
    '.kkddddddddddkk.',
    '.kdddddddddddddk',
    '.kkkkkkkkkkkkkkk',
    '...kk......kk...',
    '..kkk......kkk..',
    '.kkkkk....kkkkk.',
    'kkkkkkk..kkkkkkk',
    'kkkkkkkkkkkkkkkk'
  ]);
  SPR.kite = makeSprite([
    '.........kkkkkk.........',
    '......kkkddddddkkk......',
    '....kkddddddddddddkk....',
    '..kkddddddddrrrrrddddk..',
    '.kddddddddrrrrrrrrrdddk.',
    'kdddddddddrrrrrrrrrrdddk',
    'kkkkkkkkkkkkkkkkkkkkkkkk',
    '...kkk.......kkk........',
    '..kkkkk.....kkkkk.......',
    '........................'
  ]);
  SPR.jet = makeSprite([
    '..............kkkk..',
    '..........kkkcccwwk.',
    '.....kkkkkcccwwwwwk.',
    'kkkkkccccccccwwwwwk.',
    'kkkkkccccccccwwwwwk.',
    '.....kkkkkcccwwwwwk.',
    '..........kkkcccwwk.',
    '..............kkkk..'
  ]);
  SPR.truck = makeSprite([
    '...kkkkkkkkkkk..',
    '..kbbbbbbbbbbbk.',
    '.kbsssssssssssbk',
    '.kbsysysysysysbk',
    '.kbsssssssssssbk',
    '.kbsssssssssssbk',
    '.kkkkkkkkkkkkkkk',
    '..kk........kk..',
    '.kkkk......kkkk.'
  ]);
  SPR.boss = makeSprite([
    '...........kkkkkkkkkk...........',
    '........kkkddddddddddkkk........',
    '.....kkkdddddddddddddddddkkk....',
    '...kkdddddddddddddddddddddddkk..',
    '..kdddddddddddddddddddddddddddk.',
    '.kdddddddddddddddddddddddddddddk',
    '.kddddddrrrrrrkddddrrrrrrkdddddk',
    '.kddddrrrrrrrrrkkrrrrrrrrrrddddk',
    'kddddrrrrrrrrrrrrrrrrrrrrrrrrrdk',
    'kddddrrrrrrrrrrrrrrrrrrrrrrrrrdk',
    '.kddddrrrrrrrrrkkrrrrrrrrrrddddk',
    '.kddddddrrrrrrkddddrrrrrrkdddddk',
    'kddddddddddddddddddddddddddddddk',
    '.kkddddddddddddddddddddddddddkk.',
    '...kkddddddddddddddddddddddkk...',
    '.....kkkkkkkkkkkkkkkkkkkkkk.....',
    '.......kk......kk......kk.......',
    '....kkkkkk....kkkkk....kkkkkk...',
    '.....kkkk......kkk......kkkk....'
  ]);
  SPR.pickP = makeSprite([
    '..kkkkkk..',
    '.kyyyyyyk.',
    'kyywwwwyyk',
    'kywwyywwyk',
    'kywyyyywyk',
    'kywwyywwyk',
    'kyywwwwyyk',
    '.kyyyyyyk.',
    '..kkkkkk..'
  ], { k: '#10140f', y: '#ffd166', w: '#fff6d8' });
  SPR.pickS = makeSprite([
    '..kkkkkk..',
    '.kcccccck.',
    'kcwwccccck',
    'kcwcccccck',
    'kcccccccck',
    'kcccccccck',
    'kcccccccck',
    '.kcccccck.',
    '..kkkkkk..'
  ], { k: '#10140f', c: '#6fe3ff', w: '#ffffff' });
  SPR.pickB = makeSprite([
    '..kkkkkk..',
    '.krrrrrrk.',
    'krwwrrrrrk',
    'krwrrrrrrk',
    'krrrrrrrrk',
    'krrrrrrrrk',
    'krrrrrrrrk',
    '.krrrrrrk.',
    '..kkkkkk..'
  ], { k: '#10140f', r: '#e04a3a', w: '#ffe0d8' });
  SPR.life = makeSprite([
    '....kkkk....',
    '..kkllllkk..',
    'kkllllllllkk',
    'kllllllllllk',
    'kkkkkkkkkkkk',
    '..kk....kk..'
  ]);
}
function drawSpr(sp, x, y, opts) {
  opts = opts || {};
  ctx.save();
  if (opts.alpha !== undefined) ctx.globalAlpha = opts.alpha;
  if (opts.flip) {
    ctx.translate(Math.round(x), Math.round(y));
    ctx.scale(-1, 1);
    ctx.drawImage(sp.canvas, -Math.round(sp.w / 2), -Math.round(sp.h / 2));
  } else {
    ctx.drawImage(sp.canvas, Math.round(x - sp.w / 2), Math.round(y - sp.h / 2));
  }
  ctx.restore();
}

/* -------------------------------------------------------------------------
   10. Состояние игры
   ------------------------------------------------------------------------- */
const G = {
  state: 'title',            // title | controls | play | pause | clear | gameover | victory
  frame: 0, time: 0,
  menu: 0, help: false, menuT: 0,
  stage: 0, phase: 'intro',  // intro | waves | warn | boss | clear
  phaseT: 0,
  scrollX: 0, scrollSpeed: 0, worldT: 0,
  score: 0, hi: 0, lives: 3, bombs: 2, weapon: 1,
  player: null, enemies: [], bullets: [], ebullets: [], pickups: [], parts: [], boss: null,
  waves: [], waveIdx: 0, spawnT: 0,
  shake: 0, flash: 0,
  freeze: false,
  msg: null, msgT: 0,
  bossWarnT: 0, bonus: 0, bonusShown: 0, clearT: 0,
  stageTip: '', demo: false,
  startStage: 0
};
G.hi = loadHi();

const rng = mulberry32(0xC0FFEE);

/* -------------------------------------------------------------------------
   11. Эффекты: частицы, вспышки, тряска
   ------------------------------------------------------------------------- */
function addPart(x, y, o) {
  if (G.parts.length > 340) return;
  G.parts.push({
    x, y,
    vx: o.vx || 0, vy: o.vy || 0,
    life: o.life || 0.5, max: o.life || 0.5,
    size: o.size || 2, col: o.col || '#ffd166',
    kind: o.kind || 'spark', grav: o.grav || 0, drag: o.drag === undefined ? 0.96 : o.drag,
    rot: o.rot || 0, spin: o.spin || 0
  });
}
function boom(x, y, size, col) {
  const c = col || '#ffb347';
  const n = Math.round(6 + size * 2.2);
  for (let i = 0; i < n; i++) {
    const a = rng() * TAU, s = 20 + rng() * (60 + size * 8);
    addPart(x, y, {
      vx: Math.cos(a) * s, vy: Math.sin(a) * s - 10,
      life: 0.35 + rng() * 0.5, size: 1 + rng() * (1 + size * 0.12),
      col: rng() < 0.5 ? c : (rng() < 0.5 ? '#fff3c4' : '#ff5a2b'),
      kind: 'spark', drag: 0.9
    });
  }
  for (let i = 0; i < Math.round(2 + size * 0.5); i++) {
    addPart(x + (rng() - 0.5) * size, y + (rng() - 0.5) * size, {
      vx: (rng() - 0.5) * 26, vy: -18 - rng() * 26,
      life: 0.7 + rng() * 0.6, size: 3 + rng() * (size * 0.16),
      col: 'rgba(40,36,44,1)', kind: 'smoke', grav: -8, drag: 0.97
    });
  }
  addPart(x, y, { life: 0.22, size: size * 1.5, col: c, kind: 'ring' });
  addPart(x, y, { life: 0.1, size: size * 0.2, col: '#ffffff', kind: 'flare' });
  G.shake = Math.min(9, G.shake + size * 0.28);
}
function sparkHit(x, y, col) {
  for (let i = 0; i < 4; i++) {
    const a = rng() * TAU;
    addPart(x, y, { vx: Math.cos(a) * 60, vy: Math.sin(a) * 60, life: 0.2, size: 1, col: col || '#ffe08a', kind: 'spark' });
  }
}
function updateParts(dt) {
  for (let i = G.parts.length - 1; i >= 0; i--) {
    const p = G.parts[i];
    p.life -= dt;
    if (p.life <= 0) { G.parts.splice(i, 1); continue; }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.grav) p.vy += p.grav * dt;
    if (p.drag !== 1) { const d = Math.pow(p.drag, dt * 60); p.vx *= d; p.vy *= d; }
    p.rot += p.spin * dt;
    if (p.kind === 'smoke') p.size += dt * 14;
  }
  G.shake = Math.max(0, G.shake - dt * 26);
  G.flash = Math.max(0, G.flash - dt * 3.4);
}

/* -------------------------------------------------------------------------
   12. Фоны. Восемь рисовалок: четыре зоны × два визуальных режима.
   ------------------------------------------------------------------------- */
function px(n) { return Math.round(n); }
function bandRect(y0, y1, col) { ctx.fillStyle = col; ctx.fillRect(0, px(y0), W, px(y1 - y0)); }

function skyBands(colors, y0, y1) {
  const n = colors.length;
  for (let i = 0; i < n; i++) {
    const a = y0 + (y1 - y0) * (i / n);
    const b = y0 + (y1 - y0) * ((i + 1) / n);
    bandRect(a, b, colors[i]);
  }
  // ступенчатый дизеринг на стыках полос — фирменный приём 8-бит графики
  for (let i = 1; i < n; i++) {
    const yb = Math.round(y0 + (y1 - y0) * (i / n));
    for (let dy = -2; dy <= 1; dy++) {
      const y = yb + dy;
      if (y < y0 || y >= y1) continue;
      for (let x = (dy & 1) ? 0 : 1; x < W; x += 2) {
        ctx.fillStyle = dy < 0 ? colors[i] : colors[i - 1];
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }
}
function retroCircle(x, y, r, col, gap) {
  ctx.fillStyle = col;
  for (let j = -r; j <= r; j++) {
    const half = Math.sqrt(Math.max(0, r * r - j * j));
    if (gap && j > r * 0.1 && ((j + Math.floor(y)) % 4 === 0)) continue;
    ctx.fillRect(px(x - half), px(y + j), px(half * 2), 1);
  }
}
function retroCloud(x, y, w, col) {
  ctx.fillStyle = col;
  const h = Math.max(2, Math.round(w * 0.18));
  ctx.fillRect(px(x), px(y), px(w), h);
  ctx.fillRect(px(x + w * 0.18), px(y - h), px(w * 0.5), h);
  ctx.fillRect(px(x + w * 0.55), px(y + h), px(w * 0.35), h);
}
function retroDunes(baseY, amp, color, parallax, phase, ridge) {
  const off = -((G.scrollX * parallax) % (W * 2));
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, GND);
  for (let x = 0; x <= W; x += 2) {
    const wx = x - off;
    const y = baseY - amp * (0.45 + 0.55 * Math.sin(wx * 0.011 + phase) * Math.sin(wx * 0.004 + phase * 2));
    ctx.lineTo(x, y);
  }
  ctx.lineTo(W, GND);
  ctx.closePath();
  ctx.fill();
  if (ridge) {
    ctx.strokeStyle = ridge;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= W; x += 2) {
      const wx = x - off;
      const y = baseY - amp * (0.45 + 0.55 * Math.sin(wx * 0.011 + phase) * Math.sin(wx * 0.004 + phase * 2));
      if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
}
function retroSkyline(baseY, color, parallax, seed, litCol, litChance, windowGap) {
  const off = -((G.scrollX * parallax) % (W * 3));
  ctx.fillStyle = color;
  for (let i = 0; i < 22; i++) {
    const bw = 10 + Math.floor(hash01(seed + i * 3.1) * 20);
    const bh = 16 + Math.floor(hash01(seed + i * 7.7) * 54);
    const bx = Math.round(off + i * 34 - 40);
    if (bx > W || bx + bw < 0) continue;
    ctx.fillRect(bx, px(baseY - bh), bw, bh + 20);
    if (litCol) {
      for (let wy = baseY - bh + 4; wy < baseY - 2; wy += windowGap || 5) {
        for (let wx = bx + 2; wx < bx + bw - 2; wx += 4) {
          if (hash01(seed + i * 13.7 + wx * 0.7 + wy * 0.31) < (litChance || 0.18)) {
            ctx.fillStyle = litCol;
            ctx.fillRect(wx, wy, 1, 1);
            ctx.fillStyle = color;
          }
        }
      }
    }
  }
}
function retroStars(col) {
  ctx.fillStyle = col;
  for (let i = 0; i < 46; i++) {
    const x = Math.round((hash01(i * 1.7) * (W + 40) - G.scrollX * 0.015) % (W + 40)) - 20;
    const y = px(TOP + 3 + hash01(i * 5.3) * 74);
    if (hash01(i * 9.1 + Math.floor(G.time * 2)) > 0.82) continue;
    ctx.fillRect(x, y, hash01(i * 2.2) > 0.8 ? 2 : 1, 1);
  }
}

/* ---- 8-битные фоны ---- */
function bgDesertRetro(st) {
  const p = st.retro;
  skyBands(p.sky, TOP, GND);
  const sunX = 232 - ((G.scrollX * 0.02) % 90);
  retroCircle(sunX, TOP + 46, 17, p.sun, true);
  ctx.fillStyle = 'rgba(255,255,255,.16)';
  for (let i = 0; i < 6; i++) {
    const cx = ((i * 83 + hash01(i * 3.3) * 50 - G.scrollX * 0.07) % (W + 120)) - 60;
    retroCloud(cx, TOP + 16 + (i % 3) * 22, 22 + (i % 3) * 14, 'rgba(255,220,190,.35)');
  }
  retroDunes(GND - 62, 12, p.far, 0.12, 0.4, null);
  retroDunes(GND - 36, 9, p.mid, 0.26, 2.1, null);
  retroDunes(GND - 14, 6, p.near, 0.5, 4.2, 'rgba(255,225,170,.25)');
}
function bgSeaRetro(st) {
  const p = st.retro;
  skyBands(p.sky.slice(0, 2), TOP, TOP + 66);
  bandRect(TOP + 66, GND, p.sky[2]);
  retroCircle(250, TOP + 34, 14, p.sun, true);
  for (let i = 0; i < 5; i++) {
    const cx = ((i * 91 + 40 - G.scrollX * 0.06) % (W + 100)) - 50;
    retroCloud(cx, TOP + 10 + (i % 2) * 15, 26, 'rgba(220,240,255,.30)');
  }
  // острова
  ctx.fillStyle = p.far;
  for (let i = 0; i < 3; i++) {
    const x = ((i * 150 + 30 - G.scrollX * 0.18) % (W + 200)) - 60;
    ctx.fillRect(px(x), TOP + 62, 40, 5);
    ctx.fillRect(px(x + 12), TOP + 57, 14, 6);
  }
  // блики на воде
  for (let y = TOP + 70; y < GND; y += 3) {
    const k = (y - TOP) / (GND - TOP);
    ctx.fillStyle = 'rgba(255,255,255,' + (0.05 + k * 0.12).toFixed(2) + ')';
    const w = 4 + k * 26;
    const x = ((G.scrollX * (0.4 + k)) % (W + 60)) - 30 + Math.sin(y * 0.7) * 30;
    ctx.fillRect(px(x), y, px(w), 1);
  }
  for (let i = 0; i < 12; i++) {
    const y = TOP + 72 + (i * 11) % (GND - TOP - 76);
    const x = ((i * 67 - G.scrollX * 0.5) % (W + 40)) - 20;
    ctx.fillStyle = i % 2 ? 'rgba(120,230,240,.35)' : 'rgba(10,50,70,.5)';
    ctx.fillRect(px(x), y, 10 + (i % 4) * 8, 1);
  }
}
function bgCityRetro(st) {
  const p = st.retro;
  skyBands(p.sky, TOP, GND);
  retroStars('rgba(220,230,255,.75)');
  retroCircle(64, TOP + 30, 12, p.sun, true);
  retroSkyline(GND - 54, p.far, 0.08, 5, null, 0);
  retroSkyline(GND - 30, p.mid, 0.18, 21, 'rgba(255,207,92,.55)', 0.12, 5);
  retroSkyline(GND - 12, p.near, 0.32, 47, 'rgba(57,231,255,.45)', 0.10, 6);
  // неоновые вывески
  const off = -((G.scrollX * 0.32) % (W * 2));
  for (let i = 0; i < 6; i++) {
    const x = ((off + i * 61 + 20) % (W + 80)) - 40;
    ctx.fillStyle = i % 2 ? 'rgba(255,47,156,.65)' : 'rgba(57,231,255,.65)';
    ctx.fillRect(px(x), TOP + 70 + (i * 23) % 60, 2 + (i % 3) * 2, 6);
  }
}
function bgFortressRetro(st) {
  const p = st.retro;
  skyBands(p.sky, TOP, GND);
  // молния
  const lt = (G.time * 0.9 + 1.3) % 4.2;
  if (lt < 0.16) {
    ctx.fillStyle = 'rgba(220,220,255,.22)';
    ctx.fillRect(0, TOP, W, GND - TOP);
  }
  // горы
  ctx.fillStyle = p.far;
  ctx.beginPath();
  ctx.moveTo(0, GND);
  for (let x = 0; x <= W; x += 4) {
    const y = GND - 74 + Math.sin(x * 0.045 + 0.8) * 16 + Math.sin(x * 0.11) * 9;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(W, GND);
  ctx.fill();
  // крепостная стена
  const off = -((G.scrollX * 0.24) % 64);
  ctx.fillStyle = p.mid;
  for (let i = -1; i < W / 32 + 2; i++) {
    const x = px(off + i * 32);
    ctx.fillRect(x, GND - 30, 24, 30);
    ctx.fillRect(x + 3, GND - 34, 6, 5);
    ctx.fillRect(x + 15, GND - 34, 6, 5);
  }
  ctx.fillStyle = 'rgba(255,120,60,.20)';
  for (let i = 0; i < 22; i++) {
    const x = ((i * 41 - G.scrollX * 0.24) % (W + 40)) - 20;
    ctx.fillRect(px(x), GND - 30 + (i * 7) % 26, 3, 2);
  }
  // пепел
  ctx.fillStyle = 'rgba(255,150,110,.35)';
  for (let i = 0; i < 26; i++) {
    const x = (i * 29 + hash01(i) * 30 - G.time * 12) % W;
    const y = TOP + (hash01(i * 3) * (GND - TOP)) + Math.sin(G.time + i) * 4;
    ctx.fillRect(px(x), px(y), 1, 1);
  }
}
function drawGroundRetro() {
  const st = stageCfg();
  const p = st.retro;
  bandRect(GND, H, p.ground[0]);
  bandRect(GND, GND + 2, p.ground[1]);
  bandRect(GND + 14, GND + 17, p.ground[2]);
  bandRect(H - 3, H, p.ground[2]);
  const speed = G.scrollSpeed * 1.4;
  if (st.bg === 'city') {
    ctx.fillStyle = 'rgba(255,207,92,.35)';
    for (let i = 0; i < 14; i++) {
      const x = ((i * 34 - G.scrollX) % (W + 40)) - 20;
      ctx.fillRect(px(x), GND + 8, 10, 1);
    }
  } else if (st.bg === 'sea') {
    for (let i = 0; i < 16; i++) {
      const x = ((i * 27 - G.scrollX * 1.2) % (W + 40)) - 20;
      ctx.fillStyle = 'rgba(110,225,235,.30)';
      ctx.fillRect(px(x), GND + 3 + (i % 4) * 6, 7, 1);
    }
    ctx.fillStyle = p.ground[2];
    for (let i = 0; i < 8; i++) {
      const x = ((i * 53 - G.scrollX * 0.7) % (W + 60)) - 30;
      ctx.fillRect(px(x), GND + 1, 5 + (i % 3) * 4, 2);
    }
  } else {
    for (let i = 0; i < 18; i++) {
      const x = ((i * 31 - G.scrollX * speed) % (W + 60)) - 30;
      const y = GND + 4 + (i * 13) % 22;
      ctx.fillStyle = i % 3 ? 'rgba(0,0,0,.18)' : 'rgba(255,255,255,.16)';
      ctx.fillRect(px(x), px(y), 2 + (i % 3), 1);
    }
  }
}

/* ---- современные фоны ---- */
function modernSky(st) {
  const p = st.modern;
  const g = ctx.createLinearGradient(0, TOP, 0, GND);
  const n = p.sky.length;
  for (let i = 0; i < n; i++) g.addColorStop(i / (n - 1), p.sky[i]);
  ctx.fillStyle = g;
  ctx.fillRect(0, TOP, W, GND - TOP);
}
function modernSun(x, y, r, col, glowCol) {
  const g = ctx.createRadialGradient(x, y, r * 0.1, x, y, r * 2.4);
  g.addColorStop(0, 'rgba(255,245,210,.55)');
  g.addColorStop(0.28, glowCol || 'rgba(255,150,90,.34)');
  g.addColorStop(1, 'rgba(255,150,90,0)');
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x, y, r * 2.6, 0, TAU); ctx.fill();
  ctx.restore();
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
  // синтвейв-полосы
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 5; i++) {
    ctx.fillRect(x - r - 2, y + r * 0.12 + i * (r * 0.19), r * 2 + 4, r * 0.055);
  }
  ctx.restore();
}
function modernStars(st) {
  ctx.fillStyle = 'rgba(200,225,255,.8)';
  for (let i = 0; i < 60; i++) {
    const x = ((hash01(i * 1.7) * (W + 60) - G.scrollX * 0.02) % (W + 60)) - 30;
    const y = TOP + 2 + hash01(i * 5.3) * 100;
    const tw = 0.4 + 0.6 * Math.abs(Math.sin(G.time * 1.4 + i));
    ctx.globalAlpha = tw * 0.8;
    ctx.fillRect(px(x), px(y), 1, 1);
  }
  ctx.globalAlpha = 1;
}
function modernLayer(st, baseY, amp, parallax, color, lineCol, seed) {
  const p = st.modern;
  const off = -((G.scrollX * parallax) % (W * 2));
  const g = ctx.createLinearGradient(0, baseY - amp, 0, GND);
  g.addColorStop(0, color);
  g.addColorStop(1, p.ground[0]);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(0, GND);
  for (let x = 0; x <= W; x += 3) {
    const wx = x - off;
    const y = baseY - amp * (0.4 + 0.6 * Math.sin(wx * 0.012 + seed) * Math.sin(wx * 0.005 + seed * 1.7));
    ctx.lineTo(x, y);
  }
  ctx.lineTo(W, GND);
  ctx.closePath();
  ctx.fill();
  if (lineCol) {
    ctx.save();
    ctx.strokeStyle = lineCol;
    ctx.lineWidth = 0.7;
    ctx.shadowColor = lineCol;
    ctx.shadowBlur = 5;
    ctx.beginPath();
    for (let x = 0; x <= W; x += 3) {
      const wx = x - off;
      const y = baseY - amp * (0.4 + 0.6 * Math.sin(wx * 0.012 + seed) * Math.sin(wx * 0.005 + seed * 1.7));
      if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.restore();
  }
}
function modernSkyline(st, baseY, parallax, color, seed, accent, windowAlpha) {
  const off = -((G.scrollX * parallax) % (W * 3));
  for (let i = 0; i < 20; i++) {
    const bw = 12 + Math.floor(hash01(seed + i * 3.1) * 26);
    const bh = 20 + Math.floor(hash01(seed + i * 7.7) * 70);
    const bx = Math.round(off + i * 36 - 40);
    if (bx > W || bx + bw < 0) continue;
    const g = ctx.createLinearGradient(0, baseY - bh, 0, baseY + 10);
    g.addColorStop(0, color);
    g.addColorStop(1, st.modern.ground[0]);
    ctx.fillStyle = g;
    ctx.fillRect(bx, baseY - bh, bw, bh + 16);
    ctx.save();
    ctx.strokeStyle = accent;
    ctx.globalAlpha = 0.55;
    ctx.shadowColor = accent;
    ctx.shadowBlur = 6;
    ctx.lineWidth = 0.7;
    ctx.strokeRect(bx + 0.35, baseY - bh + 0.35, bw - 0.7, bh + 15);
    ctx.restore();
    ctx.fillStyle = 'rgba(255,255,255,' + (windowAlpha || 0.16) + ')';
    for (let wy = baseY - bh + 5; wy < baseY + 6; wy += 6) {
      for (let wx = bx + 3; wx < bx + bw - 3; wx += 5) {
        if (hash01(seed + i * 13.7 + wx * 0.7 + wy * 0.31) < 0.32) {
          ctx.fillStyle = hash01(wx + wy) > 0.5 ? accent : 'rgba(255,220,150,.7)';
          ctx.fillRect(wx, wy, 1.4, 1.4);
        }
      }
    }
  }
}
function bgDesertModern(st) {
  modernSky(st);
  modernSun(238, TOP + 48, 17, '#fff4cf', 'rgba(255,120,70,.6)');
  modernLayer(st, GND - 58, 14, 0.10, st.modern.far, null, 0.5);
  modernLayer(st, GND - 32, 10, 0.22, st.modern.mid, 'rgba(255,120,90,.5)', 2.2);
  modernLayer(st, GND - 12, 7, 0.46, st.modern.near, 'rgba(57,231,255,.45)', 4.4);
  // пыль в воздухе
  ctx.save();
  for (let i = 0; i < 22; i++) {
    const x = ((i * 37 + Math.sin(G.time * 0.4 + i) * 20 - G.scrollX * 0.3) % (W + 30)) - 15;
    const y = TOP + 40 + hash01(i * 4.1) * (GND - TOP - 40);
    ctx.fillStyle = 'rgba(255,190,140,.22)';
    ctx.fillRect(px(x), px(y), 1, 1);
  }
  ctx.restore();
}
function bgSeaModern(st) {
  modernSky(st);
  modernSun(246, TOP + 40, 15, '#f2fff9', 'rgba(80,240,220,.5)');
  // море
  const sea = ctx.createLinearGradient(0, TOP + 62, 0, GND);
  sea.addColorStop(0, '#0a4f60');
  sea.addColorStop(0.5, '#073a4c');
  sea.addColorStop(1, '#041e2a');
  ctx.fillStyle = sea;
  ctx.fillRect(0, TOP + 62, W, GND - TOP - 62);
  // закатные дорожки
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 18; i++) {
    const y = TOP + 68 + i * 6;
    const w = 20 + i * 10 + Math.sin(G.time * 1.2 + i) * 8;
    const x = 246 - w / 2 + Math.sin(i * 2.1 + G.time) * 6;
    ctx.fillStyle = 'rgba(120,240,220,' + (0.10 - i * 0.004) + ')';
    ctx.fillRect(x, y, w, 1.2);
  }
  ctx.restore();
  // острова
  ctx.fillStyle = st.modern.far;
  for (let i = 0; i < 3; i++) {
    const x = ((i * 150 + 30 - G.scrollX * 0.16) % (W + 200)) - 60;
    ctx.beginPath();
    ctx.moveTo(x, TOP + 64);
    ctx.quadraticCurveTo(x + 18, TOP + 54, x + 40, TOP + 64);
    ctx.fill();
    ctx.fillStyle = 'rgba(57,231,255,.4)';
    ctx.fillRect(x + 4, TOP + 64, 30, 0.8);
    ctx.fillStyle = st.modern.far;
  }
  // блики волн
  for (let i = 0; i < 16; i++) {
    const y = TOP + 74 + (i * 7.3) % (GND - TOP - 76);
    const x = ((i * 61 - G.scrollX * 0.7) % (W + 60)) - 30;
    ctx.fillStyle = i % 3 ? 'rgba(140,255,235,.18)' : 'rgba(140,255,235,.32)';
    ctx.fillRect(x, y, 12 + (i % 4) * 10, 0.9);
  }
}
function bgCityModern(st) {
  modernSky(st);
  modernStars(st);
  // неоновая луна
  ctx.save();
  ctx.shadowColor = '#9fe8ff';
  ctx.shadowBlur = 22;
  ctx.fillStyle = 'rgba(220,240,255,.9)';
  ctx.beginPath(); ctx.arc(62, TOP + 32, 9, 0, TAU); ctx.fill();
  ctx.restore();
  modernSkyline(st, GND - 40, 0.07, '#0a0a22', 5, 'rgba(57,231,255,.6)', 0.10);
  modernSkyline(st, GND - 22, 0.16, '#131238', 21, 'rgba(255,47,156,.6)', 0.14);
  modernSkyline(st, GND - 8, 0.30, '#1d1746', 47, 'rgba(255,47,156,.8)', 0.16);
  // туман
  const fog = ctx.createLinearGradient(0, GND - 60, 0, GND);
  fog.addColorStop(0, 'rgba(255,47,156,0)');
  fog.addColorStop(1, 'rgba(255,47,156,.16)');
  ctx.fillStyle = fog;
  ctx.fillRect(0, GND - 60, W, 60);
  // летающие огни
  for (let i = 0; i < 7; i++) {
    const x = ((i * 57 - G.scrollX * 0.5 + Math.sin(G.time * 0.7 + i) * 18) % (W + 40)) - 20;
    const y = TOP + 26 + hash01(i * 8.2) * 60;
    ctx.save();
    ctx.shadowColor = i % 2 ? '#39e7ff' : '#ff2f9c';
    ctx.shadowBlur = 8;
    ctx.fillStyle = i % 2 ? '#8ff4ff' : '#ff9ad6';
    ctx.fillRect(x, y, 2, 1.2);
    ctx.restore();
  }
}
function bgFortressModern(st) {
  modernSky(st);
  // тяжелые облака
  const cloudG = ctx.createLinearGradient(0, TOP, 0, GND - 50);
  cloudG.addColorStop(0, 'rgba(10,4,8,.85)');
  cloudG.addColorStop(1, 'rgba(10,4,8,0)');
  ctx.fillStyle = cloudG;
  ctx.fillRect(0, TOP, W, GND - TOP - 40);
  // молния
  const lt = (G.time * 0.8 + 0.6) % 3.6;
  if (lt < 0.22) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = 'rgba(255,120,90,' + (0.22 * (1 - lt / 0.22)).toFixed(2) + ')';
    ctx.fillRect(0, TOP, W, GND - TOP);
    ctx.restore();
    if (lt < 0.1) {
      ctx.strokeStyle = 'rgba(255,220,200,.85)';
      ctx.lineWidth = 1.2;
      ctx.shadowColor = '#ff6b3d';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      const bx = 190 + (Math.floor(G.time) % 3) * 40;
      ctx.moveTo(bx, TOP);
      ctx.lineTo(bx - 8, TOP + 30);
      ctx.lineTo(bx + 4, TOP + 34);
      ctx.lineTo(bx - 10, TOP + 68);
      ctx.stroke();
    }
  }
  modernLayer(st, GND - 62, 16, 0.10, st.modern.far, null, 1.2);
  modernLayer(st, GND - 34, 11, 0.22, st.modern.mid, 'rgba(255,90,50,.5)', 3.1);
  modernLayer(st, GND - 14, 7, 0.42, st.modern.near, 'rgba(255,209,102,.45)', 5.2);
  // лава в расщелинах
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 8; i++) {
    const x = ((i * 47 - G.scrollX * 0.42) % (W + 40)) - 20;
    ctx.fillStyle = 'rgba(255,90,40,.25)';
    ctx.fillRect(x, GND - 4, 8, 2);
  }
  ctx.restore();
  // угли
  for (let i = 0; i < 20; i++) {
    const x = ((i * 31 + Math.sin(G.time + i) * 10 - G.scrollX * 0.9) % (W + 30)) - 15;
    const y = GND - ((G.time * 18 + i * 29) % 90);
    ctx.fillStyle = 'rgba(255,140,80,.6)';
    ctx.fillRect(x, y, 1, 1);
  }
}
function drawGroundModern() {
  const st = stageCfg();
  const p = st.modern;
  const g = ctx.createLinearGradient(0, GND, 0, H);
  g.addColorStop(0, p.ground[0]);
  g.addColorStop(1, p.ground[1] || p.ground[0]);
  ctx.fillStyle = g;
  ctx.fillRect(0, GND, W, H - GND);
  // светящаяся кромка
  ctx.save();
  ctx.strokeStyle = p.accent;
  ctx.globalAlpha = 0.6;
  ctx.shadowColor = p.accent;
  ctx.shadowBlur = 10;
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, GND + 0.5); ctx.lineTo(W, GND + 0.5); ctx.stroke();
  ctx.restore();
  // быстрые плашки — ощущение скорости
  for (let i = 0; i < 20; i++) {
    const x = ((i * 43 - G.scrollX * 1.35) % (W + 80)) - 40;
    const y = GND + 3 + (i * 7) % 21;
    ctx.fillStyle = 'rgba(255,255,255,.055)';
    ctx.fillRect(x, y, 7 + (i % 4) * 6, 1);
  }
  for (let i = 0; i < 7; i++) {
    const x = ((i * 63 - G.scrollX * 2.4) % (W + 90)) - 45;
    ctx.fillStyle = p.accent;
    ctx.globalAlpha = 0.16;
    ctx.fillRect(x, GND + 2.5, 26, 1);
    ctx.globalAlpha = 1;
  }
  if (st.bg === 'sea') {
    ctx.fillStyle = 'rgba(140,255,235,.30)';
    for (let i = 0; i < 12; i++) {
      const x = ((i * 37 - G.scrollX * 1.2) % (W + 40)) - 20;
      ctx.fillRect(x, GND + 3 + (i % 3) * 5, 9, 0.8);
    }
  } else if (st.bg === 'city') {
    ctx.fillStyle = 'rgba(255,47,156,.35)';
    for (let i = 0; i < 12; i++) {
      const x = ((i * 34 - G.scrollX * 1.6) % (W + 40)) - 20;
      ctx.fillRect(x, GND + 10, 12, 1);
    }
  } else if (st.bg === 'fortress') {
    ctx.fillStyle = 'rgba(255,120,60,.28)';
    for (let i = 0; i < 14; i++) {
      const x = ((i * 29 - G.scrollX * 1.1) % (W + 40)) - 20;
      ctx.fillRect(x, GND + 5 + (i * 5) % 16, 4, 1);
    }
  }
  // отражение неона
  const grd = ctx.createLinearGradient(0, GND, 0, GND + 26);
  grd.addColorStop(0, p.accent + '30');
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grd;
  ctx.fillRect(0, GND, W, 26);
  // нижняя тень
  const bot = ctx.createLinearGradient(0, H - 10, 0, H);
  bot.addColorStop(0, 'rgba(0,0,0,0)');
  bot.addColorStop(1, 'rgba(0,0,0,.55)');
  ctx.fillStyle = bot;
  ctx.fillRect(0, H - 10, W, 10);
}

function drawBackground() {
  const st = stageCfg();
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, TOP, W, GND - TOP);
  ctx.clip();
  if (GFX === 'retro') {
    if (st.bg === 'desert') bgDesertRetro(st);
    else if (st.bg === 'sea') bgSeaRetro(st);
    else if (st.bg === 'city') bgCityRetro(st);
    else bgFortressRetro(st);
  } else {
    if (st.bg === 'desert') bgDesertModern(st);
    else if (st.bg === 'sea') bgSeaModern(st);
    else if (st.bg === 'city') bgCityModern(st);
    else bgFortressModern(st);
  }
  ctx.restore();
  if (GFX === 'retro') drawGroundRetro(); else drawGroundModern();
}

/* -------------------------------------------------------------------------
   13. Игровые сущности: игрок, враги, пули, бонусы
   ------------------------------------------------------------------------- */
const ENEMY_DEFS = {
  tank:  { w: 18, h: 11, hp: 3, score: 100, fire: 2.1, vx: -14, ground: true },
  aa:    { w: 16, h: 12, hp: 5, score: 150, fire: 2.4, vx: -6, ground: true },
  kite: { w: 24, h: 12, hp: 3, score: 200, fire: 1.7, vx: -56, air: true },
  jet:   { w: 20, h: 9,  hp: 2, score: 150, fire: 1.3, vx: -168, air: true },
  truck: { w: 16, h: 10, hp: 2, score: 50,  fire: 0,  vx: -18, ground: true }
};

function makePlayer() {
  return {
    x: 62, y: 116, vx: 0, vy: 0,
    w: 22, h: 10, fireCd: 0, bombCd: 0,
    weapon: G.weapon, shield: 0, invuln: 2.4,
    dead: false, deadT: 0, rotor: 0, tilt: 0, muzzle: 0, hitT: 0
  };
}
function resetRun() {
  G.score = 0; G.lives = 3; G.bombs = 2; G.weapon = 1;
  G.enemies = []; G.bullets = []; G.ebullets = []; G.pickups = []; G.parts = [];
  G.boss = null; G.shake = 0; G.flash = 0; G.msg = ''; G.msgT = 0;
  G.player = null;
}
function startStage(idx) {
  const st = STAGES[clamp(idx, 0, STAGES.length - 1)];
  G.stage = clamp(idx, 0, STAGES.length - 1);
  G.phase = 'intro'; G.phaseT = 0;
  G.scrollX = 0; G.scrollSpeed = st.scroll; G.worldT = 0;
  G.waves = makeWaves(G.stage); G.waveIdx = 0;
  G.enemies = []; G.bullets = []; G.ebullets = []; G.pickups = []; G.parts = [];
  G.boss = null; G.bossWarnT = 0; G.clearT = 0;
  G.stageTip = LANG === 'ru' ? st.tipRu : st.tipEn;
  G.player = makePlayer();
  G.player.weapon = G.weapon;
  G.player.shield = 0;
  G.msg = ''; G.msgT = 0;
  Sound.music('stage');
}
function newGame() {
  resetRun();
  G.runStartHi = G.hi;
  G.newHi = false;
  G.state = 'play';
  G.frame = 0;
  startStage(0);
}

/* ---- волны врагов: детерминированное расписание на каждую зону ---- */
function makeWaves(stageIdx) {
  const st = STAGES[clamp(stageIdx, 0, STAGES.length - 1)];
  const rnd = mulberry32(st.seed * 7919 + 13);
  const mix = st.mix;
  let total = 0;
  for (const m of mix) total += m[1];
  const list = [];
  let at = 480;
  while (at < st.len - 340) {
    let r = rnd() * total, kind = mix[0][0];
    for (const m of mix) { r -= m[1]; if (r <= 0) { kind = m[0]; break; } }
    const air = kind === 'kite' || kind === 'jet';
    const group = (kind === 'tank' || kind === 'truck') ? (rnd() < 0.34 ? 2 : 1) : (air && rnd() < 0.38 ? 2 : 1);
    for (let g = 0; g < group; g++) {
      list.push({
        at: at + g * 70,
        type: kind,
        y: air ? 34 + rnd() * 96 : 0,
        wob: rnd() * TAU
      });
    }
    at += 230 + rnd() * 250 - stageIdx * 16;
    if (rnd() < 0.13) at += 300;
  }
  return list.sort((a, b) => a.at - b.at);
}

function spawnEnemy(type, y) {
  const d = ENEMY_DEFS[type];
  if (!d) return null;
  const e = {
    type, x: W + 26, y: d.ground ? GND - d.h / 2 - 1 : clamp(y || 80, FIELD_TOP + 14, GND - 26),
    w: d.w, h: d.h, hp: d.hp + (G.stage >= 2 ? 1 : 0), maxhp: d.hp + (G.stage >= 2 ? 1 : 0),
    score: d.score, vx: d.vx, vy: 0, t: 0, fireT: 0.8 + rng() * (d.fire || 1),
    dead: false, ground: !!d.ground, wob: rng() * TAU, baseY: 0, flash: 0, open: false
  };
  e.baseY = e.y;
  G.enemies.push(e);
  return e;
}

function playerShoot() {
  const p = G.player;
  const lvl = clamp(p.weapon, 1, 4);
  const bx = p.x + 13, by = p.y;
  const shots = [];
  if (lvl === 1) shots.push([bx, by, 0]);
  else if (lvl === 2) { shots.push([bx, by - 3, 0]); shots.push([bx, by + 3, 0]); }
  else if (lvl === 3) { shots.push([bx, by, 0]); shots.push([bx, by - 3, -0.16]); shots.push([bx, by + 3, 0.16]); }
  else { shots.push([bx, by - 3, 0]); shots.push([bx, by + 3, 0]); shots.push([bx, by - 4, -0.22]); shots.push([bx, by + 4, 0.22]); }
  for (const s of shots) {
    G.bullets.push({
      x: s[0], y: s[1], vx: 430 * Math.cos(s[2]), vy: 430 * Math.sin(s[2]),
      w: 7, h: 3, dmg: 1, life: 2.4, kind: lvl >= 3 ? 'heavy' : 'std'
    });
  }
  p.muzzle = 0.06;
  p.fireCd = 0.088;
  if (G.frame % 2 === 0) Sound.sfx('shoot');
}
function enemyFire(e, tx, ty, speed, count, spread, col) {
  const p = G.player;
  const baseA = Math.atan2(ty - e.y, tx - e.x);
  count = count || 1;
  spread = spread || 0;
  for (let i = 0; i < count; i++) {
    const a = baseA + (count > 1 ? (i - (count - 1) / 2) * spread : 0);
    G.ebullets.push({
      x: e.x, y: e.y,
      vx: Math.cos(a) * speed, vy: Math.sin(a) * speed,
      w: 4, h: 4, life: 5, col: col || '#ff8a5a', t: 0
    });
  }
  if (e.x < W - 4) Sound.sfx('enemyShoot');
}

function useBomb() {
  const p = G.player;
  if (!p || p.dead || p.bombCd > 0) return;
  if (G.bombs <= 0) { Sound.sfx('select'); return; }
  G.bombs--;
  p.bombCd = 0.7;
  G.flash = 0.7;
  G.shake = 8;
  Sound.sfx('bomb');
  for (const e of G.enemies) damageEnemy(e, 6, true);
  if (G.boss && !G.boss.dead) damageBoss(12);
  G.ebullets.length = 0;
  addPart(p.x, p.y, { life: 0.6, size: 40, col: '#9fe8ff', kind: 'ring' });
  addPart(p.x, p.y, { life: 0.4, size: 20, col: '#ffffff', kind: 'ring' });
  for (let i = 0; i < 26; i++) {
    const a = rng() * TAU;
    addPart(p.x, p.y, { vx: Math.cos(a) * 210, vy: Math.sin(a) * 210, life: 0.5, size: 1.4, col: '#9fe8ff', kind: 'spark', drag: 0.92 });
  }
}

function damageEnemy(e, dmg, silent) {
  if (e.dead) return;
  if (e.type === 'aa' && !e.open && !silent) {
    sparkHit(e.x + 4, e.y, '#d8e8f0');
    Sound.sfx('hit');
    return;
  }
  e.hp -= dmg;
  e.flash = 0.14;
  if (e.hp > 0) {
    if (!silent) { sparkHit(e.x + 6, e.y, '#ffe08a'); Sound.sfx('hit'); }
    return;
  }
  e.dead = true;
  killEnemy(e);
}
function killEnemy(e) {
  G.score += e.score;
  boom(e.x, e.y, e.ground ? 7 : 9, e.ground ? '#ffb347' : '#ff8a5a');
  Sound.sfx('explosion');
  const dropChance = e.type === 'truck' ? 1 : 0.17;
  if (rng() < dropChance) dropPickup(e.x, e.y);
}
function dropPickup(x, y) {
  const r = rng();
  let type = 'P';
  if (r < 0.03) type = '1UP';
  else if (r < 0.32) type = 'S';
  else if (r < 0.55) type = 'B';
  G.pickups.push({ x, y, w: 10, h: 10, type, vy: 30, t: 0, bob: rng() * TAU });
}
function applyPickup(pu) {
  const p = G.player;
  if (pu.type === 'P') {
    if (p.weapon < 4) { p.weapon++; G.weapon = p.weapon; G.msg = t('weaponUp') + ' ' + p.weapon; }
    else { G.score += 500; G.msg = '+500'; }
    Sound.sfx('powerup');
  } else if (pu.type === 'S') {
    p.shield = Math.min(2, p.shield + 1); G.msg = t('shieldUp');
    Sound.sfx('powerup');
  } else if (pu.type === 'B') {
    G.bombs = Math.min(5, G.bombs + 1); G.msg = t('bombUp');
    Sound.sfx('powerup');
  } else if (pu.type === '1UP') {
    G.lives++; G.msg = t('extraLife');
    Sound.sfx('powerup');
  }
  G.msgT = 1.4;
}
function screenBomb(x, y) {
  G.flash = 0.55; G.shake = 7;
  Sound.sfx('bigExplosion');
  for (const e of G.enemies) damageEnemy(e, 6, true);
  if (G.boss && !G.boss.dead) damageBoss(10);
  G.ebullets.length = 0;
  addPart(x, y, { life: 0.7, size: 64, col: '#6fe3ff', kind: 'ring' });
  boom(x, y, 12, '#9fe8ff');
}

/* -------------------------------------------------------------------------
   14. Босс зоны
   ------------------------------------------------------------------------- */
function spawnBoss() {
  const st = stageCfg();
  const b = {
    x: W + 60, y: 108, w: 64, h: 40,
    hp: st.boss.hp, maxhp: st.boss.hp,
    t: 0, fireT: 1.4, dead: false, dying: 0, hitT: 0,
    entering: true, name: LANG === 'ru' ? st.boss.ru : st.boss.en
  };
  G.boss = b;
}
function damageBoss(dmg) {
  const b = G.boss;
  if (!b || b.dead) return;
  b.hp -= dmg;
  b.hitT = 0.1;
  Sound.sfx('bossHit');
  if (b.hp <= 0) {
    b.hp = 0;
    b.dead = true; b.dying = 0.001;
    G.score += 5000;
    G.ebullets.length = 0;
    Sound.sfx('bigExplosion');
    G.shake = 10;
  }
}
function updateBoss(dt) {
  const b = G.boss;
  if (!b) return;
  b.t += dt;
  b.hitT = Math.max(0, b.hitT - dt);
  if (b.dead) {
    b.dying += dt;
    if (b.dying < 1.7) {
      if (G.frame % 4 === 0) {
        const ox = (rng() - 0.5) * b.w, oy = (rng() - 0.5) * b.h;
        boom(b.x + ox, b.y + oy, 6 + rng() * 7);
      }
      b.x -= dt * 6;
      b.y += dt * 4;
      G.shake = Math.max(G.shake, 4);
    } else if (G.phase === 'boss') {
      finishStage();
    }
    return;
  }
  if (b.entering) {
    b.x -= dt * 90;
    if (b.x <= W - 78) { b.x = W - 78; b.entering = false; }
    return;
  }
  b.x = W - 78 + Math.sin(b.t * 0.8) * 9;
  b.y = 106 + Math.sin(b.t * 1.1) * 26;
  const frac = b.hp / b.maxhp;
  const rage = frac < 0.34 ? 1 : (frac < 0.67 ? 0.6 : 0.3);
  b.fireT -= dt;
  if (b.fireT <= 0) {
    const p = G.player;
    if (p && !p.dead) {
      if (frac > 0.67) {
        enemyFire(b, p.x, p.y, 135, 3, 0.2, '#ffb347');
        b.fireT = 1.55 - G.stage * 0.05;
      } else if (frac > 0.34) {
        enemyFire(b, p.x, p.y, 150, 5, 0.17, '#ff8a5a');
        // нижний залп
        for (let i = -1; i <= 1; i++) {
          G.ebullets.push({ x: b.x + i * 18, y: b.y + 16, vx: i * 26, vy: 150, w: 4, h: 4, life: 5, col: '#ffd166', t: 0 });
        }
        b.fireT = 1.25 - G.stage * 0.04;
      } else {
        enemyFire(b, p.x, p.y, 168, 7, 0.15, '#ff5a2b');
        for (let i = 0; i < 4; i++) {
          G.ebullets.push({ x: b.x - 20 + i * 12, y: b.y + 14, vx: (rng() - 0.5) * 60, vy: 160, w: 4, h: 4, life: 5, col: '#ff2f9c', t: 0 });
        }
        b.fireT = 0.85;
      }
      Sound.sfx('enemyShoot');
    } else b.fireT = 0.8;
  }
  // контакт с игроком
  const p = G.player;
  if (p && !p.dead) {
    if (rectHit(p.x, p.y, 9, 7, b.x, b.y, b.w * 0.8, b.h * 0.8)) playerHit();
  }
  G.shake = Math.max(G.shake, 1.2 + rage);
}

function finishStage() {
  const st = stageCfg();
  G.phase = 'clear';
  G.clearT = 0;
  G.bonus = 1000 + (G.player ? G.player.weapon * 500 : 0) + G.lives * 500;
  G.bonusShown = 0;
  G.score += G.bonus;
  G.ebullets.length = 0;
  Sound.music('clear');
  if (G.score > G.hi) { G.hi = G.score; saveHi(G.hi); }
}
function nextStage() {
  if (G.stage >= STAGES.length - 1) {
    G.state = 'victory';
    G.phase = 'waves';
    G.boss = null;
    G.victoryT = 0;
    Sound.music('clear');
    if (G.score > G.hi) { G.hi = G.score; saveHi(G.hi); }
  } else {
    startStage(G.stage + 1);
  }
}

/* -------------------------------------------------------------------------
   15. Урон игроку и респаун
   ------------------------------------------------------------------------- */
function playerHit() {
  const p = G.player;
  if (!p || p.dead || p.invuln > 0) return;
  if (p.shield > 0) {
    p.shield--;
    p.invuln = 1.2;
    G.flash = 0.3;
    addPart(p.x, p.y, { life: 0.35, size: 22, col: '#6fe3ff', kind: 'ring' });
    Sound.sfx('hit');
    return;
  }
  p.dead = true; p.deadT = 0;
  G.lives--;
  G.flash = 0.6;
  G.shake = 9;
  boom(p.x, p.y, 12, '#ffb347');
  boom(p.x + 2, p.y - 2, 9, '#ff5a2b');
  Sound.sfx('death');
  if (G.score > G.hi) { G.hi = G.score; saveHi(G.hi); }
}
function endGame() {
  G.state = 'gameover';
  G.goT = 0;
  G.newHi = G.score > 0 && G.score > (G.runStartHi || 0);
  if (G.score > G.hi) { G.hi = G.score; saveHi(G.hi); }
  Sound.music('gameover');
}

/* -------------------------------------------------------------------------
   16. Обновление игрового процесса
   ------------------------------------------------------------------------- */
function updatePlayer(dt) {
  const p = G.player;
  if (!p) return;
  p.rotor += dt;
  p.muzzle = Math.max(0, p.muzzle - dt);
  p.invuln = Math.max(0, p.invuln - dt);
  p.bombCd = Math.max(0, p.bombCd - dt);
  p.hitT = Math.max(0, p.hitT - dt);
  if (p.dead) {
    p.deadT += dt;
    if (G.lives <= 0) {
      if (p.deadT > 1.7) endGame();
    } else if (p.deadT > 1.1) {
      const fresh = makePlayer();
      fresh.weapon = p.weapon;
      fresh.shield = 0;
      G.player = fresh;
      G.weapon = fresh.weapon;
    }
    return;
  }
  let ax = 0, ay = 0;
  if (Input.press('left')) ax -= 1;
  if (Input.press('right')) ax += 1;
  if (Input.press('up')) ay -= 1;
  if (Input.press('down')) ay += 1;
  if (Input.touch.active) {
    const tx = clamp(Input.touch.x, 0, W);
    ax = sign(tx - p.x);
    ay = sign(Input.touch.y - p.y);
  }
  const len = Math.hypot(ax, ay) || 1;
  ax /= len; ay /= len;
  const accel = 1500, maxV = 168;
  p.vx += ax * accel * dt;
  p.vy += ay * accel * dt;
  const fr = Math.pow(0.0015, dt);
  if (ax === 0) p.vx *= fr; else p.vx = clamp(p.vx, -maxV, maxV);
  if (ay === 0) p.vy *= fr; else p.vy = clamp(p.vy, -maxV, maxV);
  p.vx = clamp(p.vx, -maxV, maxV);
  p.vy = clamp(p.vy, -maxV, maxV);
  p.x += p.vx * dt;
  p.y += p.vy * dt;
  p.x = clamp(p.x, 16, W - 26);
  p.y = clamp(p.y, FIELD_TOP + 12, GND - 10);
  p.tilt = lerp(p.tilt, clamp(p.vy / 320, -0.45, 0.45), 1 - Math.pow(0.001, dt));

  p.fireCd -= dt;
  const firing = Input.press('fire') || Input.press('Space') || Input.touch.fire;
  if (firing && p.fireCd <= 0) playerShoot();
  if (Input.just('bomb')) useBomb();
}

function updateEnemies(dt) {
  const p = G.player;
  const pl = (p && !p.dead) ? p : null;
  for (let i = G.enemies.length - 1; i >= 0; i--) {
    const e = G.enemies[i];
    e.t += dt;
    e.flash = Math.max(0, e.flash - dt);
    if (e.dead || e.x < -46) { G.enemies.splice(i, 1); continue; }
    const drift = G.scrollSpeed * (e.ground ? 1 : 0.65);
    e.x -= drift * dt;
    e.x += e.vx * dt;
    if (e.type === 'kite') {
      e.y = e.baseY + Math.sin(e.t * 2.2 + e.wob) * 24;
      e.y = clamp(e.y, FIELD_TOP + 14, GND - 28);
    } else if (e.type === 'jet') {
      e.y += Math.sin(e.t * 3) * 6 * dt;
    }
    if (e.type === 'aa') {
      const cyc = e.t % 3.1;
      e.open = cyc > 1.9;
    }
    if (pl) {
      // огонь
      e.fireT -= dt;
      const distOk = e.x < W - 8 && e.x > -20;
      if (e.fireT <= 0 && distOk && ENEMY_DEFS[e.type].fire) {
        const diff = 1 + G.stage * 0.08;
        if (e.type === 'tank') {
          enemyFire(e, pl.x, pl.y, 118 * diff, 1, 0, '#ffd166');
          e.fireT = 2.1 / diff + rng() * 0.5;
        } else if (e.type === 'aa') {
          if (e.open) { enemyFire(e, pl.x, pl.y, 130 * diff, 3, 0.16, '#ff8a5a'); e.fireT = 2.5 / diff; }
          else e.fireT = 0.5;
        } else if (e.type === 'kite') {
          enemyFire(e, pl.x, pl.y, 130 * diff, 1, 0, '#ffb0b0');
          e.fireT = 1.8 / diff + rng() * 0.4;
        } else if (e.type === 'jet') {
          enemyFire(e, pl.x, pl.y, 190 * diff, 1, 0, '#ffd166');
          e.fireT = 1.2;
        }
      }
      // контакт
      if (rectHit(pl.x, pl.y, 9, 7, e.x, e.y, e.w * 0.8, e.h * 0.8)) {
        damageEnemy(e, 3, true);
        playerHit();
      }
    }
  }
}

function updateBullets(dt) {
  for (let i = G.bullets.length - 1; i >= 0; i--) {
    const b = G.bullets[i];
    b.life -= dt;
    b.x += b.vx * dt; b.y += b.vy * dt;
    if (b.life <= 0 || b.x > W + 20 || b.y < TOP - 10 || b.y > H + 10) { G.bullets.splice(i, 1); continue; }
    let hitSomething = false;
    for (const e of G.enemies) {
      if (e.dead) continue;
      if (rectHit(b.x, b.y, b.w, b.h, e.x, e.y, e.w * 0.82, e.h * 0.82)) {
        damageEnemy(e, b.dmg);
        hitSomething = true; break;
      }
    }
    if (!hitSomething && G.boss && !G.boss.dead) {
      const bs = G.boss;
      if (rectHit(b.x, b.y, b.w, b.h, bs.x, bs.y, bs.w * 0.82, bs.h * 0.82)) {
        damageBoss(b.dmg);
        hitSomething = true;
      }
    }
    if (!hitSomething) {
      for (const pu of G.pickups) {
        if (pu.type === 'S' && rectHit(b.x, b.y, b.w, b.h, pu.x, pu.y, pu.w, pu.h)) {
          screenBomb(pu.x, pu.y);
          G.pickups.splice(G.pickups.indexOf(pu), 1);
          hitSomething = true; break;
        }
      }
    }
    if (hitSomething) G.bullets.splice(i, 1);
  }
  for (let i = G.ebullets.length - 1; i >= 0; i--) {
    const b = G.ebullets[i];
    b.life -= dt; b.t += dt;
    b.x += b.vx * dt; b.y += b.vy * dt;
    if (b.life <= 0 || b.x < -20 || b.x > W + 20 || b.y < TOP - 20 || b.y > H + 20) {
      G.ebullets.splice(i, 1); continue;
    }
    const p = G.player;
    if (p && !p.dead && rectHit(b.x, b.y, b.w, b.h, p.x, p.y, 8, 6)) {
      G.ebullets.splice(i, 1);
      playerHit();
    }
  }
}

function updatePickups(dt) {
  const p = G.player;
  for (let i = G.pickups.length - 1; i >= 0; i--) {
    const pu = G.pickups[i];
    pu.t += dt;
    pu.y += pu.vy * dt;
    pu.x -= G.scrollSpeed * dt;
    if (pu.y > GND - 4) { pu.y = GND - 4; pu.vy = 0; }
    if (pu.x < -20 || pu.t > 14) { G.pickups.splice(i, 1); continue; }
    if (p && !p.dead && rectHit(pu.x, pu.y, 12, 12, p.x, p.y, 14, 10)) {
      applyPickup(pu);
      G.pickups.splice(i, 1);
      continue;
    }
  }
}

function updateAmbient(dt) {
  if (GFX === 'retro') return;
  const st = stageCfg();
  if (Math.random() < dt * 14) {
    const x = W + 6, y = TOP + 20 + Math.random() * (GND - TOP - 40);
    if (st.bg === 'desert') addPart(x, y, { vx: -60 - Math.random() * 40, vy: 4, life: 2.4, size: 1, col: 'rgba(255,190,140,.5)', kind: 'spark', drag: 1 });
    else if (st.bg === 'sea') addPart(x, y + 40, { vx: -40, vy: 30, life: 1.8, size: 1, col: 'rgba(140,255,235,.35)', kind: 'spark', drag: 1 });
    else if (st.bg === 'city') addPart(x, y, { vx: -50, vy: 8, life: 2.2, size: 1, col: Math.random() < 0.5 ? 'rgba(255,47,156,.50)' : 'rgba(57,231,255,.50)', kind: 'spark', drag: 1 });
    else addPart(x, y, { vx: -40, vy: 22, life: 2.4, size: 1.2, col: 'rgba(255,120,70,.55)', kind: 'spark', drag: 1 });
  }
}

function updatePlay(dt) {
  if (G.freeze) return;
  G.worldT += dt;
  G.msgT = Math.max(0, G.msgT - dt);
  G.flash = Math.max(0, G.flash - dt * 2);

  if (G.phase === 'intro') {
    G.phaseT += dt;
    if (G.phaseT > 2.4) { G.phase = 'waves'; G.phaseT = 0; }
  } else if (G.phase === 'waves') {
    const st = stageCfg();
    G.scrollSpeed = st.scroll;
    G.scrollX += G.scrollSpeed * dt;
    while (G.waveIdx < G.waves.length && G.waves[G.waveIdx].at <= G.scrollX) {
      const wv = G.waves[G.waveIdx++];
      spawnEnemy(wv.type, wv.y);
    }
    if (G.scrollX >= st.len) {
      G.phase = 'warn'; G.bossWarnT = 2.4; G.scrollSpeed = 0;
      G.msg = t('bossIncoming'); G.msgT = 2.4;
      Sound.sfx('warning');
      Sound.music('boss');
    }
  } else if (G.phase === 'warn') {
    G.bossWarnT -= dt;
    if (G.bossWarnT <= 0) { G.phase = 'boss'; spawnBoss(); }
  } else if (G.phase === 'boss') {
    G.scrollSpeed = 0;
    updateBoss(dt);
  } else if (G.phase === 'clear') {
    G.clearT += dt;
    if (G.clearT > 0.2) G.bonusShown = Math.min(G.bonus, G.bonusShown + G.bonus * dt * 1.4);
    if (G.clearT > 4.6) nextStage();
  }

  updatePlayer(dt);
  updateEnemies(dt);
  updateBullets(dt);
  updatePickups(dt);
  updateParts(dt);
  updateAmbient(dt);

  // столкновение с бонусами уже в updatePickups; босс дотронулся — в updateBoss
}

/* -------------------------------------------------------------------------
   17. Отрисовка мира: общие помощники
   ------------------------------------------------------------------------- */
function rr(x, y, w, h, r) {
  ctx.beginPath();
  const rad = Math.min(r, w / 2, h / 2);
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}
function shadowAt(x, y, rx, ry, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha === undefined ? 0.22 : alpha;
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function drawParticles() {
  if (!G.parts.length) return;
  if (GFX === 'retro') {
    for (const p of G.parts) {
      const a = clamp(p.life / p.max, 0, 1);
      ctx.globalAlpha = a;
      if (p.kind === 'ring') {
        ctx.strokeStyle = p.col; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(1, (1 - a) * p.size * 2.4 + 2), 0, TAU); ctx.stroke();
      } else if (p.kind === 'flare') {
        ctx.fillStyle = '#fff';
        const s = Math.max(1, p.size * 2 * a);
        ctx.fillRect(px(p.x - s), px(p.y - s / 2), px(s * 2), px(s / 2) || 1);
      } else if (p.kind === 'smoke') {
        ctx.fillStyle = 'rgba(52,48,56,1)';
        const s = Math.max(1, p.size * (1.2 - a * 0.3));
        ctx.fillRect(px(p.x - s / 2), px(p.y - s / 2), px(s), px(s));
      } else {
        ctx.fillStyle = p.col;
        const s = Math.max(1, p.size);
        ctx.fillRect(px(p.x), px(p.y), px(s), px(s));
      }
    }
    ctx.globalAlpha = 1;
    return;
  }
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const p of G.parts) {
    const a = clamp(p.life / p.max, 0, 1);
    if (p.kind === 'ring') {
      ctx.globalAlpha = a * 0.6;
      ctx.strokeStyle = p.col;
      ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(1, (1 - a) * p.size * 2.4 + 2), 0, TAU); ctx.stroke();
      continue;
    }
    if (p.kind === 'flare') {
      ctx.globalAlpha = a * 0.75;
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 1.7);
      g.addColorStop(0, 'rgba(255,255,255,.8)');
      g.addColorStop(0.4, p.col);
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size * 1.7, 0, TAU); ctx.fill();
      continue;
    }
    if (p.kind === 'smoke') {
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = a * 0.30;
      const s = p.size;
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, s);
      g.addColorStop(0, 'rgba(70,64,78,.8)');
      g.addColorStop(1, 'rgba(70,64,78,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(p.x, p.y, s, 0, TAU); ctx.fill();
      ctx.globalCompositeOperation = 'lighter';
      continue;
    }
    ctx.globalAlpha = a;
    ctx.fillStyle = p.col;
    ctx.beginPath();
    ctx.arc(p.x, p.y, Math.max(0.6, p.size * 0.8), 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

/* ---- игрок ---- */
function drawPlayer() {
  const p = G.player;
  if (!p) return;
  if (p.dead) return;
  if (p.invuln > 0 && Math.floor(G.time * 22) % 2 === 0) return;
  if (GFX === 'retro') {
    drawSpr(SPR.heli, p.x, p.y);
    const w = 30 + Math.sin(p.rotor * 46) * 4;
    ctx.strokeStyle = 'rgba(216,232,240,.85)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(px(p.x - w / 2), px(p.y - 6)); ctx.lineTo(px(p.x + w / 2), px(p.y - 6)); ctx.stroke();
    ctx.strokeStyle = 'rgba(216,232,240,.35)';
    ctx.beginPath(); ctx.moveTo(px(p.x - w / 2 + 4), px(p.y - 8)); ctx.lineTo(px(p.x + w / 2 - 4), px(p.y - 8)); ctx.stroke();
    if (p.muzzle > 0) {
      ctx.fillStyle = '#fff3c4';
      ctx.fillRect(px(p.x + 14), px(p.y - 1), 4, 2);
      ctx.fillStyle = '#ffd166';
      ctx.fillRect(px(p.x + 18), px(p.y), 2, 1);
    }
    if (p.shield > 0) {
      ctx.strokeStyle = 'rgba(111,227,255,' + (0.55 + Math.sin(G.time * 8) * 0.2) + ')';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(px(p.x), px(p.y), 17, 0, TAU); ctx.stroke();
    }
    // винтовая тень
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.ellipse(px(p.x + 6), GND - 1, 14, 2, 0, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;
  } else {
    drawHeliModern(p);
  }
}
function drawHeliModern(p) {
  const t = G.time;
  shadowAt(p.x + 8, GND - 2, 15, 2.4, 0.30);
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(clamp(p.vy / 340, -0.22, 0.22));
  // хвостовая балка
  const tg = ctx.createLinearGradient(-22, 0, 2, 0);
  tg.addColorStop(0, '#2c3a2a');
  tg.addColorStop(1, '#6d854a');
  ctx.fillStyle = tg;
  ctx.beginPath();
  ctx.moveTo(-24, 4); ctx.lineTo(-6, 5.5); ctx.lineTo(-6, -2.5); ctx.lineTo(-22, -2);
  ctx.closePath(); ctx.fill();
  // киль
  ctx.fillStyle = '#3d4f33';
  ctx.beginPath(); ctx.moveTo(-24, 1); ctx.lineTo(-29, -6); ctx.lineTo(-22, -3.4); ctx.closePath(); ctx.fill();
  // корпус
  const bg = ctx.createLinearGradient(0, -7, 0, 8);
  bg.addColorStop(0, '#a9c46a');
  bg.addColorStop(0.45, '#7d9a4e');
  bg.addColorStop(1, '#3f5230');
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.moveTo(-8, -2.5);
  ctx.quadraticCurveTo(-2, -7.5, 7, -6.5);
  ctx.quadraticCurveTo(14, -4, 14.5, 1.2);
  ctx.quadraticCurveTo(12, 6.4, 4, 6.6);
  ctx.quadraticCurveTo(-4, 6.4, -8, 3.2);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(8,14,10,.85)';
  ctx.lineWidth = 0.9;
  ctx.stroke();
  // блик по верхней кромке
  ctx.strokeStyle = 'rgba(230,255,210,.55)';
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.moveTo(-6, -2.6);
  ctx.quadraticCurveTo(0, -6.2, 7, -5.6);
  ctx.stroke();
  // кабина
  const cg = ctx.createLinearGradient(2, -5, 11, 2);
  cg.addColorStop(0, 'rgba(180,250,255,.95)');
  cg.addColorStop(1, 'rgba(40,150,190,.7)');
  ctx.fillStyle = cg;
  ctx.beginPath();
  ctx.moveTo(4, -5.6); ctx.quadraticCurveTo(12, -5.4, 14, -1);
  ctx.quadraticCurveTo(11.5, 2.2, 5, 1.8); ctx.closePath(); ctx.fill();
  // блик кабины
  ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 0.8;
  ctx.beginPath(); ctx.moveTo(5.5, -4.2); ctx.quadraticCurveTo(10, -4, 11.8, -1.6); ctx.stroke();
  // шасси
  ctx.strokeStyle = '#2a3323'; ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.moveTo(-1, 6.4); ctx.lineTo(-1, 8.6); ctx.moveTo(7, 6.4); ctx.lineTo(7, 8.6); ctx.stroke();
  ctx.strokeStyle = '#556b3c'; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(-5, 8.8); ctx.lineTo(11, 8.8); ctx.stroke();
  // двигатель и выхлоп
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const eglow = ctx.createRadialGradient(-7, -1, 0, -7, -1, 7);
  eglow.addColorStop(0, 'rgba(255,220,160,.55)');
  eglow.addColorStop(1, 'rgba(255,120,60,0)');
  ctx.fillStyle = eglow;
  ctx.beginPath(); ctx.arc(-7, -1, 7, 0, TAU); ctx.fill();
  ctx.restore();
  // несущий винт
  const sp = Math.sin(t * 46) * 0.5 + 0.5;
  ctx.save();
  ctx.globalAlpha = 0.18 + sp * 0.12;
  ctx.fillStyle = '#dff4ff';
  ctx.beginPath(); ctx.ellipse(0, -9, 27, 3.4, 0, 0, TAU); ctx.fill();
  ctx.globalAlpha = 0.75;
  ctx.strokeStyle = 'rgba(220,240,255,.9)';
  ctx.lineWidth = 1.1;
  const rw = 30 * Math.cos(t * 46);
  ctx.beginPath(); ctx.moveTo(-rw, -9.5); ctx.lineTo(rw, -9.5); ctx.stroke();
  ctx.restore();
  // мачта
  ctx.fillStyle = '#39472c';
  ctx.fillRect(-1, -8, 2, 4.5);
  // навигационный огонь
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = Math.floor(t * 2.4) % 2 ? 'rgba(255,60,90,.95)' : 'rgba(120,255,170,.95)';
  ctx.beginPath(); ctx.arc(-24.5, -1, 1.6, 0, TAU); ctx.fill();
  ctx.restore();
  // щит
  if (p.shield > 0) {
    const pulse = 0.35 + Math.sin(t * 6) * 0.12;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = 'rgba(111,227,255,' + pulse.toFixed(2) + ')';
    ctx.lineWidth = 1.1;
    ctx.beginPath(); ctx.arc(0, 0, 19, 0, TAU); ctx.stroke();
    ctx.strokeStyle = 'rgba(111,227,255,.12)';
    ctx.beginPath(); ctx.arc(0, 0, 22, 0, TAU); ctx.stroke();
    ctx.restore();
  }
  if (p.muzzle > 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = 'rgba(255,245,200,.9)';
    ctx.beginPath(); ctx.moveTo(15, 0); ctx.lineTo(23, 0); ctx.lineTo(15, 2.4); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

/* ---- враги ---- */
function enemyColor(type) {
  const st = stageCfg();
  if (type === 'kite' || type === 'jet') return st.modern.accent || '#ff8a5a';
  return '#ff8a5a';
}
function drawEnemies() {
  const ground = [], air = [];
  for (const e of G.enemies) (e.ground ? ground : air).push(e);
  const list = ground.concat(air);
  for (const e of list) {
    if (e.dead) continue;
    if (GFX === 'retro') drawEnemyRetro(e); else drawEnemyModern(e);
  }
}
function drawEnemyRetro(e) {
  if (e.type === 'tank') {
    drawSpr(SPR.tank, e.x, e.y, { flip: false });
    ctx.fillStyle = '#10140f';
    ctx.fillRect(px(e.x - 16), px(e.y - 4), 8, 2);
    ctx.fillStyle = '#8a94a6';
    ctx.fillRect(px(e.x - 16), px(e.y - 4), 2, 1);
  } else if (e.type === 'aa') {
    drawSpr(SPR.aa, e.x, e.y);
    if (!e.open) {
      ctx.strokeStyle = '#8a94a6';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(px(e.x), px(e.y - 5), 9, Math.PI, TAU); ctx.stroke();
      ctx.fillStyle = 'rgba(138,148,166,.28)';
      ctx.beginPath(); ctx.arc(px(e.x), px(e.y - 5), 9, Math.PI, TAU); ctx.fill();
    } else {
      ctx.fillStyle = '#ff8a5a';
      ctx.fillRect(px(e.x - 1), px(e.y - 8), 2, 2);
    }
  } else if (e.type === 'kite') {
    drawSpr(SPR.kite, e.x, e.y, { flip: true });
    ctx.fillStyle = '#7a1f1f';
    ctx.fillRect(px(e.x + 6), px(e.y + 1), 9, 2);
    ctx.fillStyle = '#ffd166';
    ctx.fillRect(px(e.x - 5), px(e.y - 4), 2, 2);
    const w = 22 + Math.sin(e.t * 40) * 4;
    ctx.strokeStyle = 'rgba(220,220,230,.7)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(px(e.x - w / 2), px(e.y - 7)); ctx.lineTo(px(e.x + w / 2), px(e.y - 7)); ctx.stroke();
  } else if (e.type === 'jet') {
    drawSpr(SPR.jet, e.x, e.y);
    ctx.fillStyle = 'rgba(255,150,90,.8)';
    ctx.fillRect(px(e.x + 9), px(e.y - 1), 4, 2);
  } else if (e.type === 'truck') {
    drawSpr(SPR.truck, e.x, e.y);
  }
  if (e.flash > 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.55;
    drawSpr(e.type === 'tank' ? SPR.tank : e.type === 'aa' ? SPR.aa : e.type === 'kite' ? SPR.kite : e.type === 'jet' ? SPR.jet : SPR.truck, e.x, e.y);
    ctx.restore();
  }
}
function drawEnemyModern(e) {
  const t = e.t || 0;
  const st = stageCfg();
  const accent = st.modern.accent;
  const outline = 'rgba(5,8,14,.9)';
  ctx.save();
  ctx.translate(e.x, e.y);
  const isGround = e.type === 'tank' || e.type === 'aa' || e.type === 'truck';
  if (isGround) shadowAt(0, GND - e.y, 11, 2.2, 0.35);

  if (e.type === 'tank') {
    ctx.fillStyle = '#0c1015';
    rr(-10, 2.4, 20, 5.6, 2.3); ctx.fill();
    ctx.strokeStyle = 'rgba(120,140,160,.22)'; ctx.lineWidth = 0.6;
    rr(-10, 2.4, 20, 5.6, 2.3); ctx.stroke();
    ctx.fillStyle = 'rgba(130,150,170,.22)';
    for (let i = -8; i <= 8; i += 4) ctx.fillRect(i, 3.4, 2.2, 3.4);
    const hg = ctx.createLinearGradient(0, -5, 0, 5);
    hg.addColorStop(0, '#93a68a'); hg.addColorStop(0.45, '#566a4c'); hg.addColorStop(1, '#232e1f');
    ctx.fillStyle = hg;
    rr(-9.5, -4.8, 19, 8.2, 2.3); ctx.fill();
    ctx.strokeStyle = outline; ctx.lineWidth = 0.85;
    rr(-9.5, -4.8, 19, 8.2, 2.3); ctx.stroke();
    ctx.fillStyle = '#3f5137';
    rr(-4.5, -8.6, 10, 5.8, 1.8); ctx.fill();
    ctx.strokeStyle = outline;
    rr(-4.5, -8.6, 10, 5.8, 1.8); ctx.stroke();
    ctx.fillStyle = '#18211a'; ctx.fillRect(-17, -7.4, 13, 2.1);
    ctx.fillStyle = 'rgba(200,220,240,.30)'; ctx.fillRect(-17, -7.4, 10, 0.6);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = 'rgba(255,90,60,.95)';
    ctx.beginPath(); ctx.arc(-1.6, -7.2, 1.5, 0, TAU); ctx.fill();
    ctx.restore();
    ctx.globalAlpha = 0.5; ctx.fillStyle = accent;
    ctx.fillRect(-8.5, -1.6, 17, 0.9); ctx.globalAlpha = 1;
  } else if (e.type === 'truck') {
    ctx.fillStyle = '#0a0d11'; ctx.fillRect(-9, 2, 18, 4.5);
    ctx.fillStyle = '#05080b';
    for (const wx of [-6, 5]) { ctx.beginPath(); ctx.arc(wx, 5.4, 2.1, 0, TAU); ctx.fill(); }
    const cg = ctx.createLinearGradient(0, -7, 0, 3);
    cg.addColorStop(0, '#d3a86c'); cg.addColorStop(1, '#6b4a24');
    ctx.fillStyle = cg;
    rr(-8.5, -6.5, 17, 8.8, 1.6); ctx.fill();
    ctx.strokeStyle = outline; ctx.lineWidth = 0.85;
    rr(-8.5, -6.5, 17, 8.8, 1.6); ctx.stroke();
    ctx.fillStyle = 'rgba(255,209,102,.8)'; ctx.fillRect(-7, -3.4, 14, 1.2);
    ctx.fillStyle = 'rgba(20,24,26,.9)'; ctx.fillRect(-8.5, -2, 3.4, 5);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = 'rgba(255,230,160,.9)';
    ctx.beginPath(); ctx.arc(-7, -1, 1.1, 0, TAU); ctx.fill();
    ctx.restore();
  } else if (e.type === 'aa') {
    ctx.fillStyle = '#0d1116';
    rr(-8, 1.5, 16, 6, 2); ctx.fill();
    const hg = ctx.createLinearGradient(0, -9, 0, 3);
    hg.addColorStop(0, '#93a3b0'); hg.addColorStop(1, '#2a343d');
    ctx.fillStyle = hg;
    rr(-6, -5.5, 12, 8.5, 2.4); ctx.fill();
    ctx.strokeStyle = outline; ctx.lineWidth = 0.85;
    rr(-6, -5.5, 12, 8.5, 2.4); ctx.stroke();
    ctx.strokeStyle = '#c3d0dc'; ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-2.5, -5.5); ctx.lineTo(-7, -12);
    ctx.moveTo(2.5, -5.5); ctx.lineTo(7, -12);
    ctx.stroke();
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = 'rgba(255,80,60,.95)';
    ctx.beginPath(); ctx.arc(0, -3.2, 1.4, 0, TAU); ctx.fill();
    ctx.restore();
    if (!e.open) {
      const pulse = 0.20 + Math.abs(Math.sin(t * 3)) * 0.16;
      const sg = ctx.createRadialGradient(0, -4, 1, 0, -4, 14);
      sg.addColorStop(0, 'rgba(150,220,255,0)');
      sg.addColorStop(0.68, 'rgba(130,200,240,' + pulse.toFixed(2) + ')');
      sg.addColorStop(1, 'rgba(130,200,240,0)');
      ctx.fillStyle = sg;
      ctx.beginPath(); ctx.arc(0, -4, 14, Math.PI, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(190,230,255,' + (pulse + 0.3).toFixed(2) + ')';
      ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.arc(0, -4, 12.5, Math.PI, TAU); ctx.stroke();
      ctx.setLineDash([2, 3]);
      ctx.strokeStyle = 'rgba(190,230,255,.22)';
      ctx.beginPath(); ctx.arc(0, -4, 9, Math.PI, TAU); ctx.stroke();
      ctx.setLineDash([]);
    }
  } else if (e.type === 'kite') {
    ctx.save();
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = '#ffd0c0';
    ctx.beginPath(); ctx.ellipse(0, -10, 21, 2.6, 0, 0, TAU); ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#4a1512';
    ctx.beginPath(); ctx.moveTo(-6, 1.5); ctx.lineTo(-23, -0.5); ctx.lineTo(-6, -2); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#2a0f0c'; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-4, 6); ctx.lineTo(-4, 8.6);
    ctx.moveTo(6, 6); ctx.lineTo(6, 8.6);
    ctx.stroke();
    ctx.strokeStyle = '#5a4038'; ctx.lineWidth = 1.1;
    ctx.beginPath(); ctx.moveTo(-6, 8.6); ctx.lineTo(8, 8.6); ctx.stroke();
    const bg = ctx.createLinearGradient(0, -7, 0, 6);
    bg.addColorStop(0, '#ff9a7a'); bg.addColorStop(0.35, '#c23a2b'); bg.addColorStop(1, '#4d1210');
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.moveTo(12, 0.5);
    ctx.quadraticCurveTo(9, -6.5, 0, -6.2);
    ctx.quadraticCurveTo(-12, -5, -14, -0.5);
    ctx.quadraticCurveTo(-11, 5.5, 0, 6);
    ctx.quadraticCurveTo(9, 5.5, 12, 0.5);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = outline; ctx.lineWidth = 0.85; ctx.stroke();
    ctx.fillStyle = 'rgba(255,240,210,.92)';
    ctx.beginPath(); ctx.ellipse(5, -2.6, 3.2, 2, -0.2, 0, TAU); ctx.fill();
    const rw = 26 * Math.cos(t * 44);
    ctx.strokeStyle = 'rgba(255,200,180,.85)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(-rw, -10.5); ctx.lineTo(rw, -10.5); ctx.stroke();
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = 'rgba(255,80,60,.95)';
    ctx.beginPath(); ctx.arc(-13, 0, 1.3, 0, TAU); ctx.fill();
    ctx.restore();
  } else if (e.type === 'jet') {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const fg = ctx.createLinearGradient(10, 0, 30, 0);
    fg.addColorStop(0, 'rgba(255,220,160,.85)');
    fg.addColorStop(1, 'rgba(255,90,40,0)');
    ctx.fillStyle = fg;
    ctx.beginPath(); ctx.moveTo(10, -2.2); ctx.lineTo(30, 0); ctx.lineTo(10, 2.2); ctx.closePath(); ctx.fill();
    ctx.restore();
    const jg = ctx.createLinearGradient(-14, 0, 12, 0);
    jg.addColorStop(0, '#dbe9f2'); jg.addColorStop(0.45, '#728694'); jg.addColorStop(1, '#1c2730');
    ctx.fillStyle = jg;
    ctx.beginPath();
    ctx.moveTo(-15, 0); ctx.lineTo(-4, -4.4); ctx.lineTo(8, -2.6);
    ctx.lineTo(13, 0); ctx.lineTo(8, 2.6); ctx.lineTo(-4, 4.4);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = outline; ctx.lineWidth = 0.8; ctx.stroke();
    ctx.fillStyle = '#8ff4ff';
    ctx.beginPath(); ctx.ellipse(-3.5, -1.4, 3.2, 1.5, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(200,230,255,.7)';
    ctx.beginPath(); ctx.ellipse(-3.5, -1.9, 1.6, 0.7, 0, 0, TAU); ctx.fill();
  }

  if (e.flash > 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = Math.min(0.8, e.flash * 5);
    ctx.fillStyle = '#fff';
    if (e.type === 'tank' || e.type === 'aa') rr(-10, -9, 20, 17, 4);
    else if (e.type === 'truck') rr(-9, -7, 18, 15, 3);
    else rr(-16, -8, 32, 16, 5);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

function drawPickups() {
  for (const pu of G.pickups) {
    const bob = Math.sin(G.time * 5 + pu.bob) * 2;
    if (GFX === 'retro') {
      const sp = pu.type === 'P' ? SPR.pickP : pu.type === 'S' ? SPR.pickS : pu.type === 'B' ? SPR.pickB : SPR.pickP;
      drawSpr(sp, pu.x, pu.y + bob);
      if (pu.type === '1UP') {
        ctx.fillStyle = '#ffd166';
        ctx.fillRect(px(pu.x - 1), px(pu.y + bob - 5), 2, 10);
        ctx.fillRect(px(pu.x - 5), px(pu.y + bob - 1), 10, 2);
      }
    } else {
      const col = pu.type === 'P' ? '#ffd166' : pu.type === 'S' ? '#6fe3ff' : pu.type === 'B' ? '#ff8a5a' : '#8affc1';
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(pu.x, pu.y + bob, 1, pu.x, pu.y + bob, 13);
      g.addColorStop(0, col);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(pu.x, pu.y + bob, 13, 0, TAU); ctx.fill();
      ctx.restore();
      ctx.fillStyle = 'rgba(10,16,22,.85)';
      rr(pu.x - 5, pu.y + bob - 5, 10, 10, 2.6); ctx.fill();
      ctx.strokeStyle = col; ctx.lineWidth = 1.1;
      rr(pu.x - 5, pu.y + bob - 5, 10, 10, 2.6); ctx.stroke();
      label(pu.type === '1UP' ? '1' : pu.type, pu.x, pu.y + bob + 0.5, { size: 7, color: col, align: 'center', baseline: 'middle', weight: 700 });
    }
  }
}
function drawBullets() {
  if (GFX === 'retro') {
    for (const b of G.bullets) {
      ctx.fillStyle = b.kind === 'heavy' ? '#9fe8ff' : '#ffe08a';
      ctx.fillRect(px(b.x - 3), px(b.y - 1), 6, 2);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(px(b.x + 1), px(b.y - 1), 2, 1);
    }
    for (const b of G.ebullets) {
      ctx.fillStyle = b.col || '#ff8a5a';
      ctx.fillRect(px(b.x - 2), px(b.y - 2), 4, 4);
      ctx.fillStyle = 'rgba(255,255,255,.7)';
      ctx.fillRect(px(b.x - 1), px(b.y - 1), 1, 1);
    }
  } else {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const b of G.bullets) {
      const col = b.kind === 'heavy' ? '#8ff4ff' : '#ffe08a';
      const g = ctx.createLinearGradient(b.x - 12, b.y, b.x + 4, b.y);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, col);
      ctx.strokeStyle = g;
      ctx.lineWidth = b.kind === 'heavy' ? 2 : 1.5;
      ctx.beginPath(); ctx.moveTo(b.x - 13, b.y); ctx.lineTo(b.x + 2, b.y); ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(b.x + 2, b.y, 1.5, 0, TAU); ctx.fill();
    }
    for (const b of G.ebullets) {
      const col = b.col || '#ff8a5a';
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(b.x, b.y, 2.2, 0, TAU); ctx.fill();
      ctx.globalAlpha = 0.35;
      ctx.beginPath(); ctx.arc(b.x, b.y, 4.2, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }
}
function drawBoss() {
  const b = G.boss;
  if (!b) return;
  if (GFX === 'retro') {
    ctx.globalAlpha = b.hitT > 0 ? 0.9 : 1;
    drawSpr(SPR.boss, b.x, b.y);
    ctx.globalAlpha = 1;
    // роторы
    const w = 54 + Math.sin(b.t * 34) * 6;
    ctx.strokeStyle = 'rgba(200,220,240,.55)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(px(b.x - w / 2), px(b.y - 14)); ctx.lineTo(px(b.x + w / 2), px(b.y - 14)); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(px(b.x - w / 2), px(b.y - 12)); ctx.lineTo(px(b.x + w / 2), px(b.y - 12)); ctx.stroke();
    // ядро
    const pulse = 0.6 + Math.sin(b.t * 6) * 0.3;
    ctx.fillStyle = 'rgba(255,90,60,' + pulse.toFixed(2) + ')';
    ctx.beginPath(); ctx.arc(px(b.x), px(b.y + 2), 4, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ffe08a';
    ctx.beginPath(); ctx.arc(px(b.x), px(b.y + 2), 1.6, 0, TAU); ctx.fill();
    if (b.hitT > 0) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.5;
      drawSpr(SPR.boss, b.x, b.y); ctx.restore();
    }
  } else {
    drawBossModern(b);
  }
}
function drawBossModern(b) {
  const t = b.t;
  const st = stageCfg();
  const accent = st.modern.accent;
  const frac = clamp(b.hp / b.maxhp, 0, 1);
  ctx.save();
  ctx.translate(b.x, b.y);
  // аура
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const aura = ctx.createRadialGradient(0, 2, 6, 0, 2, 58);
  aura.addColorStop(0, 'rgba(255,90,60,.20)');
  aura.addColorStop(1, 'rgba(255,90,60,0)');
  ctx.fillStyle = aura;
  ctx.beginPath(); ctx.arc(0, 2, 58, 0, TAU); ctx.fill();
  ctx.restore();
  // несущие винты (за корпусом)
  const rotors = [[-22, -17, 15], [22, -17, 15], [0, -25, 20]];
  for (const r of rotors) {
    const rw = r[2] * Math.cos(t * 38 + r[0] * 0.3);
    ctx.save();
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = '#cfe6ff';
    ctx.beginPath(); ctx.ellipse(r[0], r[1], r[2], 2.4, 0, 0, TAU); ctx.fill();
    ctx.restore();
    ctx.strokeStyle = 'rgba(205,230,255,.5)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(r[0] - rw, r[1] - 0.5); ctx.lineTo(r[0] + rw, r[1] - 0.5); ctx.stroke();
    ctx.fillStyle = '#39445a';
    ctx.fillRect(r[0] - 1.2, r[1] - 3, 2.4, 5.5);
  }
  // корпус
  const hull = ctx.createLinearGradient(0, -22, 0, 20);
  hull.addColorStop(0, '#8b96a8');
  hull.addColorStop(0.28, '#4b5568');
  hull.addColorStop(0.62, '#2a3242');
  hull.addColorStop(1, '#0b0e14');
  ctx.fillStyle = hull;
  ctx.beginPath();
  ctx.moveTo(-33, -8);
  ctx.quadraticCurveTo(-25, -22, -2, -21);
  ctx.quadraticCurveTo(21, -21, 33, -8);
  ctx.quadraticCurveTo(37, 3, 25, 14);
  ctx.quadraticCurveTo(7, 22, -14, 16);
  ctx.quadraticCurveTo(-31, 9, -33, -8);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(8,12,20,.85)';
  ctx.lineWidth = 1;
  ctx.stroke();
  // неоновая кромка
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = accent;
  ctx.globalAlpha = 0.75;
  ctx.shadowColor = accent;
  ctx.shadowBlur = 10;
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.moveTo(-33, -8);
  ctx.quadraticCurveTo(-25, -22, -2, -21);
  ctx.quadraticCurveTo(21, -21, 33, -8);
  ctx.stroke();
  ctx.restore();
  // панели и заклёпки
  ctx.strokeStyle = 'rgba(170,195,225,.18)';
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  ctx.moveTo(-27, -2); ctx.lineTo(27, -2);
  ctx.moveTo(-20, -14); ctx.lineTo(-16, 15);
  ctx.moveTo(20, -14); ctx.lineTo(16, 15);
  ctx.stroke();
  ctx.fillStyle = 'rgba(200,220,245,.20)';
  for (let i = -24; i <= 24; i += 8) ctx.fillRect(i, -17 + Math.abs(i) * 0.18, 1, 1);
  // боковые гондолы с турбинами
  for (const sx of [-25, 25]) {
    ctx.fillStyle = '#141a26';
    rr(sx - 7.5, 3, 15, 11, 3.2); ctx.fill();
    ctx.strokeStyle = 'rgba(130,170,215,.4)';
    ctx.lineWidth = 0.8;
    rr(sx - 7.5, 3, 15, 11, 3.2); ctx.stroke();
    ctx.fillStyle = 'rgba(255,150,90,.8)';
    ctx.beginPath(); ctx.ellipse(sx, 14.2, 4.6, 1.4, 0, 0, TAU); ctx.fill();
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const fg = ctx.createLinearGradient(sx, 14, sx, 30 + Math.sin(t * 18) * 3);
    fg.addColorStop(0, 'rgba(255,180,110,.6)');
    fg.addColorStop(1, 'rgba(255,80,40,0)');
    ctx.fillStyle = fg;
    ctx.beginPath();
    ctx.moveTo(sx - 3.2, 15); ctx.lineTo(sx, 30 + Math.sin(t * 18) * 3); ctx.lineTo(sx + 3.2, 15);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  // подвесные пушки
  for (const gx of [-13, 13]) {
    ctx.fillStyle = '#2a3240';
    rr(gx - 2.6, 14, 5.2, 5, 1.4); ctx.fill();
    ctx.fillStyle = '#0c1018';
    ctx.fillRect(gx - 1.2, 18, 2.4, 6);
    ctx.fillStyle = 'rgba(255,120,80,.9)';
    ctx.fillRect(gx - 1.2, 23, 2.4, 1);
  }
  // радар
  ctx.save();
  ctx.translate(0, -23);
  ctx.rotate(Math.sin(t * 1.6) * 0.5);
  ctx.strokeStyle = 'rgba(180,210,240,.55)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -6); ctx.stroke();
  ctx.fillStyle = 'rgba(170,205,240,.75)';
  ctx.beginPath(); ctx.ellipse(0, -7, 5.5, 2, 0.2, 0, TAU); ctx.fill();
  ctx.restore();
  // ядро
  const pulse = 0.55 + Math.sin(t * 6) * 0.25;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const cg = ctx.createRadialGradient(0, 1, 1, 0, 1, 15);
  cg.addColorStop(0, 'rgba(255,235,190,' + pulse.toFixed(2) + ')');
  cg.addColorStop(0.35, 'rgba(255,110,60,' + (pulse * 0.8).toFixed(2) + ')');
  cg.addColorStop(1, 'rgba(255,60,30,0)');
  ctx.fillStyle = cg;
  ctx.beginPath(); ctx.arc(0, 1, 15, 0, TAU); ctx.fill();
  ctx.strokeStyle = accent;
  ctx.globalAlpha = 0.45 + pulse * 0.4;
  ctx.lineWidth = 0.8;
  ctx.beginPath(); ctx.arc(0, 1, 9.5, 0, TAU); ctx.stroke();
  // вращающиеся маркеры вокруг ядра
  for (let i = 0; i < 4; i++) {
    const a = t * 1.8 + i * TAU / 4;
    ctx.fillStyle = 'rgba(255,230,190,.9)';
    ctx.beginPath(); ctx.arc(Math.cos(a) * 9.5, 1 + Math.sin(a) * 9.5, 1.1, 0, TAU); ctx.fill();
  }
  ctx.restore();
  ctx.fillStyle = '#05070b';
  ctx.beginPath(); ctx.arc(0, 1, 4.4, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(255,238,205,.95)';
  ctx.beginPath(); ctx.arc(0, 1, 2.2, 0, TAU); ctx.fill();
  // повреждения: искры при низком HP
  if (frac < 0.34) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.4 + Math.abs(Math.sin(t * 9)) * 0.4;
    ctx.fillStyle = '#ff8a5a';
    ctx.fillRect(-18, -8, 2, 1);
    ctx.fillRect(12, -12, 1.4, 1.4);
    ctx.restore();
  }
  if (b.hitT > 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(0, 0, 34, 0, TAU); ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

function drawLifeIcon(x, y, col) {
  if (GFX === 'retro') {
    ctx.fillStyle = col;
    ctx.fillRect(x, y, 7, 2);
    ctx.fillRect(x + 1, y + 2, 5, 2);
    ctx.fillRect(x + 3, y + 4, 1, 2);
    ctx.fillRect(x - 1, y + 5, 9, 1);
  } else {
    ctx.save();
    ctx.fillStyle = col;
    rr(x, y + 1, 7, 2.4, 1); ctx.fill();
    ctx.fillRect(x + 2, y + 3.2, 3, 1.4);
    ctx.fillRect(x - 1, y + 5, 9, 1);
    ctx.restore();
  }
}
function drawBombIcon(x, y, col) {
  ctx.fillStyle = col;
  if (GFX === 'retro') { ctx.fillRect(x, y, 4, 4); }
  else { ctx.beginPath(); ctx.arc(x + 2, y + 2, 2.2, 0, TAU); ctx.fill(); }
}
function drawHUD() {
  const st = stageCfg();
  const accent = GFX === 'retro' ? '#ffd166' : st.modern.accent;
  const dim = GFX === 'retro' ? '#8fa0b8' : 'rgba(180,200,230,.55)';
  const ink = '#eef4ff';
  if (GFX === 'retro') {
    ctx.fillStyle = '#080a12';
    ctx.fillRect(0, 0, W, TOP);
    ctx.fillStyle = accent;
    ctx.fillRect(0, TOP - 1, W, 1);
  } else {
    const g = ctx.createLinearGradient(0, 0, 0, TOP);
    g.addColorStop(0, 'rgba(6,8,16,.94)');
    g.addColorStop(1, 'rgba(6,8,16,.55)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, TOP);
    ctx.save();
    ctx.strokeStyle = accent;
    ctx.globalAlpha = 0.5;
    ctx.shadowColor = accent;
    ctx.shadowBlur = 8;
    ctx.beginPath(); ctx.moveTo(0, TOP - 0.5); ctx.lineTo(W, TOP - 0.5); ctx.stroke();
    ctx.restore();
  }
  const p = G.player;
  const lvl = p ? clamp(p.weapon, 1, 4) : 1;
  if (GFX === 'retro') {
    label(t('score') + ' ' + fmtScore(G.score), 4, 3, { size: 8, color: ink });
    label(t('hi') + ' ' + fmtScore(G.hi), W - (isTouchDevice() ? 18 : 4), 3, { size: 8, color: dim, align: 'right' });
    label(t('zone') + ' ' + (G.stage + 1) + '/' + STAGES.length, W / 2, 3, { size: 8, color: accent, align: 'center' });
    let x = 5;
    for (let i = 0; i < Math.min(5, Math.max(0, G.lives)); i++) { drawLifeIcon(x, 13, '#b4d36a'); x += 10; }
    label(t('weapon'), 100, 12, { size: 8, color: dim });
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = i < lvl ? accent : 'rgba(255,255,255,.16)';
      ctx.fillRect(134 + i * 5, 13, 4, 4);
    }
    label(t('bombs') + ' ' + G.bombs, 196, 12, { size: 8, color: dim });
    if (p && p.shield > 0) {
      ctx.fillStyle = '#6fe3ff';
      ctx.fillRect(272, 12, 4, 4);
      ctx.fillRect(274, 10, 2, 8);
      label('x' + p.shield, 279, 12, { size: 8, color: '#6fe3ff' });
    }
  } else {
    label(t('score'), 8, 3, { size: 5.5, color: dim, spacing: 1.2 });
    label(fmtScore(G.score), 8, 9, { size: 11, color: ink, glow: accent, glowSize: 7, weight: 700, spacing: 0.4 });
    label(t('zone') + ' ' + (G.stage + 1) + ' / ' + STAGES.length, W / 2, 4, { size: 6.5, color: accent, align: 'center', spacing: 1.4 });
    label(t('hi') + ' ' + fmtScore(G.hi), W - (isTouchDevice() ? 18 : 8), 4, { size: 5.5, color: dim, align: 'right', spacing: 1.2 });
    let x = 8;
    for (let i = 0; i < Math.min(5, Math.max(0, G.lives)); i++) { drawLifeIcon(x, 14, '#c9f56a'); x += 9; }
    label(t('weapon'), 100, 15, { size: 5, color: dim, spacing: 1 });
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = i < lvl ? accent : 'rgba(255,255,255,.16)';
      rr(100 + 28 + i * 5.5, 14.5, 4, 3, 1); ctx.fill();
    }
    label(t('bombs'), 190, 15, { size: 5, color: dim, spacing: 1 });
    for (let i = 0; i < Math.min(5, G.bombs); i++) drawBombIcon(190 + 26 + i * 6, 14, '#ffd166');
    if (p && p.shield > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = '#6fe3ff';
      ctx.shadowColor = '#6fe3ff';
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.moveTo(288, 12); ctx.lineTo(292, 14); ctx.lineTo(292, 19); ctx.lineTo(288, 21);
      ctx.lineTo(284, 19); ctx.lineTo(284, 14); ctx.closePath(); ctx.stroke();
      ctx.restore();
      label('x' + p.shield, 295, 14, { size: 5.5, color: '#6fe3ff' });
    }
  }
  if (isTouchDevice()) {
    // кнопка паузы в правом верхнем углу (зона нажатия — в bindPointer)
    ctx.fillStyle = GFX === 'retro' ? '#8fa0b8' : 'rgba(190,215,245,.8)';
    ctx.fillRect(W - 9, GFX === 'retro' ? 5 : 5.5, 2, GFX === 'retro' ? 8 : 7);
    ctx.fillRect(W - 5, GFX === 'retro' ? 5 : 5.5, 2, GFX === 'retro' ? 8 : 7);
  }
  const b = G.boss;
  if (b && G.phase === 'boss') {
    const by = TOP + 3, bh = 3;
    const frac = clamp(b.hp / b.maxhp, 0, 1);
    if (GFX === 'retro') {
      label(t('boss'), 6, by - 1, { size: 8, color: '#ff8a5a' });
      ctx.fillStyle = 'rgba(0,0,0,.6)';
      ctx.fillRect(50, by, W - 100, bh);
      ctx.fillStyle = '#e04a3a';
      ctx.fillRect(50, by, Math.round((W - 100) * frac), bh);
      ctx.strokeStyle = '#ffd166'; ctx.lineWidth = 1;
      ctx.strokeRect(50, by, W - 100, bh);
    } else {
      ctx.save();
      ctx.fillStyle = 'rgba(4,6,12,.65)';
      rr(8, by - 3, W - 16, 10, 3); ctx.fill();
      const g = ctx.createLinearGradient(0, 0, W, 0);
      g.addColorStop(0, '#ffd166'); g.addColorStop(0.5, '#ff5a2b'); g.addColorStop(1, '#ff2f9c');
      ctx.fillStyle = g;
      ctx.shadowColor = '#ff5a2b'; ctx.shadowBlur = 6;
      rr(9, by - 2, (W - 18) * frac, 8, 2.6); ctx.fill();
      ctx.restore();
      label(b.name, W / 2, by + 2, { size: 5.5, color: '#ffe0c4', align: 'center', baseline: 'middle', spacing: 2 });
    }
  }
}

function vignette(a) {
  const g = ctx.createRadialGradient(W / 2, H * 0.46, H * 0.22, W / 2, H * 0.5, H * 0.8);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,' + a + ')');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}
function panel(x, y, w, h, accent, alpha) {
  if (GFX === 'retro') {
    ctx.fillStyle = 'rgba(5,7,12,' + (alpha === undefined ? 0.9 : alpha) + ')';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = accent || '#ffd166';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    ctx.strokeStyle = 'rgba(255,255,255,.14)';
    ctx.strokeRect(x + 3.5, y + 3.5, w - 7, h - 7);
  } else {
    ctx.save();
    ctx.fillStyle = 'rgba(6,9,17,' + (alpha === undefined ? 0.72 : alpha) + ')';
    rr(x, y, w, h, 6); ctx.fill();
    const g = ctx.createLinearGradient(x, y, x + w, y + h);
    g.addColorStop(0, accent || '#39e7ff');
    g.addColorStop(1, 'rgba(255,255,255,.06)');
    ctx.strokeStyle = g;
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = 0.8;
    rr(x + 0.4, y + 0.4, w - 0.8, h - 0.8, 6); ctx.stroke();
    ctx.restore();
  }
}
function wrapLines(str, maxW, size) {
  const words = String(str).split(' ');
  const lines = [];
  let cur = '';
  for (const w of words) {
    const test = cur ? cur + ' ' + w : w;
    if (labelWidth(test, size) > maxW && cur) { lines.push(cur); cur = w; }
    else cur = test;
  }
  if (cur) lines.push(cur);
  return lines;
}
function para(str, x, y, maxW, size, color, lineH, align, alpha) {
  const lines = wrapLines(str, maxW, size);
  for (let i = 0; i < lines.length; i++) {
    label(lines[i], x, y + i * lineH, { size, color, align: align || 'left', alpha: alpha === undefined ? 1 : alpha });
  }
  return lines.length;
}

const MENU_TOP = 107, MENU_STEP = 14;
function menuItems() {
  return [
    { key: 'start', text: t('start') },
    { key: 'gfx', text: t('graphics') + ': ' + (GFX === 'modern' ? t('gfxModern') : t('gfxRetro')) },
    { key: 'lang', text: t('lang') + ': ' + (LANG === 'ru' ? t('ru') : t('en')) },
    { key: 'sound', text: t('sound') + ': ' + (CFG.sound ? t('on') : t('off')) },
    { key: 'controls', text: t('controls') }
  ];
}
function menuActivate() {
  const items = menuItems();
  const it = items[G.menu];
  if (!it) return;
  Sound.unlock();
  Sound.sfx('select');
  if (it.key === 'start') { newGame(); }
  else if (it.key === 'gfx') toggleGfx();
  else if (it.key === 'lang') toggleLang();
  else if (it.key === 'sound') toggleSound();
  else if (it.key === 'controls') { G.state = 'controls'; Sound.sfx('select'); }
}

function drawTitle() {
  const prevStage = G.stage;
  G.stage = 0;
  drawBackground();
  G.stage = prevStage;
  // декоративная техника над пустыней
  const demo = { x: GFX === 'retro' ? 208 : 236, y: GFX === 'retro' ? 96 : 92, vy: 0, rotor: G.menuT, shield: 0, dead: false, invuln: 0, muzzle: 0 };
  if (GFX === 'retro') {
    drawSpr(SPR.heli, demo.x, demo.y);
    const w = 30 + Math.sin(demo.rotor * 46) * 4;
    ctx.strokeStyle = 'rgba(216,232,240,.8)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(px(demo.x - w / 2), px(demo.y - 6)); ctx.lineTo(px(demo.x + w / 2), px(demo.y - 6)); ctx.stroke();
    drawSpr(SPR.tank, 280, GND - 5);
    drawSpr(SPR.kite, 64, 80, { flip: true });
  } else {
    drawHeliModern(demo);
    drawEnemyModern({ type: 'tank', x: 282, y: GND - 5, t: G.menuT, open: false, flash: 0, ground: true });
    ctx.save(); ctx.globalAlpha = 0.85;
    drawEnemyModern({ type: 'kite', x: 64, y: 80, t: G.menuT, open: false, flash: 0, ground: false });
    ctx.restore();
  }
  // затемнение
  if (GFX === 'retro') {
    ctx.fillStyle = 'rgba(4,5,10,.55)';
    ctx.fillRect(0, 0, W, H);
  } else {
    const veil = ctx.createLinearGradient(0, 0, 0, H);
    veil.addColorStop(0, 'rgba(3,4,10,.6)');
    veil.addColorStop(0.5, 'rgba(3,4,10,.34)');
    veil.addColorStop(1, 'rgba(3,4,10,.74)');
    ctx.fillStyle = veil;
    ctx.fillRect(0, 0, W, H);
  }
  // верхняя служебная полоса
  if (GFX === 'retro') {
    ctx.fillStyle = '#070910';
    ctx.fillRect(0, 0, W, TOP);
    ctx.fillStyle = '#ffd166';
    ctx.fillRect(0, TOP - 1, W, 1);
    label('ВИХРЬ', 5, 5, { size: 8, color: '#ffd166' });
    label(t('hi') + ' ' + fmtScore(G.hi), W - 5, 5, { size: 8, color: '#ffd166', align: 'right' });
  } else {
    const g = ctx.createLinearGradient(0, 0, 0, TOP);
    g.addColorStop(0, 'rgba(4,6,14,.92)');
    g.addColorStop(1, 'rgba(4,6,14,.35)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, TOP);
    ctx.save();
    ctx.strokeStyle = '#39e7ff'; ctx.globalAlpha = 0.35; ctx.shadowColor = '#39e7ff'; ctx.shadowBlur = 8;
    ctx.beginPath(); ctx.moveTo(0, TOP - 0.5); ctx.lineTo(W, TOP - 0.5); ctx.stroke();
    ctx.restore();
    label('ВИХРЬ // ARCADE ARCHIVE', 6, 5, { size: 5, color: 'rgba(170,200,235,.8)', spacing: 1.6 });
    label(t('hi') + ' ' + fmtScore(G.hi), W - 6, 5, { size: 5.5, color: '#ffd166', align: 'right', spacing: 1.2 });
  }
  // логотип
  if (GFX === 'retro') {
    label('ВИХРЬ', W / 2 + 2, 30, { size: 30, color: '#5b1320', align: 'center' });
    label('ВИХРЬ', W / 2 + 1, 29, { size: 30, color: '#ff7a3d', align: 'center' });
    label('ВИХРЬ', W / 2, 28, { size: 30, color: '#ffd166', align: 'center' });
    ctx.fillStyle = '#ffd166';
    ctx.fillRect(W / 2 - 62, 58, 124, 1);
    ctx.fillStyle = 'rgba(255,209,102,.35)';
    ctx.fillRect(W / 2 - 42, 60, 84, 1);
    label('ВИХРЬ', W / 2, 63, { size: 12, color: '#9fe8ff', align: 'center' });
    label('ГЕФЕСТ ARCADE', W / 2, 80, { size: 8, color: '#a9b6c8', align: 'center' });
  } else {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '800 30px ui-monospace, "SF Mono", Menlo, monospace';
    if ('letterSpacing' in ctx) { try { ctx.letterSpacing = '1.5px'; } catch (e) { /* ignore */ } }
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = '#39e7ff';
    ctx.fillText('ВИХРЬ', W / 2 - 1.8, 44);
    ctx.fillStyle = '#ff2f9c';
    ctx.fillText('ВИХРЬ', W / 2 + 1.8, 44);
    ctx.globalAlpha = 1;
    const lg = ctx.createLinearGradient(0, 28, 0, 58);
    lg.addColorStop(0, '#e9fdff');
    lg.addColorStop(0.45, '#39e7ff');
    lg.addColorStop(0.75, '#a86bff');
    lg.addColorStop(1, '#ff2f9c');
    ctx.shadowColor = 'rgba(57,231,255,.65)';
    ctx.shadowBlur = 18;
    ctx.fillStyle = lg;
    ctx.fillText('ВИХРЬ', W / 2, 44);
    ctx.restore();
    label('ВИХРЬ', W / 2, 63, { size: 9, color: '#cfe9ff', align: 'center', spacing: 4, alpha: 0.95 });
    label('ГЕФЕСТ ARCADE', W / 2, 75, { size: 5.5, color: 'rgba(160,185,220,.8)', align: 'center', spacing: 2.6 });
  }
  // меню
  const items = menuItems();
  for (let i = 0; i < items.length; i++) {
    const sel = i === G.menu;
    const y = MENU_TOP + i * MENU_STEP;
    if (GFX === 'retro') {
      if (sel) {
        ctx.fillStyle = 'rgba(255,209,102,.14)';
        ctx.fillRect(34, y - 2, 252, 12);
        ctx.fillStyle = '#ffd166';
        ctx.fillRect(34, y - 2, 2, 12);
      }
      label((sel ? '> ' : '  ') + items[i].text, 42, y, { size: 9, color: sel ? '#ffe9a8' : '#b9c6da' });
    } else {
      if (sel) {
        ctx.save();
        const g = ctx.createLinearGradient(38, 0, 282, 0);
        g.addColorStop(0, 'rgba(57,231,255,.20)');
        g.addColorStop(1, 'rgba(255,47,156,.10)');
        ctx.fillStyle = g;
        rr(36, y - 3, 248, 13, 5); ctx.fill();
        ctx.strokeStyle = 'rgba(57,231,255,.55)';
        ctx.lineWidth = 0.7;
        rr(36, y - 3, 248, 13, 5); ctx.stroke();
        ctx.restore();
        ctx.fillStyle = '#39e7ff';
        ctx.fillRect(37, y - 2.5, 2, 12);
      }
      label('0' + (i + 1), 48, y, { size: 6, color: sel ? 'rgba(57,231,255,.9)' : 'rgba(140,165,200,.5)' });
      label(items[i].text, 66, y, { size: 8, color: sel ? '#f2f8ff' : 'rgba(185,200,225,.72)', glow: sel ? 'rgba(57,231,255,.8)' : 0, glowSize: 8, spacing: 0.4 });
    }
  }
  // нижние подсказки
  if (GFX === 'retro') {
    label(t('hintKeys'), W / 2, 183, { size: 8, color: '#8fa0b8', align: 'center' });
    label(t('pressEnter'), W / 2, 194, { size: 10, color: Math.floor(G.menuT * 2) % 2 ? '#ffe9a8' : '#ffd166', align: 'center' });
    label(t('unofficial'), W / 2, 210, { size: 8, color: '#8fa0b8', align: 'center' });
  } else {
    label(t('hintKeys'), W / 2, 184, { size: 6, color: 'rgba(150,175,210,.75)', align: 'center', spacing: 1.4 });
    const blink = 0.55 + Math.abs(Math.sin(G.menuT * 2.4)) * 0.45;
    label(t('pressEnter'), W / 2, 194, { size: 8, color: '#eaf6ff', align: 'center', alpha: blink, glow: 'rgba(57,231,255,.9)', glowSize: 10, spacing: 2 });
    label(t('unofficial'), W / 2, 211, { size: 5.5, color: 'rgba(150,170,205,.7)', align: 'center', spacing: 1.4 });
  }
  if (isTouchDevice()) {
    label(t('orTap'), W / 2, 196, { size: GFX === 'retro' ? 8 : 6, color: '#9fe8ff', align: 'center', alpha: 0.85 });
  }
}

function drawControls() {
  const accent = GFX === 'retro' ? '#ffd166' : '#39e7ff';
  ctx.fillStyle = 'rgba(3,4,10,.82)';
  ctx.fillRect(0, 0, W, H);
  panel(22, 16, W - 44, 192, accent, 0.95);
  label(t('controlsTitle'), W / 2, 26, { size: 13, color: accent, align: 'center' });
  const rows = [
    [t('keysArrows'), t('ctrlMove')],
    ['SPACE / Z', t('ctrlFire')],
    ['B / X', t('ctrlBomb')],
    ['P / ESC', t('ctrlPause')],
    ['G', t('ctrlGfx')],
    ['L', t('ctrlLang')],
    ['M', t('ctrlSound')],
    ['ENTER', t('ctrlStart')]
  ];
  const size = GFX === 'retro' ? 8 : 7;
  const top = 48, step = 15;
  for (let i = 0; i < rows.length; i++) {
    const y = top + i * step;
    if (GFX === 'retro') {
      label(rows[i][0], 36, y, { size, color: '#ffe9a8' });
      label(rows[i][1], 150, y, { size, color: '#d7e2f0' });
    } else {
      label(rows[i][0], 36, y, { size, color: '#ffd98a', spacing: 0.8 });
      label(rows[i][1], 150, y, { size, color: 'rgba(225,236,250,.9)' });
      ctx.strokeStyle = 'rgba(255,255,255,.06)';
      ctx.beginPath(); ctx.moveTo(36, y + 11); ctx.lineTo(W - 36, y + 11); ctx.stroke();
    }
  }
  const tsize = GFX === 'retro' ? 7 : 6;
  const touchLines = wrapLines(t('ctrlTouch'), W - 90, tsize);
  for (let i = 0; i < touchLines.length; i++) {
    label(touchLines[i], W / 2, 171 + i * 9, { size: tsize, color: '#9fe8ff', align: 'center', alpha: 0.85 });
  }
  label(t('back'), W / 2, 198, { size: 8, color: accent, align: 'center' });
}

function drawStageIntro() {
  if (G.phase !== 'intro') return;
  const a = G.phaseT < 0.35 ? G.phaseT / 0.35 : (G.phaseT > 1.9 ? clamp((2.4 - G.phaseT) / 0.5, 0, 1) : 1);
  if (a <= 0.01) return;
  const st = stageCfg();
  const x = 10, y = TOP + 8, w = 238, h = 76;
  ctx.save();
  ctx.globalAlpha = a;
  if (GFX === 'retro') {
    ctx.fillStyle = 'rgba(6,8,14,.86)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#ffd166'; ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    ctx.strokeStyle = 'rgba(255,255,255,.14)';
    ctx.strokeRect(x + 3.5, y + 3.5, w - 7, h - 7);
  } else {
    panel(x, y, w, h, st.modern.accent, 0.74);
  }
  label(t('zoneIntro') + ' ' + (G.stage + 1) + ' / ' + STAGES.length, x + 9, y + 7, { size: 8, color: GFX === 'retro' ? '#8fa0b8' : 'rgba(170,195,225,.8)', spacing: 1 });
  label(LANG === 'ru' ? st.ru : st.en, x + 9, y + 19, { size: 13, color: GFX === 'retro' ? '#ffd166' : st.modern.accent, glow: GFX === 'modern', glowSize: 9 });
  label(LANG === 'ru' ? st.ruSub : st.enSub, x + 9, y + 37, { size: 8, color: '#9fe8ff', alpha: 0.85 });
  para(G.stageTip, x + 9, y + 49, w - 18, GFX === 'retro' ? 8 : 7, GFX === 'retro' ? '#cfd8ea' : 'rgba(215,228,245,.8)', 9);
  ctx.restore();
}

function drawWarning() {
  if (G.phase !== 'warn') return;
  const pulse = 0.5 + Math.abs(Math.sin(G.time * 10)) * 0.5;
  ctx.fillStyle = 'rgba(160,20,20,' + (0.10 + pulse * 0.10).toFixed(2) + ')';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(6,4,8,.55)';
  ctx.fillRect(0, H / 2 - 30, W, 60);
  label(t('warning'), W / 2, H / 2 - 22, { size: 12, color: pulse > 0.5 ? '#ff5a2b' : '#ffd166', align: 'center' });
  label(t('bossIncoming'), W / 2, H / 2 - 2, { size: 8, color: '#ffe0c4', align: 'center', alpha: 0.85 });
  if (GFX === 'modern') {
    ctx.save();
    ctx.strokeStyle = 'rgba(255,90,50,.4)';
    ctx.lineWidth = 0.7;
    for (let i = 0; i < 3; i++) {
      const w = W * (0.2 + i * 0.16);
      ctx.beginPath(); ctx.moveTo(W / 2 - w / 2, H / 2 + 16 + i * 4); ctx.lineTo(W / 2 + w / 2, H / 2 + 16 + i * 4); ctx.stroke();
    }
    ctx.restore();
  }
}
function drawClear() {
  if (G.phase !== 'clear') return;
  const st = stageCfg();
  ctx.fillStyle = 'rgba(3,4,10,.5)';
  ctx.fillRect(0, 0, W, H);
  const x = 34, y = 52, w = W - 68, h = 128;
  panel(x, y, w, h, GFX === 'retro' ? '#ffd166' : st.modern.accent, 0.93);
  label(t('stageClear'), W / 2, y + 12, { size: 13, color: GFX === 'retro' ? '#ffd166' : st.modern.accent, align: 'center', glow: GFX === 'modern', glowSize: 12 });
  label(LANG === 'ru' ? st.ru : st.en, W / 2, y + 34, { size: 9, color: '#e8f1ff', align: 'center' });
  label(t('bonus'), W / 2, y + 52, { size: 8, color: '#9fe8ff', align: 'center', alpha: 0.85 });
  label('+' + Math.floor(G.bonusShown), W / 2, y + 63, { size: 14, color: '#ffe08a', align: 'center' });
  const nextIdx = G.stage + 1;
  if (nextIdx < STAGES.length) {
    const ns = STAGES[nextIdx];
    label(t('nextZone') + ': ' + (LANG === 'ru' ? ns.ru : ns.en), W / 2, y + 92, { size: 8, color: '#8fa0b8', align: 'center' });
  } else {
    label(t('allClear'), W / 2, y + 92, { size: 8, color: '#8affc1', align: 'center' });
  }
}

function drawPause() {
  if (G.state !== 'pause') return;
  ctx.fillStyle = 'rgba(3,4,10,.66)';
  ctx.fillRect(0, 0, W, H);
  panel(52, 62, W - 104, 104, GFX === 'retro' ? '#ffd166' : '#39e7ff', 0.93);
  label(t('pause'), W / 2, 76, { size: 15, color: '#ffe9a8', align: 'center' });
  label(t('resume'), W / 2, 104, { size: 8, color: '#d7e2f0', align: 'center' });
  label(t('toMenu'), W / 2, 120, { size: 8, color: '#8fa0b8', align: 'center' });
  label(t('hintKeys'), W / 2, 140, { size: 7, color: '#66758c', align: 'center' });
}

function drawGameOver() {
  if (G.state !== 'gameover') return;
  ctx.fillStyle = 'rgba(3,4,10,.76)';
  ctx.fillRect(0, 0, W, H);
  const accent = GFX === 'retro' ? '#e04a3a' : '#ff2f9c';
  panel(38, 46, W - 76, 140, accent, 0.93);
  label(t('gameover'), W / 2, 58, { size: 15, color: accent, align: 'center', glow: GFX === 'modern', glowSize: 14 });
  label(t('zone') + ' ' + (G.stage + 1) + ' / ' + STAGES.length, W / 2, 80, { size: 8, color: '#8fa0b8', align: 'center' });
  label(t('score'), W / 2, 96, { size: 8, color: '#8fa0b8', align: 'center' });
  label(fmtScore(G.score), W / 2, 104, { size: 18, color: '#eef4ff', align: 'center' });
  label(t('hi') + ' ' + fmtScore(G.hi), W / 2, 128, { size: 8, color: '#ffd166', align: 'center' });
  if (G.newHi) {
    label(t('newRecord'), W / 2, 140, { size: 8, color: Math.floor(G.time * 4) % 2 ? '#ffd166' : '#fff3c4', align: 'center' });
  }
  label(t('restart'), W / 2, 156, { size: 8, color: '#eef4ff', align: 'center', alpha: 0.88 });
  label(t('toMenu'), W / 2, 169, { size: 8, color: '#8fa0b8', align: 'center' });
}

function drawVictory() {
  if (G.state !== 'victory') return;
  ctx.fillStyle = 'rgba(3,4,10,.7)';
  ctx.fillRect(0, 0, W, H);
  const accent = GFX === 'retro' ? '#ffd166' : '#8affc1';
  panel(24, 36, W - 48, 160, accent, 0.94);
  label(t('victory'), W / 2, 46, { size: 17, color: accent, align: 'center', glow: GFX === 'modern', glowSize: 18 });
  label(t('victorySub'), W / 2, 70, { size: 8, color: '#d7e2f0', align: 'center' });
  label(t('score'), W / 2, 92, { size: 8, color: '#8fa0b8', align: 'center' });
  label(fmtScore(G.score), W / 2, 100, { size: 16, color: '#eef4ff', align: 'center' });
  label(t('hi') + ' ' + fmtScore(G.hi), W / 2, 122, { size: 8, color: '#ffd166', align: 'center' });
  label(t('thanks'), W / 2, 140, { size: 9, color: '#9fe8ff', align: 'center' });
  label(t('retry'), W / 2, 158, { size: 8, color: '#eef4ff', align: 'center', alpha: 0.85 });
  label(t('unofficial'), W / 2, 174, { size: 7, color: '#66758c', align: 'center' });
}

function drawWorld() {
  ctx.save();
  if (G.shake > 0.15 && G.state === 'play') {
    ctx.translate((rng() - 0.5) * G.shake, (rng() - 0.5) * G.shake);
  }
  drawBackground();
  drawPickups();
  if (G.boss) drawBoss();
  drawEnemies();
  drawPlayer();
  drawBullets();
  drawParticles();
  ctx.restore();
  drawHUD();
  if (G.phase === 'intro') drawStageIntro();
  if (G.phase === 'warn') drawWarning();
  if (G.phase === 'clear') drawClear();
  if (G.state === 'pause') drawPause();
  if (G.state === 'gameover') drawGameOver();
  if (G.state === 'victory') drawVictory();
}

function render() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, cv.width, cv.height);
  ctx.setTransform(BS, 0, 0, BS, 0, 0);
  ctx.imageSmoothingEnabled = GFX === 'modern';
  if (G.state === 'title' || G.state === 'controls') {
    drawTitle();
    if (G.state === 'controls') drawControls();
  } else {
    drawWorld();
  }
  if (G.flash > 0.01) {
    ctx.save();
    ctx.globalAlpha = Math.min(0.75, G.flash * 0.55);
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
}

/* -------------------------------------------------------------------------
   20. Переключения настроек
   ------------------------------------------------------------------------- */
function toggleGfx() {
  // режим действует до перезагрузки страницы: по умолчанию всегда 8-бит
  CFG.gfx = GFX === 'modern' ? 'retro' : 'modern';
  setGfx(CFG.gfx);
  Sound.sfx('select');
}
function toggleLang() {
  CFG.lang = LANG === 'ru' ? 'en' : 'ru';
  saveCfg();
  setLang(CFG.lang);
  Sound.sfx('select');
}
function toggleSound() {
  CFG.sound = !CFG.sound;
  saveCfg();
  Sound.applyMute();
  toast((LANG === 'ru' ? 'Звук: ' : 'Sound: ') + (CFG.sound ? t('on') : t('off')));
  if (CFG.sound) Sound.sfx('select');
}
function toTitle() {
  G.state = 'title';
  G.freeze = false;
  resetRun();
  G.stage = 0;
  G.phase = 'waves';
  G.scrollX = 0;
  G.scrollSpeed = 0;
  G.player = null;
  G.boss = null;
  G.phaseT = 0;
  G.bonus = 0;
  G.bonusShown = 0;
  Sound.music('title');
}
function pauseGame() {
  if (G.state !== 'play') return;
  G.state = 'pause';
  Sound.stop();
}
function resumeGame() {
  if (G.state !== 'pause') return;
  G.state = 'play';
  Sound.music(G.phase === 'boss' ? 'boss' : 'stage', true);
}

/* -------------------------------------------------------------------------
   21. Обновление состояний
   ------------------------------------------------------------------------- */
function updateTitle(dt) {
  G.scrollX += 26 * dt;
  const items = menuItems();
  if (Input.just('up')) { G.menu = (G.menu - 1 + items.length) % items.length; Sound.sfx('select'); }
  if (Input.just('down')) { G.menu = (G.menu + 1) % items.length; Sound.sfx('select'); }
  if (Input.just('enter')) menuActivate();
}
function updateGameover() {
  G.goT = (G.goT || 0) + 1 / 60;
  if (Input.just('enter')) { Sound.unlock(); newGame(); }
  else if (Input.just('escape')) toTitle();
}
function updateVictory() {
  if (Input.just('enter') || Input.just('escape')) toTitle();
}
function handleGlobals() {
  if (Input.just('gfx')) toggleGfx();
  if (Input.just('lang')) toggleLang();
  if (Input.just('sound')) toggleSound();
}
function update(dt) {
  G.frame++;
  G.time += dt;
  G.menuT += dt;
  handleGlobals();
  switch (G.state) {
    case 'title':
      updateTitle(dt);
      break;
    case 'controls':
      if (Input.just('escape') || Input.just('enter')) { G.state = 'title'; Sound.sfx('select'); }
      break;
    case 'play':
      if (Input.just('pause') || Input.just('escape')) { pauseGame(); break; }
      updatePlay(dt);
      break;
    case 'pause':
      if (Input.just('pause') || Input.just('enter')) resumeGame();
      else if (Input.just('escape')) toTitle();
      break;
    case 'gameover':
      updateGameover();
      break;
    case 'victory':
      updateVictory();
      break;
  }
}

/* -------------------------------------------------------------------------
   22. Тач-управление
   ------------------------------------------------------------------------- */
function bindPointer() {
  const toGame = ev => {
    const r = cv.getBoundingClientRect();
    return { x: (ev.clientX - r.left) / r.width * W, y: (ev.clientY - r.top) / r.height * H };
  };
  cv.addEventListener('pointerdown', ev => {
    try { ev.preventDefault(); } catch (e) { /* ignore */ }
    Sound.unlock();
    if (G.state === 'title') { newGame(); return; }
    if (G.state === 'controls') { G.state = 'title'; return; }
    if (G.state === 'gameover' || G.state === 'victory') { newGame(); return; }
    if (G.state === 'pause') { resumeGame(); return; }
    if (G.state === 'play') {
      const p = toGame(ev);
      if (isTouchDevice() && p.y < TOP + 6 && p.x > W - 34) { pauseGame(); return; }
      Input.touch.active = true;
      Input.touch.x = p.x; Input.touch.y = p.y; Input.touch.fire = true;
      G.touchId = ev.pointerId;
      try { cv.setPointerCapture(ev.pointerId); } catch (e) { /* ignore */ }
    }
  }, { passive: false });
  cv.addEventListener('pointermove', ev => {
    if (!Input.touch.active || ev.pointerId !== G.touchId) return;
    const p = toGame(ev);
    Input.touch.x = p.x; Input.touch.y = p.y;
  }, { passive: true });
  const stop = ev => {
    if (ev.pointerId !== G.touchId) return;
    Input.touch.active = false;
    Input.touch.fire = false;
  };
  cv.addEventListener('pointerup', stop);
  cv.addEventListener('pointercancel', stop);
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden && G.state === 'play') pauseGame();
});

/* -------------------------------------------------------------------------
   23. Отладочные режимы для скриншотов и автотестов
   ------------------------------------------------------------------------- */
function spawnShowcase() {
  const p = G.player;
  if (!p) return;
  p.x = 62; p.y = 118; p.invuln = 0; p.shield = 1; p.weapon = 3;
  G.weapon = 3; G.score = 23780; G.hi = 45600; G.lives = 2; G.bombs = 3;
  const spots = [
    ['tank', 168, GND - 6], ['tank', 246, GND - 6], ['aa', 288, GND - 6],
    ['kite', 196, 66], ['kite', 268, 112], ['jet', 300, 84], ['truck', 132, GND - 5]
  ];
  for (const s of spots) {
    const e = spawnEnemy(s[0], s[2]);
    if (e) { e.x = s[1]; e.baseY = s[2]; e.y = s[2]; e.fireT = 99; }
  }
  G.pickups.push({ x: 124, y: 96, w: 10, h: 10, type: 'P', vy: 0, t: 0, bob: 1 });
  G.pickups.push({ x: 212, y: 150, w: 10, h: 10, type: 'S', vy: 0, t: 0, bob: 3 });
  G.bullets.push({ x: 84, y: 116, vx: 430, vy: 0, w: 7, h: 3, dmg: 1, life: 2.4, kind: 'heavy' });
  G.bullets.push({ x: 88, y: 121, vx: 430, vy: 0, w: 7, h: 3, dmg: 1, life: 2.4, kind: 'std' });
  boom(168, 150, 5);
  G.parts.push({ x: 246, y: 152, vx: -20, vy: -40, life: 0.6, max: 0.6, size: 3, col: '#ffb347', kind: 'smoke', grav: -10, drag: 0.97, rot: 0, spin: 0 });
}
function setupShot(name, params) {
  const stageIdx = clamp((parseInt(params.get('stage') || '1', 10) || 1) - 1, 0, STAGES.length - 1);
  const st = STAGES[stageIdx];
  G.freeze = true;
  if (name === 'title') {
    G.state = 'title'; G.freeze = false;
    G.hi = 45600; G.stage = 0;
    return;
  }
  if (name === 'controls') {
    G.state = 'controls'; G.freeze = false;
    G.hi = 45600; G.stage = 0;
    return;
  }
  if (name === 'gameover') {
    resetRun();
    G.state = 'gameover';
    G.stage = 1; G.score = 48210; G.hi = 48210; G.player = null; G.boss = null;
    G.freeze = true;
    return;
  }
  if (name === 'victory') {
    resetRun();
    G.state = 'victory';
    G.score = 128450; G.hi = 128450; G.stage = 3; G.player = null; G.boss = null;
    G.freeze = true;
    return;
  }
  newGame();
  startStage(stageIdx);
  G.state = 'play';
  G.freeze = true;
  G.scrollSpeed = st.scroll;
  if (name === 'boss') {
    G.phase = 'boss'; G.waves = [];
    G.scrollX = st.len; G.player = makePlayer();
    G.player.x = 54; G.player.y = 118; G.player.shield = 1; G.player.weapon = 3;
    G.weapon = 3; G.score = 31240; G.hi = 45600; G.lives = 2; G.bombs = 3;
    spawnBoss();
    if (G.boss) { G.boss.entering = false; G.boss.x = W - 78; G.boss.y = 106; G.boss.fireT = 99; }
    G.ebullets.push({ x: 160, y: 90, vx: -60, vy: 20, w: 4, h: 4, life: 5, col: '#ff8a5a', t: 0 });
    G.ebullets.push({ x: 220, y: 120, vx: -120, vy: 10, w: 4, h: 4, life: 5, col: '#ffd166', t: 0 });
    G.ebullets.push({ x: 250, y: 150, vx: -40, vy: 40, w: 4, h: 4, life: 5, col: '#ffd166', t: 0 });
    boom(210, 130, 5);
  } else if (name === 'clear') {
    G.phase = 'clear'; G.waves = []; G.scrollX = st.len * 0.72;
    G.player = makePlayer(); G.player.x = 58; G.player.y = 110; G.player.weapon = 3; G.player.shield = 1;
    G.weapon = 3; G.score = 38400; G.hi = 45600; G.lives = 2; G.bombs = 3;
    G.clearT = 2.4; G.bonus = 4500; G.bonusShown = 2600;
    boom(180, 120, 6);
  } else if (name === 'pause') {
    G.state = 'pause';
    spawnShowcase();
  } else if (name === 'intro') {
    G.phase = 'intro'; G.phaseT = 0.9; G.waves = []; G.scrollX = st.len * 0.3;
    G.weapon = 3; G.score = 18240; G.hi = 45600; G.lives = 3; G.bombs = 3;
    spawnShowcase();
  } else {
    G.phase = 'waves';
    G.scrollX = st.len * 0.36;
    G.waveIdx = G.waves.filter(w => w.at <= G.scrollX).length;
    spawnShowcase();
  }
}

function runTests() {
  const results = [];
  const check = (name, fn) => {
    let ok = false, msg = '';
    try {
      const r = fn();
      ok = r !== false;
      if (r === false) msg = 'вернуло false';
    } catch (e) { msg = e && e.message ? e.message : String(e); }
    results.push({ name, ok, msg });
  };

  check('локализация: наборы ключей ru/en совпадают', () => {
    const a = Object.keys(I18N.ru).sort(), b = Object.keys(I18N.en).sort();
    return a.length === b.length && a.every((k, i) => k === b[i]);
  });
  check('конфигурация: 4 зоны, палитры и боссы', () => STAGES.length === 4 &&
    STAGES.every(s => s.retro && s.modern && s.boss.hp > 0 && s.mix.length >= 3 && s.len > 3000));
  check('волны: детерминированы', () => {
    const a = JSON.stringify(makeWaves(0)), b = JSON.stringify(makeWaves(0));
    return a === b && makeWaves(0).length > 8;
  });
  check('волны: в границах зоны и известных типах', () => STAGES.every((s, i) =>
    makeWaves(i).every(w => w.at > 0 && w.at < s.len && ENEMY_KINDS.indexOf(w.type) >= 0)));
  check('коллизии: пересечение AABB', () =>
    aabb({ x: 10, y: 10, w: 10, h: 10 }, { x: 14, y: 12, w: 10, h: 10 }) === true);
  check('коллизии: без пересечения', () =>
    aabb({ x: 0, y: 0, w: 10, h: 10 }, { x: 40, y: 0, w: 10, h: 10 }) === false);
  check('коллизии: касание не считается попаданием', () =>
    rectHit(0, 0, 10, 10, 10, 0, 10, 10) === false);
  check('очки: формат 6 цифр', () => fmtScore(42) === '000042' && fmtScore(123456) === '123456');
  check('оружие: уровни 1–4 дают 1–4 пули', () => {
    const counts = [];
    for (let w = 1; w <= 4; w++) {
      G.player = makePlayer(); G.player.weapon = w; G.bullets = []; G.frame = 0;
      playerShoot();
      counts.push(G.bullets.length);
    }
    G.player = null; G.bullets = [];
    return counts.join(',') === '1,2,3,4';
  });
  check('оружие: пули летят вперёд', () => {
    G.player = makePlayer(); G.player.weapon = 4; G.bullets = []; G.frame = 0;
    playerShoot();
    const ok = G.bullets.length === 4 && G.bullets.every(b => b.vx > 300);
    G.player = null; G.bullets = [];
    return ok;
  });
  check('бонусы: типы выдачи корректны', () => {
    G.player = makePlayer(); G.weapon = 1;
    const types = new Set();
    for (let i = 0; i < 400; i++) { dropPickup(100, 100); types.add(G.pickups[G.pickups.length - 1].type); }
    G.pickups = []; G.player = null;
    return ['P', 'S', 'B', '1UP'].every(ty => types.has(ty));
  });
  check('щит: поглощает попадание', () => {
    G.player = makePlayer(); G.player.shield = 1; G.player.invuln = 0; G.lives = 3;
    playerHit();
    const ok = G.player.shield === 0 && !G.player.dead && G.lives === 3;
    G.player = null; G.lives = 3;
    return ok;
  });
  check('смерть: снимает жизнь', () => {
    G.player = makePlayer(); G.player.invuln = 0; G.lives = 3;
    playerHit();
    const ok = G.player.dead === true && G.lives === 2;
    G.player = null; G.lives = 3;
    return ok;
  });
  check('босс: получает урон и умирает', () => {
    startStage(0); spawnBoss();
    const hp = G.boss.hp;
    damageBoss(10);
    const hitOk = G.boss.hp === hp - 10;
    damageBoss(999999);
    const deadOk = G.boss.dead === true;
    G.boss = null;
    return hitOk && deadOk;
  });
  check('зоны: переключение графики', () => {
    const before = GFX;
    setGfx(before === 'retro' ? 'modern' : 'retro', true);
    const changed = GFX !== before;
    setGfx(before, true);
    return changed;
  });
  check('локализация: переключение языка', () => {
    const before = LANG;
    setLang(before === 'ru' ? 'en' : 'ru', true);
    const changed = LANG !== before;
    setLang(before, true);
    return changed;
  });
  check('графика: старт всегда 8-бит, режим не сохраняется', () => {
    const before = GFX;
    setGfx('modern', true);
    CFG.gfx = 'modern';
    saveCfg();
    const raw = JSON.parse(localStorage.getItem(CFG_KEY) || '{}');
    const ok = !('gfx' in raw);
    setGfx(before, true);
    CFG.gfx = before;
    return ok;
  });
  check('рекорд: запись и чтение', () => {
    saveHi(4321);
    return loadHi() === 4321;
  });
  check('холст: пропорции 320×224', () => cv.width / cv.height === W / H);
  check('аудиодвижок подключён', () => !!(window.SWAudio && typeof window.SWAudio.playMusic === 'function'));
  if (window.SWAudio && typeof window.SWAudio.selftest === 'function') {
    try {
      const arr = window.SWAudio.selftest();
      for (const r of arr) check('аудио: ' + r.name, () => r.ok === true);
    } catch (e) {
      check('аудио: selftest', () => false);
    }
  }

  const pass = results.filter(r => r.ok).length;
  document.title = 'SW TESTS ' + pass + '/' + results.length + (pass === results.length ? ' PASS' : ' FAIL');
  const out = document.getElementById('testout');
  if (out) {
    out.style.display = 'block';
    out.textContent = 'ВИХРЬ · ' + document.title + '\n\n' +
      results.map(r => (r.ok ? '  ✓ ' : '  ✗ ') + r.name + (r.msg ? ' — ' + r.msg : '')).join('\n') +
      '\n\n' + (pass === results.length ? 'ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ' : 'ЕСТЬ ОШИБКИ');
  }
  window.__SW_TESTS__ = { results, pass, total: results.length };
  // вернуть игру в исходное состояние
  G.freeze = false;
  toTitle();
}

/* -------------------------------------------------------------------------
   23b. Симуляция: прогон игры без рендера (для автотестов и отладки).
   Возвращает события смены состояний/зон/фаз и итог.
   ------------------------------------------------------------------------- */
function simulate(seconds) {
  seconds = clamp(parseFloat(seconds) || 240, 5, 1200);
  const steps = Math.round(seconds * 60);
  const events = [];
  G.freeze = false;
  newGame();
  let last = { state: G.state, stage: G.stage, phase: G.phase, lives: G.lives };
  for (let i = 0; i < steps; i++) {
    const pl = G.player;
    if (pl && !pl.dead) {
      pl.invuln = Math.max(pl.invuln, 0.05);      // симуляция «идеального» пилота
      let targetY = G.boss ? G.boss.y : 112;
      let best = Infinity;
      for (const e of G.enemies) {
        if (e.dead) continue;
        const dx = e.x - pl.x;
        if (e.x > pl.x && dx < best) { best = dx; targetY = e.y; }
      }
      const targetX = 58 + Math.sin(i / 110) * 12;
      Input.down.fire = true;
      Input.down.up = pl.y > targetY + 5;
      Input.down.down = pl.y < targetY - 5;
      Input.down.left = pl.x > targetX + 2;
      Input.down.right = pl.x < targetX - 2;
    }
    update(STEP);
    if (G.state !== last.state) { events.push('state ' + last.state + '>' + G.state + ' @' + (i / 60).toFixed(1) + 's'); last.state = G.state; }
    if (G.stage !== last.stage) { events.push('stage ' + (last.stage + 1) + '>' + (G.stage + 1) + ' @' + (i / 60).toFixed(1) + 's'); last.stage = G.stage; }
    if (G.phase !== last.phase) { events.push('phase ' + last.phase + '>' + G.phase + ' @' + (i / 60).toFixed(1) + 's'); last.phase = G.phase; }
    if (G.state === 'gameover' || G.state === 'victory') break;
  }
  Input.down = Object.create(null);
  Input.hit = Object.create(null);
  const res = {
    state: G.state,
    stage: G.stage + 1,
    phase: G.phase,
    score: G.score,
    lives: G.lives,
    time: +(G.time || 0).toFixed(1),
    events,
    enemies: G.enemies.length,
    parts: G.parts.length
  };
  toTitle();
  return res;
}

function parseHash() {
  if (!location.hash || location.hash.length < 2) return;
  const params = new URLSearchParams(location.hash.replace(/^#/, ''));
  if (params.get('lang') === 'en') { CFG.lang = 'en'; setLang('en', true); }
  else if (params.get('lang') === 'ru') { CFG.lang = 'ru'; setLang('ru', true); }
  if (params.get('gfx') === 'modern') { CFG.gfx = 'modern'; setGfx('modern', true); }
  else if (params.get('gfx') === 'retro') { CFG.gfx = 'retro'; setGfx('retro', true); }
  if (params.get('mute') === '1') { CFG.sound = false; }
  const shot = params.get('shot');
  if (shot) setupShot(shot, params);
  if (params.has('sim')) {
    const r = simulate(parseFloat(params.get('sim') || '300'));
    document.title = 'SW SIM ' + r.state.toUpperCase() + ' stage=' + r.stage + ' score=' + r.score + ' t=' + r.time + 's';
    const out = document.getElementById('testout');
    if (out) {
      out.style.display = 'block';
      out.textContent = 'ВИХРЬ SIM\n' + JSON.stringify(r, null, 2);
    }
    window.__SW_SIM__ = r;
  }
  if (params.has('test')) runTests();
}

/* -------------------------------------------------------------------------
   24. Главный цикл
   ------------------------------------------------------------------------- */
const STEP = 1 / 60;
let lastTs = 0, acc = 0;
function loop(ts) {
  requestAnimationFrame(loop);
  if (!lastTs) lastTs = ts;
  let dt = (ts - lastTs) / 1000;
  lastTs = ts;
  if (!isFinite(dt) || dt < 0) dt = 0;
  dt = Math.min(dt, 0.1);
  acc += dt;
  let guard = 0;
  while (acc >= STEP && guard < 5) {
    update(STEP);
    acc -= STEP;
    guard++;
  }
  if (guard >= 5) acc = 0;
  Input.endFrame();
  render();
}

/* -------------------------------------------------------------------------
   25. Запуск
   ------------------------------------------------------------------------- */
function boot() {
  loadCfg();
  CFG.gfx = 'retro';                 // по умолчанию всегда 8-битный режим
  LANG = CFG.lang === 'en' ? 'en' : 'ru';
  defineSprites();
  Input.init();
  bindPointer();
  G.hi = loadHi();
  setGfx(CFG.gfx, true);
  setLang(LANG, true);
  resize();
  G.state = 'title';
  G.phase = 'waves';
  Sound.music('title');
  Sound.applyMute();
  parseHash();
  if (window.SWAudio && typeof window.SWAudio.isReady === 'function') {
    try { Sound.ready = !!window.SWAudio.isReady(); } catch (e) { /* ignore */ }
  }
  // отладочный доступ из консоли и автотестов
  window.__SW = {
    G, STAGES, GFX: () => GFX, LANG: () => LANG,
    setGfx, setLang, newGame, startStage, spawnBoss, spawnShowcase,
    updatePlay, render, runTests, makeWaves, I18N, Sound, simulate,
    // для оболочки движка v2 (js/host.js): меню/пауза/звук через родные функции
    CFG, toTitle, pauseGame, resumeGame, toggleSound
  };
  requestAnimationFrame(loop);
}

boot();

})();
