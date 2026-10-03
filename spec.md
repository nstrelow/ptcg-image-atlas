# PTCG Image Atlas — spec

*Brought in line with the live site on 2026-10-03 (dashboard overview from 2026-09-26, data updated 2026-10-02).*

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
   - **Korean**: the official site (pokemoncard.co.kr) serves only watermarked images; fan databases link to those;
     PriceCharting has photos of real cards plus some official watermarked images. No clean digital Korean image found.
   - **Simplified Chinese**: the only complete set we found is the official WeChat mini-program's,
     scraped into the `duanxr/PTCG-CHS-Datasets` GitHub repo at 300×419 (low quality), no
     redistribution without Pokémon Shanghai's consent. Larger official renders (pokemon.cn product
     pages) exist for about 15 % of the cards. Sampled TCGdex `zh-cn` images are the Traditional
     Chinese (Taiwan) print.
   - **Better quality exists**: where a larger or cleaner original exists than what
     TCGdex serves (malie 734×1024 vs 600×825, the Singapore English print at 744×1040,
     TCG Collector 1280 px JP scans, bisafans 1200 px German photos, Poképédia, pokemon.cn).
   - **Vintage**: we found no Base Set → Platinum card published as an official digital image
     online; for English, nearly everyone uses the scans by Martin of Pokémon Paradijs, whose work
     much of the vintage picture rests on.
   - **Japanese DP era (2006–2011)**: official images stop at 162 px; shop and community scans
     give 2,233 of 2,336 card ids (96 %) a reference image of ≥ 400 px.
5. **Every source** has: homepage link, terms link (fan and third-party sites only; official
   Pokémon sites' terms are deliberately not shown), an example asset link pointing at the
   file where the original lives (click-to-preview, loaded from the origin host), image
   size/format, what it covers, API availability, whether it takes user submissions.
6. Shareable: deployed at a public URL, deep links to a source (`#s=<id>`) and a view.

Non-goals: hosting or mirroring any card image; legal advice; bypassing anything.

## 2. Content model (`data.json`)

```jsonc
{
  "meta":  { "updated": "2026-10-02", "measured": "2026-09-23 / 2026-09-24", "note", "gapsMeasured",
             "languages": { "<code>": { "flag", "label", "discontinued"? } }, "discontinuedNote" },
  "families": { "<id>": { "label", "desc" } },   // colour = --c-<id> in style.css; ids: official, extract, dataset, rehost, wiki, scan, market, tcgdex, print
  "sources": [{
    "id", "name", "url", "family", "tier",               // tier = lane in the graph (0 origin … 3 consumer)
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
  "gaps": [{ "lang", "name", "missing", "total", "have", "missingCount", "missingNote", "noData",
             "fills": [{ "source", "count", "nature", "permission": "none|maintainer|rights-holder|scanner|impossible", "alt"?, "kind"?, "note" }] }],
  "permissions": { "<permission>": { "label", "desc" } },  // legend for the permission colours
  "stories": [ … ],                                      // "Follow one card": every step's links must exist in links[]
  "callouts": [{ "id", "title", "tag", "kind", "short", "body", "sources": [], "lang", "badge": { "value", "label" } }],   // badge = the glanceable tile; short = its sentence; lang = language "Show in map" switches to
  // gaps[] also carry "issue" + "issueKind" (good|warn|info|muted): the one-line label on the coverage bars
  "compare": { "title", "card", "checked", "note", "steps": [{ "source", "w", "h", "spec", "url"?, "via"?, "same"?, "empty"? }] }   // the drawn-to-scale "one card, three copies" strip
}
```

All numbers come from the measurements in the author's research notes (COVERAGE, SOURCES,
LICENSING, `tools/provenance.py` output). The base snapshot was measured 2026-09-23/24
(`meta.measured`); Western gap counts were re-measured 2026-09-26 (`meta.gapsMeasured`), and later
dated checks (the vintage mirrors, pcg-search, the Japanese DP era) are listed in STATUS.md. The data
was last updated 2026-10-02 (`meta.updated`, shown in the footer as the snapshot date); the site says
the numbers are a snapshot.

## 3. Views

Four tabs: **Overview** (tab id `network`, the default), **TCGdex gaps**, **Sources**, **Method**.

