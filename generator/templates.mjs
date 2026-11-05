// HTML for every Stackd Instagram layout. Rendered by render.mjs with Playwright.
// Feed slides are 1080 × 1350 (4:5); reels are 1080 × 1920 (9:16).
// Text markup: *word* shows in the accent violet. Cards are codes like "As", "Td", "7h".
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dataUri = (file) => {
  const ext = path.extname(file).slice(1).replace('otf', 'font/otf').replace('png', 'image/png');
  return `data:${ext.includes('/') ? ext : 'application/octet-stream'};base64,${fs.readFileSync(file).toString('base64')}`;
};
const FONT_WEIGHTS = { Regular: 400, Medium: 500, SemiBold: 600, Bold: 700, ExtraBold: 800 };
const fontFaces = Object.entries(FONT_WEIGHTS)
  .map(
    ([name, weight]) =>
      `@font-face{font-family:StackdInter;font-weight:${weight};src:url(${dataUri(path.join(here, 'fonts', `Inter-${name}.otf`))})}`,
  )
  .join('');
export const SPADE = dataUri(path.join(here, 'assets', 'spade.png'));
const screenshotCache = new Map();
export function screenshot(name) {
  if (!screenshotCache.has(name)) {
    const file = path.join(here, 'assets', 'screenshots', `${name}.png`);
    if (!fs.existsSync(file)) throw new Error(`No screenshot called "${name}" in generator/assets/screenshots`);
    screenshotCache.set(name, dataUri(file));
  }
  return screenshotCache.get(name);
}

export const C = {
  bg: '#0A0A0C',
  card: '#141417',
  raised: '#1E1E23',
  border: '#232329',
  text: '#FFFFFF',
  soft: '#D4D4DA',
  muted: '#A1A1AD',
  faint: '#80808C',
  accent: '#8B6CFF',
  accentText: '#B9A5FF',
  profit: '#34D399',
  loss: '#F87171',
  call: '#2DD4BF',
  allin: '#F5A524',
  cardFace: '#F4F4F6',
};

const esc = (s = '') =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// *accent* → violet; **bold** is not supported on purpose (keep text simple).
export const rich = (s = '') => esc(s).replace(/\*([^*]+)\*/g, '<span class="a">$1</span>').replace(/\n/g, '<br>');

const SUITS = { s: ['♠', '#16161A'], c: ['♣', '#16161A'], h: ['♥', '#E5484D'], d: ['♦', '#E5484D'] };
export function cardHtml(code, size = 1) {
  const rank = code[0] === 'T' ? '10' : code[0];
  const [suit, color] = SUITS[code[1]?.toLowerCase()] ?? ['?', '#16161A'];
  const w = Math.round(132 * size);
  const h = Math.round(w * 1.4);
  return `<div class="pc" style="width:${w}px;height:${h}px;color:${color}">
    <b style="font-size:${Math.round(w * 0.42)}px">${rank}</b>
    <i style="font-size:${Math.round(w * 0.5)}px">${suit}</i></div>`;
}

const BASE = (w, h) => `
${fontFaces}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:${w}px;height:${h}px;overflow:hidden;background:${C.bg};color:${C.text};
  font-family:StackdInter,Inter,system-ui,sans-serif;-webkit-font-smoothing:antialiased}
.frame{position:relative;width:${w}px;height:${h}px;overflow:hidden;
  background:radial-gradient(110% 55% at 50% -8%,#3A2477 0%,#1A1033 42%,${C.bg} 78%)}
.a{color:${C.accentText}}
.kicker{font-size:30px;font-weight:700;letter-spacing:7px;text-transform:uppercase;color:${C.accentText}}
.title{font-weight:800;letter-spacing:-2px;line-height:1.04;text-wrap:balance}
.body{color:${C.soft};line-height:1.42}
.muted{color:${C.muted}}
.pc{position:relative;flex:none;background:${C.cardFace};border-radius:16px;box-shadow:0 18px 40px rgba(0,0,0,.45);line-height:1}
.pc b{position:absolute;left:12%;top:9%;font-weight:800;letter-spacing:-2px}
.pc i{position:absolute;right:11%;bottom:8%;font-style:normal}
.cards{display:flex;gap:18px;flex-wrap:wrap}
.brand{display:flex;align-items:center;gap:14px;font-weight:800;font-size:30px;letter-spacing:1px}
.brand img{width:44px;height:44px}
.panel{background:${C.card};border:2px solid ${C.border};border-radius:28px}
`;

