// The "Save as PDF" keepsake: tonight's menu with each wine's favourite pairing and notes as they
// stand, all read from the page. Drawn in the light scheme on one canvas, A4 at 2 px per point, one
// JPEG per page (six at most), and wrapped in a small hand-written PDF. notes.js imports this module
// on the first tap, then shares or downloads the file.

// Page, margins and columns in canvas px: numerals hang left of X; a dish's English starts at
// DISH_EN, a labelled line's text at VALUE.
const W = 1190, H = 1684, M = 90, R = W - M, TOP = 72, BOTTOM = H - 112, MAX_PAGES = 6;
const X = M + 112, DISH_EN = X + 320, VALUE = X + 220;
// tokens.css, light scheme: the keepsake is paper and ink whatever the phone's scheme.
const C = { paper: '#F3E9D7', ink: '#4C2819', muted: '#6F5040', accent: '#9F3B26', rule: 'rgba(76, 40, 25, 0.3)' };
const css = getComputedStyle(document.documentElement);
const [display, text, sc, zh] = ['display', 'text', 'sc', 'zh'].map((f) => css.getPropertyValue(`--font-${f}`).trim());
const mixed = `${text.replace(/,\s*serif$/, '')}, ${zh}`; // Latin in the text face, Chinese in the Chinese face
// Each style: font, colour, line height, tracking.
const S = {
  date: { font: `21px ${sc}`, color: C.ink, lh: 30, track: '1.5px' },
  place: { font: `21px ${sc}`, color: C.muted, lh: 30, track: '1.5px' },
  label: { font: `18px ${sc}`, color: C.muted, lh: 30, track: '1.3px' },
  name: { font: `64px ${display}`, color: C.ink, lh: 120 },
  stamp: { font: `34px ${display}`, color: C.accent, lh: 52 },
  credit: { font: `italic 26px ${text}`, color: C.ink },
  creditZh: { font: `25px ${zh}`, color: C.ink },
  cuisine: { font: `italic 20px ${text}`, color: C.muted },
  cuisineZh: { font: `22px ${zh}`, color: C.muted },
  numeral: { font: `66px ${display}`, color: C.accent, lh: 70 },
  title: { font: `30px ${display}`, color: C.ink, lh: 40 },
  style: { font: `italic 20px ${text}`, color: C.muted, lh: 30 },
  dishZh: { font: `24px ${zh}`, color: C.ink, lh: 34 },
  dishEn: { font: `italic 19px ${text}`, color: C.muted, lh: 26 },
  wine: { font: `24px ${display}`, color: C.ink, lh: 36 },
  body: { font: `22px ${mixed}`, color: C.ink, lh: 32 },
  foot: { font: `16px ${sc}`, color: C.muted, lh: 24, track: '1.2px' },
};

// What the keepsake prints, read from the page: the menu as shown, each wine's pick and note now.
const read = () => {
  const q = (sel, el = document) => el.querySelector(sel);
  const button = q('[data-export="pdf"]');
  const dishes = (el) => [...el.querySelectorAll('.dish-list li')].map((li) => [q('.dish-zh', li).textContent, q('.dish-en', li).textContent]);
  // The credit's English and Chinese, each in its own face as on the page (Chinese is never slanted).
  const runs = (el, latin, chinese) => [...el.childNodes].map((n) => [n.nodeType === 1 ? chinese : latin, n.textContent.trim()]).filter(([, t]) => t);
  const credit = q('.credit-note').parentElement;
  const [date, place = ''] = [...document.querySelectorAll('.dateline p span')].map((s) => s.textContent);
  return {
    title: button.dataset.title,
    file: button.dataset.file,
    footer: button.dataset.footer,
    pageLine: button.dataset.page,
    pairing: q('.export').dataset.pairing,
    notes: button.dataset.notes,
    date,
    place,
    volume: q('.stamp').textContent,
    name: q('.mast-word img').alt,
    // An <img>'s own src is the light-scheme file; dark mode swaps it only through <source>.
    word: q('.mast-word img').getAttribute('src'),
    mark: q('.mast-host img').getAttribute('src'),
    kitchen: [[S.label, q('dt', credit).textContent], ...runs(q('.credit-name', credit), S.credit, S.creditZh), ...runs(q('.credit-note', credit), S.cuisine, S.cuisineZh)],
    courses: [...document.querySelectorAll('.course')].map((c) => ({
      numeral: q('.numeral', c).textContent,
      title: q('.pour', c).textContent,
      style: q('.style', c).textContent,
      dishes: dishes(c),
      wines: [...c.querySelectorAll('.notes')].map((n) => {
        const chip = q('.chip[aria-pressed="true"]', n);
        return { line: q('.notes-field', n).dataset.line, pick: chip ? `${chip.dataset.zh} · ${chip.dataset.en}` : '', note: q('.notes-field', n).value.trim() };
      }),
    })),
    finale: { title: q('.finale-title').textContent, dishes: dishes(q('.finale')) },
  };
};

