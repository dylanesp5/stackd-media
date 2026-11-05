// Renders one week of posts from weeks/<week>/week.json into ig/<week>/ and
// writes weeks/<week>/media.json (public URLs + alt text for every file).
//
//   node generator/render.mjs 2026-11-09            render every post
//   node generator/render.mjs 2026-11-09 p3         render only post p3 (after an edit)
//
// Every post may carry "version" (default 1); file names include it, so an edited
// post gets new URLs and Instagram never sees a cached old picture.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { SLIDE_LAYOUTS, reelHtml, reelTimeline, slideHtml } from './templates.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RAW = 'https://raw.githubusercontent.com/dylanesp5/stackd-media/main';
const FPS = 30;

const [week, only] = process.argv.slice(2);
if (!/^\d{4}-\d{2}-\d{2}$/.test(week ?? '')) {
  console.error('Usage: node generator/render.mjs <week YYYY-MM-DD> [postId]');
  process.exit(2);
}
const weekFile = path.join(root, 'weeks', week, 'week.json');
const plan = JSON.parse(fs.readFileSync(weekFile, 'utf8'));
const problems = validate(plan);
if (problems.length) {
  console.error('week.json has problems:\n- ' + problems.join('\n- '));
  process.exit(1);
}

const outDir = path.join(root, 'ig', week);
fs.mkdirSync(outDir, { recursive: true });
const mediaFile = path.join(root, 'weeks', week, 'media.json');
const media = fs.existsSync(mediaFile) ? JSON.parse(fs.readFileSync(mediaFile, 'utf8')) : {};

const browser = await chromium.launch();
const failures = [];
for (const post of plan.posts) {
  if (only && post.id !== only) continue;
  const v = post.version ?? 1;
  const base = `${week}-${post.id}-v${v}`;
  try {
    if (post.format === 'reel') {
      const file = `${base}-reel.mp4`;
      const cover = `${base}-cover.png`;
      await renderReel(post.reel, path.join(outDir, file), path.join(outDir, cover));
      media[post.id] = {
        version: v,
        type: 'reel',
        files: [{ kind: 'video', path: `ig/${week}/${file}`, url: `${RAW}/ig/${week}/${file}` }],
        cover: { path: `ig/${week}/${cover}`, url: `${RAW}/ig/${week}/${cover}` },
      };
    } else {
      const files = [];
      for (const [i, slide] of post.slides.entries()) {
        const file = post.slides.length > 1 ? `${base}-${i + 1}.png` : `${base}.png`;
        await renderSlide(slide, i, post.slides.length, path.join(outDir, file));
        files.push({ kind: 'image', path: `ig/${week}/${file}`, url: `${RAW}/ig/${week}/${file}`, alt: slide.alt });
      }
      media[post.id] = { version: v, type: post.slides.length > 1 ? 'carousel' : 'single', files };
    }
    console.log(`ok ${post.id} (${media[post.id].type}, v${v})`);
  } catch (error) {
    failures.push(`${post.id}: ${error.message}`);
    console.error(`FAILED ${post.id}: ${error.message}`);
  }
}
await browser.close();
// Small JPEG copies for the review page (videos are used as they are). Not committed.
const previewDir = path.join(root, 'weeks', week, '.preview');
fs.mkdirSync(previewDir, { recursive: true });
for (const [id, m] of Object.entries(media)) {
  if (only && id !== only) continue;
  for (const f of [...m.files, ...(m.cover ? [m.cover] : [])]) {
    const src = path.join(root, f.path);
    const name = path.basename(f.path);
    if (f.kind === 'video') {
      fs.copyFileSync(src, path.join(previewDir, name));
      f.preview = `weeks/${week}/.preview/${name}`;
    } else {
      const jpg = name.replace(/\.png$/, '.jpg');
      execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', src, '-vf', 'scale=720:-1', '-q:v', '4', path.join(previewDir, jpg)]);
      f.preview = `weeks/${week}/.preview/${jpg}`;
    }
  }
}
fs.writeFileSync(mediaFile, JSON.stringify(media, null, 2) + '\n');
if (failures.length) process.exit(1);

// ---------------------------------------------------------------------------

