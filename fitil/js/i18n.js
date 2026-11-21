/* ФИТИЛЬ · i18n (RU/EN/TR/ES/PT — движок v2.8 берёт языки из ключей strings; название: RU — ФИТИЛЬ, EN/TR/ES/PT — FUSEWICK). FITIL.STR — таблицы для Arcade.createGame({strings}).
   Ключи play/players/language/theme/... нужны стандартным экранам движка; остальные — игре. */
(function (global) {
  'use strict';
  var F = global.FITIL = global.FITIL || {};
  F.STR = {
    ru: {
      play: 'Играть', players: 'Игроки', touch1p: 'тач — 1 игрок', language: 'Язык', theme: 'Тема', sound: 'Звук', on: 'вкл', off: 'выкл',
      score: 'Счёт', level: 'Ур.', best: 'Рекорд', win: 'ЖЕРНОВ РАСКОЛОТ!', gameover: 'ФИТИЛЬ ДОГОРЕЛ',
      pause: 'ПАУЗА', resume: 'Продолжить', menu: 'В меню', tapstart: 'пробел / тап',
      title: 'ФИТИЛЬ', subtitle: 'Лабиринт подрывника · 8 уровней + Жернов · 1–2 игрока',
      back: 'Каталог', ff: 'Огонь по своим', lives: 'Жизни',
      ready: 'УРОВЕНЬ', goal: 'Взорви всех врагов — люк откроется', bossGoal: 'Расколи Жернов взрывами — 10 попаданий',
      clear: 'ЛЮК ПРОЙДЕН', bonus: 'Бонус', open: 'ЛЮК ОТКРЫТ', down: 'ПОДРЫВНИК ВЫБЫЛ', life: '+1 ЖИЗНЬ', mill: 'Жернов',
      p1: 'И1', p2: 'И2', out: 'выбыл', cardNext: 'пробел / тап — дальше', rwLife: 'Реклама: +1 жизнь',
      lv_yard: 'Двор', lv_store: 'Склад', lv_lanes: 'Переулки', lv_cellar: 'Подвал', lv_mine: 'Шахта',
      lv_foundry: 'Литейка', lv_bridge: 'Мост', lv_citadel: 'Цитадель', lv_lair: 'Логово Жернова',
      pw_bomb: 'ЗАРЯД', pw_flame: 'ЖАР', pw_speed: 'ПРЫТЬ', pw_kick: 'ТОЛЧОК', pw_relay: 'РЕЛЕ',
      en_wander: 'Шатун', en_chaser: 'Ищейка', en_ghost: 'Мгла', en_fast: 'Юла',
      hint1: 'И1: стрелки — ход, пробел или / — бомба, . — РЕЛЕ (подрыв)',
      hint2: 'И2: W A S D — ход, F — бомба, G — РЕЛЕ · 1/2 — число игроков',
      foot: '<b>ФИТИЛЬ</b> · И1: стрелки + пробел или / — бомба, . — подрыв РЕЛЕ · И2: WASD + F — бомба, G — подрыв · 1/2 на заставке — игроки · P/Esc пауза · L язык, T тема, M звук. Тач — только И1.'
    },
    en: {
      play: 'Play', players: 'Players', touch1p: 'touch — 1 player', language: 'Language', theme: 'Theme', sound: 'Sound', on: 'on', off: 'off',
      score: 'Score', level: 'Lvl', best: 'Best', win: 'MILLSTONE SHATTERED!', gameover: 'THE FUSE BURNED OUT',
      pause: 'PAUSE', resume: 'Resume', menu: 'Menu', tapstart: 'space / tap',
      title: 'FUSEWICK', subtitle: 'Sapper maze · 8 levels + the Millstone · 1–2 players',
      back: 'Catalog', ff: 'Friendly fire', lives: 'Lives',
      ready: 'LEVEL', goal: 'Blast every enemy — the hatch will open', bossGoal: 'Crack the Millstone with blasts — 10 hits',
      clear: 'HATCH REACHED', bonus: 'Bonus', open: 'HATCH OPEN', down: 'SAPPER DOWN', life: '+1 LIFE', mill: 'Millstone',
      p1: 'P1', p2: 'P2', out: 'out', cardNext: 'space / tap — go on', rwLife: 'Watch ad: +1 life',
      lv_yard: 'Yard', lv_store: 'Storehouse', lv_lanes: 'Back Lanes', lv_cellar: 'Cellar', lv_mine: 'Mine',
      lv_foundry: 'Foundry', lv_bridge: 'Bridge', lv_citadel: 'Citadel', lv_lair: 'Millstone Lair',
      pw_bomb: 'CHARGE', pw_flame: 'HEAT', pw_speed: 'DASH', pw_kick: 'SHOVE', pw_relay: 'RELAY',
      en_wander: 'Shambler', en_chaser: 'Hound', en_ghost: 'Haze', en_fast: 'Whirl',
      hint1: 'P1: arrows — move, space or / — bomb, . — RELAY (detonate)',
      hint2: 'P2: W A S D — move, F — bomb, G — RELAY · 1/2 — player count',
      foot: '<b>FUSEWICK</b> · P1: arrows + space or / — bomb, . — RELAY detonate · P2: WASD + F — bomb, G — detonate · 1/2 on the title — players · P/Esc pause · L language, T theme, M sound. Touch — P1 only.'
    }
  };
  F.STR.tr = {
    play: 'Oyna', players: 'Oyuncular', touch1p: 'dokunmatik — 1 oyuncu', language: 'Dil', theme: 'Tema', sound: 'Ses', on: 'açık', off: 'kapalı',
    score: 'Puan', level: 'Sv.', best: 'Rekor', win: 'DEĞİRMEN TAŞI PARÇALANDI!', gameover: 'FİTİL YANIP BİTTİ',
    pause: 'DURAKLATILDI', resume: 'Devam et', menu: 'Ana menü', tapstart: 'boşluk / dokun',
    title: 'FUSEWICK', subtitle: 'Lağımcı labirenti · 8 seviye + Değirmen Taşı · 1–2 oyuncu',
    back: 'Katalog', ff: 'Dost ateşi', lives: 'Can',
    ready: 'SEVİYE', goal: 'Tüm düşmanları patlat — kapak açılacak', bossGoal: 'Değirmen Taşı’nı patlamalarla kır — 10 isabet',
    clear: 'KAPAĞA ULAŞILDI', bonus: 'Bonus', open: 'KAPAK AÇIK', down: 'LAĞIMCI ELENDİ', life: '+1 CAN', mill: 'Değirmen Taşı',
    p1: 'O1', p2: 'O2', out: 'elendi', cardNext: 'boşluk / dokun — devam', rwLife: 'Reklam: +1 can',
    lv_yard: 'Avlu', lv_store: 'Ambar', lv_lanes: 'Ara sokaklar', lv_cellar: 'Mahzen', lv_mine: 'Maden',
    lv_foundry: 'Dökümhane', lv_bridge: 'Köprü', lv_citadel: 'Kale', lv_lair: 'Değirmen Taşı’nın ini',
    pw_bomb: 'ŞARJ', pw_flame: 'ALEV', pw_speed: 'HIZ', pw_kick: 'İTME', pw_relay: 'RÖLE',
    en_wander: 'Aylak', en_chaser: 'Tazı', en_ghost: 'Sis', en_fast: 'Topaç',
    hint1: 'O1: oklar — hareket, boşluk ya da / — bomba, . — RÖLE (patlat)',
    hint2: 'O2: W A S D — hareket, F — bomba, G — RÖLE · 1/2 — oyuncu sayısı',
    foot: '<b>FUSEWICK</b> · O1: oklar + boşluk ya da / — bomba, . — RÖLE ile patlat · O2: WASD + F — bomba, G — patlat · başlıkta 1/2 — oyuncular · P/Esc duraklat · L dil, T tema, M ses. Dokunmatik — yalnızca O1.'
  };
  F.STR.es = {
    play: 'Jugar', players: 'Jugadores', touch1p: 'táctil — 1 jugador', language: 'Idioma', theme: 'Tema', sound: 'Sonido', on: 'sí', off: 'no',
    score: 'Puntos', level: 'Niv.', best: 'Récord', win: '¡MUELA DESTROZADA!', gameover: 'LA MECHA SE CONSUMIÓ',
    pause: 'PAUSA', resume: 'Continuar', menu: 'Menú principal', tapstart: 'espacio / toca',
    title: 'FUSEWICK', subtitle: 'Laberinto del zapador · 8 niveles + la Muela · 1–2 jugadores',
    back: 'Catálogo', ff: 'Fuego amigo', lives: 'Vidas',
    ready: 'NIVEL', goal: 'Vuela a todos los enemigos: se abrirá la trampilla', bossGoal: 'Rompe la Muela con explosiones: 10 impactos',
    clear: 'TRAMPILLA ALCANZADA', bonus: 'Bonus', open: 'TRAMPILLA ABIERTA', down: 'ZAPADOR CAÍDO', life: '+1 VIDA', mill: 'Muela',
    p1: 'J1', p2: 'J2', out: 'fuera', cardNext: 'espacio / toca — seguir', rwLife: 'Anuncio: +1 vida',
    lv_yard: 'Patio', lv_store: 'Almacén', lv_lanes: 'Callejones', lv_cellar: 'Sótano', lv_mine: 'Mina',
    lv_foundry: 'Fundición', lv_bridge: 'Puente', lv_citadel: 'Ciudadela', lv_lair: 'Guarida de la Muela',
    pw_bomb: 'CARGA', pw_flame: 'CALOR', pw_speed: 'BRÍO', pw_kick: 'EMPUJE', pw_relay: 'RELÉ',
    en_wander: 'Errante', en_chaser: 'Sabueso', en_ghost: 'Bruma', en_fast: 'Peonza',
    hint1: 'J1: flechas — mover, espacio o / — bomba, . — RELÉ (detonar)',
    hint2: 'J2: W A S D — mover, F — bomba, G — RELÉ · 1/2 — jugadores',
    foot: '<b>FUSEWICK</b> · J1: flechas + espacio o / — bomba, . — detonar con RELÉ · J2: WASD + F — bomba, G — detonar · 1/2 en la portada — jugadores · P/Esc pausa · L idioma, T tema, M sonido. Táctil — solo J1.'
  };
  F.STR.pt = {
    play: 'Jogar', players: 'Jogadores', touch1p: 'toque — 1 jogador', language: 'Idioma', theme: 'Tema', sound: 'Som', on: 'lig.', off: 'desl.',
    score: 'Pontos', level: 'Nív.', best: 'Recorde', win: 'MÓ DESPEDAÇADA!', gameover: 'O PAVIO QUEIMOU',
    pause: 'PAUSA', resume: 'Continuar', menu: 'Menu principal', tapstart: 'espaço / toque',
    title: 'FUSEWICK', subtitle: 'Labirinto do sapador · 8 fases + a Mó · 1–2 jogadores',
    back: 'Catálogo', ff: 'Fogo amigo', lives: 'Vidas',
    ready: 'FASE', goal: 'Exploda todos os inimigos — o alçapão vai abrir', bossGoal: 'Rache a Mó com explosões — 10 acertos',
    clear: 'ALÇAPÃO ALCANÇADO', bonus: 'Bônus', open: 'ALÇAPÃO ABERTO', down: 'SAPADOR CAIU', life: '+1 VIDA', mill: 'Mó',
    p1: 'J1', p2: 'J2', out: 'fora', cardNext: 'espaço / toque — seguir', rwLife: 'Anúncio: +1 vida',
    lv_yard: 'Pátio', lv_store: 'Depósito', lv_lanes: 'Becos', lv_cellar: 'Porão', lv_mine: 'Mina',
    lv_foundry: 'Fundição', lv_bridge: 'Ponte', lv_citadel: 'Cidadela', lv_lair: 'Covil da Mó',
    pw_bomb: 'CARGA', pw_flame: 'CALOR', pw_speed: 'PIQUE', pw_kick: 'EMPURRÃO', pw_relay: 'RELÉ',
    en_wander: 'Andarilho', en_chaser: 'Farejador', en_ghost: 'Névoa', en_fast: 'Pião',
    hint1: 'J1: setas — mover, espaço ou / — bomba, . — RELÉ (detonar)',
    hint2: 'J2: W A S D — mover, F — bomba, G — RELÉ · 1/2 — jogadores',
    foot: '<b>FUSEWICK</b> · J1: setas + espaço ou / — bomba, . — detonar com RELÉ · J2: WASD + F — bomba, G — detonar · 1/2 na tela inicial — jogadores · P/Esc pausa · L idioma, T tema, M som. Toque — só J1.'
  };
})(typeof window !== 'undefined' ? window : globalThis);
