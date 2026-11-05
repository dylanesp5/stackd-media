// Builds the review page's rows for one week, ready for ArtifactData "batch" (file_path per row).
//
//   node generator/rows.mjs <week> <assets.json> [postId]
//
// assets.json maps each preview file path (weeks/<week>/.preview/<name>) to the
// URL the Artifact tool returned when that file was uploaded as an asset.
// Writes weeks/<week>/rows/<docId>.json and prints the batch entries to use.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [week, assetsFile, only] = process.argv.slice(2);
const plan = JSON.parse(fs.readFileSync(path.join(root, 'weeks', week, 'week.json'), 'utf8'));
const media = JSON.parse(fs.readFileSync(path.join(root, 'weeks', week, 'media.json'), 'utf8'));
const assets = JSON.parse(fs.readFileSync(path.resolve(assetsFile), 'utf8'));
const asset = (p) => {
  const url = assets[p] ?? assets[path.basename(p)];
  if (!url) throw new Error(`No uploaded asset for ${p}`);
  return url;
};
const outDir = path.join(root, 'weeks', week, 'rows');
fs.mkdirSync(outDir, { recursive: true });
const entries = [];
for (const post of plan.posts) {
  if (only && post.id !== only) continue;
  const m = media[post.id];
  if (!m) throw new Error(`${post.id} has not been rendered`);
  const docId = `${week}-${post.id}`;
  const row = {
    week,
    postId: post.id,
    category: post.category,
    audience: post.audience ?? '',
    format: post.format,
    hook: post.hook ?? '',
    caption: post.caption,
    cta: post.cta ?? '',
    dueAt: post.dueAt,
    version: m.version,
    media: m.files.map((f) => ({ kind: f.kind, url: f.url, alt: f.alt ?? post.coverAlt ?? '' })),
    preview: m.files.map((f) => ({ kind: f.kind, src: asset(f.preview), alt: f.alt ?? post.coverAlt ?? '' })),
    coverSrc: m.cover ? asset(m.cover.preview) : null,
    status: 'pending',
    changeRequest: null,
    declineReason: null,
    bufferPostId: null,
    error: null,
    updatedAt: new Date().toISOString(),
  };
  const file = path.join(outDir, `${docId}.json`);
  fs.writeFileSync(file, JSON.stringify(row, null, 2));
  entries.push({ docId, file });
}
console.log(JSON.stringify(entries, null, 2));
