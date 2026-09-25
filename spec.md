# PTCG Image Atlas — spec

A public, static web app that maps the Pokémon TCG card-image ecosystem: who publishes
card images, who copies whom, where TCGdex's images come from, what TCGdex is still
missing and where (if anywhere) those images exist, and whose permission reusing them
would need.

Audience: anyone building or contributing to a card database (TCGdex contributors,
collectors, app developers) who wants to understand the network before scraping or
submitting anything.

## 1. Goals

1. **Provenance network.** Show which sources share the same image files, and how
   confident that link is:
   - *verified*: pixel-identical after registration (tile test, see §6),
   - *stated*: the site itself credits the source,
   - *likely*: strong indirect evidence (identical size/format signature, same crop),
   - *shared, direction unknown*: two sites serve the same file, nobody says who was first.
2. **Three families of images**, visually distinct:
   - **Official digital** (The Pokémon Company and its regional companies; the game
     clients). One colour for every official Pokémon site.
   - **Game-client renders re-published by malie.io**, the de-facto origin of almost
     every clean Western digital image from HGSS (2010) onward.
   - **Scans and photos of physical cards**, marked everywhere as *scan-only*. Split into
     the widely re-used ones (the Pokémon Paradijs English vintage scans) and the ones
     that live on a single community site and have not spread (bisafans German, pkmcards.fr
     French, TCG Collector Japanese vintage, shop scans).
3. **TCGdex view.** Where TCGdex's images (likely) come from today, per language and era,
   and which sources can fill each gap, with the count and the permission needed.
4. **Callouts**, impossible to miss:
   - **Korean**: only a watermarked official image exists; nobody has a clean one.
   - **Simplified Chinese**: only the official WeChat mini-program exists; scraped into
     the `duanxr/PTCG-CHS-Datasets` GitHub repo at 300×419 (low quality), no
     redistribution without Pokémon Shanghai's consent. TCGdex's current `zh-cn` images
     are actually the Traditional Chinese (Taiwan) print.
   - **Better quality exists**: where a larger or cleaner original exists than what
     TCGdex serves (malie 734×1024 vs 600×825, the Singapore English print at 744×1040,
     TCG Collector 1280 px JP scans, bisafans 1200 px German photos).
5. **Every source** has: homepage link, terms link, an example asset link pointing at the
   file where the original lives (click-to-preview, loaded from the origin host), image
   size/format, what it covers, API availability, whether it takes user submissions.
6. Shareable: deployed at a public URL, deep links to a source (`#s=<id>`) and a view.

Non-goals: hosting or mirroring any card image; legal advice; bypassing anything.

## 2. Content model (`data.json`)

```jsonc
{
  "meta":  { "updated": "2026-09-25", "method": "…" },
  "families": { "<id>": { "label", "color", "desc" } },   // official, extract, digital-rehost, aggregator, scan, marketplace, dataset
  "sources": [{
    "id", "name", "url", "family", "tier",               // tier = column in the graph (0 origin … 4 consumer)
    "official": bool, "scanOnly": bool,
    "langs": ["en", …], "eras": "…",
    "imageNature": "digital|scan|photo|mixed",
    "resolution": "734×1024 PNG", "watermark": bool,
    "api": { "kind": "open|partner|paid|none|dump", "url", "note" },
    "submissions": { "yes": bool, "how", "url" },
    "terms": { "summary", "url" },
    "origin": "where its images come from (plain English)",
    "examples": [{ "label", "url", "nature": "digital|scan|photo", "note" }],
    "stats":   [{ "label", "value" }],                    // measured classification shares
    "callout": "korean|zhcn|quality|null"
  }],
  "links": [{
    "from", "to", "kind": "copies|credits|shared|scans",
    "confidence": "verified|stated|likely|unknown-direction",
    "scope": "e.g. en, HGSS → today", "evidence": "…"
  }],
  "gaps": [{ "lang", "missing", "fills": [{ "source", "count", "nature", "permission": "none|maintainer|rights-holder|scanner|impossible", "note" }] }],
  "callouts": [{ "id", "title", "body", "sources": [] }]
}
```

