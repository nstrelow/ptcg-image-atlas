# Status — PTCG Image Atlas (2026-09-26)

Live: https://nstrelow.github.io/ptcg-image-atlas/ · repo `nstrelow/ptcg-image-atlas` (public)
· GitHub Pages from `main` / root, no build step (push = deploy, ~1 min).

## What's there

- `index.html` · `style.css` · `app.js` (D3 v7 from jsDelivr) · `data.json` (all content) ·
  `icons/` (each site's favicon/logo, 64 px; `print`, `paradijs`, `pokeca` are drawn
  placeholders) · `spec.md` (goals, data model, wording rules) · `README.md` · `LICENSE` (MIT, code).
- Views: **Network** (left → right lanes: origin → extract/scan/dataset → re-host/wiki → consumers;
  every source is a box with a type-coloured bar, icon, name, language flags and tags SCANS/+SCANS/WM/300×419;
  lane membership from `ORDER` in `app.js`, the order inside a lane is re-sorted to cross fewer links),
  **TCGdex gaps**, **Sources** table, **Method**.
- Network controls: a **language lens** (flag buttons with source counts; picking one redraws the graph with
  only that language's sources and shows a summary: official source, what TCGdex misses, best fills),
  a highlight switch (all / where TCGdex's images come from / scans), find-a-source, click a legend type to
  highlight it. Hover or click a box to trace its lineage.
- Top of page: one-line AI-disclaimer banner, then 4 key findings (`short` one-liner from `data.json`
  callouts, full text under Details; "Show in network" switches to the finding's `lang` and highlights its sources).
- Deep links: `#v=gaps|sources|method`, `#s=<source id>`, `#l=<language>` (e.g. `#l=ko`), `#m=tcgdex|scans`,
  `#f=<family>`, `#st=<story>.<step>`; the "Copy link" button copies the current hash.
- 42 sources, 77 links. Link confidence: verified (pixel match) · stated · likely ·
  unknown-direction. Only pixel matches may be "verified".

## Where the facts come from

The author's private research repo (`LICENSING.md` §5–7, `SOURCES.md`, `COVERAGE.md`,
`tools/provenance.py` and its local mirrors).
Snapshot 2026-09-23/24, plus these 2026-09-25 checks:
- TCGdex SV01 → me05: pixel-identical to malie's TCG Live renders (can't tell via-malie from
  straight-from-game). 30th Celebration: a different render, online ~5 h before malie's
  export → another source. (3 cards per set sampled.)
- Bulbagarden JP categories: 2,683 pokemon-card.com copies, 316 malie (2,419 was a stale count, fixed 2026-09-25).
- PriceCharting Korean (6 sampled): 5 photos of real cards, 1 official watermarked image.
- Re-audit against the raw provenance.jsonl (2026-09-25): pokemon.com copies sit on pokemontcg.io
  (97, sv6pt5), pkmcards.fr (868) and bisafans (49), not on TCGdex; TCGdex en 1999–2010 = 94%
  pokemontcg.io's files (ex3/ex6 are 700×980 files of unknown source); fr vintage = 43/96 pkmcards.fr
  + 22 English pokemontcg.io files (POP series); Serebii SwSh/SV = malie 11/12; WeChat renders also on
  TCG Collector (9) and PriceCharting (6); zh-cn starts 2022-10-27. Paradijs edges are `stated`
  (pixel proof is against pokemontcg.io, attribution is pkmncards'); pokemontcgio ↔ tcgdex added.

- 2026-09-25 (evening): sample checks of more sites added 7 sources: pokemon.cn product pages
  (official zh-cn renders ≥ 868 px for highlighted cards), 52poke (collects them), pcg-search.com
  (ja 1996–2006, own scans), Poképédia (fr vintage), PokéWiki (de vintage), Pokellector (tracker;
  terms forbid automated image retrieval), Collector apps (Dex, pkmn.gg, PokemonPrice = malie /
  pokemontcg.io copies). zh-cn callout no longer says "nothing larger". Left out on purpose: Pokéos
  (zh-cn = WeChat 300 px + pokemon.cn downscales at 444 px, nothing new), Hareruya2 (shop stock only),
  carddex.net, cardrush.media, jcc.pokemon.tf, the Internet Archive "Card Scans" pack (pokemontcg.io JPEGs).
- 2026-09-25 (night): old official PC software. Added the Japanese Card Encyclopedia & Deck
  Builder (Master Kit CD-ROM 2005, archive.org `ccdb-2005`: every JP card 1996 → mid-2005,
  official renders but 162×226). It doesn't change the "no official digital image online" finding; the print node and vintage callout
  now mention it. Checked and left out: Wizards' Play It! (2000–01, redrawn game cards, not real card images), PCG Online (2009 Flash demo, two decks), the
  2003/04 Pokémon Card Game CD-ROM and the DPt training kits (tutorials), the PTCGO bundle cache
  (en subset of malie), the official Card Dex app (2016–2023, shut down).

## Editorial rules (from the owner — keep)

- Credit **Martin of Pokémon Paradijs** by name and warmly; same spirit for malie and the
  community scanners.
- **No terms/conditions shown for official Pokémon sites** (`terms: null` on print, ptcgo,
  tcgl, pcj, asia, pcom, kr, wechat). Fan/third-party terms stay.
- No accusations ("uncredited", "stole", "without permission"). Say what matches.
- "we found" instead of "nowhere / only / never".
- Nothing private in the repo: no local paths, IPs, or how access blocks were handled.
- Commit with the GitHub noreply identity (set locally in the clone).

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
- Phones: the graph opens at ≥ 0.52 zoom and pans; a vertical per-language list could replace it on small screens.
- When the research repo's numbers change (e.g. Korean 2010–2018 processed, malie importer built),
  update `data.json` gaps.

- 2026-09-25 (late): languages are a table in `data.json` `meta.languages` (flag emoji, label,
  `discontinued` for nl/pl/ru). Flags are Twemoji SVGs from jsDelivr (`@twemoji/svg@15.0.0`) under
  every graph node, in the panel header/Languages row, the Sources table and the gap cards. Sources
  whose languages are all discontinued sit in their own dashed strip under the four tiers; the gaps
  view has "Current" and "Discontinued" groups. Add a language by adding it to `meta.languages`.

- 2026-09-26: UX pass from an expert review (all 12 items the owner picked), three commits:
  - **Fixes** (`0d2dd56`): gap bars scale to `missingCount` (new numeric gap fields `total`, `have`,
    `missingCount`, `missingNote`, `noData`; fills get `alt` = alternatives counted once and
    `kind: "upgrade"` = listed apart); grey = no source found; permission legend with descriptions;
    SVG type bar renamed `pill-bar` (the gaps `.bar` style was overriding it); `short` names on sources;
    line weight by confidence; finding `tag`s; hover/pin shows upstream (blue) vs downstream (yellow)
    with counts; the panel pans the box out from under itself; sources table sticky header,
    numeric sort, row click, Feeds-TCGdex and links in/out columns.
  - **Opportunities** (`87752d0`): headline + 3-step flow; `stories` in `data.json` (Follow one card,
    5 stories, every step's links must exist in `links`); scoreboard tiles on the gaps view; printed-card
    links hidden behind a "scanned by N sites" count until a focus/mode shows them; fan-outs ≥ 5 leave
    along one trunk; the panel loads its first example image right away.
  - **Reach**: favicon (inline SVG), og/twitter tags + `og.png` (rendered from the graph, no card images;
    re-render when the graph changes a lot), empty lanes collapse in a language lens, phones get a
    lane-by-lane list with a "See the full map" toggle and a one-line disclaimer, keyboard: skip link,
    one tab stop per radio group / graph with arrow keys, panel is a dialog that takes and returns focus.
  - Gap numbers: Western languages measured 2026-09-26 on `cards-database` (TCG only, Pocket excluded);
    ja/zh-tw/th/id/ko/zh-cn from the 2026-09-23 coverage audit.
- 2026-09-26 (later): Paradijs Wayback archive mirrored in full (13,264 files) and compared set by set
  with TCGdex: e-card → Platinum, POP and promos on TCGdex are Martin's original pictures (3,806 files,
  EX Dragon / FireRed & LeafGreen included, which matched nothing before) → `paradijs → tcgdex` is now
  `verified`; Base Set → Neo, EX Ruby & Sapphire, Sandstorm, Hidden Legends on TCGdex are different
  scans (1,231), so Base Set examples no longer say "Paradijs scan". New en gap row: Paradijs 331
  (alternative to pokemontcg.io's kits/holos); nl Paradijs count 228 card scans. Poképédia, PokéWiki and
  PokeZentrum got their listing counts (6,664 / ≈10,700 / 1,158); their full mirrors are running in the
  research repo, results to follow.