async function renderSlide(slide, index, total, file) {
  const page = await browser.newPage({ viewport: { width: 1080, height: 1350 } });
  await page.setContent(slideHtml(slide, index, total), { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  // Shrink the content a little at a time until nothing runs off the bottom.
  let overflow = [];
  for (const zoom of [1, 0.94, 0.88, 0.82, 0.76]) {
    overflow = await page.evaluate((z) => {
      const fit = document.querySelector('.fit');
      if (fit) fit.style.zoom = z;
      const limit = 1350 - 140;
      const bad = [];
      for (const el of document.querySelectorAll('.frame *')) {
        if (el.closest('[data-footer]') || el.children.length || !el.textContent.trim()) continue;
        const r = el.getBoundingClientRect();
        if (r.width && (r.bottom > limit || r.right > 1080 - 40)) bad.push(el.textContent.trim().slice(0, 40));
      }
      return bad;
    }, zoom);
    if (!overflow.length || slide.layout === 'cta') break;
  }
  if (overflow.length && slide.layout !== 'cta') {
    await page.close();
    throw new Error(`slide ${index + 1} (${slide.layout}) is too full; text runs off the bottom: "${overflow[0]}". Shorten it.`);
  }
  await page.screenshot({ path: file });
  await page.close();
}

async function renderReel(reel, file, coverFile) {
  const { duration, beats } = reelTimeline(reel);
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  await page.setContent(reelHtml(reel), { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  // Everything must be readable above Instagram's caption area at the moment the last line is in.
  // Shrink the content a little at a time until it all sits above Instagram's caption area.
  let tooLow = 0;
  for (const zoom of [1, 0.94, 0.88, 0.82, 0.76]) {
    tooLow = await page.evaluate(
      ([z, times]) => {
        document.querySelector('.fit').style.zoom = z;
        let max = 0;
        for (const t of times) {
          window.setTime(t);
          for (const el of document.querySelectorAll('.beat')) {
            if (Number(el.style.opacity) > 0.5) max = Math.max(max, el.getBoundingClientRect().bottom);
          }
        }
        return max > 1920 - 470 ? Math.round(max) : 0;
      },
      [zoom, beats.map((b) => b + 0.5)],
    );
    if (!tooLow) break;
  }
  if (tooLow) {
    await page.close();
    throw new Error(`reel content reaches ${tooLow}px, into Instagram's caption area. Use fewer or shorter lines.`);
  }
  // The cover is the moment everything is on screen (chat) or the title (steps).
  await page.evaluate((t) => window.setTime(t), reel.layout === 'chat' ? beats[beats.length - 1] + 0.6 : 0.2);
  await page.screenshot({ path: coverFile });
  const frames = fs.mkdtempSync(path.join(path.dirname(file), '.frames-'));
  const total = Math.ceil(duration * FPS);
  let last = null;
  for (let f = 0; f < total; f += 1) {
    const state = await page.evaluate((t) => {
      window.setTime(t);
      return [...document.querySelectorAll('.beat,#outro')].map((el) => el.style.opacity + el.style.transform).join('|');
    }, f / FPS);
    const out = path.join(frames, `${String(f).padStart(5, '0')}.png`);
    if (state === last?.state) fs.copyFileSync(last.file, out);
    else {
      await page.screenshot({ path: out });
      last = { state, file: out };
    }
  }
  await page.close();
  // Silent audio track: some apps refuse a video with no audio at all.
  execFileSync('ffmpeg', [
    '-v', 'error', '-y', '-framerate', String(FPS), '-i', path.join(frames, '%05d.png'),
    '-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100',
    '-shortest', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '64k', '-movflags', '+faststart', file,
  ]);
  fs.rmSync(frames, { recursive: true, force: true });
}

function validate(p) {
  const out = [];
  if (!Array.isArray(p.posts) || p.posts.length === 0) return ['no posts'];
  const ids = new Set();
  for (const post of p.posts) {
    const where = post.id ?? '(no id)';
    if (!post.id || ids.has(post.id)) out.push(`${where}: missing or repeated id`);
    ids.add(post.id);
    for (const key of ['category', 'caption', 'dueAt', 'format']) if (!post[key]) out.push(`${where}: missing ${key}`);
    if (post.dueAt && !/[+-]\d\d:\d\d$/.test(post.dueAt)) out.push(`${where}: dueAt needs a UTC offset, e.g. -05:00`);
    if ((post.caption ?? '').length > 2100) out.push(`${where}: caption over 2,100 characters`);
    const tags = post.caption?.match(/#\w+/g) ?? [];
    if (tags.length > 5) out.push(`${where}: ${tags.length} hashtags (max 5)`);
    if (post.format === 'reel') {
      const r = post.reel;
      if (!r || !['chat', 'steps'].includes(r.layout)) out.push(`${where}: reel.layout must be chat or steps`);
      else if (r.layout === 'chat' && !(r.messages?.length >= 2 && r.messages.length <= 8)) out.push(`${where}: chat reel needs 2-8 messages`);
      else if (r.layout === 'steps' && !(r.steps?.length >= 2 && r.steps.length <= 6)) out.push(`${where}: steps reel needs 2-6 steps`);
      if (!post.coverAlt) out.push(`${where}: missing coverAlt`);
    } else {
      if (!Array.isArray(post.slides) || post.slides.length < 1 || post.slides.length > 10) out.push(`${where}: 1-10 slides`);
      for (const [i, s] of (post.slides ?? []).entries()) {
        if (!SLIDE_LAYOUTS.includes(s.layout)) out.push(`${where} slide ${i + 1}: layout must be one of ${SLIDE_LAYOUTS.join(', ')}`);
        if (!s.alt || s.alt.length < 15) out.push(`${where} slide ${i + 1}: needs its own alt text`);
      }
      const alts = (post.slides ?? []).map((s) => s.alt);
      if (new Set(alts).size !== alts.length) out.push(`${where}: every slide needs different alt text`);
    }
  }
  return out;
}
