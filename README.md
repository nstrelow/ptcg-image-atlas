# PTCG Image Atlas

**Live:** https://nstrelow.github.io/ptcg-image-atlas/

This was checked several times with Claude (an AI), but not verified by hand — treat what's written here as a lead, not as fact.

An interactive map of where Pokémon TCG card images come from: which official sites
publish them, who re-hosts or scans them, who copies whom (pixel-verified where
possible), where TCGdex's images come from, what TCGdex is still missing, and where
those images exist and whose permission reusing them would need.

- **Network**: sources in four columns (origin → extract/scan → re-host → consumer),
  links styled by confidence (verified pixel match · stated · likely · direction unknown).
- **TCGdex gaps**: per language, which source fills how many cards and what permission
  that needs.
- **Sources**: filterable table (official, scans only, API, user submissions, watermark).
- **Method**: how provenance was measured (dHash → correlation → tile registration).

All content lives in [`data.json`](data.json); the spec is in [`spec.md`](spec.md).
The site hosts **no card images**. Example assets are links to their origin and load only
when you click *preview*.

Every card image is © The Pokémon Company / Nintendo / Creatures / GAME FREAK (Wizards of
the Coast for 1999–2003 English prints). This is not legal advice. Snapshot: September 2026.
Corrections are welcome as issues or pull requests.

The site icons in `icons/` are each site's own favicon or logo (trademarks of their owners),
used only to identify the site. `print`, `paradijs` and `pokeca` are simple drawn placeholders
(no favicon available).

Code: MIT.
