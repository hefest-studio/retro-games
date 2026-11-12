#!/usr/bin/env node
/**
 * audit-catalog.mjs — интерактивная приёмка стартовой страницы-каталога.
 *
 * Проверяет: тему по умолчанию (retro), переключение по G/кнопке, сохранение
 * в localStorage после перезагрузки, смену превью, фильтры по жанрам, поиск,
 * HTTP 200 по всем ссылкам каталога, alt/naturalWidth превью, отсутствие внешних
 * запросов, мобильный и десктопный лейаут, клавиатурную навигацию/Enter,
 * aria-label/aria-pressed, контраст (прикидка), prefers-reduced-motion, 404.
 *
 * Пишет скриншоты в reports/qa-shots/ и сырой JSON рядом с ними.
 * Ничего не меняет в файлах каталога: только читает страницу и взаимодействует.
 *
 * Пример:
 *   node tools/qa/audit-catalog.mjs --base http://127.0.0.1:8098 \
 *     --out-dir reports/qa-shots --json reports/qa-shots/catalog-audit.json
 */
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { launch, parseArgs, httpCheck } from './lib.mjs';

// слаги игр — из каталога (assets/catalog/games.json), без жёсткого списка
const DEFAULT_SLUGS = JSON.parse(readFileSync(new URL('../../assets/catalog/games.json', import.meta.url), 'utf8'))
  .games.map((g) => g.slug);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const PAGE_HELPERS = `
  const SLUGS = __SLUGS__;
  const txt = (el) => (el ? (el.innerText || el.textContent || '') : '').replace(/\\s+/g, ' ').trim();
  const isVisible = (el) => {
    if (!el || !el.getBoundingClientRect) return false;
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) > 0.05;
  };
  const rectOf = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), right: Math.round(r.right), bottom: Math.round(r.bottom) };
  };
  const slugOf = (a) => {
    try {
      const u = new URL(a.getAttribute('href') || a.href, location.href);
      const parts = u.pathname.split('/').filter(Boolean);
      for (let i = parts.length - 1; i >= 0; i -= 1) {
        if (SLUGS.includes(parts[i])) return parts[i];
      }
      return '';
    } catch (e) { return ''; }
  };
  const parseColor = (str) => {
    if (!str || str === 'transparent') return [0, 0, 0, 0];
    const m = str.match(/rgba?\\(([^)]+)\\)/);
    if (!m) return null;
    const parts = m[1].split(',').map((x) => parseFloat(x));
    return [parts[0], parts[1], parts[2], parts.length > 3 ? parts[3] : 1];
  };
  const blend = (top, bottom) => {
    const a = top[3] + bottom[3] * (1 - top[3]);
    if (a === 0) return [0, 0, 0, 0];
    return [
      (top[0] * top[3] + bottom[0] * bottom[3] * (1 - top[3])) / a,
      (top[1] * top[3] + bottom[1] * bottom[3] * (1 - top[3])) / a,
      (top[2] * top[3] + bottom[2] * bottom[3] * (1 - top[3])) / a,
      a,
    ];
  };
  const luminance = (c) => {
    const f = (v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
  };
  const contrast = (fg, bg) => {
    const l1 = luminance(fg) + 0.05;
    const l2 = luminance(bg) + 0.05;
    return Math.round((Math.max(l1, l2) / Math.min(l1, l2)) * 100) / 100;
  };
`;

