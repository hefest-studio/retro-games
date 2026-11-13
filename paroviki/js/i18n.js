/* ПАРОВИКИ · i18n (RU/EN). PAROVIKI.STR — таблицы для Arcade.createGame({strings}).
   Ключи play/language/theme/... нужны стандартным экранам движка, players/touch1p — g.usePlayers; остальные — игре. */
(function (global) {
  'use strict';
  var PV = global.PAROVIKI = global.PAROVIKI || {};
  PV.STR = {
    ru: {
      play: 'Новая игра', players: 'Игроки', touch1p: 'тач — 1 игрок', language: 'Язык', theme: 'Тема', sound: 'Звук', on: 'вкл', off: 'выкл',
      score: 'Счёт', level: 'Уровень', best: 'Рекорд', win: 'МАШИНА ПОГАШЕНА! ГУБЕРНИЯ СПАСЕНА', gameover: 'ПАР ВЫШЕЛ',
      pause: 'ПАУЗА', resume: 'Продолжить', menu: 'В меню', tapstart: 'пробел / тап',
      title: 'ПАРОВИКИ', subtitle: 'Подрядчики «Гефеста» против взбесившейся Паровой Машины',
      back: 'Каталог', p1: 'И1', p2: 'И2', ai: 'ИИ', aiMate: 'Напарник (ИИ)', hero1: 'Герой И1', hero2: 'Герой И2',
      cont: 'Продолжить', contFrom: 'мир', pass: 'Пароль', passTitle: 'ВВОД ПАРОЛЯ', passHint: 'буквы и цифры · ↑↓ — знак · ←→ — место · Enter — ввод · Esc — назад', passBad: 'Неверный пароль', passOk: 'Пароль принят',
      h_klepa: 'Клёпа', h_gudok: 'Гудок', h_shest: 'Шестерня', h_fonar: 'Фонарь',
      hd_klepa: 'быстрый заклёпочник · латает обоих', hd_gudok: 'паровая мортирка с разрывом · котёл-бомба', hd_shest: 'пилы с рикошетом · зонт-щит', hd_fonar: 'разрядник насквозь · лоция и оглушение',
      g_rivet: 'Заклёпочник', g_steam: 'Паровая мортирка', g_saw: 'Пилометатель', g_bolt: 'Разрядник',
      s_heal: 'Заплатка', s_bomb: 'Котёл-бомба', s_shield: 'Зонт-щит', s_chart: 'Лоция',
      sd_heal: 'лечит обоих, поднимает напарника', sd_bomb: 'урон всем вокруг, гасит снаряды', sd_shield: 'неуязвимость обоим на 5 с', sd_chart: 'открывает карту, оглушает чудищ',
      u_gun: 'Ствол', u_hp: 'Котёл (+25 здоровья)', u_heal: 'Латка (всё здоровье)', u_spec: 'Заряд спецприёма',
      u_speed: 'Лёгкий шаг (скорость +8%)', u_life: 'Запасная жизнь', u_armor: 'Клёпаная броня (урон −12%)', u_magnet: 'Магнит для монет', u_regen: 'Самовар (сам лечится)',
      u_ready: 'Готов → в путь', tier: 'ступень', max: 'предел', noMoney: 'не хватает', owned: 'есть',
      shop: 'ЛАВКА «ГЕФЕСТА»', shopHint: '↑↓ — выбор · огонь — купить', aiBuys: 'ИИ-напарник закупился сам:', aiNothing: 'копит деньги', waitMate: 'ждём напарника…', money: 'Деньги', next: 'Дальше',
      w_1: 'Угольные копи', w_2: 'Паровой порт', w_3: 'Часовая слобода', w_4: 'Котельная Губернии',
      world: 'МИР', lvlShort: 'Ур.', worldShort: 'Мир', bossLvl: 'механизм',
      b_drill: 'БУР-ЗЕМЛЕРОЙ', b_crane: 'КРАН-КЛЕШНЯ', b_pendulum: 'МАЯТНИК-ГИРЕВИК', b_machine: 'ПАРОВАЯ МАШИНА ГУБЕРНИИ',
      bossSub: 'Крути вентили — давление спадёт, броня откроется',
      introSub: 'Открой все узлы-вентили — откроется шлюз',
      valves: 'Вентили', keys: 'Ключи', valveOn: 'ВЕНТИЛЬ ОТКРЫТ', valveLeft: 'осталось', exitOpen: 'ШЛЮЗ ОТКРЫТ!', toExit: 'к шлюзу',
      secret: 'ТАЙНИК!', key: '+ключ', lever: 'ЗАСЛОНКА ПОДНЯТА', door: 'ДВЕРЬ ОТПЕРТА', food: '+здоровье', charge: '+заряд', chest: 'сундук',
      armorDown: 'ДАВЛЕНИЕ СБРОШЕНО', armorOff: 'БРОНЯ СНЯТА!', levelDone: 'УРОВЕНЬ ПРОЙДЕН', bossDone: 'МЕХАНИЗМ ОСТАНОВЛЕН', bonus: 'Бонус',
      warp: 'паровой рывок', down: 'ВЫВЕДЕН ИЗ СТРОЯ', revive: 'снова в строю', out: 'выбыл', lives: 'жизни', hpShort: 'здоровье',
      contAsk: 'ПРОДОЛЖИТЬ?', contHint: 'огонь / Enter — снова в бой', contLeft: 'продолжений', continued: 'ПРОДОЛЖЕНИЕ', saved: 'сохранено', password: 'Пароль уровня',
      hint1: 'И1: стрелки — ход, / или пробел — огонь, , или правый Shift — спецприём',
      hint2: 'И2: WASD — ход, F — огонь, G или Q — спецприём · 1/2 — игроки',
      foot: '<b>ПАРОВИКИ</b> · стрелки — ход, <b>/</b> . пробел — огонь (пока держишь — герой не разворачивается), <b>,</b> правый Shift — спецприём · И2: WASD, F — огонь, G/Q — спецприём · 1/2 на заставке — игроки · P/Esc пауза · L язык, T тема, M звук. Один игрок — второго ведёт ИИ-напарник.'
    },
    en: {
      play: 'New game', players: 'Players', touch1p: 'touch — 1 player', language: 'Language', theme: 'Theme', sound: 'Sound', on: 'on', off: 'off',
      score: 'Score', level: 'Level', best: 'Best', win: 'THE MACHINE IS DOWN! PROVINCE SAVED', gameover: 'OUT OF STEAM',
      pause: 'PAUSED', resume: 'Resume', menu: 'Menu', tapstart: 'space / tap',
      title: 'PAROVIKI', subtitle: 'Hefest contractors versus the runaway Steam Machine',
      back: 'Catalog', p1: 'P1', p2: 'P2', ai: 'AI', aiMate: 'Partner (AI)', hero1: 'P1 hero', hero2: 'P2 hero',
      cont: 'Continue', contFrom: 'world', pass: 'Password', passTitle: 'ENTER PASSWORD', passHint: 'letters and digits · ↑↓ — char · ←→ — slot · Enter — ok · Esc — back', passBad: 'Wrong password', passOk: 'Password accepted',
      h_klepa: 'Rivet', h_gudok: 'Hooter', h_shest: 'Cog', h_fonar: 'Lantern',
      hd_klepa: 'rapid rivet gun · patches both', hd_gudok: 'bursting steam mortar · boiler bomb', hd_shest: 'ricochet saws · umbrella shield', hd_fonar: 'piercing arc · chart and stun',
      g_rivet: 'Rivet gun', g_steam: 'Steam mortar', g_saw: 'Saw thrower', g_bolt: 'Arc caster',
      s_heal: 'Patch-up', s_bomb: 'Boiler bomb', s_shield: 'Umbrella shield', s_chart: 'Chart',
      sd_heal: 'heals both, revives the partner', sd_bomb: 'hurts all around, clears shots', sd_shield: 'both invulnerable for 5 s', sd_chart: 'reveals the map, stuns monsters',
      u_gun: 'Gun', u_hp: 'Boiler (+25 health)', u_heal: 'Patch (full health)', u_spec: 'Special charge',
      u_speed: 'Light step (speed +8%)', u_life: 'Spare life', u_armor: 'Riveted armour (−12% damage)', u_magnet: 'Coin magnet', u_regen: 'Samovar (self-repair)',
      u_ready: 'Ready → move on', tier: 'tier', max: 'max', noMoney: 'short by', owned: 'owned',
      shop: 'HEFEST STORE', shopHint: '↑↓ — choose · fire — buy', aiBuys: 'The AI partner shopped by itself:', aiNothing: 'saving up', waitMate: 'waiting for partner…', money: 'Money', next: 'Next',
      w_1: 'Coal Pits', w_2: 'Steam Docks', w_3: 'Clockwork Quarter', w_4: 'Province Boilerhouse',
      world: 'WORLD', lvlShort: 'Lv.', worldShort: 'World', bossLvl: 'mechanism',
      b_drill: 'BURROW DRILL', b_crane: 'CLAW CRANE', b_pendulum: 'WEIGHT PENDULUM', b_machine: 'PROVINCE STEAM MACHINE',
      bossSub: 'Turn the valves — pressure drops, armour opens',
      introSub: 'Open every valve node — the sluice will open',
      valves: 'Valves', keys: 'Keys', valveOn: 'VALVE OPEN', valveLeft: 'left', exitOpen: 'SLUICE OPEN!', toExit: 'to the sluice',
      secret: 'SECRET!', key: '+key', lever: 'GATE RAISED', door: 'DOOR UNLOCKED', food: '+health', charge: '+charge', chest: 'chest',
      armorDown: 'PRESSURE RELEASED', armorOff: 'ARMOUR OFF!', levelDone: 'LEVEL CLEAR', bossDone: 'MECHANISM STOPPED', bonus: 'Bonus',
      warp: 'steam dash', down: 'KNOCKED OUT', revive: 'back in action', out: 'out', lives: 'lives', hpShort: 'health',
      contAsk: 'CONTINUE?', contHint: 'fire / Enter — back to the fight', contLeft: 'continues', continued: 'CONTINUE', saved: 'saved', password: 'Level password',
      hint1: 'P1: arrows — move, / or space — fire, , or right Shift — special',
      hint2: 'P2: WASD — move, F — fire, G or Q — special · 1/2 — players',
      foot: '<b>PAROVIKI</b> · arrows — move, <b>/</b> . space — fire (hold to keep facing), <b>,</b> right Shift — special · P2: WASD, F — fire, G/Q — special · 1/2 on the title — players · P/Esc pause · L language, T theme, M sound. Playing solo, an AI partner takes the second hero.'
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