// ---------- drawing ----------
const canvas = Object.assign(document.createElement('canvas'), { width: 0, height: 0 });
const ctx = canvas.getContext('2d');
const pen = (s) => {
  ctx.font = s.font;
  ctx.fillStyle = s.color;
  ctx.letterSpacing = s.track || '0px';
};
const width = (s, str) => (pen(s), ctx.measureText(str).width);
// Text on the baseline of a line box of height h whose top is y.
const put = (s, str, x, y, h = s.lh) => {
  pen(s);
  ctx.fillText(str, x, y + h * 0.7);
};

// Greedy wrap by measured width: at spaces, and anywhere in Chinese or in a word too long for the line.
const CJK = '⺀-鿿豈-﫿＀-￯';
const TOKENS = new RegExp(`\\s+|[${CJK}]|[^\\s${CJK}]+`, 'g');
const wrap = (s, str, max) => str.split('\n').flatMap((para) => {
  const lines = [];
  let line = '';
  const tokens = (para.match(TOKENS) || []).flatMap((t) => (width(s, t) > max ? [...t] : [t]));
  for (const t of tokens) {
    if (!line && !t.trim()) continue;
    if (line && width(s, (line + t).trimEnd()) > max) {
      lines.push(line.trimEnd());
      line = t.trim() ? t : '';
    } else line += t;
  }
  return [...lines, line.trimEnd()];
});

// Layout items: { h, draw(top) }. Spacers, rules and blank lines are dropped at the top of a page.
const space = (h) => ({ h, space: true, draw() {} });
const rule = (h, weight = 2, color = C.rule, dash = []) => ({ h, space: true, draw: (y) => {
  ctx.setLineDash(dash);
  ctx.lineWidth = weight;
  ctx.strokeStyle = color;
  ctx.beginPath();
  ctx.moveTo(M, y + h / 2);
  ctx.lineTo(R, y + h / 2);
  ctx.stroke();
} });
const lines = (s, str, x) => wrap(s, str, R - x).map((t) => ({ h: s.lh, space: !t, draw: (y) => put(s, t, x, y) }));
// A small-caps label beside the first line of its text, as the page's "For the nerds" list sets them.
const labelled = (label, s, str) => wrap(s, str, R - VALUE).map((t, i) => ({ h: s.lh, space: !t, draw: (y) => {
  put(s, t, VALUE, y);
  if (!i) put(S.label, label, X, y, s.lh);
} }));
// A dish: the Chinese, and the English beside it.
const dish = ([zhName, en]) => {
  const zhLines = wrap(S.dishZh, zhName, DISH_EN - X - 24);
  const enLines = wrap(S.dishEn, en, R - DISH_EN);
  return { h: Math.max(zhLines.length * S.dishZh.lh, S.dishZh.lh + (enLines.length - 1) * S.dishEn.lh), draw: (y) => {
    zhLines.forEach((t, i) => put(S.dishZh, t, X, y + i * S.dishZh.lh));
    enLines.forEach((t, i) => put(S.dishEn, t, DISH_EN, y + i * S.dishEn.lh, S.dishZh.lh));
  } };
};
const dishes = (list) => list.flatMap((d, i) => (i ? [space(4), dish(d)] : [dish(d)]));
// A course head: the numeral hanging in the margin, the title and its rule, the style under them.
const head = (c) => ({ h: 66, draw: (y) => {
  pen(S.numeral);
  ctx.save();
  ctx.translate(M, y + 60);
  ctx.rotate(-Math.PI / 90);
  ctx.fillText(c.numeral, 0, 0);
  ctx.restore();
  put(S.title, c.title, X, y);
  const end = X + width(S.title, c.title) + 18;
  ctx.fillStyle = C.ink;
  ctx.fillRect(end, y + 18, R - end, 3);
  put(S.style, c.style, X, y + 36);
} });

