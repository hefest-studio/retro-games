/* НАЛЁТ · i18n (RU/EN). NALYOT.STR — таблицы для Arcade.createGame({strings}).
   Ключи play/language/theme/... нужны стандартным экранам движка, players/touch1p — g.usePlayers; остальные — игре. */
(function (global) {
  'use strict';
  var N = global.NALYOT = global.NALYOT || {};
  N.STR = {
    ru: {
      play: 'Играть', players: 'Игроки', touch1p: 'тач — 1 игрок', language: 'Язык', theme: 'Тема', sound: 'Звук', on: 'вкл', off: 'выкл',
      score: 'Счёт', level: 'Миссия', best: 'Рекорд', win: 'ОКАЛИНА РАЗБИТА!', gameover: 'НАЛЁТ ОТБИТ… ПОКА',
      pause: 'ПАУЗА', resume: 'Продолжить', menu: 'В меню', tapstart: 'пробел / тап',
      title: 'НАЛЁТ', subtitle: 'Ремонтники «Гефеста» против банды «Окалина» · 1–2 игрока · 6 миссий',
      back: 'Каталог', p1: 'И1', p2: 'И2', hero_0: 'Клёпа', hero_1: 'Шпулька',
      mission: 'МИССИЯ', missionShort: 'Мис.',
      m_yard: 'Ржавый двор', m_quarry: 'Карьер', m_depot: 'Депо', m_bridges: 'Мосты над шлаком', m_mast: 'Причальная мачта', m_den: 'Логово Окалины',
      introSub: 'Беги, стреляй, выручай подмастерьев · в конце — машина банды',
      b_pincer: 'КЛЕШНЯ', b_auger: 'БУРАВ', b_smokestack: 'ДЫМОХОД', b_cogwalker: 'ШЕСТЕРНЯ', b_bellship: 'КОЛОКОЛ', b_furnace: 'ГОРН ОКАЛИНЫ',
      bossSub: 'Машина банды «Окалина» · бей в корпус, следи за вспышками',
      phase: 'ФАЗА', clear: 'МИССИЯ ВЫПОЛНЕНА', bonus: 'Бонус', rescued: 'Выручено',
      w_rivet: 'Клепальник', w_nail: 'Гвоздомёт', w_spark: 'Искровик', w_torch: 'Паяльник', w_scoop: 'Дробовой ковш', w_kotel: 'Пушка «Котла»',
      pk_gren: '+5 гранат', pk_life: '+1 жизнь', pk_medal: '+1000', pk_armor: 'фартук',
      rescue: 'ВЫРУЧЕН!', board: 'В «КОТЁЛ»!', eject: 'ПРЫЖОК!', kotelCrit: '«КОТЁЛ» ГОРИТ — ВЫПРЫГИВАЙ!', armorLost: 'фартук пробит',
      weaponOut: 'патроны кончились', extraLife: '+1 ЖИЗНЬ', out: 'выбыл', lives: 'Жизни', grenades: 'Гранаты',
      hint1: 'И1: стрелки — бег/прицел, пробел — прыжок, / — огонь, , — граната',
      hint2: 'И2: WASD — бег/прицел, Z — прыжок, X — огонь, C — граната · 1/2 — игроки',
      foot: '<b>НАЛЁТ</b> · И1: стрелки, пробел — прыжок, / — огонь, «,» — граната · И2: WASD, Z — прыжок, X — огонь, C — граната (в одиночку работают обе раскладки) · ↓ у «Котла» — сесть, ↓+прыжок — выпрыгнуть · 1/2 на заставке — игроки · P/Esc пауза · L язык, T тема, M звук. Тач — только И1.'
    },
    en: {
      play: 'Play', players: 'Players', touch1p: 'touch — 1 player', language: 'Language', theme: 'Theme', sound: 'Sound', on: 'on', off: 'off',
      score: 'Score', level: 'Mission', best: 'Best', win: 'THE SCALE GANG IS BROKEN!', gameover: 'THE RAID IS OVER… FOR NOW',
      pause: 'PAUSE', resume: 'Resume', menu: 'Menu', tapstart: 'space / tap',
      title: 'NALYOT', subtitle: 'Hefest repair crew vs the Scale gang · 1–2 players · 6 missions',
      back: 'Catalog', p1: 'P1', p2: 'P2', hero_0: 'Rivet', hero_1: 'Bobbin',
      mission: 'MISSION', missionShort: 'Mis.',
      m_yard: 'Rust Yard', m_quarry: 'The Quarry', m_depot: 'The Depot', m_bridges: 'Slag Bridges', m_mast: 'Mooring Mast', m_den: 'The Scale Den',
      introSub: 'Run, shoot, free the apprentices · a gang machine waits at the end',
      b_pincer: 'PINCER', b_auger: 'AUGER', b_smokestack: 'SMOKESTACK', b_cogwalker: 'COGWALKER', b_bellship: 'BELLSHIP', b_furnace: 'SCALE FURNACE',
      bossSub: 'A Scale gang machine · hit the hull, watch for the flashes',
      phase: 'PHASE', clear: 'MISSION COMPLETE', bonus: 'Bonus', rescued: 'Rescued',
      w_rivet: 'Riveter', w_nail: 'Nailer', w_spark: 'Sparker', w_torch: 'Torch', w_scoop: 'Shot Scoop', w_kotel: 'Boiler cannon',
      pk_gren: '+5 grenades', pk_life: '+1 life', pk_medal: '+1000', pk_armor: 'apron',
      rescue: 'FREED!', board: 'INTO THE BOILER!', eject: 'BAIL OUT!', kotelCrit: 'BOILER ON FIRE — BAIL OUT!', armorLost: 'apron torn',
      weaponOut: 'out of ammo', extraLife: '+1 LIFE', out: 'is out', lives: 'Lives', grenades: 'Grenades',
      hint1: 'P1: arrows — run/aim, space — jump, / — fire, , — grenade',
      hint2: 'P2: WASD — run/aim, Z — jump, X — fire, C — grenade · 1/2 — players',
      foot: '<b>NALYOT</b> · P1: arrows, space — jump, / — fire, “,” — grenade · P2: WASD, Z — jump, X — fire, C — grenade (solo: both layouts work) · ↓ at the Boiler — climb in, ↓+jump — bail out · 1/2 on the title — players · P/Esc pause · L language, T theme, M sound. Touch — P1 only.'
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