// ---------------------------------------------------------------------------
// Feed slides (1080 × 1350)
// ---------------------------------------------------------------------------
const W = 1080;
const H = 1350;
const PAD = 84;

function footer(index, total) {
  const swipe = index < total - 1 ? `<div style="font-size:30px;color:${C.muted};font-weight:600">Swipe →</div>` : '';
  return `<div data-footer style="position:absolute;left:${PAD}px;right:${PAD}px;bottom:70px;display:flex;justify-content:space-between;align-items:center">
    <div class="brand"><img src="${SPADE}">STACKD</div>${swipe}</div>`;
}
function counter(index, total) {
  if (total < 2) return '';
  return `<div data-footer style="position:absolute;top:64px;right:${PAD}px;font-size:28px;color:${C.muted};font-weight:600;letter-spacing:3px">${
    index + 1
  } / ${total}</div>`;
}
function head(s, titleSize = 104) {
  return `${s.kicker ? `<div class="kicker">${rich(s.kicker)}</div>` : ''}
    ${s.title ? `<div class="title" style="font-size:${s.titleSize ?? titleSize}px;margin-top:${s.kicker ? 30 : 0}px">${rich(s.title)}</div>` : ''}
    ${s.body ? `<div class="body" style="font-size:${s.bodySize ?? 40}px;margin-top:34px">${rich(s.body)}</div>` : ''}`;
}