// The masthead: dateline, wordmark with the Volume stamp and the walking table, the kitchen credit.
const masthead = (page, word, mark) => [
  { h: 30, draw: (y) => {
    put(S.date, page.date, M, y);
    put(S.place, page.place, R - width(S.place, page.place), y);
  } },
  rule(12),
  { h: 164, draw: (y) => {
    if (word) ctx.drawImage(word, M, y + 4, 200, (200 * word.naturalHeight) / word.naturalWidth);
    else put(S.name, page.name, M, y);
    const box = width(S.stamp, page.volume) + 28;
    ctx.save();
    ctx.translate(M + 228, y + 98);
    ctx.rotate(-Math.PI / 90);
    ctx.strokeStyle = C.accent;
    ctx.lineWidth = 3;
    ctx.setLineDash([]);
    ctx.strokeRect(0, 0, box, 52);
    put(S.stamp, page.volume, 14, 2);
    ctx.restore();
    if (mark) {
      const w = (164 * mark.naturalWidth) / mark.naturalHeight;
      ctx.drawImage(mark, R - w, y + 4, w, 164);
    }
  } },
  rule(10, 3, C.ink),
  { h: 44, draw: (y) => page.kitchen.reduce((x, [s, t], i) => {
    put(s, t, x, y, 44);
    return x + width(s, t) + (i ? 12 : 28);
  }, M) },
  rule(16),
];

// Blocks of items; a block's first `keep` items (all of them unless set) stay on one page.
const layout = (page, word, mark) => [
  { items: masthead(page, word, mark) },
  ...page.courses.flatMap((c, i) => [
    { items: [...(i ? [space(8), rule(26)] : [space(16)]), head(c), space(6), ...dishes(c.dishes)] },
    ...c.wines.map((w) => {
      const top = [space(14), ...lines(S.wine, w.line, X), ...(w.pick ? labelled(page.pairing, S.body, w.pick) : [])];
      const notes = w.note ? labelled(page.notes, S.body, w.note) : [];
      return { items: [...top, ...notes], keep: top.length + Math.min(notes.length, 2) };
    }),
  ]),
  { items: [space(8), rule(26, 2, C.rule, [8, 8]), ...lines(S.title, page.finale.title, X), space(6), ...dishes(page.finale.dishes)] },
];

// Pages of [item, top]. A block whose kept items don't fit starts a new page; the rest flows.
// Past the cap, the last line becomes an ellipsis.
const paginate = (blocks) => {
  const pages = [[]];
  let y = TOP;
  for (const { items, keep = items.length } of blocks) {
    const need = items.slice(0, keep).reduce((sum, item) => sum + item.h, 0);
    if (y + need > BOTTOM && y > TOP) { pages.push([]); y = TOP; }
    for (const item of items) {
      if (y + item.h > BOTTOM) { pages.push([]); y = TOP; }
      if (item.space && y === TOP) continue;
      pages[pages.length - 1].push([item, y]);
      y += item.h;
    }
  }
  if (pages.length > MAX_PAGES) {
    pages.length = MAX_PAGES;
    const last = pages[MAX_PAGES - 1];
    last[last.length - 1][0] = { draw: (at) => put(S.body, '…', VALUE, at) };
  }
  return pages;
};

