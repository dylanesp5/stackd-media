# stackd-media

Pictures and reels for @stackdpokerapp, and the system that makes them.

- Every **Sunday about 5:30 PM ET** a scheduled Claude run writes next week's 7 posts,
  renders them (`generator/`), puts the files here, and sends Dylan a phone notification.
- Dylan reviews on the **review page** (https://claude.ai/artifact/7USNw5WSHdBsNMBqkzqFoE):
  **Approve** schedules the post in Buffer at its planned time; **Decline** keeps it off;
  **Edit** rewrites the caption on the spot or sends the picture/video back to be redone.
- Every **evening about 8:40 PM ET** (and right away when Dylan taps "Redo picture/video")
  a revision run redoes what was sent back and notifies him again.
- Nothing is ever posted without Dylan's Approve tap.

Files: `ig/<week>/` media (public, Buffer downloads from here), `weeks/<week>/week.json` the
posts as written, `BRAND.md` what may and may not be said, `RUNBOOK.md` the procedure the runs follow.

This repo is public: never put keys, tokens or passwords in it.