All numbers come from the measurements in the private `pokeassets` research repo
(COVERAGE, SOURCES, LICENSING, `tools/provenance.py` output, 2026-09-23/24). The site
states the date and that they are a snapshot.

## 3. Views

1. **Network** (default). Layered graph, left → right:
   `origin` (physical prints, official DBs, game clients) → `primary` (malie, scanners,
   datasets) → `aggregator` (pokemontcg.io, pkmncards, wikis, fan sites) → `consumer`
   (TCGdex, marketplaces, collection trackers). Node colour = family, official = one
   colour (Pokémon red/gold). Scan-only nodes carry a hatched ring + "SCAN" tag. Edge
   style = confidence (solid verified, long-dash stated, short-dash likely, dotted
   direction unknown). Hover highlights a node's up- and downstream; click opens the
   detail panel. Filters: family, language, "only scans", "show TCGdex lineage".
2. **Source detail panel**: all fields from §2, upstream/downstream lists, example assets
   with a *preview* button (the image is fetched from its origin only on click).
3. **TCGdex gaps**: per language, what's missing, which source fills how many, and a
   permission badge (none needed beyond TPC · ask maintainer · ask rights holder · ask
   the scanner · doesn't exist).
4. **Sources table**: sortable/filterable list with the booleans (official, scan-only,
   API, user submissions, watermark) as columns.
5. **Method**: how provenance was measured (dHash → thumbnail correlation → tile
   registration: re-hosted digital files align ≤ 1 px in every tile, scans drift 1.4–7 px),
   and its limits.

## 4. Visual design

- Dark-first "archive / field guide" look, light theme via `prefers-color-scheme`.
- Official Pokémon sources: one colour (#e3350d red-orange), used nowhere else.
- malie / game extracts: amber; digital re-hosts: blue; scans: violet with hatching;
  marketplaces: teal; datasets: green; TCGdex: white ring highlight.
- Callout cards at the top: Korean (watermark), zh-cn (WeChat only, low res), better
  quality available.
- Responsive: the graph scrolls horizontally on phones; panel becomes a bottom sheet.

## 5. Tech + deployment

- Plain static site: `index.html`, `app.js`, `style.css`, `data.json`. D3 v7 from
  jsDelivr. No build step, no tracking.
- Repo `github.com/nstrelow/ptcg-image-atlas` (public), deployed with **GitHub Pages**
  from `main` / root → `https://nstrelow.github.io/ptcg-image-atlas/`.
- Card images are never copied into the repo; examples are links to the origin host.

## 6. Method summary (shown on the site)

For each image of a mirrored site: 256-bit dHash candidate search against the official
digital images (malie PTCGO + TCG Live, pokemon.com, pokemon-card.com, asia.pokemon-card.com,
pokemoncard.co.kr) and all other mirrored fan sites → 180×252 correlation with crop-inset
search (≥ 0.88) → 20-tile registration at the smaller image's resolution (copy = drift
≤ 1 px and p10 tile correlation ≥ 0.91). Classes: official copy, near-official, fan copy,
same card (different pixels), unmatched, placeholder. Plus EXIF/DPI signals (camera,
scanner, editor, alpha).

Limits: `unmatched` can't prove an image isn't a digital asset from a source we don't
hold; sites behind Cloudflare challenges were only sampled via the Internet Archive or
open CDNs; samples (TCGplayer, Cardmarket, Serebii, PriceCharting, Scrydex, TCG
Collector) are tens to hundreds of images, not full crawls.

## 7. Wording rules

- "Verified" only for pixel matches; otherwise "stated", "likely", or "direction unknown".
- Never say a site "stole" anything. State what matches and what the site's terms say.
- Not legal advice; every card image is © The Pokémon Company / Nintendo / Creatures /
  GAME FREAK (Wizards of the Coast for 1999–2003 English prints).
