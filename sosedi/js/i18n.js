/* ШПУЛЬКА · строки RU/EN/TR/ES/PT (движок v2.8 берёт языки из ключей strings). Название: RU — ШПУЛЬКА, EN/TR/ES/PT — SPOOLSWING
   (одно имя внутри языка, Яндекс 5.1.3). Ключи play/language/theme/… — для экранов движка, остальные — игре.
   TR/ES/PT — перевод ИИ по глоссарию tools/i18n-glossary.md; носитель не вычитывал. */
(function (global) {
  'use strict';
  var SP = global.SPOOL = global.SPOOL || {};
  SP.STR = {
    ru: {
      caught: 'ПЕРЕРЕЗАНО', play: 'Играть', language: 'Язык', theme: 'Тема', sound: 'Звук', on: 'вкл', off: 'выкл', score: 'Счёт', level: 'Стол', best: 'Рекорд',
      win: 'ВСЕ СТОЛЫ ПРОЙДЕНЫ!', gameover: 'НИТКА ПОРВАЛАСЬ', pause: 'ПАУЗА', resume: 'Продолжить', menu: 'В меню', tapstart: 'пробел / тап',
      title: 'ШПУЛЬКА', subtitle: 'Держи — кружишь у булавки · отпусти — летишь', back: 'Каталог', lives: 'Жизни',
      lb: 'Лидеры', lbAll: 'Очки', rwBonus: 'Реклама: запасная нитка', oldBest: 'Прежний рекорд', migrated: 'Игра обновлена: теперь это «ШПУЛЬКА», новый рекорд — с нуля',
      clear: 'СТОЛ ПРОЙДЕН', buttons: 'Пуговицы', life: '+1 ЖИЗНЬ', shield: 'ЗАПАСНАЯ НИТКА', combo: 'ЦЕПОЧКА', go: 'ЛЕТИ!', bonus: 'Бонус', nextUp: 'пробел / тап — дальше', exitOpen: 'УШКО ОТКРЫТО',
      tut1: 'Держи кнопку: нитка цепляется за булавку, шпулька кружит. Отпусти — полетит по прямой', tut2: 'Собери все пуговицы — откроется игольное ушко',
      tut3: 'Ножницы режут нитку! Пролети мимо, когда они отвернулись', tut4: 'Ржавая булавка ломается через секунду — не засиживайся',
      tutK1: 'Держи Пробел: нитка цепляется за булавку. Отпусти — шпулька полетит по прямой', tutK2: 'Собери все пуговицы — откроется игольное ушко',
      tutK3: 'Ножницы режут нитку! Пролети мимо, когда они отвернулись', tutK4: 'Ржавая булавка ломается через секунду — не засиживайся',
      hint: 'Держи Пробел — кружить · отпусти — лететь · P — пауза', hintTouch: 'Держи большую кнопку — кружить · отпусти — лететь',
      hook: 'ДЕРЖИ',
      foot: '<b>ШПУЛЬКА</b> · держи Пробел / ↑ / мышь — кружить у булавки, отпусти — лететь · P/Esc — пауза · L язык, T тема, M звук'
    },
    en: {
      caught: 'SNIPPED', play: 'Play', language: 'Language', theme: 'Theme', sound: 'Sound', on: 'on', off: 'off', score: 'Score', level: 'Table', best: 'Best',
      win: 'ALL TABLES DONE!', gameover: 'THE THREAD SNAPPED', pause: 'PAUSE', resume: 'Resume', menu: 'Menu', tapstart: 'space / tap',
      title: 'SPOOLSWING', subtitle: 'Hold to swing round a pin · release to fly', back: 'Catalog', lives: 'Lives',
      lb: 'Leaderboard', lbAll: 'Score', rwBonus: 'Watch ad: spare thread', oldBest: 'Previous best', migrated: 'Game updated: now it is SPOOLSWING, new best starts from zero',
      clear: 'TABLE DONE', buttons: 'Buttons', life: '+1 LIFE', shield: 'SPARE THREAD', combo: 'CHAIN', go: 'FLY!', bonus: 'Bonus', nextUp: 'space / tap — next', exitOpen: 'NEEDLE EYE OPEN',
      tut1: 'Hold the button: the thread hooks a pin and the spool swings round it. Release to fly straight', tut2: 'Collect every button to open the needle eye',
      tut3: 'Scissors! Slip past when they are looking away', tut4: 'A rusty pin snaps after a second: do not linger',
      tutK1: 'Hold Space: the thread hooks a pin. Release and the spool flies straight', tutK2: 'Collect every button to open the needle eye',
      tutK3: 'Scissors! Slip past when they are looking away', tutK4: 'A rusty pin snaps after a second: do not linger',
      hint: 'Hold Space: swing · release: fly · P: pause', hintTouch: 'Hold the big button: swing · release: fly',
      hook: 'HOLD',
      foot: '<b>SPOOLSWING</b> · hold Space / ↑ / mouse: swing round a pin, release: fly · P/Esc: pause · L language, T theme, M sound'
    },
    tr: {
      caught: 'KESİLDİ', play: 'Oyna', language: 'Dil', theme: 'Tema', sound: 'Ses', on: 'açık', off: 'kapalı', score: 'Skor', level: 'Masa', best: 'Rekor',
      win: 'TÜM MASALAR BİTTİ!', gameover: 'İPLİK KOPTU', pause: 'DURAKLAT', resume: 'Devam', menu: 'Menü', tapstart: 'boşluk / dokun',
      title: 'SPOOLSWING', subtitle: 'Basılı tut: iğnenin etrafında dön · bırak: uç', back: 'Katalog', lives: 'Can',
      lb: 'Sıralama', lbAll: 'Puan', rwBonus: 'Reklam: yedek iplik', oldBest: 'Önceki rekor', migrated: 'Oyun güncellendi: artık SPOOLSWING, yeni rekor sıfırdan başlar',
      clear: 'MASA TAMAM', buttons: 'Düğmeler', life: '+1 CAN', shield: 'YEDEK İPLİK', combo: 'ZİNCİR', go: 'UÇ!', bonus: 'Bonus', nextUp: 'boşluk / dokun — devam', exitOpen: 'İĞNE GÖZÜ AÇIK',
      tut1: 'Düğmeyi basılı tut: iplik bir iğneye takılır, makara etrafında döner. Bırak, düz uçar', tut2: 'Tüm düğmeleri topla, iğne gözü açılır',
      tut3: 'Makaslar! Başka yöne baktıklarında yanlarından geç', tut4: 'Paslı iğne bir saniye sonra kırılır: oyalanma',
      tutK1: 'Boşluğu basılı tut: iplik bir iğneye takılır. Bırak, makara düz uçar', tutK2: 'Tüm düğmeleri topla, iğne gözü açılır',
      tutK3: 'Makaslar! Başka yöne baktıklarında yanlarından geç', tutK4: 'Paslı iğne bir saniye sonra kırılır: oyalanma',
      hint: 'Boşluk basılı: dön · bırak: uç · P: duraklat', hintTouch: 'Büyük düğme basılı: dön · bırak: uç',
      hook: 'BASILI TUT',
      foot: '<b>SPOOLSWING</b> · Boşluk / ↑ / fare basılı: iğnenin etrafında dön, bırak: uç · P/Esc: duraklat · L dil, T tema, M ses'
    },
    es: {
      caught: 'CORTADO', play: 'Jugar', language: 'Idioma', theme: 'Tema', sound: 'Sonido', on: 'sí', off: 'no', score: 'Puntos', level: 'Mesa', best: 'Récord',
      win: '¡TODAS LAS MESAS LISTAS!', gameover: 'SE ROMPIÓ EL HILO', pause: 'PAUSA', resume: 'Continuar', menu: 'Menú', tapstart: 'espacio / toca',
      title: 'SPOOLSWING', subtitle: 'Mantén: giras en torno a un alfiler · suelta: vuelas', back: 'Catálogo', lives: 'Vidas',
      lb: 'Clasificación', lbAll: 'Puntos', rwBonus: 'Anuncio: hilo de repuesto', oldBest: 'Récord anterior', migrated: 'Juego actualizado: ahora es SPOOLSWING, el nuevo récord empieza de cero',
      clear: 'MESA LISTA', buttons: 'Botones', life: '+1 VIDA', shield: 'HILO DE REPUESTO', combo: 'CADENA', go: '¡VUELA!', bonus: 'Bono', nextUp: 'espacio / toca — seguir', exitOpen: 'OJAL ABIERTO',
      tut1: 'Mantén el botón: el hilo se engancha a un alfiler y el carrete gira. Suelta y vuela recto', tut2: 'Junta todos los botones para abrir el ojo de la aguja',
      tut3: '¡Tijeras! Pasa cuando miren hacia otro lado', tut4: 'Un alfiler oxidado se rompe al cabo de un segundo: no te quedes',
      tutK1: 'Mantén Espacio: el hilo se engancha a un alfiler. Suelta y el carrete vuela recto', tutK2: 'Junta todos los botones para abrir el ojo de la aguja',
      tutK3: '¡Tijeras! Pasa cuando miren hacia otro lado', tutK4: 'Un alfiler oxidado se rompe al cabo de un segundo: no te quedes',
      hint: 'Mantén Espacio: girar · suelta: volar · P: pausa', hintTouch: 'Mantén el botón grande: girar · suelta: volar',
      hook: 'MANTÉN',
      foot: '<b>SPOOLSWING</b> · mantén Espacio / ↑ / ratón: gira en torno a un alfiler, suelta: vuela · P/Esc: pausa · L idioma, T tema, M sonido'
    },
    pt: {
      caught: 'CORTADO', play: 'Jogar', language: 'Idioma', theme: 'Tema', sound: 'Som', on: 'sim', off: 'não', score: 'Pontos', level: 'Mesa', best: 'Recorde',
      win: 'TODAS AS MESAS FEITAS!', gameover: 'A LINHA ARREBENTOU', pause: 'PAUSA', resume: 'Continuar', menu: 'Menu', tapstart: 'espaço / toque',
      title: 'SPOOLSWING', subtitle: 'Segure: gira em volta do alfinete · solte: voa', back: 'Catálogo', lives: 'Vidas',
      lb: 'Classificação', lbAll: 'Pontos', rwBonus: 'Anúncio: linha reserva', oldBest: 'Recorde anterior', migrated: 'Jogo atualizado: agora é SPOOLSWING, o novo recorde começa do zero',
      clear: 'MESA FEITA', buttons: 'Botões', life: '+1 VIDA', shield: 'LINHA RESERVA', combo: 'CORRENTE', go: 'VOE!', bonus: 'Bônus', nextUp: 'espaço / toque — seguir', exitOpen: 'AGULHA ABERTA',
      tut1: 'Segure o botão: a linha prende num alfinete e o carretel gira. Solte e ele voa reto', tut2: 'Junte todos os botões para abrir o fundo da agulha',
      tut3: 'Tesouras! Passe quando olharem para o outro lado', tut4: 'Um alfinete enferrujado quebra em um segundo: não demore',
      tutK1: 'Segure Espaço: a linha prende num alfinete. Solte e o carretel voa reto', tutK2: 'Junte todos os botões para abrir o fundo da agulha',
      tutK3: 'Tesouras! Passe quando olharem para o outro lado', tutK4: 'Um alfinete enferrujado quebra em um segundo: não demore',
      hint: 'Segure Espaço: girar · solte: voar · P: pausa', hintTouch: 'Segure o botão grande: girar · solte: voar',
      hook: 'SEGURE',
      foot: '<b>SPOOLSWING</b> · segure Espaço / ↑ / mouse: gire em volta do alfinete, solte: voe · P/Esc: pausa · L idioma, T tema, M som'
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