function inventoryExpr(slugs) {
  return `(() => {
    ${PAGE_HELPERS.replace('__SLUGS__', JSON.stringify(slugs))}

    // ── текущая тема: атрибуты/классы + кандидаты-переключатели ──
    const themeNodes = [];
    for (const [el, name] of [[document.documentElement, 'html'], [document.body, 'body']]) {
      if (!el) continue;
      for (const attr of ['data-theme', 'data-style', 'data-mode', 'data-gfx', 'data-skin', 'data-palette']) {
        const v = el.getAttribute(attr);
        if (v !== null) themeNodes.push({ on: name, attr, value: v });
      }
      const cn = String(el.className || '');
      if (/retro|modern|neon|classic|8bit|8-?bit|aurora/i.test(cn)) themeNodes.push({ on: name, attr: 'class', value: cn.slice(0, 200) });
      if (el.dataset && Object.keys(el.dataset).length) themeNodes.push({ on: name, attr: 'datasetKeys', value: Object.keys(el.dataset).join(',') });
    }

    // ── переключатель темы ──
    const toggleEls = [];
    for (const el of document.querySelectorAll('button, [role=button], [role=switch], a[href]')) {
      if (!isVisible(el)) continue;
      const text = txt(el);
      if (text.length > 80) continue;
      if (el.tagName === 'A' && slugOf(el)) continue; // ссылка на игру, не переключатель
      if ([...el.querySelectorAll('a[href]')].some((x) => slugOf(x))) continue;
      const isInteractive = el.tagName === 'BUTTON'
        || el.getAttribute('role') === 'button'
        || el.getAttribute('role') === 'switch'
        || el.hasAttribute('aria-pressed')
        || /theme/i.test(el.getAttribute('data-action') || '')
        || /theme/i.test(el.id || '');
      if (!isInteractive) continue;
      const blob = [text, el.getAttribute('aria-label') || '', el.getAttribute('title') || '', el.id || '',
        String(el.className || ''), Object.keys(el.dataset || {}).join(' '),
        el.getAttribute('data-action') || '', el.getAttribute('data-theme') || ''].join(' ');
      if (!/theme|style|gfx|график|стил|тем[аыу]|8-?бит|неон|retro|modern/i.test(blob)) continue;
      toggleEls.push(el);
    }
    // переключатель в шапке важнее пунктов меню: сначала те, у кого есть aria-pressed
    toggleEls.sort((a, b) => {
      const ap = (a.hasAttribute('aria-pressed') ? 0 : 1) - (b.hasAttribute('aria-pressed') ? 0 : 1);
      if (ap !== 0) return ap;
      return a.getBoundingClientRect().y - b.getBoundingClientRect().y;
    });
    const toggles = [];
    for (const el of toggleEls.slice(0, 3)) {
      el.setAttribute('data-qa-theme', String(toggles.length));
      toggles.push({
        index: toggles.length,
        tag: el.tagName,
        text: txt(el),
        ariaLabel: el.getAttribute('aria-label') || '',
        ariaPressed: el.getAttribute('aria-pressed'),
        title: el.getAttribute('title') || '',
        id: el.id || '',
        className: String(el.className || '').slice(0, 120),
        rect: rectOf(el),
      });
    }

    // ── карточки игр ──
    const cards = [];
    const seenSlug = new Set();
    for (const a of document.querySelectorAll('a[href]')) {
      const slug = slugOf(a);
      if (!slug) continue;
      if (seenSlug.has(slug)) continue;
      seenSlug.add(slug);
      const cardEl = (() => {
        const direct = a.closest('article, li, [data-game], [data-game-slug], [data-slug]');
        if (direct) return direct;
        const cand = a.closest('[class*=card], [class*=Card]');
        if (cand && cand.querySelectorAll('a[href]').length === 1) return cand;
        return a;
      })();
      cardEl.setAttribute('data-qa-card', slug);
      const img = a.querySelector('img') || cardEl.querySelector('img');
      cards.push({
        slug,
        hrefAttr: a.getAttribute('href') || '',
        resolved: (() => { try { return new URL(a.getAttribute('href'), location.href).href; } catch (e) { return ''; } })(),
        text: txt(cardEl).slice(0, 200),
        visible: isVisible(cardEl),
        rect: rectOf(cardEl),
        img: img ? {
          srcAttr: img.getAttribute('src') || '',
          currentSrc: img.currentSrc || img.src || '',
          alt: img.getAttribute('alt'),
          naturalWidth: img.naturalWidth,
          naturalHeight: img.naturalHeight,
          complete: img.complete,
          loading: img.getAttribute('loading') || '',
          decoding: img.getAttribute('decoding') || '',
          widthAttr: img.getAttribute('width') || '',
          heightAttr: img.getAttribute('height') || '',
          visible: isVisible(img),
        } : null,
        buttonTexts: [...cardEl.querySelectorAll('button')].map((b) => txt(b)).filter(Boolean),
        dataGenre: (cardEl.closest('[data-genre]') || cardEl).getAttribute('data-genre') || '',
      });
    }

    // ── чипы фильтров ──
    const filters = [];
    const filterEls = [];
    const addFilter = (el) => {
      if (!el || filterEls.includes(el) || !isVisible(el)) return;
      if (el.hasAttribute('data-qa-theme') || el.closest('[data-qa-theme]')) return;
      if ([...el.querySelectorAll('a[href]')].some((x) => slugOf(x))) return; // карточка, а не чип
      const t = txt(el);
      if (!t || t.length > 40) return;
      filterEls.push(el);
    };
    for (const el of document.querySelectorAll('[data-genre], [data-filter], [data-filter-genre]')) {
      if (el.matches('a[href]')) continue;
      addFilter(el);
    }
    for (const container of document.querySelectorAll('[class*=filter], [class*=Filter], [class*=chip], [class*=genre], [class*=Genre], [id*=filter], [id*=Filter], [role=tablist], [aria-label*=жанр], [aria-label*=Жанр], [aria-label*=фильтр], [aria-label*=Фильтр], [aria-label*=category]')) {
      for (const el of container.querySelectorAll('button, [role=tab], [role=radio], a')) addFilter(el);
    }
    for (const el of document.querySelectorAll('button, [role=tab]')) {
      if (!isVisible(el)) continue;
      const t = txt(el);
      if (/^(все|все игры|all)$/i.test(t)) addFilter(el);
    }
    filterEls.forEach((el, i) => {
      el.setAttribute('data-qa-filter', String(i));
      filters.push({
        index: i,
        tag: el.tagName,
        text: txt(el).slice(0, 60),
        ariaPressed: el.getAttribute('aria-pressed'),
        ariaSelected: el.getAttribute('aria-selected'),
        dataGenre: el.getAttribute('data-genre') || '',
        className: String(el.className || '').slice(0, 120),
        rect: rectOf(el),
      });
    });

    // ── поиск ──
    let searchEl = document.querySelector('input[type=search]');
    if (!searchEl) {
      for (const el of document.querySelectorAll('input[type=text], input:not([type])')) {
        const blob = (el.getAttribute('placeholder') || '') + ' ' + (el.getAttribute('aria-label') || '') + ' ' + String(el.className || '');
        if (/поиск|search|найти/i.test(blob)) { searchEl = el; break; }
      }
    }
    if (searchEl && isVisible(searchEl)) searchEl.setAttribute('data-qa-search', '1');
    const search = searchEl && isVisible(searchEl) ? {
      placeholder: searchEl.getAttribute('placeholder') || '',
      ariaLabel: searchEl.getAttribute('aria-label') || '',
      type: searchEl.getAttribute('type') || 'text',
    } : null;

    // ── регионы страницы ──
    const regionSelectors = {
      header: 'header, [class*=header], [role=banner]',
      hero: '[class*=hero], [class*=Hero], [class*=intro], main > section:first-child',
      filters: '[class*=filter], [role=tablist]',
      grid: '[class*=grid], [class*=Grid], [class*=cards], main > section:nth-of-type(2)',
      footer: 'footer, [role=contentinfo]',
    };
    const regions = {};
    for (const [name, sel] of Object.entries(regionSelectors)) {
      const el = document.querySelector(sel);
      regions[name] = el ? rectOf(el) : null;
    }

    // ── анимации и prefers-reduced-motion ──
    const animated = [];
    for (const el of document.querySelectorAll('*')) {
      const s = getComputedStyle(el);
      if (s.animationName && s.animationName !== 'none' && s.animationDuration !== '0s') {
        animated.push({ tag: el.tagName, cls: String(el.className || '').slice(0, 60), name: s.animationName, duration: s.animationDuration });
      }
      if (animated.length >= 40) break;
    }
    const reducedMotionRules = [];
    for (const sheet of document.styleSheets) {
      let rules;
      try { rules = sheet.cssRules; } catch (e) { continue; }
      for (const rule of rules) {
        const stack = [rule];
        while (stack.length) {
          const r = stack.pop();
          if (r.media && /prefers-reduced-motion/i.test(r.media.mediaText)) {
            reducedMotionRules.push({ media: r.media.mediaText, css: (r.cssText || '').slice(0, 200) });
          }
          if (r.cssRules) for (const inner of r.cssRules) stack.push(inner);
        }
      }
    }

    // ── контраст текста (только там, где фон — сплошные цвета) ──
    const contrastViolations = [];
    let contrastChecked = 0;
    let contrastUnknownBg = 0;
    const candidates = [...document.querySelectorAll('h1,h2,h3,h4,p,a,button,span,li,label,strong,b,small')];
    const seenText = new Set();
    for (const el of candidates) {
      if (contrastChecked + contrastUnknownBg > 400) break;
      const ownText = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').trim();
      if (!ownText || ownText.length < 2) continue;
      if (!isVisible(el)) continue;
      if (seenText.has(el)) continue;
      seenText.add(el);
      const s = getComputedStyle(el);
      const fg = parseColor(s.color);
      if (!fg || fg[3] === 0) continue;
      // эффективный фон: идём вверх, собираем слои; если есть background-image — фон неизвестен
      const layers = [];
      let unknown = false;
      let node = el;
      while (node && node !== document.documentElement.parentElement) {
        const ns = getComputedStyle(node);
        if (ns.backgroundImage && ns.backgroundImage !== 'none') { unknown = true; break; }
        const c = parseColor(ns.backgroundColor);
        if (c && c[3] > 0) layers.push(c);
        node = node.parentElement;
      }
      if (unknown) { contrastUnknownBg += 1; continue; }
      let bg = [255, 255, 255, 1];
      for (let i = layers.length - 1; i >= 0; i -= 1) bg = blend(layers[i], bg);
      const fgComposited = fg[3] < 1 ? blend(fg, bg) : fg;
      const ratio = contrast(fgComposited, bg);
      const fontSize = parseFloat(s.fontSize) || 16;
      const fontWeight = parseInt(s.fontWeight, 10) || 400;
      const large = fontSize >= 24 || (fontSize >= 18.66 && fontWeight >= 700);
      const threshold = large ? 3 : 4.5;
      contrastChecked += 1;
      if (ratio < threshold) {
        contrastViolations.push({
          tag: el.tagName,
          cls: String(el.className || '').slice(0, 80),
          text: ownText.slice(0, 60),
          color: s.color,
          bgColor: 'rgb(' + bg.slice(0, 3).map((x) => Math.round(x)).join(', ') + ')',
          ratio,
          threshold,
          fontSize,
          fontWeight,
        });
      }
    }

    // ── лейаут: горизонтальный скролл, наложения карточек, вылеты за экран ──
    const vw = window.innerWidth;
    const docEl = document.documentElement;
    const hscroll = docEl.scrollWidth > vw + 1;
    const cardOverlaps = [];
    const visibleCards = cards.filter((c) => c.visible && c.rect);
    for (let i = 0; i < visibleCards.length; i += 1) {
      for (let j = i + 1; j < visibleCards.length; j += 1) {
        const a = visibleCards[i].rect;
        const b = visibleCards[j].rect;
        const ox = Math.min(a.right, b.right) - Math.max(a.x, b.x);
        const oy = Math.min(a.bottom, b.bottom) - Math.max(a.y, b.y);
        if (ox > 4 && oy > 4) cardOverlaps.push({ a: visibleCards[i].slug, b: visibleCards[j].slug, overlap: { x: ox, y: oy } });
      }
    }
    const offscreen = [];
    for (const el of document.querySelectorAll('body *')) {
      if (!isVisible(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.right > vw + 1 || r.left < -1) {
        // игнорируем элементы внутри горизонтально прокручиваемых контейнеров
        let p = el.parentElement;
        let scrollable = false;
        while (p && p !== document.body) {
          const ps = getComputedStyle(p);
          if ((ps.overflowX === 'auto' || ps.overflowX === 'scroll') && p.scrollWidth > p.clientWidth) { scrollable = true; break; }
          p = p.parentElement;
        }
        if (scrollable) continue;
        offscreen.push({ tag: el.tagName, cls: String(el.className || '').slice(0, 80), rect: rectOf(el), text: txt(el).slice(0, 50) });
        if (offscreen.length >= 12) break;
      }
    }
    const textOverflow = [];
    for (const el of document.querySelectorAll('h1,h2,h3,p,span,button,a')) {
      if (!isVisible(el)) continue;
      if (el.clientWidth <= 2) continue; // screen-reader-only / декоративные
      {
      if (el.scrollWidth > el.clientWidth + 3 && el.clientWidth > 0) {
        textOverflow.push({ tag: el.tagName, cls: String(el.className || '').slice(0, 60), scrollWidth: el.scrollWidth, clientWidth: el.clientWidth, text: txt(el).slice(0, 50) });
        if (textOverflow.length >= 12) break;
      }
      }
    }

    const cssVars = {};
    const rootStyle = getComputedStyle(document.documentElement);
    for (const name of ['--bg', '--bg0', '--ink', '--accent', '--font']) {
      const v = rootStyle.getPropertyValue(name);
      if (v) cssVars[name] = v.trim();
    }

    const sheets = [...document.styleSheets].map((s) => s.href || 'inline');
    const bodyText = (document.body.innerText || '').replace(/\\s+/g, ' ').trim();

    const themeProbe = {
      bodyBg: getComputedStyle(document.body).backgroundColor,
      htmlBg: getComputedStyle(document.documentElement).backgroundColor,
      bodyColor: getComputedStyle(document.body).color,
      firstCardImg: (() => {
        const img = document.querySelector('[data-qa-card] img, a[href] img');
        return img ? (img.getAttribute('src') || '') : '';
      })(),
      accent: getComputedStyle(document.documentElement).getPropertyValue('--accent').trim(),
    };

    return {
      url: location.href,
      title: document.title,
      lang: document.documentElement.lang || '',
      h1: [...document.querySelectorAll('h1')].map((e) => txt(e)),
      bodyTextLen: bodyText.length,
      bodyTextHead: bodyText.slice(0, 500),
      hasCounter: new RegExp(DEFAULT_SLUGS.length + '\\s*(игр|оригинальн)', 'i').test(bodyText),
      yearsMentioned: /19\\d\\d\\s*[–—-]\\s*19\\d\\d/.test(bodyText),
      themeNodes,
      themeProbe,
      toggles,
      cards,
      filters,
      search,
      regions,
      animatedCount: animated.length,
      animatedSample: animated.slice(0, 15),
      reducedMotionRules: { count: reducedMotionRules.length, sample: reducedMotionRules.slice(0, 3) },
      contrast: { checked: contrastChecked, unknownBg: contrastUnknownBg, violations: contrastViolations },
      layout: {
        innerWidth: vw,
        innerHeight: window.innerHeight,
        scrollWidth: docEl.scrollWidth,
        scrollHeight: docEl.scrollHeight,
        hscroll,
        cardOverlaps,
        offscreen,
        textOverflow,
      },
      cssVars,
      sheets,
      localStorage: (() => { const o = {}; try { for (let i = 0; i < localStorage.length; i += 1) { const k = localStorage.key(i); o[k] = localStorage.getItem(k); } } catch (e) { o.__error = String(e); } return o; })(),
      counts: {
        gameLinks: cards.length,
        images: document.images.length,
        buttons: document.querySelectorAll('button').length,
        focusables: document.querySelectorAll('a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])').length,
      },
      activeElement: document.activeElement && document.activeElement.tagName,
    };
  })()`;
}

