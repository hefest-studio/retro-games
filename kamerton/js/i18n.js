/* КАМЕРТОН · i18n (RU/EN/TR/ES/PT — движок v2.8 берёт языки из ключей strings; название: RU — КАМЕРТОН, EN/TR/ES/PT — BRASSHUSH).
   В самой игре слов нет — только картинки и пиктограммы; строки нужны меню, паузе, финалу и подписи под канвой. */
(function (global) {
  'use strict';
  var K = global.KAMER = global.KAMER || {};
  K.STR = {
    ru: {
      play: 'Новый путь', cont: 'Продолжить', restart: 'К последнему фонарику', language: 'Язык', theme: 'Тема', sound: 'Звук', on: 'вкл', off: 'выкл',
      score: 'Оценка', best: 'Рекорд', win: 'ГОРОД ПРОСНУЛСЯ', gameover: 'ЗАВОД ОСТАНОВИЛСЯ',
      pause: 'ПАУЗА', resume: 'Продолжить', menu: 'В меню', tapstart: 'пробел / тап',
      title: 'КАМЕРТОН', subtitle: 'Подмастерье будит заводных кукол в городе часовщиков',
      hint: '◀▶ — идти · ▲▼ — лестница · пробел — прыжок · E — камертон / рычаг · Q — к другой кукле · P — пауза',
      foot: 'Тревожная сказка без слов: в сумерках заброшенного города часовщиков подмастерье находит камертон, который будит заводных кукол. Носильщик, плясунья, тяжеловес и оловянные солдатики ходят там, куда самому не пройти: держат вороты, жмут плиты, заслоняют фонари смотрителей. Остановился завод — и снова у последнего фонарика.',
      stops: 'остановки', zones: 'зоны', rwSkip: 'Реклама: пропустить зону'
    },
    en: {
      play: 'New journey', cont: 'Continue', restart: 'Back to last lantern', language: 'Language', theme: 'Theme', sound: 'Sound', on: 'on', off: 'off',
      score: 'Grade', best: 'Best', win: 'THE TOWN AWAKES', gameover: 'WOUND DOWN',
      pause: 'PAUSE', resume: 'Resume', menu: 'Menu', tapstart: 'space / tap',
      title: 'BRASSHUSH', subtitle: 'An apprentice wakes the wind-up dolls of the clockmakers’ town',
      hint: '◀▶ — walk · ▲▼ — ladder · space — jump · E — tuning fork / lever · Q — next doll · P — pause',
      foot: 'An uneasy tale without words: at dusk, in the abandoned town of clockmakers, an apprentice finds a tuning fork that wakes the wind-up dolls. A porter, a dancer, a giant and tin soldiers go where you cannot: they hold cranks, press plates and shade you from the watchmen’s lanterns. When the spring runs down, you are back at the last lantern.',
      stops: 'stops', zones: 'zones', rwSkip: 'Watch ad: skip this zone'
    }
  };
  K.STR.tr = {
    play: 'Yeni yolculuk', cont: 'Devam', restart: 'Son fenere dön', language: 'Dil', theme: 'Tema', sound: 'Ses', on: 'açık', off: 'kapalı',
    score: 'Not', best: 'Rekor', win: 'KASABA UYANDI', gameover: 'KURMA BİTTİ',
    pause: 'DURAKLATILDI', resume: 'Devam', menu: 'Menü', tapstart: 'boşluk / dokun',
    title: 'BRASSHUSH', subtitle: 'Bir çırak saatçiler kasabasının kurmalı bebeklerini uyandırır',
    hint: '◀▶ — yürü · ▲▼ — merdiven · boşluk — zıpla · E — diyapazon / kol · Q — sonraki bebek · P — duraklat',
    foot: 'Sözsüz, tedirgin bir masal: terk edilmiş saatçiler kasabasında bir çırak, kurmalı bebekleri uyandıran bir diyapazon bulur. Hamal, dansçı, dev ve teneke askerler senin geçemediğin yerlere gider: kolları tutar, plakalara basar, bekçilerin fenerlerinden seni gizler. Yay boşalınca son fenere dönersin.',
    stops: 'duruş', zones: 'bölge', rwSkip: 'Reklam: bölgeyi atla'
  };
  K.STR.es = {
    play: 'Nuevo camino', cont: 'Continuar', restart: 'Al último farol', language: 'Idioma', theme: 'Tema', sound: 'Sonido', on: 'sí', off: 'no',
    score: 'Nota', best: 'Récord', win: 'EL PUEBLO DESPIERTA', gameover: 'SIN CUERDA',
    pause: 'PAUSA', resume: 'Seguir', menu: 'Menú', tapstart: 'espacio / toca',
    title: 'BRASSHUSH', subtitle: 'Un aprendiz despierta a los muñecos de cuerda del pueblo relojero',
    hint: '◀▶ — andar · ▲▼ — escalera · espacio — saltar · E — diapasón / palanca · Q — otro muñeco · P — pausa',
    foot: 'Un cuento inquieto sin palabras: al anochecer, en el pueblo abandonado de los relojeros, un aprendiz encuentra un diapasón que despierta a los muñecos de cuerda. Un porteador, una bailarina, un gigante y soldaditos de hojalata van adonde tú no puedes: sujetan manivelas, pisan placas y te ocultan de los faroles de los vigilantes. Si se acaba la cuerda, vuelves al último farol.',
    stops: 'paradas', zones: 'zonas', rwSkip: 'Anuncio: saltar la zona'
  };
  K.STR.pt = {
    play: 'Nova jornada', cont: 'Continuar', restart: 'Voltar à última lanterna', language: 'Idioma', theme: 'Tema', sound: 'Som', on: 'lig.', off: 'desl.',
    score: 'Nota', best: 'Recorde', win: 'A CIDADE DESPERTA', gameover: 'SEM CORDA',
    pause: 'PAUSA', resume: 'Continuar', menu: 'Menu', tapstart: 'espaço / toque',
    title: 'BRASSHUSH', subtitle: 'Um aprendiz desperta os bonecos de corda da cidade dos relojoeiros',
    hint: '◀▶ — andar · ▲▼ — escada · espaço — pular · E — diapasão / alavanca · Q — outro boneco · P — pausa',
    foot: 'Um conto inquieto sem palavras: ao anoitecer, na cidade abandonada dos relojoeiros, um aprendiz encontra um diapasão que desperta os bonecos de corda. Um carregador, uma bailarina, um gigante e soldadinhos de lata vão aonde você não pode: seguram manivelas, pisam placas e escondem você das lanternas dos vigias. Se a corda acaba, você volta à última lanterna.',
    stops: 'paradas', zones: 'zonas', rwSkip: 'Anúncio: pular a zona'
  };
})(typeof window !== 'undefined' ? window : globalThis);
