/* ЮЗ · i18n (RU/EN/TR/ES/PT — движок v2.8 берёт языки из ключей strings; название: RU — ЮЗ, EN/TR/ES/PT — BENCHSKID). YUZ.STR — таблицы для Arcade.createGame({strings}).
   Ключи play/players/language/theme/... нужны стандартным экранам движка; остальные — игре. */
(function (global) {
  'use strict';
  var Y = global.YUZ = global.YUZ || {};
  Y.STR = {
    ru: {
      play: 'Играть', players: 'Игроки', touch1p: 'тач — 1 игрок', language: 'Язык', theme: 'Тема', sound: 'Звук', on: 'вкл', off: 'выкл',
      score: 'Очки', level: 'Трасса', best: 'Рекорд', win: 'ЧЕМПИОН!', gameover: 'ЧЕМПИОНАТ ОКОНЧЕН',
      pause: 'ПАУЗА', resume: 'Продолжить', menu: 'В меню', tapstart: 'пробел / тап',
      title: 'ЮЗ', subtitle: 'Гонки на мини-машинках · 8 трасс-комнат · 1–2 игрока',
      back: 'Каталог',
      p1: 'И1', p2: 'И2', bot_pin: 'Шпилька', bot_bun: 'Бублик',
      track: 'Трасса', lap: 'Круг', place: 'Место', pts: 'очк.', total: 'Всего', wins: 'побед',
      go: 'СТАРТ!', finish: 'ФИНИШ!', out: 'ВЫБЫЛ', outWarn: 'ОТСТАЁШЬ!', lastLap: 'ПОСЛЕДНИЙ КРУГ', lapN: 'КРУГ',
      results: 'ИТОГИ ЗАЕЗДА', standings: 'ЧЕМПИОНАТ', next: 'Дальше — Enter / тап', final: 'Итог — Enter / тап',
      champPlace: 'Итоговое место', placeN: '-е', dnf: 'выбыл',
      pk_boost: 'ТУРБО', pk_shield: 'ЩИТ', rwBoost: 'Реклама: турбо и щит',
      room_desk: 'Стол мастерской', room_bench: 'Верстак', room_kitchen: 'Кухня', room_garden: 'Сад',
      tr_warmup: 'Разминка', tr_shavings: 'Стружка', tr_tablecloth: 'Скатерть', tr_path: 'Тропинка',
      tr_vise: 'Тиски', tr_plane: 'Рубанок', tr_freezer: 'Морозилка', tr_flowerbed: 'Клумбы',
      hint1: 'И1: ← → — руль, ↑ — газ, ↓ — тормоз/назад, / или пр. Shift — занос',
      hint2: 'И2: A D — руль, W — газ, S — тормоз, F или лев. Shift — занос · 1/2 — игроки',
      foot: '<b>ЮЗ</b> · И1: ← → руль, ↑ газ, ↓ тормоз, / — занос · И2: A D руль, W газ, S тормоз, F — занос · 1/2 на заставке — игроки · P/Esc пауза · L язык, T тема, M звук. Тач — только И1.'
    },
    en: {
      play: 'Play', players: 'Players', touch1p: 'touch — 1 player', language: 'Language', theme: 'Theme', sound: 'Sound', on: 'on', off: 'off',
      score: 'Score', level: 'Track', best: 'Best', win: 'CHAMPION!', gameover: 'CHAMPIONSHIP OVER',
      pause: 'PAUSE', resume: 'Resume', menu: 'Menu', tapstart: 'space / tap',
      title: 'BENCHSKID', subtitle: 'Micro-car racing · 8 room tracks · 1–2 players',
      back: 'Catalog',
      p1: 'P1', p2: 'P2', bot_pin: 'Pinpoint', bot_bun: 'Bagel',
      track: 'Track', lap: 'Lap', place: 'Place', pts: 'pts', total: 'Total', wins: 'wins',
      go: 'GO!', finish: 'FINISH!', out: 'OUT', outWarn: 'FALLING BEHIND!', lastLap: 'FINAL LAP', lapN: 'LAP',
      results: 'RACE RESULTS', standings: 'CHAMPIONSHIP', next: 'Next — Enter / tap', final: 'Final — Enter / tap',
      champPlace: 'Final place', placeN: '', dnf: 'out',
      pk_boost: 'TURBO', pk_shield: 'SHIELD', rwBoost: 'Watch ad: turbo + shield',
      room_desk: 'Workshop desk', room_bench: 'Workbench', room_kitchen: 'Kitchen', room_garden: 'Garden',
      tr_warmup: 'Warm-up', tr_shavings: 'Shavings', tr_tablecloth: 'Tablecloth', tr_path: 'Garden Path',
      tr_vise: 'The Vise', tr_plane: 'The Plane', tr_freezer: 'Freezer', tr_flowerbed: 'Flowerbeds',
      hint1: 'P1: ← → — steer, ↑ — gas, ↓ — brake/reverse, / or right Shift — drift',
      hint2: 'P2: A D — steer, W — gas, S — brake, F or left Shift — drift · 1/2 — players',
      foot: '<b>BENCHSKID</b> · P1: ← → steer, ↑ gas, ↓ brake, / — drift · P2: A D steer, W gas, S brake, F — drift · 1/2 on the title — players · P/Esc pause · L language, T theme, M sound. Touch — P1 only.'
    }
  };
  Y.STR.tr = {
    play: 'Oyna', players: 'Oyuncular', touch1p: 'dokunmatik — 1 oyuncu', language: 'Dil', theme: 'Tema', sound: 'Ses', on: 'açık', off: 'kapalı',
    score: 'Puan', level: 'Pist', best: 'Rekor', win: 'ŞAMPİYON!', gameover: 'ŞAMPİYONA BİTTİ',
    pause: 'DURAKLATILDI', resume: 'Devam et', menu: 'Ana menü', tapstart: 'boşluk / dokun',
    title: 'BENCHSKID', subtitle: 'Mini araba yarışı · 8 oda pisti · 1–2 oyuncu',
    back: 'Katalog',
    p1: 'O1', p2: 'O2', bot_pin: 'Firkete', bot_bun: 'Simit',
    track: 'Pist', lap: 'Tur', place: 'Sıra', pts: 'puan', total: 'Toplam', wins: 'galibiyet',
    go: 'BAŞLA!', finish: 'BİTİŞ!', out: 'ELENDİ', outWarn: 'GERİDE KALIYORSUN!', lastLap: 'SON TUR', lapN: 'TUR',
    results: 'YARIŞ SONUCU', standings: 'ŞAMPİYONA', next: 'Devam — Enter / dokun', final: 'Sonuç — Enter / dokun',
    champPlace: 'Genel sıra', placeN: '.', dnf: 'elendi',
    pk_boost: 'TURBO', pk_shield: 'KALKAN', rwBoost: 'Reklam: turbo ve kalkan',
    room_desk: 'Atölye masası', room_bench: 'Tezgâh', room_kitchen: 'Mutfak', room_garden: 'Bahçe',
    tr_warmup: 'Isınma', tr_shavings: 'Talaş', tr_tablecloth: 'Masa örtüsü', tr_path: 'Bahçe yolu',
    tr_vise: 'Mengene', tr_plane: 'Rende', tr_freezer: 'Dondurucu', tr_flowerbed: 'Çiçeklik',
    hint1: 'O1: ← → — direksiyon, ↑ — gaz, ↓ — fren/geri, / ya da sağ Shift — drift',
    hint2: 'O2: A D — direksiyon, W — gaz, S — fren, F ya da sol Shift — drift · 1/2 — oyuncular',
    foot: '<b>BENCHSKID</b> · O1: ← → direksiyon, ↑ gaz, ↓ fren, / — drift · O2: A D direksiyon, W gaz, S fren, F — drift · başlıkta 1/2 — oyuncular · P/Esc duraklat · L dil, T tema, M ses. Dokunmatik — yalnızca O1.'
  };
  Y.STR.es = {
    play: 'Jugar', players: 'Jugadores', touch1p: 'táctil — 1 jugador', language: 'Idioma', theme: 'Tema', sound: 'Sonido', on: 'sí', off: 'no',
    score: 'Puntos', level: 'Pista', best: 'Récord', win: '¡CAMPEÓN!', gameover: 'FIN DEL CAMPEONATO',
    pause: 'PAUSA', resume: 'Continuar', menu: 'Menú principal', tapstart: 'espacio / toca',
    title: 'BENCHSKID', subtitle: 'Carreras de minicoches · 8 pistas-habitación · 1–2 jugadores',
    back: 'Catálogo',
    p1: 'J1', p2: 'J2', bot_pin: 'Horquilla', bot_bun: 'Rosquilla',
    track: 'Pista', lap: 'Vuelta', place: 'Puesto', pts: 'pts', total: 'Total', wins: 'victorias',
    go: '¡YA!', finish: '¡META!', out: 'ELIMINADO', outWarn: '¡TE QUEDAS ATRÁS!', lastLap: 'ÚLTIMA VUELTA', lapN: 'VUELTA',
    results: 'RESULTADOS', standings: 'CAMPEONATO', next: 'Seguir — Enter / toca', final: 'Final — Enter / toca',
    champPlace: 'Puesto final', placeN: '.º', dnf: 'eliminado',
    pk_boost: 'TURBO', pk_shield: 'ESCUDO', rwBoost: 'Anuncio: turbo y escudo',
    room_desk: 'Mesa del taller', room_bench: 'Banco de trabajo', room_kitchen: 'Cocina', room_garden: 'Jardín',
    tr_warmup: 'Calentamiento', tr_shavings: 'Virutas', tr_tablecloth: 'Mantel', tr_path: 'Sendero',
    tr_vise: 'El tornillo', tr_plane: 'El cepillo', tr_freezer: 'Congelador', tr_flowerbed: 'Parterres',
    hint1: 'J1: ← → — volante, ↑ — gas, ↓ — freno/atrás, / o Mayús der. — derrape',
    hint2: 'J2: A D — volante, W — gas, S — freno, F o Mayús izq. — derrape · 1/2 — jugadores',
    foot: '<b>BENCHSKID</b> · J1: ← → volante, ↑ gas, ↓ freno, / — derrape · J2: A D volante, W gas, S freno, F — derrape · 1/2 en la portada — jugadores · P/Esc pausa · L idioma, T tema, M sonido. Táctil — solo J1.'
  };
  Y.STR.pt = {
    play: 'Jogar', players: 'Jogadores', touch1p: 'toque — 1 jogador', language: 'Idioma', theme: 'Tema', sound: 'Som', on: 'lig.', off: 'desl.',
    score: 'Pontos', level: 'Pista', best: 'Recorde', win: 'CAMPEÃO!', gameover: 'FIM DO CAMPEONATO',
    pause: 'PAUSA', resume: 'Continuar', menu: 'Menu principal', tapstart: 'espaço / toque',
    title: 'BENCHSKID', subtitle: 'Corrida de minicarros · 8 pistas-cômodo · 1–2 jogadores',
    back: 'Catálogo',
    p1: 'J1', p2: 'J2', bot_pin: 'Grampo', bot_bun: 'Rosquinha',
    track: 'Pista', lap: 'Volta', place: 'Posição', pts: 'pts', total: 'Total', wins: 'vitórias',
    go: 'JÁ!', finish: 'CHEGADA!', out: 'FORA', outWarn: 'FICANDO PARA TRÁS!', lastLap: 'ÚLTIMA VOLTA', lapN: 'VOLTA',
    results: 'RESULTADO', standings: 'CAMPEONATO', next: 'Seguir — Enter / toque', final: 'Final — Enter / toque',
    champPlace: 'Posição final', placeN: 'º', dnf: 'fora',
    pk_boost: 'TURBO', pk_shield: 'ESCUDO', rwBoost: 'Anúncio: turbo e escudo',
    room_desk: 'Mesa da oficina', room_bench: 'Bancada', room_kitchen: 'Cozinha', room_garden: 'Jardim',
    tr_warmup: 'Aquecimento', tr_shavings: 'Serragem', tr_tablecloth: 'Toalha', tr_path: 'Trilha',
    tr_vise: 'A morsa', tr_plane: 'A plaina', tr_freezer: 'Congelador', tr_flowerbed: 'Canteiros',
    hint1: 'J1: ← → — volante, ↑ — acelerar, ↓ — freio/ré, / ou Shift dir. — derrapar',
    hint2: 'J2: A D — volante, W — acelerar, S — freio, F ou Shift esq. — derrapar · 1/2 — jogadores',
    foot: '<b>BENCHSKID</b> · J1: ← → volante, ↑ acelerar, ↓ freio, / — derrapar · J2: A D volante, W acelerar, S freio, F — derrapar · 1/2 na tela inicial — jogadores · P/Esc pausa · L idioma, T tema, M som. Toque — só J1.'
  };
  // порядковое место: RU «1-е», EN «1st», TR «1.», ES «1.º», PT «1º»
  Y.ordinal = function (lang, n) {
    if (lang === 'ru') return n + '-е';
    if (lang === 'tr') return n + '.';
    if (lang === 'es') return n + '.º';
    if (lang === 'pt') return n + 'º';
    var s = ['th', 'st', 'nd', 'rd'], v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  };
})(typeof window !== 'undefined' ? window : globalThis);
