/* ДРУЖИНА · i18n (RU/EN). DRUZHINA.STR — таблицы для Arcade.createGame({strings}).
   Ключи play/language/theme/... нужны стандартным экранам движка, players/touch1p — g.usePlayers; остальные — игре. */
(function (global) {
  'use strict';
  var D = global.DRUZHINA = global.DRUZHINA || {};
  D.STR = {
    ru: {
      play: 'Играть', players: 'Игроки', touch1p: 'тач — 1 игрок', language: 'Язык', theme: 'Тема', sound: 'Звук', on: 'вкл', off: 'выкл',
      score: 'Счёт', level: 'Этап', best: 'Рекорд', win: 'ТРАКТ СВОБОДЕН!', gameover: 'ДРУЖИНА ПАЛА…',
      pause: 'ПАУЗА', resume: 'Продолжить', menu: 'В меню', tapstart: 'пробел / тап',
      title: 'ДРУЖИНА', subtitle: 'Дружина «Гефеста» против железной орды · 1–2 игрока · 6 этапов',
      back: 'Каталог', p1: 'И1', p2: 'И2',
      h_zhdan: 'Ждан', h_secha: 'Сеча', h_olha: 'Ольха',
      r_zhdan: 'молотобоец', r_secha: 'ратница', r_olha: 'лучница-ведунья',
      d_zhdan: 'Медленный, крепкий, бьёт молотом сильнее всех',
      d_secha: 'Быстрая, парные клинки, комбо из 4 ударов',
      d_olha: 'Стрелы на средней дистанции, посох вблизи',
      m_forge: 'Горнов жар', m_whirl: 'Вихрь клинков', m_roots: 'Цепкие корни',
      st_power: 'Сила', st_speed: 'Скорость', st_reach: 'Дальность',
      select: 'ВЫБОР ГЕРОЯ', selHint: '← → — герой, удар — готов', ready: 'ГОТОВ', taken: 'занят',
      s_trakt: 'Кузнечный тракт', s_village: 'Деревня Подгорье', s_forest: 'Дремучий лес', s_crossing: 'Переправа', s_walls: 'Крепостные стены', s_foundry: 'Литейная твердыня', s_camp: 'Привал',
      stage: 'ЭТАП', stageShort: 'Этап',
      introSub: 'Бей железную орду · сбивай бесов-кладовиков — в мешках кувшины',
      b_voevoda: 'БРОННЫЙ ВОЕВОДА', b_twins: 'БЛИЗНЕЦЫ-МОЛОТОБОЙЦЫ', b_lovchiy: 'ЛОВЧИЙ НА ОГНЕЯЩЕРЕ', b_cepnik: 'ЦЕПНИК-ПАРОМЩИК', b_stenoboy: 'СТЕНОБОЙ', b_liteyshchik: 'ЧЁРНЫЙ ЛИТЕЙЩИК',
      bossSub: 'Вожак железной орды · следи за замахом', phase: 'ЯРОСТЬ',
      clear: 'ЭТАП ПРОЙДЕН', bonus: 'Награда',
      camp: 'ПРИВАЛ', campSub: 'Бесы-кладовики крадутся к лагерю — отбирай кувшины и еду!', campEnd: 'Утро — в путь!',
      go: 'ВПЕРЁД', jug: 'кувшин', bread: 'каравай', pie: 'пирог', noMagic: 'нет кувшинов',
      mount: 'В СЕДЛО!', knockOff: 'выбит из седла', extraLife: '+1 ЖИЗНЬ', out: 'выбыл',
      cont: 'ПРОДОЛЖИТЬ?', contSub: 'удар / Enter — продолжить', contLeft: 'осталось продолжений',
      lvl: 'ур.',
      hint1: 'И1: стрелки, / удар, пробел прыжок, . магия, , «спина»',
      hint2: 'И2: WASD, X удар, Z прыжок, C магия, V «спина» · 1/2 — игроки',
      foot: '<b>ДРУЖИНА</b> · И1: стрелки, / — удар, пробел — прыжок, «.» — магия, «,» — «спина» · И2: WASD, X — удар, Z — прыжок, C — магия, V — «спина» (в одиночку работают обе раскладки) · ⇄⇄ — бег, удар в беге и в прыжке, вплотную — захват (удар — колено, удар от врага — бросок) · к ничейному зверю — в седло, «спина» в седле — спешиться · 1/2 на заставке — игроки · P/Esc пауза · L язык, T тема, M звук. Тач — только И1.'
    },
    en: {
      play: 'Play', players: 'Players', touch1p: 'touch — 1 player', language: 'Language', theme: 'Theme', sound: 'Sound', on: 'on', off: 'off',
      score: 'Score', level: 'Stage', best: 'Best', win: 'THE ROAD IS FREE!', gameover: 'THE BAND HAS FALLEN…',
      pause: 'PAUSE', resume: 'Resume', menu: 'Menu', tapstart: 'space / tap',
      title: 'DRUZHINA', subtitle: 'The Hefest war band vs the iron horde · 1–2 players · 6 stages',
      back: 'Catalog', p1: 'P1', p2: 'P2',
      h_zhdan: 'Zhdan', h_secha: 'Secha', h_olha: 'Olkha',
      r_zhdan: 'hammer-smith', r_secha: 'blade maiden', r_olha: 'archer seer',
      d_zhdan: 'Slow and sturdy, the heaviest hammer blows',
      d_secha: 'Fast twin blades, a four-hit combo',
      d_olha: 'Arrows at mid range, a staff up close',
      m_forge: 'Forge Heat', m_whirl: 'Blade Gale', m_roots: 'Gripping Roots',
      st_power: 'Power', st_speed: 'Speed', st_reach: 'Reach',
      select: 'CHOOSE YOUR HERO', selHint: '← → — hero, attack — ready', ready: 'READY', taken: 'taken',
      s_trakt: 'The Smiths’ Road', s_village: 'Podgorye Village', s_forest: 'The Deep Forest', s_crossing: 'The Crossing', s_walls: 'Fortress Walls', s_foundry: 'The Foundry Keep', s_camp: 'Camp',
      stage: 'STAGE', stageShort: 'Stage',
      introSub: 'Smash the iron horde · knock the pantry imps — their sacks hold jugs',
      b_voevoda: 'THE ARMORED WARLORD', b_twins: 'THE HAMMER TWINS', b_lovchiy: 'HUNTMASTER ON A FIRE LIZARD', b_cepnik: 'THE CHAIN FERRYMAN', b_stenoboy: 'THE WALLBREAKER', b_liteyshchik: 'THE BLACK FOUNDER',
      bossSub: 'A chief of the iron horde · watch the wind-up', phase: 'RAGE',
      clear: 'STAGE CLEAR', bonus: 'Reward',
      camp: 'CAMP', campSub: 'Pantry imps sneak into camp — grab their jugs and food!', campEnd: 'Morning — move out!',
      go: 'GO', jug: 'jug', bread: 'bread', pie: 'pie', noMagic: 'no jugs',
      mount: 'SADDLE UP!', knockOff: 'knocked off', extraLife: '+1 LIFE', out: 'is out',
      cont: 'CONTINUE?', contSub: 'attack / Enter — continue', contLeft: 'continues left',
      lvl: 'lv',
      hint1: 'P1: arrows, / attack, space jump, . magic, , back attack',
      hint2: 'P2: WASD, X attack, Z jump, C magic, V back attack · 1/2 — players',
      foot: '<b>DRUZHINA</b> · P1: arrows, / — attack, space — jump, “.” — magic, “,” — back attack · P2: WASD, X — attack, Z — jump, C — magic, V — back attack (solo: both layouts work) · ⇄⇄ — run, attacks while running and jumping, walk into a foe — grab (attack — knee, attack away — throw) · walk into a free beast — ride it, back attack while riding — dismount · 1/2 on the title — players · P/Esc pause · L language, T theme, M sound. Touch — P1 only.'
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