function visibleSlugsExpr(slugs) {
  return `(() => {
    ${PAGE_HELPERS.replace('__SLUGS__', JSON.stringify(slugs))}
    return [...document.querySelectorAll('a[href]')].map((a) => ({ slug: slugOf(a), visible: isVisible(a), text: txt(a).slice(0, 160), rect: rectOf(a), href: a.getAttribute('href') || '' }))
      .filter((x) => x.slug && x.visible).map((x) => x.slug)
      .filter((slug, idx, arr) => arr.indexOf(slug) === idx);
  })()`;
}

function themeSignature(inv) {
  // ВАЖНО: не включаем текст/aria-label переключателя — на мобильном вёрстка
  // сокращает подпись («ГРАФИКА 8-БИТ» → «8-БИТ»), из-за этого сигнатуры
  // одной и той же темы на разных ширинах не должны различаться.
  return JSON.stringify({
    nodes: (inv?.themeNodes || []).map((n) => `${n.on}:${n.attr}:${n.value}`).sort(),
    pressed: (inv?.toggles || []).map((t) => String(t.ariaPressed)),
    probe: inv?.themeProbe || null,
  });
}

/** Прокрутить страницу целиком, чтобы догрузились lazy-превью и отработали reveal-анимации. */
async function scrollThrough(session) {
  const loaded = await session.evaluate(`(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const deadline = Date.now() + 12000;
    // 0) сначала дожидаемся, пока JS отрисует карточки из games.json
    while (Date.now() < deadline && document.querySelectorAll('#game-grid .card, #game-grid li').length === 0) {
      await wait(120);
    }
    const pending = () => [...document.images].filter((i) => !i.complete || i.naturalWidth === 0);
    // 1) прокрутка по странице
    const h = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
    const step = Math.max(180, Math.round(window.innerHeight * 0.6));
    for (let y = 0; y <= h; y += step) {
      window.scrollTo(0, y);
      await wait(120);
    }
    // 2) принудительно показываем каждое превью (lazy-загрузка)
    if (pending().length) {
      for (const img of [...document.images]) {
        if (img.naturalWidth > 0) continue;
        img.scrollIntoView({ block: 'center', behavior: 'instant' });
        await wait(180);
      }
    }
    // 3) ждём, пока все картинки декодируются (но не дольше deadline)
    while (Date.now() < deadline && pending().length) await wait(200);
    return [...document.images].filter((i) => i.naturalWidth > 0).length;
  })()`);
  await new Promise((r) => setTimeout(r, 300));
  await session.evaluate('window.scrollTo(0, 0)');
  await new Promise((r) => setTimeout(r, 350));
  return loaded;
}
/** Убедиться, что включена нужная тема (retro/modern), зная её сигнатуру. */
async function ensureTheme(session, inv, targetSig) {
  let info = await inv();
  for (let i = 0; i < 2 && themeSignature(info) !== targetSig; i += 1) {
    await session.pressKey('g');
    await sleep(1000);
    await scrollThrough(session);
    info = await inv();
  }
  return info;
}