const LAYOUTS = {
  // Big opening slide: kicker, headline, optional cards and a line under them.
  cover: (s) => `<div class="fit" style="position:absolute;inset:150px ${PAD}px 180px">
      ${head(s, 118)}
      ${s.cards?.length ? `<div class="cards" style="margin-top:70px">${s.cards.map((c) => cardHtml(c, s.cardSize ?? 1.15)).join('')}</div>` : ''}
      ${s.sub ? `<div class="body" style="font-size:42px;margin-top:70px;color:${C.soft}">${rich(s.sub)}</div>` : ''}
    </div>`,

  // Numbered points.
  list: (s) => `<div class="fit" style="position:absolute;inset:150px ${PAD}px 180px">
      ${head(s, 88)}
      <div style="display:flex;flex-direction:column;gap:26px;margin-top:56px">
        ${(s.items ?? [])
          .map(
            (it, i) => `<div class="panel" style="display:flex;gap:30px;padding:36px 40px;align-items:flex-start">
              <div style="flex:none;width:64px;height:64px;border-radius:32px;background:#2A2150;color:${C.accentText};font-weight:800;font-size:32px;display:flex;align-items:center;justify-content:center">${
                it.mark ? esc(it.mark) : i + 1
              }</div>
              <div><div style="font-size:42px;font-weight:700;line-height:1.15">${rich(it.title)}</div>
              ${it.body ? `<div class="body" style="font-size:33px;margin-top:10px;color:${C.muted}">${rich(it.body)}</div>` : ''}</div>
            </div>`,
          )
          .join('')}
      </div></div>`,

  // One big sentence in the middle.
  statement: (s) => `<div class="fit" style="position:absolute;inset:0 ${PAD}px;display:flex;flex-direction:column;justify-content:center">
      ${s.kicker ? `<div class="kicker">${rich(s.kicker)}</div>` : ''}
      <div class="title" style="font-size:${s.titleSize ?? 112}px;margin-top:34px">${rich(s.title)}</div>
      ${s.body ? `<div class="body" style="font-size:44px;margin-top:44px">${rich(s.body)}</div>` : ''}
    </div>`,

  // A real app screen in a phone frame, text on top.
  screenshot: (s) => {
    const top = s.body ? 470 : 360;
    const pos = { top: 'top', bottom: 'bottom', center: 'center' }[s.crop ?? 'top'];
    return `<div class="fit" style="position:absolute;inset:130px ${PAD}px 0">${head(s, 84)}</div>
      <div style="position:absolute;left:50%;transform:translateX(-50%);top:${top}px;bottom:150px;width:600px;border-radius:64px;padding:14px;background:#232030;box-shadow:0 0 0 3px #3b3550,0 40px 100px rgba(0,0,0,.6)">
        <div style="width:100%;height:100%;border-radius:52px;background:url(${screenshot(s.screenshot)}) ${pos} / 100% auto no-repeat"></div>
      </div>`;
  },

  // Do this / not that, two columns.
  compare: (s) => `<div class="fit" style="position:absolute;inset:150px ${PAD}px 180px">
      ${head(s, 84)}
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:26px;margin-top:56px">
        ${[
          [s.left, C.loss, '✕'],
          [s.right, C.profit, '✓'],
        ]
          .map(
            ([col, color, mark]) => `<div class="panel" style="padding:40px 36px;border-color:${color}55">
              <div style="font-size:30px;font-weight:800;letter-spacing:4px;text-transform:uppercase;color:${color}">${esc(col?.label ?? '')}</div>
              <div style="display:flex;flex-direction:column;gap:26px;margin-top:30px">
              ${(col?.items ?? [])
                .map(
                  (t) => `<div style="display:flex;gap:16px;font-size:34px;line-height:1.3;color:${C.soft}"><span style="color:${color};font-weight:800">${mark}</span><span>${rich(t)}</span></div>`,
                )
                .join('')}</div></div>`,
          )
          .join('')}
      </div></div>`,

  // A question with answer chips (engagement posts).
  question: (s) => `<div class="fit" style="position:absolute;inset:150px ${PAD}px 180px">
      ${head(s, 92)}
      ${s.cards?.length ? `<div class="cards" style="margin-top:50px">${s.cards.map((c) => cardHtml(c, 1)).join('')}</div>` : ''}
      <div style="display:flex;flex-direction:column;gap:22px;margin-top:56px">
        ${(s.options ?? [])
          .map(
            (o, i) => `<div class="panel" style="display:flex;align-items:center;gap:26px;padding:30px 36px">
            <div style="flex:none;width:60px;height:60px;border-radius:16px;background:${C.raised};border:2px solid ${C.border};font-weight:800;font-size:30px;display:flex;align-items:center;justify-content:center;color:${C.accentText}">${'ABCD'[i]}</div>
            <div style="font-size:40px;font-weight:600">${rich(o)}</div></div>`,
          )
          .join('')}
      </div>
      ${s.sub ? `<div class="body" style="font-size:36px;margin-top:44px;color:${C.muted}">${rich(s.sub)}</div>` : ''}
    </div>`,

  // Last slide: the logo and where to go.
  cta: (s) => `<div style="position:absolute;inset:0 ${PAD}px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center">
      <div style="width:190px;height:190px;border-radius:46px;background:#13111B;display:flex;align-items:center;justify-content:center;box-shadow:0 0 0 2px #2b2540,0 30px 80px rgba(139,108,255,.25)"><img src="${SPADE}" style="width:130px"></div>
      <div class="title" style="font-size:${s.titleSize ?? 96}px;margin-top:70px">${rich(s.title)}</div>
      ${s.body ? `<div class="body" style="font-size:42px;margin-top:40px">${rich(s.body)}</div>` : ''}
      <div style="margin-top:56px;padding:22px 46px;border-radius:999px;border:2px solid #3B3360;background:#1C1830;color:${C.accentText};font-weight:700;font-size:38px">${esc(
        s.pill ?? 'stackdpoker.app',
      )}</div></div>`,
};

export function slideHtml(slide, index, total) {
  const layout = LAYOUTS[slide.layout];
  if (!layout) throw new Error(`Unknown slide layout "${slide.layout}". Use: ${Object.keys(LAYOUTS).join(', ')}`);
  const showFooter = slide.layout !== 'cta';
  return `<!doctype html><html><head><meta charset="utf-8"><style>${BASE(W, H)}</style></head><body>
    <div class="frame">${counter(index, total)}${layout(slide)}${showFooter ? footer(index, total) : ''}</div></body></html>`;
}
export const SLIDE_LAYOUTS = Object.keys(LAYOUTS);

// ---------------------------------------------------------------------------
// Reels (1080 × 1920). The page exposes window.setTime(seconds) and the renderer
// screenshots every frame. Nothing sits in the outer 250px top / 380px bottom,
// where Instagram's own buttons and caption cover the video.
// ---------------------------------------------------------------------------
const RW = 1080;
const RH = 1920;

