/* КАЛЁНЫЙ ДВОР · строки RU/EN/TR/ES/PT (движок v2.8 берёт языки из ключей strings). Название: RU — КАЛЁНЫЙ ДВОР, EN/TR/ES/PT — CINDER COURT
   (одно имя внутри языка, Яндекс 5.1.3). Ключи play/language/theme/… — для экранов движка, остальные — игре.
   TR/ES/PT — перевод ИИ по глоссарию tools/i18n-glossary.md; носитель не вычитывал. */
(function (global) {
  'use strict';
  var KL = global.KALENY = global.KALENY || {};
  KL.STR = {
    ru: {
      play: 'Турнир', language: 'Язык', theme: 'Тема', sound: 'Звук', on: 'вкл', off: 'выкл', score: 'Счёт', level: 'Матч', best: 'Рекорд',
      win: 'ТУРНИР ВЗЯТ!', gameover: 'ТУРНИР ПРОИГРАН', pause: 'ПАУЗА', resume: 'Продолжить', menu: 'В меню', tapstart: 'пробел / тап',
      title: 'КАЛЁНЫЙ ДВОР', subtitle: 'Вышибалы в мастерских · лови шар в накал', back: 'Каталог', lives: 'Попытки',
      quick: 'Быстрый матч', lb: 'Лидеры', lbAll: 'Очки турнира', rwBonus: 'Реклама: подмастерье в строй',
      match: 'МАТЧ', vs: 'против', team0: 'Подмастерья', nextUp: 'пробел / тап — в бой', streak: 'Победы подряд',
      matchWin: 'ПОБЕДА В МАТЧЕ', matchLose: 'МАТЧ ПРОИГРАН', matchDraw: 'НИЧЬЯ — ПЕРЕИГРОВКА', points: 'Очки матча', total: 'Всего',
      retry: 'Попытки', tryAgain: 'пробел / тап — переиграть', champ: 'ЧЕМПИОНЫ ДВОРОВ',
      perfect: 'ЗАКАЛКА!', catch: 'ЛОВЛЯ!', out: 'ВЫБИТ', dodge: 'УКЛОН', burn: 'ОЖОГ!', revive: 'В СТРОЙ!', timeUp: 'ВРЕМЯ!', sudden: 'ДО ПЕРВОГО ПОПАДАНИЯ',
      go: 'ВПЕРЁД!', aim: 'Автоприцел', tut1: 'Стик — бег · ● бросок (держи — накал) · ◆ ловля', tut2: 'Лови шар, когда кольцо сомкнётся: чем жарче шар, тем уже окно',
      tutK1: 'Стрелки — бег · Пробел — бросок (держи — накал) · X — ловля', tutK2: 'Лови шар, когда кольцо сомкнётся: чем жарче шар, тем уже окно',
      hint1: 'И1: стрелки — бег · Пробел/Z — бросок · X/C — ловля', hint2: 'И2: WASD — бег · F — бросок · G — ловля',
      hint: 'Стрелки — бег · Пробел — бросок · X — ловля · P — пауза', hintTouch: 'Стик — бег · ● бросок · ◆ ловля · II — пауза',
      foot: '<b>КАЛЁНЫЙ ДВОР</b> · стрелки — бег, Пробел — бросок/пас (держи — накал), X — ловля/уклон · И2: WASD, F, G · 1/2 на заставке — игроки · P/Esc — пауза · L язык, T тема, M звук',
      arena_forge: 'Кузнечный двор', arena_foundry: 'Литейный двор', arena_steam: 'Паровой двор', arena_locksmith: 'Слесарный двор', arena_boiler: 'Котельный двор', arena_anvil: 'Двор Наковальни', arena_grand: 'Большой двор',
      rival0: 'Кузнечные', rival1: 'Литейщики', rival2: 'Паровики', rival3: 'Слесари', rival4: 'Котельщики', rival5: 'Наковальни', rival6: 'Мастера двора',
      dailyHint: '', stripLbl: 'ЗА ЛИНИЕЙ', lock: 'ловля', dash: 'рывок'
    },
    en: {
      play: 'Tournament', language: 'Language', theme: 'Theme', sound: 'Sound', on: 'on', off: 'off', score: 'Score', level: 'Match', best: 'Best',
      win: 'TOURNAMENT WON!', gameover: 'TOURNAMENT LOST', pause: 'PAUSE', resume: 'Resume', menu: 'Menu', tapstart: 'space / tap',
      title: 'CINDER COURT', subtitle: 'Workshop dodgeball · catch the ball at white heat', back: 'Catalog', lives: 'Retries',
      quick: 'Quick match', lb: 'Leaderboard', lbAll: 'Tournament points', rwBonus: 'Watch ad: apprentice back in',
      match: 'MATCH', vs: 'vs', team0: 'Apprentices', nextUp: 'space / tap — to the court', streak: 'Win streak',
      matchWin: 'MATCH WON', matchLose: 'MATCH LOST', matchDraw: 'DRAW — REPLAY', points: 'Match points', total: 'Total',
      retry: 'Retries', tryAgain: 'space / tap — replay', champ: 'YARD CHAMPIONS',
      perfect: 'TEMPERED!', catch: 'CAUGHT!', out: 'OUT', dodge: 'DODGE', burn: 'BURN!', revive: 'BACK IN!', timeUp: 'TIME!', sudden: 'FIRST HIT WINS',
      go: 'GO!', aim: 'Auto-aim', tut1: 'Stick: move · ● throw (hold to heat) · ◆ catch', tut2: 'Catch when the ring closes: the hotter the ball, the narrower the window',
      tutK1: 'Arrows: move · Space: throw (hold to heat) · X: catch', tutK2: 'Catch when the ring closes: the hotter the ball, the narrower the window',
      hint1: 'P1: arrows · Space/Z throw · X/C catch', hint2: 'P2: WASD · F throw · G catch',
      hint: 'Arrows: move · Space: throw · X: catch · P: pause', hintTouch: 'Stick: move · ● throw · ◆ catch · II: pause',
      foot: '<b>CINDER COURT</b> · arrows: move, Space: throw/pass (hold to heat), X: catch/dash · P2: WASD, F, G · 1/2 on the title: players · P/Esc: pause · L language, T theme, M sound',
      arena_forge: 'Forge Yard', arena_foundry: 'Foundry Yard', arena_steam: 'Steam Yard', arena_locksmith: 'Locksmith Yard', arena_boiler: 'Boiler Yard', arena_anvil: 'Anvil Yard', arena_grand: 'Grand Yard',
      rival0: 'Forge Crew', rival1: 'Foundry Hands', rival2: 'Steamfitters', rival3: 'Locksmiths', rival4: 'Boilermakers', rival5: 'Anvil Guild', rival6: 'Yard Masters',
      dailyHint: '', stripLbl: 'BEHIND THE LINE', lock: 'catch', dash: 'dash'
    },
    tr: {
      play: 'Turnuva', language: 'Dil', theme: 'Tema', sound: 'Ses', on: 'açık', off: 'kapalı', score: 'Skor', level: 'Maç', best: 'Rekor',
      win: 'TURNUVA KAZANILDI!', gameover: 'TURNUVA KAYBEDİLDİ', pause: 'DURAKLAT', resume: 'Devam', menu: 'Menü', tapstart: 'boşluk / dokun',
      title: 'CINDER COURT', subtitle: 'Atölye yakan topu · topu beyaz kızgınlıkta yakala', back: 'Katalog', lives: 'Hak',
      quick: 'Hızlı maç', lb: 'Sıralama', lbAll: 'Turnuva puanı', rwBonus: 'Reklam: çırak sahaya dönsün',
      match: 'MAÇ', vs: 'karşı', team0: 'Çıraklar', nextUp: 'boşluk / dokun — sahaya', streak: 'Seri galibiyet',
      matchWin: 'MAÇ KAZANILDI', matchLose: 'MAÇ KAYBEDİLDİ', matchDraw: 'BERABERE — TEKRAR', points: 'Maç puanı', total: 'Toplam',
      retry: 'Hak', tryAgain: 'boşluk / dokun — tekrar', champ: 'AVLU ŞAMPİYONLARI',
      perfect: 'SERTLEŞTİ!', catch: 'YAKALADIN!', out: 'ELENDİ', dodge: 'KAÇIŞ', burn: 'YANIK!', revive: 'OYUNA DÖNDÜ!', timeUp: 'SÜRE!', sudden: 'İLK İSABET KAZANIR',
      go: 'HADİ!', aim: 'Otomatik nişan', tut1: 'Çubuk: hareket · ● atış (basılı tut: ısıt) · ◆ yakala', tut2: 'Halka kapanınca yakala: top ne kadar kızgınsa pencere o kadar dar',
      tutK1: 'Oklar: hareket · Boşluk: atış (basılı tut: ısıt) · X: yakala', tutK2: 'Halka kapanınca yakala: top ne kadar kızgınsa pencere o kadar dar',
      hint1: 'O1: oklar · Boşluk/Z atış · X/C yakala', hint2: 'O2: WASD · F atış · G yakala',
      hint: 'Oklar: hareket · Boşluk: atış · X: yakala · P: duraklat', hintTouch: 'Çubuk: hareket · ● atış · ◆ yakala · II: duraklat',
      foot: '<b>CINDER COURT</b> · oklar: hareket, Boşluk: atış/pas (basılı tut: ısıt), X: yakala/atılma · O2: WASD, F, G · başlıkta 1/2: oyuncular · P/Esc: duraklat · L dil, T tema, M ses',
      arena_forge: 'Demirci Avlusu', arena_foundry: 'Döküm Avlusu', arena_steam: 'Buhar Avlusu', arena_locksmith: 'Çilingir Avlusu', arena_boiler: 'Kazan Avlusu', arena_anvil: 'Örs Avlusu', arena_grand: 'Büyük Avlu',
      rival0: 'Demirciler', rival1: 'Dökümcüler', rival2: 'Buharcılar', rival3: 'Çilingirler', rival4: 'Kazancılar', rival5: 'Örs Loncası', rival6: 'Avlu Ustaları',
      dailyHint: '', stripLbl: 'ÇİZGİ ARKASI', lock: 'yakala', dash: 'atılma'
    },
    es: {
      play: 'Torneo', language: 'Idioma', theme: 'Tema', sound: 'Sonido', on: 'sí', off: 'no', score: 'Puntos', level: 'Partido', best: 'Récord',
      win: '¡TORNEO GANADO!', gameover: 'TORNEO PERDIDO', pause: 'PAUSA', resume: 'Continuar', menu: 'Menú', tapstart: 'espacio / toca',
      title: 'CINDER COURT', subtitle: 'Balón prisionero de taller · atrapa la bola al rojo blanco', back: 'Catálogo', lives: 'Intentos',
      quick: 'Partido rápido', lb: 'Clasificación', lbAll: 'Puntos de torneo', rwBonus: 'Anuncio: un aprendiz vuelve',
      match: 'PARTIDO', vs: 'frente a', team0: 'Aprendices', nextUp: 'espacio / toca — a la pista', streak: 'Racha de victorias',
      matchWin: 'PARTIDO GANADO', matchLose: 'PARTIDO PERDIDO', matchDraw: 'EMPATE — REPETIR', points: 'Puntos del partido', total: 'Total',
      retry: 'Intentos', tryAgain: 'espacio / toca — repetir', champ: 'CAMPEONES DEL PATIO',
      perfect: '¡TEMPLADO!', catch: '¡ATRAPADA!', out: 'ELIMINADO', dodge: 'ESQUIVA', burn: '¡QUEMADURA!', revive: '¡DE VUELTA!', timeUp: '¡TIEMPO!', sudden: 'GANA EL PRIMER GOLPE',
      go: '¡YA!', aim: 'Puntería auto', tut1: 'Stick: mover · ● lanzar (mantén: calienta) · ◆ atrapar', tut2: 'Atrapa al cerrarse el aro: cuanto más caliente la bola, más estrecha la ventana',
      tutK1: 'Flechas: mover · Espacio: lanzar (mantén: calienta) · X: atrapar', tutK2: 'Atrapa al cerrarse el aro: cuanto más caliente la bola, más estrecha la ventana',
      hint1: 'J1: flechas · Espacio/Z lanzar · X/C atrapar', hint2: 'J2: WASD · F lanzar · G atrapar',
      hint: 'Flechas: mover · Espacio: lanzar · X: atrapar · P: pausa', hintTouch: 'Stick: mover · ● lanzar · ◆ atrapar · II: pausa',
      foot: '<b>CINDER COURT</b> · flechas: mover, Espacio: lanzar/pasar (mantén: calienta), X: atrapar/esquivar · J2: WASD, F, G · 1/2 en el título: jugadores · P/Esc: pausa · L idioma, T tema, M sonido',
      arena_forge: 'Patio de la Fragua', arena_foundry: 'Patio de Fundición', arena_steam: 'Patio de Vapor', arena_locksmith: 'Patio del Cerrajero', arena_boiler: 'Patio de Calderas', arena_anvil: 'Patio del Yunque', arena_grand: 'Gran Patio',
      rival0: 'Los Fraguadores', rival1: 'Fundidores', rival2: 'Vaporistas', rival3: 'Cerrajeros', rival4: 'Caldereros', rival5: 'Gremio del Yunque', rival6: 'Maestros del Patio',
      dailyHint: '', stripLbl: 'TRAS LA LÍNEA', lock: 'atrapar', dash: 'impulso'
    },
    pt: {
      play: 'Torneio', language: 'Idioma', theme: 'Tema', sound: 'Som', on: 'sim', off: 'não', score: 'Pontos', level: 'Partida', best: 'Recorde',
      win: 'TORNEIO VENCIDO!', gameover: 'TORNEIO PERDIDO', pause: 'PAUSA', resume: 'Continuar', menu: 'Menu', tapstart: 'espaço / toque',
      title: 'CINDER COURT', subtitle: 'Queimada de oficina · pegue a bola em brasa branca', back: 'Catálogo', lives: 'Tentativas',
      quick: 'Partida rápida', lb: 'Ranking', lbAll: 'Pontos do torneio', rwBonus: 'Anúncio: aprendiz volta ao jogo',
      match: 'PARTIDA', vs: 'frente a', team0: 'Aprendizes', nextUp: 'espaço / toque — para a quadra', streak: 'Sequência de vitórias',
      matchWin: 'PARTIDA VENCIDA', matchLose: 'PARTIDA PERDIDA', matchDraw: 'EMPATE — REPETIR', points: 'Pontos da partida', total: 'Total',
      retry: 'Tentativas', tryAgain: 'espaço / toque — repetir', champ: 'CAMPEÕES DO PÁTIO',
      perfect: 'TEMPERADO!', catch: 'PEGOU!', out: 'ELIMINADO', dodge: 'ESQUIVA', burn: 'QUEIMADURA!', revive: 'DE VOLTA!', timeUp: 'TEMPO!', sudden: 'VALE O PRIMEIRO ACERTO',
      go: 'JÁ!', aim: 'Mira automática', tut1: 'Stick: mover · ● lançar (segure: aquece) · ◆ pegar', tut2: 'Pegue quando o anel fechar: quanto mais quente a bola, mais estreita a janela',
      tutK1: 'Setas: mover · Espaço: lançar (segure: aquece) · X: pegar', tutK2: 'Pegue quando o anel fechar: quanto mais quente a bola, mais estreita a janela',
      hint1: 'J1: setas · Espaço/Z lançar · X/C pegar', hint2: 'J2: WASD · F lançar · G pegar',
      hint: 'Setas: mover · Espaço: lançar · X: pegar · P: pausa', hintTouch: 'Stick: mover · ● lançar · ◆ pegar · II: pausa',
      foot: '<b>CINDER COURT</b> · setas: mover, Espaço: lançar/passar (segure: aquece), X: pegar/esquivar · J2: WASD, F, G · 1/2 no título: jogadores · P/Esc: pausa · L idioma, T tema, M som',
      arena_forge: 'Pátio da Forja', arena_foundry: 'Pátio da Fundição', arena_steam: 'Pátio do Vapor', arena_locksmith: 'Pátio do Serralheiro', arena_boiler: 'Pátio das Caldeiras', arena_anvil: 'Pátio da Bigorna', arena_grand: 'Grande Pátio',
      rival0: 'Os Forjadores', rival1: 'Fundidores', rival2: 'Vaporistas', rival3: 'Serralheiros', rival4: 'Caldeireiros', rival5: 'Guilda da Bigorna', rival6: 'Mestres do Pátio',
      dailyHint: '', stripLbl: 'ATRÁS DA LINHA', lock: 'pegar', dash: 'impulso'
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
