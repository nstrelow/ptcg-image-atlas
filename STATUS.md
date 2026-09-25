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
- 39 sources, 73 links. Link confidence: verified (pixel match) · stated · likely ·
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
- Graph on phones is small; could default to zoomed-in + pan.
- When the research repo's numbers change (e.g. Korean 2010–2018 processed, malie importer built),
  update `data.json` gaps.

- 2026-09-25 (late): languages are a table in `data.json` `meta.languages` (flag emoji, label,
  `discontinued` for nl/pl/ru). Flags are Twemoji SVGs from jsDelivr (`@twemoji/svg@15.0.0`) under
  every graph node, in the panel header/Languages row, the Sources table and the gap cards. Sources
  whose languages are all discontinued sit in their own dashed strip under the four tiers; the gaps
  view has "Current" and "Discontinued" groups. Add a language by adding it to `meta.languages`.
