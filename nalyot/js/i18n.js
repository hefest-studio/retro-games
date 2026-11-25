/* НАЛЁТ · i18n (RU/EN/TR/ES/PT — движок v2.8 берёт языки из ключей strings; название: RU — НАЛЁТ, EN/TR/ES/PT — BOILERRAID). NALYOT.STR — таблицы для Arcade.createGame({strings}).
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
      aim: 'Автоприцел', rwLife: 'Реклама: +1 жизнь', cardDone: 'Миссия выполнена', cardMis: 'Миссия', cardNext: 'пробел / тап — следующая миссия',
      foot: '<b>НАЛЁТ</b> · И1: стрелки, пробел — прыжок, / — огонь, «,» — граната · И2: WASD, Z — прыжок, X — огонь, C — граната (в одиночку работают обе раскладки) · ↓ у «Котла» — сесть, ↓+прыжок — выпрыгнуть · 1/2 на заставке — игроки · P/Esc пауза · L язык, T тема, M звук. Тач (только И1) — стик: бег, прицел вверх, присесть; ⤒ прыжок, ● огонь, ✸ граната, автоприцел (меню).'
    },
    en: {
      play: 'Play', players: 'Players', touch1p: 'touch — 1 player', language: 'Language', theme: 'Theme', sound: 'Sound', on: 'on', off: 'off',
      score: 'Score', level: 'Mission', best: 'Best', win: 'THE SCALE GANG IS BROKEN!', gameover: 'THE RAID IS OVER… FOR NOW',
      pause: 'PAUSE', resume: 'Resume', menu: 'Menu', tapstart: 'space / tap',
      title: 'BOILERRAID', subtitle: 'Hefest repair crew vs the Scale gang · 1–2 players · 6 missions',
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
      aim: 'Auto-aim', rwLife: 'Watch ad: +1 life', cardDone: 'Mission complete', cardMis: 'Mission', cardNext: 'space / tap — next mission',
      foot: '<b>BOILERRAID</b> · P1: arrows, space — jump, / — fire, “,” — grenade · P2: WASD, Z — jump, X — fire, C — grenade (solo: both layouts work) · ↓ at the Boiler — climb in, ↓+jump — bail out · 1/2 on the title — players · P/Esc pause · L language, T theme, M sound. Touch (P1 only) — stick: run, aim up, crouch; ⤒ jump, ● fire, ✸ grenade, auto-aim (menu).'
    }
  };
  N.STR.tr = {
    play: 'Oyna', players: 'Oyuncular', touch1p: 'dokunmatik — 1 oyuncu', language: 'Dil', theme: 'Tema', sound: 'Ses', on: 'açık', off: 'kapalı',
    score: 'Puan', level: 'Görev', best: 'Rekor', win: 'TUFAL ÇETESİ DAĞILDI!', gameover: 'BASKIN PÜSKÜRTÜLDÜ… ŞİMDİLİK',
    pause: 'DURAKLATILDI', resume: 'Devam et', menu: 'Ana menü', tapstart: 'boşluk / dokun',
    title: 'BOILERRAID', subtitle: 'Hefest onarımcıları Tufal çetesine karşı · 1–2 oyuncu · 6 görev',
    back: 'Katalog', p1: 'O1', p2: 'O2', hero_0: 'Perçin', hero_1: 'Makara',
    mission: 'GÖREV', missionShort: 'Gör.',
    m_yard: 'Paslı avlu', m_quarry: 'Taş ocağı', m_depot: 'Depo', m_bridges: 'Cüruf köprüleri', m_mast: 'Bağlama direği', m_den: 'Tufal ini',
    introSub: 'Koş, ateş et, çırakları kurtar · sonunda çetenin makinesi bekliyor',
    b_pincer: 'KISKAÇ', b_auger: 'BURGU', b_smokestack: 'BACA', b_cogwalker: 'DİŞLİ YÜRÜYÜCÜ', b_bellship: 'ÇAN GEMİSİ', b_furnace: 'TUFAL OCAĞI',
    bossSub: 'Tufal çetesinin makinesi · gövdeye vur, parlamalara dikkat et',
    phase: 'EVRE', clear: 'GÖREV TAMAM', bonus: 'Bonus', rescued: 'Kurtarılan',
    w_rivet: 'Perçinci', w_nail: 'Çivici', w_spark: 'Kıvılcımcı', w_torch: 'Hamlaç', w_scoop: 'Saçma kepçe', w_kotel: 'Kazan topu',
    pk_gren: '+5 bomba', pk_life: '+1 can', pk_medal: '+1000', pk_armor: 'önlük',
    rescue: 'KURTARILDI!', board: 'KAZANA!', eject: 'ATLA!', kotelCrit: 'KAZAN YANIYOR — ATLA!', armorLost: 'önlük delindi',
    weaponOut: 'mermi bitti', extraLife: '+1 CAN', out: 'oyun dışı', lives: 'Can', grenades: 'Bomba',
    hint1: 'O1: oklar — koş/nişan, boşluk — zıpla, / — ateş, , — bomba',
    hint2: 'O2: WASD — koş/nişan, Z — zıpla, X — ateş, C — bomba · 1/2 — oyuncu',
    aim: 'Otomatik nişan', rwLife: 'Reklam: +1 can', cardDone: 'Görev tamam', cardMis: 'Görev', cardNext: 'boşluk / dokun — sonraki görev',
    foot: '<b>BOILERRAID</b> · O1: oklar, boşluk — zıpla, / — ateş, «,» — bomba · O2: WASD, Z — zıpla, X — ateş, C — bomba (tek kişide iki düzen de çalışır) · Kazanın yanında ↓ — bin, ↓+zıpla — atla · başlıkta 1/2 — oyuncu · P/Esc duraklat · L dil, T tema, M ses. Dokunmatik (yalnız O1) — çubuk: koş, yukarı nişan, çömel; ⤒ zıpla, ● ateş, ✸ bomba, otomatik nişan (menü).'
  };
  N.STR.es = {
    play: 'Jugar', players: 'Jugadores', touch1p: 'táctil — 1 jugador', language: 'Idioma', theme: 'Tema', sound: 'Sonido', on: 'sí', off: 'no',
    score: 'Puntos', level: 'Misión', best: 'Récord', win: '¡LA BANDA ESCORIA ESTÁ ROTA!', gameover: 'EL ASALTO HA TERMINADO… POR AHORA',
    pause: 'PAUSA', resume: 'Continuar', menu: 'Menú principal', tapstart: 'espacio / toca',
    title: 'BOILERRAID', subtitle: 'Reparadores de Hefest frente a la banda Escoria · 1–2 jugadores · 6 misiones',
    back: 'Catálogo', p1: 'J1', p2: 'J2', hero_0: 'Remache', hero_1: 'Bobina',
    mission: 'MISIÓN', missionShort: 'Mis.',
    m_yard: 'Patio oxidado', m_quarry: 'La cantera', m_depot: 'El depósito', m_bridges: 'Puentes de escoria', m_mast: 'Mástil de amarre', m_den: 'Guarida de Escoria',
    introSub: 'Corre, dispara, libera a los aprendices · al final espera una máquina de la banda',
    b_pincer: 'PINZA', b_auger: 'BARRENA', b_smokestack: 'CHIMENEA', b_cogwalker: 'ANDADOR DE ENGRANAJES', b_bellship: 'NAVE CAMPANA', b_furnace: 'HORNO DE ESCORIA',
    bossSub: 'Máquina de la banda Escoria · golpea el casco, ojo a los destellos',
    phase: 'FASE', clear: 'MISIÓN CUMPLIDA', bonus: 'Bonus', rescued: 'Liberados',
    w_rivet: 'Remachadora', w_nail: 'Clavadora', w_spark: 'Chispero', w_torch: 'Soplete', w_scoop: 'Cazo de perdigones', w_kotel: 'Cañón de caldera',
    pk_gren: '+5 granadas', pk_life: '+1 vida', pk_medal: '+1000', pk_armor: 'mandil',
    rescue: '¡LIBERADO!', board: '¡A LA CALDERA!', eject: '¡SALTA!', kotelCrit: 'LA CALDERA ARDE: ¡SALTA!', armorLost: 'mandil roto',
    weaponOut: 'sin munición', extraLife: '+1 VIDA', out: 'fuera', lives: 'Vidas', grenades: 'Granadas',
    hint1: 'J1: flechas — correr/apuntar, espacio — saltar, / — disparo, , — granada',
    hint2: 'J2: WASD — correr/apuntar, Z — saltar, X — disparo, C — granada · 1/2 — jugadores',
    aim: 'Autoapuntado', rwLife: 'Anuncio: +1 vida', cardDone: 'Misión cumplida', cardMis: 'Misión', cardNext: 'espacio / toca — siguiente misión',
    foot: '<b>BOILERRAID</b> · J1: flechas, espacio — saltar, / — disparo, «,» — granada · J2: WASD, Z — saltar, X — disparo, C — granada (en solitario valen ambas) · ↓ junto a la Caldera — subir, ↓+salto — saltar fuera · 1/2 en el título — jugadores · P/Esc pausa · L idioma, T tema, M sonido. Táctil (solo J1) — stick: correr, apuntar arriba, agacharse; ⤒ saltar, ● disparo, ✸ granada, autoapuntado (menú).'
  };
  N.STR.pt = {
    play: 'Jogar', players: 'Jogadores', touch1p: 'toque — 1 jogador', language: 'Idioma', theme: 'Tema', sound: 'Som', on: 'lig.', off: 'desl.',
    score: 'Pontos', level: 'Missão', best: 'Recorde', win: 'A GANGUE CAREPA CAIU!', gameover: 'O ATAQUE ACABOU… POR ORA',
    pause: 'PAUSA', resume: 'Continuar', menu: 'Menu principal', tapstart: 'espaço / toque',
    title: 'BOILERRAID', subtitle: 'Reparadores da Hefest diante da gangue Carepa · 1–2 jogadores · 6 missões',
    back: 'Catálogo', p1: 'J1', p2: 'J2', hero_0: 'Rebite', hero_1: 'Bobina',
    mission: 'MISSÃO', missionShort: 'Mis.',
    m_yard: 'Pátio enferrujado', m_quarry: 'A pedreira', m_depot: 'O depósito', m_bridges: 'Pontes de escória', m_mast: 'Mastro de amarração', m_den: 'Covil da Carepa',
    introSub: 'Corra, atire, liberte os aprendizes · no fim espera uma máquina da gangue',
    b_pincer: 'PINÇA', b_auger: 'BROCA', b_smokestack: 'CHAMINÉ', b_cogwalker: 'ANDARILHO DE ENGRENAGENS', b_bellship: 'NAVE SINO', b_furnace: 'FORNALHA DA CAREPA',
    bossSub: 'Máquina da gangue Carepa · acerte o casco, cuidado com os clarões',
    phase: 'FASE', clear: 'MISSÃO CUMPRIDA', bonus: 'Bônus', rescued: 'Libertados',
    w_rivet: 'Rebitadora', w_nail: 'Pregadeira', w_spark: 'Faiscador', w_torch: 'Maçarico', w_scoop: 'Concha de chumbo', w_kotel: 'Canhão da caldeira',
    pk_gren: '+5 granadas', pk_life: '+1 vida', pk_medal: '+1000', pk_armor: 'avental',
    rescue: 'LIBERTADO!', board: 'PARA A CALDEIRA!', eject: 'PULE FORA!', kotelCrit: 'CALDEIRA EM CHAMAS — PULE!', armorLost: 'avental rasgado',
    weaponOut: 'sem munição', extraLife: '+1 VIDA', out: 'fora', lives: 'Vidas', grenades: 'Granadas',
    hint1: 'J1: setas — correr/mirar, espaço — pular, / — tiro, , — granada',
    hint2: 'J2: WASD — correr/mirar, Z — pular, X — tiro, C — granada · 1/2 — jogadores',
    aim: 'Mira automática', rwLife: 'Anúncio: +1 vida', cardDone: 'Missão cumprida', cardMis: 'Missão', cardNext: 'espaço / toque — próxima missão',
    foot: '<b>BOILERRAID</b> · J1: setas, espaço — pular, / — tiro, «,» — granada · J2: WASD, Z — pular, X — tiro, C — granada (sozinho, as duas valem) · ↓ junto à Caldeira — entrar, ↓+pulo — pular fora · 1/2 na tela inicial — jogadores · P/Esc pausa · L idioma, T tema, M som. Toque (só J1) — stick: correr, mirar para cima, agachar; ⤒ pular, ● tiro, ✸ granada, mira automática (menu).'
  };
})(typeof window !== 'undefined' ? window : globalThis);
