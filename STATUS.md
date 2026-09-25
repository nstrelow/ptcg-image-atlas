# Status — PTCG Image Atlas (2026-09-25)

Live: https://nstrelow.github.io/ptcg-image-atlas/ · repo `nstrelow/ptcg-image-atlas` (public)
· GitHub Pages from `main` / root, no build step (push = deploy, ~1 min).

## What's there

- `index.html` · `style.css` · `app.js` (D3 v7 from jsDelivr) · `data.json` (all content) ·
  `icons/` (each site's favicon/logo, 64 px; `print`, `paradijs`, `pokeca` are drawn
  placeholders) · `spec.md` (goals, data model, wording rules) · `README.md` · `LICENSE` (MIT, code).
- Views: **Network** (4 hand-placed columns, `ORDER` in `app.js`: origin → extract/scan/dataset
  → re-host/wiki → consumers), **TCGdex gaps**, **Sources** table, **Method**.
- Top of page: AI-disclaimer banner ("Research notes, not a reference"), then 4 callouts
  (Korean watermark, zh-cn WeChat 300×419, better quality exists, Western 1999–2010 = scans).
- Deep links: `#v=gaps|sources|method`, `#s=<source id>`.
- 31 sources, ~50 links. Link confidence: verified (pixel match) · stated · likely ·
  unknown-direction. Only pixel matches may be "verified".

## Where the facts come from

The private research repo `/srv/repos/pokeassets` (`LICENSING.md` §5–7, `SOURCES.md`,
`COVERAGE.md`, `tools/provenance.py`, mirrors in `/mnt/landing/pokeassets-mirrors`).
Snapshot 2026-09-23/24, plus these 2026-09-25 checks:
- TCGdex SV01 → me05: pixel-identical to malie's TCG Live renders (can't tell via-malie from
  straight-from-game). 30th Celebration: a different render, online ~5 h before malie's
  export → another source. (3 cards per set sampled.)
- Bulbagarden JP categories: 2,419 pokemon-card.com copies, 316 malie.
- PriceCharting Korean (6 sampled): 5 photos of real cards, 1 official watermarked image.

## Editorial rules (from the owner — keep)

- Credit **Martin of Pokémon Paradijs** by name and warmly; same spirit for malie and the
  community scanners.
- **No terms/conditions shown for official Pokémon sites** (`terms: null` on print, ptcgo,
  tcgl, pcj, asia, pcom, kr, wechat). Fan/third-party terms stay.
- No accusations ("uncredited", "stole", "without permission"). Say what matches.
- "we found" instead of "nowhere / only / never".
- Nothing private in the repo: no local paths, IPs, or how access blocks were handled.
- Git identity in this clone is the GitHub noreply address (global one is `root@pve…` — don't).

## History

- `c230632` initial site · `1eae44c` site icons · `d580e64` claim revision after an
  independent review (Martin credit, official terms removed, newest-set + Korean findings,
  Bulbagarden correction, softened absolutes) · `1c93ee7` AI-disclaimer banner · `a12969c` this file.

## Open / ideas

- Korean terms URL (`pokemonkorea.co.kr/terms`) is no longer shown (official terms removed);
  nothing to fix unless official terms come back.
- The newest-set finding rests on 3 cards; check more 30th cards and the next set when it
  releases (does TCGdex keep beating malie → a TCG Live extraction of its own?).
- PriceCharting Korean: sample of 6 only.
- Samples (TCGplayer, Cardmarket, Serebii, PriceCharting, Scrydex, TCG Collector) could be
  enlarged; the table says they are samples.
- Graph on phones is small; could default to zoomed-in + pan.
- When `pokeassets` numbers change (e.g. Korean 2010–2018 processed, malie importer built),
  update `data.json` gaps.
