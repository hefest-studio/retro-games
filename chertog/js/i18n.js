/* ЧЕРТОГ · i18n (RU/EN). CHERTOG.STR — таблицы для Arcade.createGame({strings}).
   Ключи play/language/theme/... нужны стандартным экранам движка; остальные — игре. */
(function (global) {
  'use strict';
  var C = global.CHERTOG = global.CHERTOG || {};
  C.STR = {
    ru: {
      play: 'Новая игра', language: 'Язык', theme: 'Тема', sound: 'Звук', on: 'вкл', off: 'выкл',
      score: 'Счёт', level: 'Уровень', best: 'Рекорд', bestTime: 'Лучшее время', time: 'Время',
      win: 'МАСТЕР СВОБОДЕН!', gameover: 'НАСТАЛ РАССВЕТ',
      pause: 'ПАУЗА', resume: 'Продолжить', menu: 'В меню', tapstart: 'пробел / тап',
      title: 'ЧЕРТОГ', subtitle: 'Подземный Чертог Медного Наместника',
      sub2: 'Подмастерье-беглец спасает учителя до рассвета',
      cont: 'Продолжить', restart: 'Заново уровень', back: 'Каталог', left: 'до рассвета', final: 'финал',
      l1: 'Нижние кладовые', l2: 'Колодезный ярус', l3: 'Ржавые галереи', l4: 'Литейный ход', l5: 'Часовые залы',
      l6: 'Казармы стражи', l7: 'Палата весов', l8: 'Медная лестница', l9: 'Литейная яма',
      g: 'Стражник', f: 'Дуэлянт', w: 'Щитник', m: 'Автоматон', N: 'Медный Наместник', Z: 'Медный двойник',
      intro1: 'До рассвета — 45 минут. Учитель томится у Литейной ямы.',
      introN: 'Дверь впереди. Время уходит.',
      h_step: 'Шипы: переходи осторожным шагом — Shift + стрелка',
      h_climb: '↑ у края над головой — подтянуться · ↓ у края — спуститься',
      h_fight: 'Бой: Пробел — выпад · ↑ — защита · ← → — шаг',
      h_plate: 'Плита подняла решётку — она скоро опустится!',
      h_chop: 'Ножницы: выжди, пока лезвия разойдутся',
      h_door: 'Найди плиту, что открывает дверь',
      h_twin: 'Медный двойник отлит по твоему слепку и повторяет каждое твоё движение — меч его не берёт. Заведи его в его же ловушку!',
      h_cage: 'Клетка открыта — ↑, чтобы освободить мастера',
      doorOpen: 'Дверь выхода открыта', slam: 'Решётки упали!', poison: 'Яд!', heal: '+1 здоровье', maxUp: 'Сила растёт: +1 к здоровью',
      hit: 'Удар!', parried: 'Защита', killed: 'повержен', twinDown: 'Двойник разбит!', bossDown: 'Наместник пал… но литейная форма раскрывается',
      d_spike: 'Шипы', d_chop: 'Ножницы', d_fall: 'Падение', d_abyss: 'Пропасть', d_sword: 'Клинок', d_plate: 'Плита', d_poison: 'Яд', d_twin: 'Двойник',
      again: 'уровень начнётся заново', timeup: 'Время вышло — солнце встало над Чертогом',
      hint: '←→ бег · Shift шаг · ↑ прыжок · ↓ вниз/пить · Пробел выпад · P пауза',
      foot: '<b>ЧЕРТОГ</b> · ← → / A D — бег · Shift + стрелка — осторожный шаг · ↑ / W — прыжок вверх, с разбега, подтянуться · ↑ + стрелка — прыжок с места · ↓ / S — спуститься с края, выпить зелье · бой: Пробел / X — выпад, ↑ — защита, ← → — шаг · P / Esc — пауза · L язык, T тема, M звук.'
    },
    en: {
      play: 'New game', language: 'Language', theme: 'Theme', sound: 'Sound', on: 'on', off: 'off',
      score: 'Score', level: 'Level', best: 'Best', bestTime: 'Best time', time: 'Time',
      win: 'THE MASTER IS FREE!', gameover: 'DAWN HAS COME',
      pause: 'PAUSE', resume: 'Resume', menu: 'Menu', tapstart: 'space / tap',
      title: 'CHERTOG', subtitle: 'The underground Hall of the Copper Viceroy',
      sub2: 'A runaway apprentice must free his master before dawn',
      cont: 'Continue', restart: 'Restart level', back: 'Catalog', left: 'to dawn', final: 'finale',
      l1: 'Lower Storerooms', l2: 'Well Tier', l3: 'Rusted Galleries', l4: 'Foundry Passage', l5: 'Clockwork Halls',
      l6: 'Guard Barracks', l7: 'Hall of Scales', l8: 'Copper Stair', l9: 'The Casting Pit',
      g: 'Guard', f: 'Duelist', w: 'Shieldman', m: 'Automaton', N: 'Copper Viceroy', Z: 'Copper Twin',
      intro1: '45 minutes until dawn. Your master waits by the Casting Pit.',
      introN: 'The door lies ahead. Time is running out.',
      h_step: 'Spikes: cross with careful steps — Shift + arrow',
      h_climb: '↑ under a ledge — pull up · ↓ at an edge — climb down',
      h_fight: 'Fight: Space — lunge · ↑ — parry · ← → — step',
      h_plate: 'The plate raised a gate — it will drop soon!',
      h_chop: 'Shears: wait until the blades part',
      h_door: 'Find the plate that opens the door',
      h_twin: 'The copper twin, cast from your likeness, copies your every move — steel won’t touch it. Lure it into its own trap!',
      h_cage: 'The cage is open — press ↑ to free your master',
      doorOpen: 'The exit door is open', slam: 'The gates slammed shut!', poison: 'Poison!', heal: '+1 health', maxUp: 'Stronger: +1 max health',
      hit: 'Hit!', parried: 'Parry', killed: 'defeated', twinDown: 'The twin is shattered!', bossDown: 'The Viceroy falls… but the casting mold cracks open',
      d_spike: 'Spikes', d_chop: 'Shears', d_fall: 'Fall', d_abyss: 'Abyss', d_sword: 'Blade', d_plate: 'Plate', d_poison: 'Poison', d_twin: 'Twin',
      again: 'the level restarts', timeup: 'Time is up — the sun rises over the Hall',
      hint: '←→ run · Shift step · ↑ jump · ↓ down/drink · Space lunge · P pause',
      foot: '<b>CHERTOG</b> · ← → / A D — run · Shift + arrow — careful step · ↑ / W — jump up, running jump, pull up · ↑ + arrow — standing jump · ↓ / S — climb down, drink a potion · fight: Space / X — lunge, ↑ — parry, ← → — step · P / Esc — pause · L language, T theme, M sound.'
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