**Header** (sticky): title, an "AI research notes" chip that opens the disclaimer (with a link to
open an issue), the tabs, and a **Guide** button. Under it, on the Overview only, one control bar:
language picker (flags + source counts, discontinued languages apart), "Follow one card" menu (the
`stories`), highlight switch (All / TCGdex's sources / Scans), find a source, copy link.

1. **Overview**, top to bottom:
   - **Number tiles** (each is a shortcut): sources (→ Sources table), links (→ the map), images
     TCGdex lacks for cards it already lists (→ gaps), languages + discontinued (→ language picker).
   - **Finding badges**, one per `callouts[]` entry (`badge.value` + `badge.label`, a flag when the
     finding has a `lang`). Clicking one opens its sentence (`short`), "The whole finding" (`body`)
     and **Show in map** (switches to the finding's language and highlights its `sources`).
   - **Coverage bars**, one per language: TCGdex has / official ready / watermarked / ask the rights
     holder / fan scan / no source found, from the same gap segments as the gaps view; `gaps[].issue`
     + `issueKind` is the one-line label. Clicking a language filters the page and shows a summary.
   - **The map** ("Who copies whom"): four lanes left → right: *Origin* (official sites, game
     clients, printed cards) → *Extract · scan · dataset* (first copy outside the official sites) →
     *Re-host · wiki · fan DB* → *Consumers · marketplaces* (shops, trackers, apps and TCGdex).
     Sources whose languages are all discontinued sit in their own strip. Each box: colour bar = type
     (hatched = scans only), site icon, name, language flags, and icons instead of text tags (scans
     only, plus some scans, photos, watermarked, small images). Line colour = what kind of image
     travels, line style and weight = confidence (thicker = surer). Hover or focus traces upstream
     (blue) and downstream (yellow) with counts; click opens the detail panel. The printed cards'
     links to the scanners stay hidden behind a "scanned by N sites" count until a focus or mode
     shows them. Empty lanes collapse in a language lens. Zoom in/out/Fit, drag to pan; keyboard: one
     tab stop, arrow keys move within and across lanes, Enter opens details.
   - **Language × source grid** ("Which source has which language"): rows = languages, columns =
     sources in lane order; colour = type, mark shape = digital / digital + scans / scans or photos /
     the printed card. Follows the language, highlight and open source; a mark opens the source.
   - **One card, three copies** (`compare`): one card from TCG Live → malie → pokemontcg.io →
     TCGdex, drawn to scale (1/3 on desktop, 1/5 on phones); images load from each site, with a link
     instead when a site doesn't allow embedding.
2. **Source detail panel** (a dialog that takes and returns focus): all fields from §2,
   upstream/downstream lists, example assets with a *preview* button (the image is fetched from its
   origin only on click; the first example loads right away).
3. **TCGdex gaps**: a permission legend, scoreboard tiles, then per language ("Current" and
   "Discontinued" groups) a bar scaled to what is missing (alternatives counted once, upgrades listed
   apart, grey = no source found) and one row per source with its count and permission (none needed
   beyond TPC · ask maintainer · ask rights holder · ask the scanner · doesn't exist).
4. **Sources table**: text filter and toggles (official, has scans/photos, has API/dump, takes
   submissions); sortable columns Source, Type, Official, Images, Size, Watermark, API, Submissions,
   Feeds TCGdex, Links in · out, Languages, Link; sticky header, a row click opens the source.
5. **Method**: how provenance was measured (dHash → thumbnail correlation → tile
   registration: re-hosted digital files align ≤ 1 px in every tile, scans drift 1.4–7 px),
   and its limits.

**First visit** (no hash): a three-step guide (language → coverage bars → map), remembered in
`localStorage`; "Guide" replays it.

**Deep links**: `#v=gaps|sources|method`, `#s=<source id>`, `#l=<language>`, `#m=tcgdex|scans`,
`#f=<family>`, `#st=<story>.<step>`; "Copy link" copies the current hash.

## 4. Visual design

- Dark-first "archive / field guide" look, light theme via `prefers-color-scheme`.
- Official Pokémon sources: one colour (#e3350d red-orange), used nowhere else.
- Game-client extracts (malie): amber; datasets: green; fan databases/APIs: blue; fan wikis: light
  blue; scans: violet, hatched when scans only; marketplaces/trackers: teal; printed cards: grey;
  TCGdex: white (dark in the light theme).
- No callout cards on top: the findings are compact badges next to the number tiles, opened on click.
  The zh-cn finding says the complete set we found is 300 px and that larger official renders
  (pokemon.cn) exist for about 15 % of the cards.
- Flags are Twemoji SVGs (jsDelivr) so they render where emoji fonts are missing.
- Phones (≤ 760 px): number tiles and finding badges 2 × 2; coverage rows become swipeable language
  cards (official source + best fill); the map stays a lane list with "See the full map" (toggles to
  the graph); search and copy link are hidden in the bar; menus open full width; the detail panel
  becomes a bottom sheet.

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
hold; some sites were only sampled via the Internet Archive or
open CDNs; samples (TCGplayer, Cardmarket, Serebii, PriceCharting, Scrydex, TCG
Collector) are tens to hundreds of images, not full crawls.

## 7. Wording rules

- "Verified" only for pixel matches; otherwise "stated", "likely", or "direction unknown".
- Never say a site "stole" anything, and no "uncredited"-style accusations. State what matches.
- Credit people whose work everything rests on (Martin of Pokémon Paradijs, malie, community scanners).
- Prefer "we found" over "nowhere" / "only" / "never".
- Pixel identity to malie shows the render, not the route: TCG Live renders are the same pixels
  whether taken from malie or from the game.
- Not legal advice; every card image is © The Pokémon Company / Nintendo / Creatures /
  GAME FREAK (Wizards of the Coast for 1999–2003 English prints).