export function reelTimeline(reel) {
  const beats = [];
  let t = 0.6;
  if (reel.layout === 'chat') {
    for (const m of reel.messages) {
      beats.push(t);
      t += Math.min(2.6, 1.1 + m.text.length * 0.035);
    }
  } else {
    for (const step of reel.steps) {
      beats.push(t);
      t += Math.min(4.2, 1.8 + ((step.title ?? '').length + (step.body ?? '').length) * 0.03);
    }
  }
  const outroAt = t + 0.8;
  return { beats, outroAt, duration: outroAt + 2.8 };
}

export function reelHtml(reel) {
  const { beats, outroAt } = reelTimeline(reel);
  let middle;
  if (reel.layout === 'chat') {
    middle = `<div id="chat" style="display:flex;flex-direction:column;gap:18px;margin-top:56px">
      ${reel.messages
        .map((m, i) => {
          const me = m.from === 'me';
          return `<div class="beat" data-i="${i}" style="align-self:${me ? 'flex-end' : 'flex-start'};max-width:84%">
            ${!me && m.name ? `<div style="font-size:28px;color:${C.muted};margin:0 0 8px 10px;font-weight:600">${esc(m.name)}</div>` : ''}
            <div style="font-size:44px;line-height:1.22;padding:22px 32px;border-radius:36px;${
              me
                ? `background:${C.accent};color:#fff;border-bottom-right-radius:12px`
                : `background:${C.raised};color:${C.text};border-bottom-left-radius:12px`
            }">${rich(m.text)}</div></div>`;
        })
        .join('')}</div>`;
  } else {
    middle = `<div style="display:grid;margin-top:70px">
      ${reel.steps
        .map(
          (st, i) => `<div class="beat step" data-i="${i}" style="grid-area:1/1">
            ${st.cards?.length ? `<div class="cards" style="margin-bottom:46px">${st.cards.map((c) => cardHtml(c, 1.05)).join('')}</div>` : ''}
            <div class="title" style="font-size:${st.titleSize ?? 100}px">${rich(st.title ?? '')}</div>
            ${st.body ? `<div class="body" style="font-size:54px;margin-top:40px">${rich(st.body)}</div>` : ''}
          </div>`,
        )
        .join('')}</div>`;
  }
  return `<!doctype html><html><head><meta charset="utf-8"><style>${BASE(RW, RH)}
    .beat{opacity:0;transform:translateY(30px)}
    #outro{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;
      background:radial-gradient(110% 55% at 50% 30%,#3A2477 0%,#1A1033 45%,${C.bg} 80%);opacity:0;padding:0 ${PAD}px}
  </style></head><body><div class="frame">
    <div class="fit" style="position:absolute;left:${PAD}px;right:${PAD}px;top:250px;height:1200px;display:flex;flex-direction:column;justify-content:center">
      ${reel.kicker ? `<div class="kicker" style="font-size:34px">${rich(reel.kicker)}</div>` : ''}
      <div class="title" style="font-size:${reel.titleSize ?? 96}px;margin-top:26px">${rich(reel.title ?? '')}</div>
      ${middle}
    </div>
    <div style="position:absolute;left:${PAD}px;bottom:420px" class="brand"><img src="${SPADE}">STACKD</div>
    <div id="outro">
      <div style="width:200px;height:200px;border-radius:50px;background:#13111B;display:flex;align-items:center;justify-content:center;box-shadow:0 0 0 2px #2b2540"><img src="${SPADE}" style="width:136px"></div>
      <div class="title" style="font-size:88px;margin-top:64px">${rich(reel.outro?.title ?? 'Track it. Train it.')}</div>
      <div class="body" style="font-size:44px;margin-top:34px">${rich(reel.outro?.body ?? 'stackdpoker.app')}</div>
    </div>
  </div>
  <script>
    const beats = ${JSON.stringify(beats)}, outroAt = ${outroAt}, stepMode = ${reel.layout !== 'chat'};
    const ease = (x) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);
    window.setTime = (t) => {
      document.querySelectorAll('.beat').forEach((el) => {
        const i = Number(el.dataset.i), start = beats[i];
        let p = ease((t - start) / 0.35);
        if (stepMode && i < beats.length - 1) p = Math.min(p, 1 - ease((t - beats[i + 1] + 0.25) / 0.25));
        el.style.opacity = p;
        el.style.transform = 'translateY(' + (1 - p) * 30 + 'px)';
      });
      document.getElementById('outro').style.opacity = ease((t - outroAt) / 0.5);
    };
    window.setTime(0);
  </script></body></html>`;
}