async function fetchJson(url, attempts = 3) {
  let last;
  for (let i = 1; i <= attempts; i += 1) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(10000), headers: { connection: 'close' } });
      const text = await r.text();
      return { status: r.status, json: JSON.parse(text), bytes: text.length };
    } catch (error) {
      last = error;
      if (i < attempts) await sleep(250 * i);
    }
  }
  return { status: 0, json: null, error: String(last?.message || last) };
}

function scrollAndShoot(session, outPath, which) {
  return (async () => {
    await session.evaluate(`(() => {
      const card = document.querySelector('[data-qa-card], [class*=grid] > *, [class*=card]');
      const target = ${JSON.stringify(which)} === 'grid' ? (card || document.querySelector('main')) : document.body;
      if (target) target.scrollIntoView({ block: 'start', behavior: 'instant' });
      window.scrollBy(0, ${JSON.stringify(which)} === 'grid' ? -40 : 0);
      return window.scrollY;
    })()`);
    await sleep(700);
    return session.screenshot(outPath);
  })();
}

async function main() {
  const args = parseArgs(process.argv.slice(2), {
    base: 'http://127.0.0.1:8098',
    outDir: 'reports/qa-shots',
    json: 'reports/qa-shots/catalog-audit.json',
    wait: 1800,
  });
  if (args.help) {
    console.log('usage: node tools/qa/audit-catalog.mjs [--base URL] [--out-dir DIR] [--json FILE]');
    return;
  }
  mkdirSync(args.outDir, { recursive: true });
  const base = String(args.base).replace(/\/$/, '');
  const catalogUrl = `${base}/`;

  // ── игры и games.json ──
  const gamesJson = await fetchJson(`${base}/assets/catalog/games.json`);
  const games = Array.isArray(gamesJson.json?.games) ? gamesJson.json.games : [];
  const slugs = games.length ? games.map((g) => g.slug) : DEFAULT_SLUGS;
  const metaBySlug = Object.fromEntries(games.map((g) => [g.slug, g]));

  const http = {
    root: await httpCheck(catalogUrl),
    gamesJson: { status: gamesJson.status, count: games.length, error: gamesJson.error || null },
    thumbs: [],
  };

  const report = {
    when: new Date().toISOString(),
    base,
    catalogUrl,
    gamesJson: { status: gamesJson.status, count: games.length, slugs, error: gamesJson.error || null },
    schema: {},
    phases: {},
    links: [],
    thumbs: {},
    filters: [],
    search: {},
    keyboard: {},
    a11y: {},
    reducedMotion: {},
    layout: {},
    external: [],
    errors: [],
    missing404: {},
    verdictHints: {},
  };

  // ── валидация схемы games.json ──
  if (games.length) {
    const required = ['slug', 'title', 'subtitle', 'year', 'developer', 'genre', 'tags', 'players', 'summary', 'description', 'features', 'controls', 'styles', 'languages', 'accent', 'thumb'];
    const issues = [];
    if (games.length !== DEFAULT_SLUGS.length) issues.push(`games.length=${games.length}, ожидается ${DEFAULT_SLUGS.length}`);
    const seen = new Set();
    for (const g of games) {
      for (const field of required) {
        if (g[field] === undefined || g[field] === null || g[field] === '') issues.push(`${g.slug || '?'}: нет поля ${field}`);
      }
      if (g.slug) {
        if (seen.has(g.slug)) issues.push(`дубликат slug ${g.slug}`);
        seen.add(g.slug);
        if (!DEFAULT_SLUGS.includes(g.slug)) issues.push(`неизвестный slug ${g.slug}`);
      }
      if (g.thumb && (!g.thumb.retro || !g.thumb.modern)) issues.push(`${g.slug}: thumb без retro/modern`);
      if (g.year && (g.year < 1970 || g.year > 2000)) issues.push(`${g.slug}: подозрительный year=${g.year}`);
    }
    for (const s of DEFAULT_SLUGS) if (!seen.has(s)) issues.push(`в games.json нет ${s}`);
    // порядок по году
    const years = games.map((g) => g.year);
    const sorted = [...years].sort((a, b) => a - b);
    const orderOk = JSON.stringify(years) === JSON.stringify(sorted);
    report.schema = { ok: issues.length === 0, issues, orderByYearOk: orderOk, gamesCount: games.length };
    // HTTP-проверка превью
    for (const g of games) {
      for (const kind of ['retro', 'modern']) {
        const rel = g.thumb?.[kind];
        if (!rel) continue;
        const res = await httpCheck(`${base}/${rel.replace(/^\//, '')}`);
        http.thumbs.push({ slug: g.slug, kind, rel, status: res.status, contentType: res.contentType, bytes: res.bytes, ok: res.status === 200 });
      }
    }
  } else {
    report.schema = { ok: false, issues: ['assets/catalog/games.json не найден или пуст'], gamesCount: 0 };
  }
  report.thumbs.http = http.thumbs;

  // ── браузерная часть ──
  const session = await launch({ width: 1440, height: 900 });
  const catalogConsoleErrors = [];
  const capture = () => {
    const blocking = session.consoleErrors.filter((e) => !/favicon/i.test(e));
    if (blocking.length) catalogConsoleErrors.push(...blocking);
    for (const e of session.pageErrors) catalogConsoleErrors.push(`pageerror: ${e}`);
  };
  const inv = async () => session.evaluate(inventoryExpr(slugs));
  const shoot = (name) => session.screenshot(`${args.outDir}/${name}`);

  try {
    // ── Фаза 1: retro по умолчанию ──
    await session.setViewport({ width: 1440, height: 900, mobile: false });
    await session.goto(catalogUrl, { wait: args.wait });
    await scrollThrough(session);
    report.phases.retro = await inv();
    capture();
    report.phases.retro.shotTop = await shoot('catalog-retro-1440.png');
    report.phases.retro.shotGrid = await scrollAndShoot(session, `${args.outDir}/catalog-retro-1440-grid.png`, 'grid');
    await session.evaluate('window.scrollTo(0, 0)');
    await sleep(400);

    // ── Фаза 2: клавиша G → modern ──
    const retroSig = themeSignature(report.phases.retro);
    await session.pressKey('g');
    await sleep(1200);
    await scrollThrough(session);
    report.phases.modern = await inv();
    capture();
    report.phases.modern.shotTop = await shoot('catalog-modern-1440.png');
    report.phases.modern.shotGrid = await scrollAndShoot(session, `${args.outDir}/catalog-modern-1440-grid.png`, 'grid');
    await session.evaluate('window.scrollTo(0, 0)');
    await sleep(400);
    const modernSig = themeSignature(report.phases.modern);

    // ── Фаза 3: клик по кнопке-переключателю (возврат в retro) ──
    let clickToggle = null;
    if (report.phases.modern.toggles.length) {
      try {
        await session.click('[data-qa-theme="0"]');
        await sleep(1200);
        report.phases.afterToggleClick = await inv();
        capture();
        clickToggle = {
          ok: themeSignature(report.phases.afterToggleClick) !== modernSig,
          signatureDiffersFromModern: themeSignature(report.phases.afterToggleClick) !== modernSig,
          equalsRetro: themeSignature(report.phases.afterToggleClick) === retroSig,
          ariaPressed: report.phases.afterToggleClick.toggles[0]?.ariaPressed ?? null,
        };
        // вернуть modern и проверить сохранение после перезагрузки
        await session.pressKey('g');
        await sleep(800);
        report.phases.beforeReload = await inv();
        capture();
        await session.goto(catalogUrl, { wait: args.wait });
        report.phases.afterReload = await inv();
        capture();
        report.phases.afterReload.shot = await shoot('catalog-modern-after-reload-1440.png');
      } catch (error) {
        clickToggle = { ok: false, error: String(error?.message || error) };
      }
    }
    report.phases.toggleTests = {
      gChangedTheme: modernSig !== retroSig,
      toggleClick: clickToggle,
      persistedAfterReload: Boolean(report.phases.afterReload) && themeSignature(report.phases.afterReload) === themeSignature(report.phases.beforeReload),
      localStorageAfterSwitch: report.phases.modern.localStorage,
      localStorageAfterReload: report.phases.afterReload?.localStorage || null,
      retrofit: {
        retroSignatureSample: report.phases.retro.themeNodes,
        modernSignatureSample: report.phases.modern.themeNodes,
      },
    };

    // ── Фаза 4: фильтры по жанрам ──
    // Берём инвентарь с актуальной страницы; фильтры не зависят от темы.
    await session.goto(catalogUrl, { wait: args.wait });
    const filterInv = await inv();
    capture();
    report.phases.filtersHost = { filters: filterInv.filters, search: filterInv.search, cards: filterInv.cards.length };
    // «Все» для сброса
    const resetIdx = filterInv.filters.findIndex((f) => /^(все|все игры|all)$/i.test(f.text));
    for (const f of filterInv.filters) {
      try {
        await session.click(`[data-qa-filter="${f.index}"]`);
        await sleep(500);
        const visible = await session.evaluate(visibleSlugsExpr(slugs));
        const expected = games.filter((g) => {
          const label = f.text.toLowerCase();
          return String(g.genre || '').toLowerCase() === label || (Array.isArray(g.tags) && g.tags.some((t) => String(t).toLowerCase() === label));
        }).map((g) => g.slug);
        report.filters.push({
          text: f.text,
          ariaPressed: f.ariaPressed,
          visibleCount: visible.length,
          visibleSlugs: visible,
          expectedFromGamesJson: expected,
          matchesExpected: expected.length ? JSON.stringify([...visible].sort()) === JSON.stringify([...expected].sort()) : null,
        });
      } catch (error) {
        report.filters.push({ text: f.text, error: String(error?.message || error) });
      }
      // сброс в «Все», если это не он
      if (resetIdx >= 0 && f.index !== resetIdx) {
        try {
          await session.click(`[data-qa-filter="${resetIdx}"]`);
          await sleep(350);
        } catch { /* ignore */ }
      }
    }
    if (resetIdx >= 0 && filterInv.filters[resetIdx]) {
      await session.click(`[data-qa-filter="${resetIdx}"]`);
      await sleep(400);
      report.filters.push({ text: filterInv.filters[resetIdx].text, visibleCount: (await session.evaluate(visibleSlugsExpr(slugs))).length, isReset: true });
    }

    // ── Фаза 5: поиск ──
    if (filterInv.search) {
      const queries = games.slice(0, DEFAULT_SLUGS.length).map((g) => ({ kind: 'title', q: String(g.title), expected: g.slug, title: g.title }));
      for (const item of queries) {
        try {
          await session.evaluate(`(() => {
            const inp = document.querySelector('[data-qa-search]');
            if (!inp) return false;
            const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
            setter.call(inp, ${JSON.stringify(item.q)});
            inp.dispatchEvent(new Event('input', { bubbles: true }));
            inp.dispatchEvent(new Event('change', { bubbles: true }));
            return true;
          })()`);
          await sleep(600);
          const visible = await session.evaluate(visibleSlugsExpr(slugs));
          report.search[item.q] = {
            query: item.q,
            title: item.title,
            visibleCount: visible.length,
            includesExpected: visible.includes(item.expected),
            visible,
            shot: visible.length ? await shoot(`catalog-search-${item.expected}.png`) : null,
          };
        } catch (error) {
          report.search[item.q] = { query: item.q, error: String(error?.message || error) };
        }
      }
      // очистка + мусорный запрос
      await session.evaluate(`(() => {
        const inp = document.querySelector('[data-qa-search]');
        if (!inp) return false;
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(inp, '');
        inp.dispatchEvent(new Event('input', { bubbles: true }));
        inp.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      })()`);
      await sleep(500);
      report.search.__afterClear = { visibleCount: (await session.evaluate(visibleSlugsExpr(slugs))).length, shot: await shoot('catalog-search-cleared.png') };
      await session.evaluate(`(() => {
        const inp = document.querySelector('[data-qa-search]');
        if (!inp) return false;
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(inp, 'zzzqqq-nonexistent');
        inp.dispatchEvent(new Event('input', { bubbles: true }));
        inp.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      })()`);
      await sleep(600);
      report.search.__gibberish = { visibleCount: (await session.evaluate(visibleSlugsExpr(slugs))).length, shot: await shoot('catalog-search-empty.png') };
    }

    // ── Фаза 6: HTTP-проверка всех ссылок + href-атрибуты ──
    await session.goto(catalogUrl, { wait: args.wait });
    const linkInv = await inv();
    capture();
    const uniqueCards = [];
    const seenSlugs = new Set();
    for (const c of linkInv.cards) {
      if (seenSlugs.has(c.slug)) continue;
      seenSlugs.add(c.slug);
      uniqueCards.push(c);
    }
    for (const c of uniqueCards) {
      const res = await httpCheck(c.resolved);
      report.links.push({
        slug: c.slug,
        hrefAttr: c.hrefAttr,
        resolved: c.resolved,
        status: res.status,
        ok: res.status === 200,
        relative: !/^([a-z]+:|\/)/i.test(c.hrefAttr),
        trailingSlash: /\/$/.test(c.hrefAttr),
      });
    }
    report.linksSummary = {
      count: report.links.length,
      expected: slugs.length,
      missing: slugs.filter((s) => !report.links.some((l) => l.slug === s)),
      extra: report.links.map((l) => l.slug).filter((s) => !slugs.includes(s)),
      non200: report.links.filter((l) => l.status !== 200),
      hrefIssues: report.links.filter((l) => !l.relative || !l.trailingSlash),
    };
    // превью в обеих темах из инвентарей
    const thumbSummary = (phase, kind) => {
      const problems = [];
      const cards = phase?.cards || [];
      for (const c of cards) {
        if (!c.img) { problems.push(`${c.slug}: нет <img>`); continue; }
        if (!(c.img.naturalWidth > 0)) problems.push(`${c.slug}: naturalWidth=${c.img.naturalWidth} src=${c.img.currentSrc || c.img.srcAttr}`);
        if (!c.img.alt || !c.img.alt.trim()) problems.push(`${c.slug}: пустой alt`);
        if (c.img.srcAttr && !/assets\/catalog\/thumbs\//.test(c.img.srcAttr)) problems.push(`${c.slug}: src не из assets/catalog/thumbs (${c.img.srcAttr})`);
        if (c.img.srcAttr && kind && !new RegExp(`-${kind}\\.(webp|png|jpg|jpeg|avif)(\\?|$)`).test(c.img.srcAttr)) problems.push(`${c.slug}: в ${kind}-теме src=${c.img.srcAttr}`);
        if (c.img.complete === false) problems.push(`${c.slug}: img.complete=false (не догрузилась)`);
      }
      return { count: cards.length, withImg: cards.filter((c) => c.img).length, loaded: cards.filter((c) => c.img && c.img.naturalWidth > 0).length, problems };
    };
    report.thumbs.retro = thumbSummary(report.phases.retro, 'retro');
    report.thumbs.modern = thumbSummary(report.phases.modern, 'modern');
    report.thumbs.altsAllSet = (report.phases.retro.cards || []).every((c) => c.img && c.img.alt && c.img.alt.trim());

    // ── Фаза 7: клавиатурная навигация ──
    await session.goto(catalogUrl, { wait: args.wait });
    capture();
    await inv();
    const tabOrder = [];
    let themeReached = false;
    let cardReached = false;
    let focusedCardSlug = '';
    for (let i = 0; i < 70; i += 1) {
      await session.pressKey('Tab');
      await sleep(120);
      const focus = await session.evaluate(`(() => {
        const el = document.activeElement;
        if (!el) return null;
        const s = getComputedStyle(el);
        const cardHost = el.closest('[data-qa-card]');
        let slug = cardHost ? cardHost.getAttribute('data-qa-card') : '';
        if (!slug && el.tagName === 'A' && el.getAttribute('href')) {
          const m = (el.getAttribute('href') || '').match(/([a-z0-9-]+)\\/?$/);
          if (m) slug = m[1];
        }
        const isTheme = Boolean(el.hasAttribute('data-qa-theme') || el.closest('[data-qa-theme]')) || (() => {
          const blob = [el.id, el.className, el.getAttribute('aria-label') || '', el.getAttribute('data-action') || '', el.textContent || ''].join(' ');
          return /theme|gfx|график|стил|8-?бит|неон/i.test(blob);
        })();
        const inCard = Boolean(cardHost || el.closest('[class*=card]'));
        return {
          tag: el.tagName,
          text: (el.innerText || el.getAttribute('aria-label') || '').replace(/\\s+/g, ' ').trim().slice(0, 80),
          slug,
          ariaLabel: el.getAttribute('aria-label') || '',
          ariaPressed: el.getAttribute('aria-pressed'),
          href: el.getAttribute('href') || '',
          isTheme,
          inCard,
          outline: s.outlineStyle + ' ' + s.outlineWidth + ' ' + s.outlineColor,
          boxShadow: s.boxShadow === 'none' ? '' : s.boxShadow.slice(0, 80),
        };
      })()`);
      if (!focus) break;
      tabOrder.push(focus);
      if (focus.isTheme && !themeReached) themeReached = true;
      if (focus.inCard && focus.slug && !cardReached) {
        cardReached = true;
        focusedCardSlug = focus.slug;
      }
      if (themeReached && cardReached) break;
    }
    let enterNav = null;
    if (cardReached) {
      const expectedSlug = focusedCardSlug;
      await session.evaluate(`(() => {
        const host = document.querySelector('[data-qa-card="${expectedSlug}"]');
        const el = host ? (host.matches('a[href]') ? host : host.querySelector('a[href]')) : null;
        if (el) el.focus();
        return true;
      })()`);
      await session.pressKey('Enter');
      await sleep(1600);
      const after = await session.evaluate('({ url: location.href, title: document.title })');
      enterNav = {
        from: catalogUrl,
        expectedSlug,
        ...after,
        navigated: after.url !== catalogUrl && !after.url.endsWith('/#'),
        navigatedToExpected: after.url.includes(`/${expectedSlug}/`),
      };
    }
    report.keyboard = { tabStops: tabOrder.length, themeReached, cardReached, focusedCardSlug, enterNav, tabOrderSample: tabOrder.slice(0, 20) };

    // ── Фаза 8: доступность ──
    await session.goto(catalogUrl, { wait: args.wait });
    const a11yInv = await inv();
    capture();
    report.a11y = {
      rootLang: a11yInv.lang,
      h1Count: a11yInv.h1.length,
      h1: a11yInv.h1,
      themeToggles: (a11yInv.toggles || []).map((t) => ({ text: t.text, ariaLabel: t.ariaLabel, ariaPressed: t.ariaPressed, title: t.title })),
      togglesHaveAriaLabel: (a11yInv.toggles || []).every((t) => t.ariaLabel || t.text),
      togglesHaveAriaPressed: (a11yInv.toggles || []).some((t) => t.ariaPressed !== null),
      filters: (a11yInv.filters || []).map((f) => ({ text: f.text, ariaPressed: f.ariaPressed, ariaSelected: f.ariaSelected })),
      cardsHaveAlt: (a11yInv.cards || []).every((c) => c.img && c.img.alt && c.img.alt.trim()),
      contrast: a11yInv.contrast,
      focusables: a11yInv.counts.focusables,
    };
    // aria-pressed должен меняться при переключении темы
    if ((a11yInv.toggles || []).length) {
      await session.pressKey('g');
      await sleep(900);
      const switched = await inv();
      report.a11y.ariaPressedAfterSwitch = switched.toggles?.[0]?.ariaPressed ?? null;
      report.a11y.ariaPressedChanged = String(switched.toggles?.[0]?.ariaPressed) !== String(a11yInv.toggles[0].ariaPressed);
      await session.pressKey('g');
      await sleep(700);
    }

    // ── Фаза 9: prefers-reduced-motion ──
    await session.goto(catalogUrl, { wait: args.wait });
    const motionBefore = await session.evaluate(`(() => {
      const els = [...document.querySelectorAll('*')];
      let animated = 0;
      const samples = [];
      for (const el of els) {
        const s = getComputedStyle(el);
        if (s.animationName && s.animationName !== 'none' && s.animationDuration !== '0s') {
          animated += 1;
          if (samples.length < 10) samples.push({ tag: el.tagName, cls: String(el.className || '').slice(0, 50), name: s.animationName, duration: s.animationDuration });
        }
      }
      return { matches: matchMedia('(prefers-reduced-motion: reduce)').matches, animated, samples };
    })()`);
    await session.setEmulatedMedia({ 'prefers-reduced-motion': 'reduce' });
    await sleep(900);
    const motionAfter = await session.evaluate(`(() => {
      const els = [...document.querySelectorAll('*')];
      let animated = 0;
      const samples = [];
      let zeroTransitions = 0;
      let totalTransitions = 0;
      for (const el of els) {
        const s = getComputedStyle(el);
        if (s.animationName && s.animationName !== 'none' && s.animationDuration !== '0s') {
          animated += 1;
          if (samples.length < 10) samples.push({ tag: el.tagName, cls: String(el.className || '').slice(0, 50), name: s.animationName, duration: s.animationDuration });
        }
        const td = s.transitionDuration;
        if (td && td !== 'none') {
          const parts = td.split(',').map((x) => parseFloat(x));
          totalTransitions += 1;
          if (parts.every((x) => x === 0)) zeroTransitions += 1;
        }
      }
      return { matches: matchMedia('(prefers-reduced-motion: reduce)').matches, animated, samples, totalTransitions, zeroTransitions };
    })()`);
    report.reducedMotion = {
      before: motionBefore,
      after: motionAfter,
      cssRules: a11yInv.reducedMotionRules,
      emulationMatched: motionAfter.matches === true,
      animationsReduced: motionAfter.animated < motionBefore.animated || (motionBefore.animated === 0 && motionAfter.animated === 0),
      transitionsZeroed: motionAfter.totalTransitions > 0 ? motionAfter.zeroTransitions / motionAfter.totalTransitions : null,
    };
    report.reducedMotion.shot = await shoot('catalog-reduced-motion-1440.png');
    await session.setEmulatedMedia({});

    // ── Фаза 10: мобильный 390×844, обе темы ──
    await session.setViewport({ width: 390, height: 844, mobile: true });
    await session.goto(catalogUrl, { wait: args.wait });
    await scrollThrough(session);
    const mobileRetro = await ensureTheme(session, inv, retroSig);
    capture();
    const mobileRetroShot = await shoot('catalog-retro-390.png');
    const mobileRetroGrid = await scrollAndShoot(session, `${args.outDir}/catalog-retro-390-grid.png`, 'grid');
    await session.evaluate('window.scrollTo(0, 0)');
    await sleep(300);
    await session.pressKey('g');
    await sleep(1100);
    await scrollThrough(session);
    const mobileModern = await inv();
    capture();
    const mobileModernShot = await shoot('catalog-modern-390.png');
    const mobileModernGrid = await scrollAndShoot(session, `${args.outDir}/catalog-modern-390-grid.png`, 'grid');
    report.phases.mobileRetro = { themeNodes: mobileRetro.themeNodes, toggles: mobileRetro.toggles, themeProbe: mobileRetro.themeProbe, localStorage: mobileRetro.localStorage, signature: themeSignature(mobileRetro) };
    report.phases.mobileModern = { themeNodes: mobileModern.themeNodes, toggles: mobileModern.toggles, themeProbe: mobileModern.themeProbe, localStorage: mobileModern.localStorage, signature: themeSignature(mobileModern) };
    report.phases.desktopRetroSig = retroSig;
    report.phases.desktopModernSig = modernSig;
    report.layout.mobile = {
      retro: {
        viewport: mobileRetro.layout,
        cards: mobileRetro.cards.filter((c) => c.visible).map((c) => ({ slug: c.slug, rect: c.rect, imgW: c.img?.naturalWidth })),
        filtersWrap: (mobileRetro.filters || []).map((f) => ({ text: f.text, rect: f.rect })),
        shotTop: mobileRetroShot,
        shotGrid: mobileRetroGrid,
      },
      modern: {
        viewport: mobileModern.layout,
        shotTop: mobileModernShot,
        shotGrid: mobileModernGrid,
        thumbs: thumbSummary(mobileModern, 'modern'),
      },
      themeChangedOnMobile: themeSignature(mobileModern) !== themeSignature(mobileRetro),
    };

    // ── Фаза 11: десктопный лейаут (из инвентаря) ──
    report.layout.desktop = {
      retro: { viewport: report.phases.retro.layout, regions: report.phases.retro.regions, shotTop: report.phases.retro.shotTop, shotGrid: report.phases.retro.shotGrid },
      modern: { viewport: report.phases.modern.layout, regions: report.phases.modern.regions, shotTop: report.phases.modern.shotTop, shotGrid: report.phases.modern.shotGrid },
    };

    // ── Фаза 12: 404 ──
    await session.setViewport({ width: 1440, height: 900, mobile: false });
    const missingUrl = `${base}/qa-missing-page-${Date.now()}/`;
    const missingHttp = await httpCheck(missingUrl);
    await session.goto(missingUrl, { wait: 700 }).catch(() => null);
    capture();
    report.missing404 = {
      url: missingUrl,
      status: missingHttp.status,
      hasCustomPage: Boolean(await session.evaluate(`(() => {
        const t = (document.body?.innerText || '').trim();
        return t.length > 80 && !/File not found|Directory listing|Error response/i.test(t);
      })()`).catch(() => false)),
      shot: await shoot('catalog-404.png').catch(() => null),
    };

    // ── внешние запросы за все фазы ──
    const externalMap = new Map();
    const baseHost = new URL(base).hostname;
    for (const req of session.requests.values()) {
      let u;
      try { u = new URL(req.url); } catch { continue; }
      if (!/^https?:$/.test(u.protocol)) continue;
      if (['127.0.0.1', 'localhost', '[::1]', '::1', baseHost].includes(u.hostname)) continue;
      if (!externalMap.has(u.hostname)) externalMap.set(u.hostname, []);
      externalMap.get(u.hostname).push(req.url);
    }
    report.external = [...externalMap.entries()].map(([host, urls]) => ({ host, urls: [...new Set(urls)] }));

    report.errors = catalogConsoleErrors;
    report.verdictHints = {
      httpRootOk: http.root.status === 200,
      titleOk: Boolean(report.phases.retro.title && report.phases.retro.title.trim() && !/Directory listing/i.test(report.phases.retro.title)),
      notDirectoryListing: !/Directory listing/i.test(report.phases.retro.bodyTextHead || ''),
      freshProfileNoThemeStorage: Object.keys(report.phases.retro.localStorage || {}).length === 0,
      defaultStateMentionsRetro: /retro|classic|8-?бит|8bit/i.test(JSON.stringify([report.phases.retro.themeNodes, report.phases.retro.toggles, report.phases.retro.cssVars, report.phases.retro.themeProbe])),
      defaultRetro: themeSignature(report.phases.retro) !== themeSignature(report.phases.modern)
        && report.phases.toggleTests.gChangedTheme
        && Object.keys(report.phases.retro.localStorage || {}).length === 0
        && /retro|classic|8-?бит|8bit/i.test(JSON.stringify([report.phases.retro.themeNodes, report.phases.retro.toggles, report.phases.retro.cssVars, report.phases.retro.themeProbe])),
      allLinks200: report.links.every((l) => l.status === 200),
      allCards: report.phases.retro.cards.filter((c) => c.slug).length === DEFAULT_SLUGS.length,
      thumbsRetroOk: report.thumbs.retro.problems.length === 0,
      thumbsModernOk: report.thumbs.modern.problems.length === 0,
      altsSet: report.thumbs.altsAllSet,
      consoleOk: catalogConsoleErrors.length === 0,
      externalOk: report.external.length === 0,
      noHscrollDesktop: !report.phases.retro.layout.hscroll && !report.phases.modern.layout.hscroll,
      noHscrollMobile: !mobileRetro.layout.hscroll && !mobileModern.layout.hscroll,
      noCardOverlap: report.phases.retro.layout.cardOverlaps.length === 0 && report.phases.modern.layout.cardOverlaps.length === 0,
      keyboardOk: report.keyboard.themeReached && report.keyboard.cardReached,
      enterNavigates: Boolean(report.keyboard.enterNav?.navigated),
      ariaOk: report.a11y.togglesHaveAriaPressed,
      reducedMotionHandled: report.reducedMotion.emulationMatched && (report.reducedMotion.cssRules.count > 0 || report.reducedMotion.animationsReduced),
      gamesJsonOk: report.schema.ok !== false,
      thumbsHttpOk: http.thumbs.every((t) => t.ok),
      linksRelativeTrailingSlash: report.links.every((l) => l.relative && l.trailingSlash),
    };
  } finally {
    await session.close();
  }

  mkdirSync(args.outDir, { recursive: true });
  writeFileSync(args.json, JSON.stringify(report, null, 2));

  // ── краткий вывод ──
  const v = report.verdictHints;
  console.log('\n=== CATALOG AUDIT ===');
  for (const [k, val] of Object.entries(v)) console.log(`${val === true ? 'OK  ' : 'FAIL'} ${k}${val === null ? ' (n/a)' : ''}`);
  console.log('\nlinks:', report.links.map((l) => `${l.slug}:${l.status}`).join(' '));
  console.log('filters:', report.filters.map((f) => `${f.text}=${f.visibleCount}`).join(' '));
  console.log('console errors:', report.errors.length, report.errors.slice(0, 5));
  console.log('external:', report.external.map((e) => e.host).join(', ') || 'none');
  console.log('JSON:', args.json);
}

main().catch((error) => {
  console.error('FATAL', error);
  process.exit(1);
});