const footer = (page, n, total) => {
  rule(2).draw(H - 92);
  put(S.foot, page.footer, M, H - 84);
  const count = page.pageLine.replace('{n}', n).replace('{total}', total);
  put(S.foot, count, R - width(S.foot, count), H - 84);
};

const image = (src) => new Promise((resolve) => {
  const img = new Image();
  img.onload = () => resolve(img);
  img.onerror = () => resolve(null);
  img.src = src;
});

const jpeg = () => new Promise((resolve, reject) => canvas.toBlob((blob) => {
  if (blob && blob.type === 'image/jpeg') blob.arrayBuffer().then((b) => resolve(new Uint8Array(b)), reject);
  else reject(new Error('this browser did not encode the page as JPEG'));
}, 'image/jpeg', 0.86));

// A minimal PDF 1.4: per page a Page, its content stream and the page's JPEG (DCTDecode). Assembled
// from bytes, so the xref offsets count the binary JPEG data exactly.
const pdf = (jpegs, title) => {
  const enc = new TextEncoder();
  const parts = [];
  const offsets = [0];
  let size = 0;
  const add = (chunk) => {
    const bytes = typeof chunk === 'string' ? enc.encode(chunk) : chunk;
    parts.push(bytes);
    size += bytes.length;
  };
  const obj = (n, dict, stream) => {
    offsets[n] = size;
    add(`${n} 0 obj\n${dict}\n`);
    if (stream) { add('stream\n'); add(stream); add('\nendstream\n'); }
    add('endobj\n');
  };
  // The title as UTF-16 with a byte order mark: any character, nothing to escape.
  const utf16 = (s) => `<FEFF${[...Array(s.length).keys()].map((i) => s.charCodeAt(i).toString(16).padStart(4, '0')).join('')}>`;
  add('%PDF-1.4\n');
  add(new Uint8Array([37, 226, 227, 207, 211, 10])); // a comment of high bytes: the file is binary
  obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
  obj(2, `<< /Type /Pages /Count ${jpegs.length} /Kids [${jpegs.map((_, i) => `${4 + 3 * i} 0 R`).join(' ')}] >>`);
  obj(3, `<< /Title ${utf16(title)} /Producer (Tipsy Table) >>`);
  jpegs.forEach((jpg, i) => {
    const n = 4 + 3 * i;
    const draw = enc.encode(`q 595 0 0 842 0 0 cm /Im${i + 1} Do Q`);
    obj(n, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /XObject << /Im${i + 1} ${n + 2} 0 R >> >> /Contents ${n + 1} 0 R >>`);
    obj(n + 1, `<< /Length ${draw.length} >>`, draw);
    obj(n + 2, `<< /Type /XObject /Subtype /Image /Width ${W} /Height ${H} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpg.length} >>`, jpg);
  });
  const xref = size;
  add(`xref\n0 ${offsets.length}\n0000000000 65535 f \n${offsets.slice(1).map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`);
  add(`trailer\n<< /Size ${offsets.length} /Root 1 0 R /Info 3 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  return new Blob(parts, { type: 'application/pdf' });
};

// The keepsake as a PDF File, named and titled from the page.
export async function keepsake() {
  const page = read();
  await document.fonts.ready;
  // Every face, for every character the keepsake prints; one that can't load falls back, as on the page.
  const chars = JSON.stringify(page);
  await Promise.all(Object.values(S).map((s) => document.fonts.load(s.font, chars).catch(() => null)));
  const [word, mark] = await Promise.all([image(page.word), image(page.mark)]);
  const pages = paginate(layout(page, word, mark));
  Object.assign(canvas, { width: W, height: H });
  const jpegs = [];
  for (const [i, items] of pages.entries()) {
    ctx.fillStyle = C.paper;
    ctx.fillRect(0, 0, W, H);
    for (const [item, y] of items) item.draw(y);
    footer(page, i + 1, pages.length);
    jpegs.push(await jpeg());
  }
  Object.assign(canvas, { width: 0, height: 0 }); // iOS frees a canvas's memory only when it shrinks
  return new File([pdf(jpegs, page.title)], page.file, { type: 'application/pdf' });
}
