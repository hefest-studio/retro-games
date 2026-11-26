/* ПУЗЫРЬ · i18n (RU/EN/TR/ES/PT — движок v2.8 берёт языки из ключей strings; название: RU — ПУЗЫРЬ, EN/TR/ES/PT — GLASSGUST).
   PUZYR.STR — таблицы для Arcade.createGame({strings}). Ключи play/players/language/theme/... нужны стандартным экранам движка; остальные — игре.
   Переделка 2026-11: раздуй пузырь на трубке и лопни его хлопком — волна сдувает врагов в ванны с расплавом.
   Переводы TR/ES/PT — ИИ, носитель не вычитывал. */
(function (global) {
  'use strict';
  var Z = global.PUZYR = global.PUZYR || {};
  Z.STR = {
    ru: {
      play: 'Играть', players: 'Игроки', touch1p: 'тач — 1 игрок', language: 'Язык', theme: 'Тема', sound: 'Звук', on: 'вкл', off: 'выкл',
      score: 'Счёт', level: 'Ур.', best: 'Рекорд', win: 'КОТЁЛ ПЕРЕПЛАВЛЕН!', gameover: 'ТРУБКИ ОСТЫЛИ',
      pause: 'ПАУЗА', resume: 'Продолжить', menu: 'В меню', tapstart: 'пробел / тап',
      title: 'ПУЗЫРЬ', subtitle: 'Стеклодувы мастерской «Гефест» · 30 уровней + Котёл · 1–2 игрока',
      sub2: 'Раздуй пузырь, лопни хлопком — сдуй врагов в расплав',
      back: 'Каталог',
      ready: 'УРОВЕНЬ', goal: 'Сдуй всех врагов в ванны с расплавом', bossGoal: 'Отбивай хлопком капли — пусть летят в Котёл',
      clear: 'ЧИСТО!', timeBonus: 'за время', life: '+1 ЖИЗНЬ', join: 'ВХОДИТ', boss: 'Котёл',
      p1: 'Колба', p2: 'Реторта', out: 'выбыл', press2: 'жми 2 — войти', left: 'врагов',
      combo: 'КОМБО', melt: 'ПЕРЕПЛАВ', knock: 'КЕГЛЯ', bossFall: 'КОТЁЛ ПАДАЕТ!',
      z_workshop: 'Мастерская', z_kiln: 'Печной ряд', z_glass: 'Стеклянный склад', z_pipes: 'Трубы', z_dome: 'Купол', z_boss: 'Логово Котла',
      en_cog: 'Зубец', en_spring: 'Пружина', en_soot: 'Копоть', en_spark: 'Искрун',
      tipHold: 'держи — раздуть', tipRelease: 'отпусти — хлоп!', tipVat: 'сдуй в ванну',
      rwLife: 'Реклама: +1 жизнь', cardDone: 'УРОВЕНЬ ПРОЙДЕН', cardNext: 'пробел / тап — следующий уровень',
      hint1: 'Колба: ← → — бег, ↑ или / — прыжок, держи пробел или . — раздуть, отпусти — хлоп',
      hint2: 'Реторта: A D — бег, W или G — прыжок, F или E — пузырь · 2 — войти в игре',
      foot: '<b>ПУЗЫРЬ</b> · Колба: ← → бег, ↑ или / прыжок, держи пробел или . — раздуть пузырь, отпусти — хлопок · Реторта: A D бег, W или G прыжок, F или E пузырь · <b>2</b> — второй игрок входит прямо в игре · сдувай врагов в ванны с расплавом · P/Esc пауза · L язык, T тема, M звук. Тач — только Колба.'
    },
    en: {
      play: 'Play', players: 'Players', touch1p: 'touch — 1 player', language: 'Language', theme: 'Theme', sound: 'Sound', on: 'on', off: 'off',
      score: 'Score', level: 'Lvl', best: 'Best', win: 'THE CAULDRON IS MELTED!', gameover: 'THE PIPES WENT COLD',
      pause: 'PAUSE', resume: 'Resume', menu: 'Menu', tapstart: 'space / tap',
      title: 'GLASSGUST', subtitle: 'Glassblowers of the Hefest workshop · 30 levels + the Cauldron · 1–2 players',
      sub2: 'Blow a bubble, pop it — gust the foes into the melt',
      back: 'Catalog',
      ready: 'LEVEL', goal: 'Gust every foe into the molten vats', bossGoal: 'Pop back the drops — send them into the Cauldron',
      clear: 'CLEAR!', timeBonus: 'time bonus', life: '+1 LIFE', join: 'JOINS', boss: 'Cauldron',
      p1: 'Flask', p2: 'Retort', out: 'out', press2: 'press 2 to join', left: 'foes',
      combo: 'COMBO', melt: 'MELTED', knock: 'STRIKE', bossFall: 'THE CAULDRON FALLS!',
      z_workshop: 'Workshop', z_kiln: 'Kiln Row', z_glass: 'Glass Store', z_pipes: 'Pipes', z_dome: 'The Dome', z_boss: 'Cauldron Lair',
      en_cog: 'Cog', en_spring: 'Spring', en_soot: 'Soot', en_spark: 'Sparker',
      tipHold: 'hold — inflate', tipRelease: 'release — pop!', tipVat: 'gust it into the vat',
      rwLife: 'Ad: +1 life', cardDone: 'LEVEL CLEAR', cardNext: 'space / tap — next level',
      hint1: 'Flask: ← → run, ↑ or / jump, hold space or . to inflate, release to pop',
      hint2: 'Retort: A D run, W or G jump, F or E bubble · 2 — join in game',
      foot: '<b>GLASSGUST</b> · Flask: ← → run, ↑ or / jump, hold space or . to inflate a bubble, release to pop it · Retort: A D run, W or G jump, F or E bubble · <b>2</b> — player two joins mid-game · gust the foes into the molten vats · P/Esc pause · L language, T theme, M sound. Touch — Flask only.'
    },
    tr: {
      play: 'Oyna', players: 'Oyuncular', touch1p: 'dokunmatik — 1 oyuncu', language: 'Dil', theme: 'Tema', sound: 'Ses', on: 'açık', off: 'kapalı',
      score: 'Skor', level: 'Sv.', best: 'Rekor', win: 'KAZAN ERİDİ!', gameover: 'BORULAR SOĞUDU',
      pause: 'DURAKLAT', resume: 'Devam', menu: 'Menü', tapstart: 'boşluk / dokun',
      title: 'GLASSGUST', subtitle: 'Hefest atölyesinin cam üfleyicileri · 30 seviye + Kazan · 1–2 oyuncu',
      sub2: 'Balonu şişir, patlat — düşmanları erimiş cama üfle',
      back: 'Katalog',
      ready: 'SEVİYE', goal: 'Tüm düşmanları erimiş cam teknelerine üfle', bossGoal: 'Damlaları patlamayla geri gönder — Kazan’a çarpsın',
      clear: 'TEMİZ!', timeBonus: 'süre bonusu', life: '+1 CAN', join: 'KATILDI', boss: 'Kazan',
      p1: 'Şişe', p2: 'İmbik', out: 'elendi', press2: 'katılmak için 2', left: 'düşman',
      combo: 'KOMBO', melt: 'ERİDİ', knock: 'DEVİRDİ', bossFall: 'KAZAN DÜŞÜYOR!',
      z_workshop: 'Atölye', z_kiln: 'Fırın Sırası', z_glass: 'Cam Deposu', z_pipes: 'Borular', z_dome: 'Kubbe', z_boss: 'Kazan’ın İni',
      en_cog: 'Dişli', en_spring: 'Yay', en_soot: 'İs', en_spark: 'Kıvılcım',
      tipHold: 'basılı tut — şişir', tipRelease: 'bırak — patlat!', tipVat: 'tekneye üfle',
      rwLife: 'Reklam: +1 can', cardDone: 'SEVİYE TAMAM', cardNext: 'boşluk / dokun — sonraki seviye',
      hint1: 'Şişe: ← → koş, ↑ ya da / zıpla, boşluğu ya da . tut — şişir, bırak — patlat',
      hint2: 'İmbik: A D koş, W ya da G zıpla, F ya da E balon · 2 — oyunda katıl',
      foot: '<b>GLASSGUST</b> · Şişe: ← → koş, ↑ ya da / zıpla, boşluğu ya da . basılı tut — balonu şişir, bırak — patlat · İmbik: A D koş, W ya da G zıpla, F ya da E balon · <b>2</b> — ikinci oyuncu oyun sırasında katılır · düşmanları erimiş cam teknelerine üfle · P/Esc duraklat · L dil, T tema, M ses. Dokunmatik — yalnızca Şişe.'
    },
    es: {
      play: 'Jugar', players: 'Jugadores', touch1p: 'táctil — 1 jugador', language: 'Idioma', theme: 'Tema', sound: 'Sonido', on: 'sí', off: 'no',
      score: 'Puntos', level: 'Niv.', best: 'Récord', win: '¡EL CALDERO SE FUNDIÓ!', gameover: 'LAS CAÑAS SE ENFRIARON',
      pause: 'PAUSA', resume: 'Seguir', menu: 'Menú', tapstart: 'espacio / toca',
      title: 'GLASSGUST', subtitle: 'Sopladores de vidrio del taller Hefest · 30 niveles + el Caldero · 1–2 jugadores',
      sub2: 'Infla una burbuja, revientala — sopla a los enemigos al vidrio fundido',
      back: 'Catálogo',
      ready: 'NIVEL', goal: 'Sopla a todos los enemigos a las cubas de vidrio fundido', bossGoal: 'Devuelve las gotas de un soplido — al Caldero',
      clear: '¡LIMPIO!', timeBonus: 'bonus de tiempo', life: '+1 VIDA', join: 'SE UNE', boss: 'Caldero',
      p1: 'Matraz', p2: 'Retorta', out: 'fuera', press2: 'pulsa 2 para unirte', left: 'enemigos',
      combo: 'COMBO', melt: 'FUNDIDO', knock: 'CHUZA', bossFall: '¡EL CALDERO CAE!',
      z_workshop: 'Taller', z_kiln: 'Hornos', z_glass: 'Almacén de vidrio', z_pipes: 'Tuberías', z_dome: 'La Cúpula', z_boss: 'Guarida del Caldero',
      en_cog: 'Diente', en_spring: 'Muelle', en_soot: 'Hollín', en_spark: 'Chispero',
      tipHold: 'mantén — inflar', tipRelease: 'suelta — ¡plop!', tipVat: 'sóplalo a la cuba',
      rwLife: 'Anuncio: +1 vida', cardDone: 'NIVEL SUPERADO', cardNext: 'espacio / toca — siguiente nivel',
      hint1: 'Matraz: ← → correr, ↑ o / saltar, mantén espacio o . para inflar, suelta para reventar',
      hint2: 'Retorta: A D correr, W o G saltar, F o E burbuja · 2 — unirse en juego',
      foot: '<b>GLASSGUST</b> · Matraz: ← → correr, ↑ o / saltar, mantén espacio o . para inflar la burbuja, suelta para reventarla · Retorta: A D correr, W o G saltar, F o E burbuja · <b>2</b> — el segundo jugador se une en plena partida · sopla a los enemigos a las cubas de vidrio fundido · P/Esc pausa · L idioma, T tema, M sonido. Táctil — solo Matraz.'
    },
    pt: {
      play: 'Jogar', players: 'Jogadores', touch1p: 'toque — 1 jogador', language: 'Idioma', theme: 'Tema', sound: 'Som', on: 'lig', off: 'desl',
      score: 'Pontos', level: 'Nív.', best: 'Recorde', win: 'O CALDEIRÃO DERRETEU!', gameover: 'OS CANUDOS ESFRIARAM',
      pause: 'PAUSA', resume: 'Continuar', menu: 'Menu', tapstart: 'espaço / toque',
      title: 'GLASSGUST', subtitle: 'Sopradores de vidro da oficina Hefest · 30 níveis + o Caldeirão · 1–2 jogadores',
      sub2: 'Encha uma bolha, estoure — sopre os inimigos no vidro derretido',
      back: 'Catálogo',
      ready: 'NÍVEL', goal: 'Sopre todos os inimigos nas cubas de vidro derretido', bossGoal: 'Rebata as gotas com o sopro — de volta ao Caldeirão',
      clear: 'LIMPO!', timeBonus: 'bônus de tempo', life: '+1 VIDA', join: 'ENTROU', boss: 'Caldeirão',
      p1: 'Frasco', p2: 'Retorta', out: 'fora', press2: 'aperte 2 para entrar', left: 'inimigos',
      combo: 'COMBO', melt: 'DERRETIDO', knock: 'STRIKE', bossFall: 'O CALDEIRÃO CAI!',
      z_workshop: 'Oficina', z_kiln: 'Fornos', z_glass: 'Depósito de vidro', z_pipes: 'Canos', z_dome: 'A Cúpula', z_boss: 'Covil do Caldeirão',
      en_cog: 'Dente', en_spring: 'Mola', en_soot: 'Fuligem', en_spark: 'Faísca',
      tipHold: 'segure — encher', tipRelease: 'solte — plof!', tipVat: 'sopre para a cuba',
      rwLife: 'Anúncio: +1 vida', cardDone: 'NÍVEL CONCLUÍDO', cardNext: 'espaço / toque — próximo nível',
      hint1: 'Frasco: ← → correr, ↑ ou / pular, segure espaço ou . para encher, solte para estourar',
      hint2: 'Retorta: A D correr, W ou G pular, F ou E bolha · 2 — entrar no jogo',
      foot: '<b>GLASSGUST</b> · Frasco: ← → correr, ↑ ou / pular, segure espaço ou . para encher a bolha, solte para estourar · Retorta: A D correr, W ou G pular, F ou E bolha · <b>2</b> — o segundo jogador entra no meio da partida · sopre os inimigos nas cubas de vidro derretido · P/Esc pausa · L idioma, T tema, M som. Toque — só Frasco.'
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
