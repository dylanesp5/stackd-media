# Stackd Instagram: how the automated runs work

Read `BRAND.md` before writing anything. It lists what Stackd really does and what must
never be claimed. This file is the procedure.

**Hard rule: these runs never publish or schedule anything on Instagram or Buffer.**
Posts reach Buffer only when Dylan taps Approve on the review page, which schedules
the post with his own Buffer login. Do not call Buffer `create_post`, `edit_post` or
`delete_post` from a run.

| Thing | Where |
| --- | --- |
| Review page (Dylan's phone) | https://claude.ai/artifact/7USNw5WSHdBsNMBqkzqFoE |
| Its database | `ArtifactData` on that URL: `posts/<week>-<postId>`, `reports/<week>`, `config/main` |
| Media repo (public, Buffer reads files from it) | github.com/dylanesp5/stackd-media, raw URL `https://raw.githubusercontent.com/dylanesp5/stackd-media/main/...` |
| Buffer | organization 6aecd344dc988902a9da6a44, Instagram channel @stackdpokerapp 6aecd416e29c69a1717465c0 |
| Generator | `generator/render.mjs` (pictures and reels), `generator/rows.mjs` (review rows) |

## Setup at the start of every run

1. Attach and clone the repo: `add_repo` dylanesp5/stackd-media with push access, then
   `git clone https://github.com/dylanesp5/stackd-media /home/claude/stackd-media`.
   Work inside that folder.
2. Read `BRAND.md`.

## Weekly run (Sunday evening)

The week is the coming Monday to Sunday, named by the Monday's date (YYYY-MM-DD, Eastern time).

1. **Already done?** `ArtifactData` query `posts` where `week == <week>`. If any rows exist,
   stop: report "This week's posts already exist" and do nothing else (no duplicates).
2. **Last week's results.** With Buffer: `list_posts` (status `sent`, last 7 days, `includeMetrics: true`)
   and `get_aggregated_post_metrics` for the same range. Write 4 to 8 short lines: posts
   published, then reach/impressions, engagement, profile visits and link clicks *only where
   Buffer returns them*. Write "not available" for anything Buffer doesn't report; never write 0
   for a missing number. Name the best and worst post and one concrete idea for this week.
   Save it: `ArtifactData set reports/<week>` `{ "text": "...", "createdAt": "<now>" }`.
3. **Learn from Dylan's feedback.** `ArtifactData list posts` and read every declined post's
   `declineReason`, every `changeRequest` in `log`, and `captionHistory` (his edited captions
   are the voice he wants). Also read the last 4 `weeks/*/week.json` so topics and hooks don't repeat.
4. **Write `weeks/<week>/week.json`** with exactly 7 posts (copy the shape of
   `weeks/2026-11-09/week.json`):
   - 2 education (one carousel, one `steps` reel works well)
   - 2 memes / relatable (a `chat` reel and a single image work well)
   - 1 Stackd feature showcase using real screenshots (`screenshot` slides; names are the files
     in `generator/assets/screenshots`: home, bankroll, trainer, why, rating, exploit, replay,
     share, friends)
   - 1 bankroll or mental-game post
   - 1 community question (`question` layout)
   Every post: `id` p1..p7 in date order, `category`, `audience`, `format` (carousel | single |
   reel), `dueAt` (Eastern time with offset, e.g. `2026-11-16T19:00:00-05:00`; weekdays 6:30 to 8 PM,
   weekends around noon; one post per day), `hook`, `caption` (the hook first, 3 to 5 hashtags at
   the end, a call to action), `cta`, then `slides` (each with its own `alt` text) or `reel` plus
   `coverAlt`. Slide layouts: cover, list, statement, screenshot (optional `crop`: top | bottom |
   center), compare, question, cta. Reel layouts: `chat` (2 to 8 messages) or `steps` (2 to 6 steps).
   Text in `*stars*` shows in the brand violet. Poker content must be correct; when in doubt,
   say "a common starting point" rather than stating a rule.
   Until BRAND.md says the app is live, calls to action say it is coming soon to the App Store
   and point to stackdpoker.app / link in bio. Never say "download now" or "join the beta".
5. **Render:** `node generator/render.mjs <week>`. It refuses posts whose text runs off the
   picture or into Instagram's caption area: shorten that text and run it again.
6. **Look at every picture** (Read each PNG in `ig/<week>/`, and the cover PNG of each reel).
   Fix anything ugly, cut off, wrong or off-brand, then render again.
7. **Publish the media:** `git add ig/<week> weeks/<week>/week.json weeks/<week>/media.json`,
   commit "Posts for week of <week>", `git fetch origin main && git rebase origin/main`, push.
   If the push fails, stop and report it (the review rows must not point to files that aren't online).
8. **Upload the previews** in `weeks/<week>/.preview/` to the review page as assets:
   `Artifact` publish with `url` = the review page, `asset: true`, `file_paths` = every file in that
   folder (up to 25 per call). Save a JSON file mapping each file name to the `/_blob/...` url the
   result gives, e.g. `/tmp/assets.json`.
9. **Create the review rows:** `node generator/rows.mjs <week> /tmp/assets.json` writes
   `weeks/<week>/rows/<docId>.json`. Then `ArtifactData batch` with one `set` per row:
   `{op: "set", collection: "posts", doc_id: <docId>, file_path: <file>}` (new documents, no if_version).
10. **Finish** with a short message, which is the phone notification Dylan sees:
    "7 Stackd posts for the week of <Mon date> are ready to review: <review page URL>",
    plus one line from the results report. If anything failed, say exactly what and what still
    needs doing instead.

## Revision run (evenings, and on demand when Dylan taps "Redo picture/video")

1. `ArtifactData query posts` where `status == "changes"`. If none: finish with
   "Nothing to redo." and stop.
2. For each such post (doc id `<week>-<postId>`):
   - Read its `changeRequest`. Open `weeks/<week>/week.json`, change that post as asked
     (layout, wording, cards, screenshot, caption if asked), and add 1 to its `version`
     (start from the row's `version`).
   - Also copy the row's current `caption` into week.json first: Dylan may have edited it on the page.
   - `node generator/render.mjs <week> <postId>`, look at the new pictures, commit
     "Redo <week> <postId> v<version>", push.
   - Upload that post's new preview files (`weeks/<week>/.preview/<week>-<postId>-v<version>*`) as
     assets, write a mapping file, run `node generator/rows.mjs <week> <mapping> <postId>`.
   - `ArtifactData update posts/<docId>` with `if_version` = the version you read, sending from the
     new row file: `caption`, `version`, `media`, `preview`, `coverSrc`, plus `status: "pending"`,
     `changeRequest: null`, `updatedAt`, and `log` = the old log plus
     `{at, action: "redone", note: "<what you changed>"}`.
3. Finish with: "Redone: <post> (<one line on what changed>). Ready to review: <review page URL>".

## Housekeeping

- The review page's asset storage is limited. Once a week, if the page has assets from weeks
  more than 3 weeks old whose posts are all scheduled, declined or past, delete those assets
  (`Artifact` list `scope: "assets"`, then delete by id). Never delete the current or next week's.
- Never put tokens, passwords or keys in this repo: it is public.
