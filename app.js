(async function () {
  const D = await fetch('data.json').then(r => r.json());
  const byId = Object.fromEntries(D.sources.map(s => [s.id, s]));
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const famColor = f => css('--c-' + f);
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const hostOf = u => { try { return new URL(u).host.replace(/^www\./, ''); } catch { return u; } };
  const fmt = n => n.toLocaleString('en-US');
  document.getElementById('updated').textContent = D.meta.updated;
  const LANG = D.meta.languages || {};
  const langInfo = l => LANG[l] || LANG[l.split(' ')[0]] || LANG[l.split('-')[0]] || { flag: '🏳', label: l };
  const isDiscontinued = l => !!langInfo(l).discontinued;
  // Flags are Twemoji SVGs (emoji fonts are missing on Windows and in headless browsers).
  const TW = 'https://cdn.jsdelivr.net/npm/@twemoji/svg@15.0.0/';
  const flagUrl = l => TW + [...langInfo(l).flag].map(c => c.codePointAt(0).toString(16)).join('-') + '.svg';
  const flagImg = (l, cls = 'flag') => `<img class="${cls}" src="${flagUrl(l)}" alt="${esc(langInfo(l).label)}" title="${esc(langInfo(l).label)}" loading="lazy">`;
  const uniqFlags = langs => [...new Map(langs.map(l => [langInfo(l).flag, l])).values()];
  const flagsOf = (langs, cls) => uniqFlags(langs).map(l => flagImg(l, cls)).join('');
  const langsHtml = langs => langs.map(l => `<span data-l="${esc(l)}" class="lang${isDiscontinued(l) ? ' disc' : ''}" title="${esc(langInfo(l).label)}${isDiscontinued(l) ? ' — discontinued ' + esc(langInfo(l).discontinued) : ''}">${flagImg(l)} ${esc(l)}</span>`).join(' ');
  // a source belongs to the discontinued section when every language it serves is a discontinued one
  const discontinuedSource = s => s.langs.length > 0 && s.langs.every(isDiscontinued);

  /* ---------- at a glance: numbers + findings as badges ---------- */
  // "current languages TCGdex has card data for": leaves out no-card-data languages and zh-cn (card files from our branch)
  const missCur = d3.sum(D.gaps.filter(g => !g.noData && !isDiscontinued(g.lang) && g.lang !== 'zh-cn'), g => g.missingCount);
  const nCurLang = Object.keys(LANG).filter(l => ['en', 'ja', 'fr', 'de', 'it', 'es', 'pt', 'ko', 'zh-tw', 'zh-cn', 'th', 'id'].includes(l)).length;
  const nDiscLang = Object.keys(LANG).filter(isDiscontinued).length;
  document.getElementById('kpis').innerHTML = [
    ['sources', D.sources.length, 'sources of card images', 'See them all in the Sources table'],
    ['links', D.links.length, 'links between them', 'Jump to the map'],
    ['missing', fmt(missCur), 'images TCGdex lacks for cards it already lists', 'What is missing, per language'],
    ['langs', `${nCurLang}<small> +${nDiscLang}</small>`, 'languages (+ discontinued)', 'Pick a language']
  ].map(([k, v, l, t]) => `<button class="kpi${k === 'missing' ? ' hot' : ''}" data-kpi="${k}" title="${t}"><span class="v">${v}</span><span class="l">${l}</span></button>`).join('');
  document.querySelectorAll('[data-kpi]').forEach(b => b.addEventListener('click', () => {
    const k = b.dataset.kpi;
    if (k === 'sources') { showView('sources'); scrollToTop(); }
    else if (k === 'missing') { showView('gaps'); scrollToTop(); }
    else if (k === 'links') document.getElementById('map').scrollIntoView({ behavior: 'smooth', block: 'start' });
    else document.getElementById('lang-btn').click();
  }));
  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  const KIND = { warn: 'warn', good: 'good', info: 'info' };
  function renderFindings() {
    const box = document.getElementById('callouts'), open = D.callouts.find(c => c.id === state.finding);
    box.innerHTML = D.callouts.map(c => `<button class="fb k-${KIND[c.kind] || 'info'}" id="finding-${c.id}" data-f="${c.id}" aria-expanded="${c.id === state.finding}" aria-controls="fdetail">
        <span class="v">${c.lang ? flagImg(c.lang) : ''}${esc(c.badge ? c.badge.value : c.tag)}</span>
        <span class="l">${esc(c.badge ? c.badge.label : c.title)}</span><span class="more" aria-hidden="true">${c.id === state.finding ? '−' : '+'}</span></button>`).join('') +
      (open ? `<div class="fdetail k-${KIND[open.kind] || 'info'}" id="fdetail"><div class="ft"><h3>${esc(open.title)}</h3><p>${esc(open.short || open.body)}</p>
        <details><summary>The whole finding</summary><p>${esc(open.body)}</p></details></div>
        <button class="btn-go" data-callout="${open.id}">Show in map →</button></div>` : '');
    box.querySelector('.btn-go')?.addEventListener('click', () => showFinding(open));
  }
  function showFinding(c) {
    showView('network'); stopStory(true); closePanel(true);
    setLang(c.lang || '');
    state.set = { ids: new Set(c.sources), title: c.title };
    highlight();
    document.getElementById('map').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function openFinding(id) {
    state.finding = id; renderFindings();
    document.getElementById('callouts').scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  document.getElementById('callouts').addEventListener('click', e => {
    const b = e.target.closest('[data-f]'); if (!b) return;
    state.finding = state.finding === b.dataset.f ? null : b.dataset.f;
    renderFindings();
    document.getElementById('finding-' + b.dataset.f)?.focus();
  });

  /* ---------- header: AI note, sticky height ---------- */
  document.getElementById('ai-chip').addEventListener('click', e => {
    const pop = document.getElementById('ai-pop'); pop.hidden = !pop.hidden;
    e.currentTarget.setAttribute('aria-expanded', String(!pop.hidden));
  });
  // sections scroll to just below the sticky header
  const sticky = document.getElementById('sticky');
  new ResizeObserver(() => document.documentElement.style.setProperty('--sticky-h', sticky.offsetHeight + 'px')).observe(sticky);

  /* ---------- tabs + routing ---------- */
  const tabs = document.querySelectorAll('.tabs button');
  function setHash(k, v) {
    const h = new URLSearchParams(location.hash.slice(1));
    v ? h.set(k, v) : h.delete(k);
    history.replaceState(null, '', '#' + h.toString());
  }
  function showView(v) {
    tabs.forEach(b => b.setAttribute('aria-selected', b.dataset.view === v));
    document.querySelectorAll('.view').forEach(s => { s.hidden = s.id !== 'view-' + v; });
    document.getElementById('ctl').hidden = v !== 'network';
    if (v === 'network') requestAnimationFrame(() => fitGraph(false));
    setHash('v', v);
  }
  tabs.forEach(b => b.addEventListener('click', () => showView(b.dataset.view)));

  /* ---------- network ----------
     Left → right flow: four lanes (origin → consumers). Every source is a box: coloured bar =
     type, icon, name, its languages as flags, and tags (SCANS, WM …). Links leave a box on the
     right and enter the next one on the left; the order inside each lane is tuned to cross less. */

  const PW = 250, PH = 46, CG = 120, RG = 14, NCOL = 4;
  // lanes with nothing in them (in a language lens) collapse: slot[t] is the lane's column, null if hidden
  let slot = [0, 1, 2, 3], GW = 3 * (PW + CG) + PW;
  const colX = t => slot[t] * (PW + CG);
  const TIERS = [
    ['Origin', 'official sites, game clients, printed cards'],
    ['Extract · scan · dataset', 'first copy outside the official sites'],
    ['Re-host · wiki · fan DB', 'databases and wikis re-using those files'],
    ['Consumers · marketplaces', 'shops, trackers, apps — and TCGdex']
  ];
  const nodes = D.sources.map(s => ({ ...s }));
  const nById = Object.fromEntries(nodes.map(n => [n.id, n]));
  const links = D.links.map(l => ({ ...l, source: nById[l.from], target: nById[l.to] }));
  // Starting order inside each lane (scans on top, malie / digital in the middle, Asia at the bottom);
  // layout() then reorders to reduce crossings.
  const ORDER = [
    { print: .02, ccdb: .14, ptcgo: .28, tcgl: .39, pcom: .48, pcj: .57, asia: .67, kr: .77, wechat: .87, pokemoncn: .98 },
    { bisafans: .02, pokezentrum: .10, pokecardex: .19, yuyutei: .28, pcgsearch: .38, paradijs: .50, malie: .64, pokeca: .80, duanxr: .98 },
    { pkmncards: .03, pokemontcgio: .11, pkmcardsfr: .19, pokepedia: .27, pokewiki: .35, pokemoncentral: .43, wikidex: .51, wiki52poke: .59, bulbagarden: .67, limitless: .75, krfan: .86, mikmoe: .98 },
    { pricecharting: .03, scrydex: .14, apps: .25, tcgplayer: .36, cardmarket: .46, tcgdex: .57, tcgcollector: .66, pokedata: .74, pokellector: .82, serebii: .92 }
  ];
  ORDER.forEach((col, t) => Object.entries(col).forEach(([id, f]) => { const n = nById[id]; if (n) { n.tier = t; n.f = f; } }));
  nodes.forEach(n => { n.disc = discontinuedSource(n); if (n.tier == null) { n.tier = 1; n.f = 1; } });

  // language lens
  const LENS = ['en', 'ja', 'fr', 'de', 'it', 'es', 'pt', 'ko', 'zh-tw', 'zh-cn', 'th', 'id'].filter(l => LANG[l]);
  const LENS_DISC = Object.keys(LANG).filter(isDiscontinued);
  const serves = (n, lang) => !lang || n.langs.some(l => l === 'all' || l === lang || l.startsWith(lang + '-') || l.startsWith(lang + ' ') || (l === 'zh' && lang.startsWith('zh')));
  const lensKey = l => [...LENS, ...LENS_DISC].find(k => l === k || l.startsWith(k + '-') || l.startsWith(k + ' '));
  const langCount = lang => nodes.filter(n => n.id !== 'print' && serves(n, lang)).length;

  const css2 = n => css(n) || '#888';
  const EDGE = {
    official: { color: () => famColor('official'), label: 'official image' },
    extract: { color: () => famColor('extract'), label: 'game-client render' },
    scan: { color: () => famColor('scan'), label: 'scanned / photographed from print' },
    copy: { color: () => famColor('rehost'), label: 'copied from a fan site' },

    shared: { color: () => css2('--muted'), label: 'same files, direction unknown' }
  };
  const edgeKind = l => l.kind === 'scans' ? 'scan' : l.kind === 'shared' ? 'shared' : l.source.family === 'official' ? 'official' : l.source.family === 'extract' ? 'extract' : 'copy';

  // thicker = surer; dashes repeat it for colour-blind readers
  const CONF = {
    'verified': { dash: null, w: 2.4, label: 'verified (pixel match)' },
    'stated': { dash: '9 5', w: 1.6, label: 'stated by the site' },
    'likely': { dash: '3 4', w: 1.2, label: 'likely (indirect evidence)' },
    'unknown-direction': { dash: '1 5', w: 1.2, label: 'same files, direction unknown' }
  };

  function layout(vis) {
    const visSet = new Set(vis);
    const vl = links.filter(l => visSet.has(l.source) && visSet.has(l.target));
    const main = vis.filter(n => !n.disc), disc = vis.filter(n => n.disc);
    let cols = d3.range(NCOL).map(t => main.filter(n => n.tier === t).sort((a, b) => a.f - b.f));
    const pos = new Map();
    const setPos = cs => cs.forEach(c => c.forEach((n, i) => pos.set(n, c.length > 1 ? i / (c.length - 1) : .5)));
    const nb = new Map(main.map(n => [n, []]));
    vl.forEach(l => { if (nb.has(l.source) && nb.has(l.target) && l.source.tier !== l.target.tier) { nb.get(l.source).push(l.target); nb.get(l.target).push(l.source); } });
    const cross = () => {
      const seg = vl.filter(l => pos.has(l.source) && pos.has(l.target) && l.source.tier !== l.target.tier);
      let c = 0;
      for (let i = 0; i < seg.length; i++) for (let j = i + 1; j < seg.length; j++) {
        const a = seg[i], b = seg[j];
        if (a.source.tier === b.source.tier && a.target.tier === b.target.tier &&
          (pos.get(a.source) - pos.get(b.source)) * (pos.get(a.target) - pos.get(b.target)) < 0) c++;
      }
      return c;
    };
    setPos(cols);
    let best = cols.map(c => c.slice()), bestC = cross();
    for (let it = 0; it < 16; it++) {
      const seq = it % 2 ? [3, 2, 1, 0] : [0, 1, 2, 3];
      seq.forEach(t => {
        const key = new Map(cols[t].map(n => {
          const ns = nb.get(n);
          return [n, ns.length ? d3.mean(ns, m => pos.get(m)) : pos.get(n)];
        }));
        cols[t].sort((a, b) => key.get(a) - key.get(b) || pos.get(a) - pos.get(b));
        setPos([cols[t]]);
      });
      const c = cross();
      if (c < bestC) { bestC = c; best = cols.map(x => x.slice()); }
    }
    cols = best; setPos(cols);
    let k = 0;
    slot = cols.map(c => c.length || !state.lang ? k++ : null);
    GW = Math.max(k - 1, 0) * (PW + CG) + PW;
    const maxN = d3.max(cols, c => c.length) || 1;
    const H = maxN * (PH + RG);
    cols.forEach((c, t) => {
      const step = Math.min(H / c.length, (PH + RG) * 1.7), off = (H - step * c.length) / 2;
      c.forEach((n, i) => { n.x = colX(t); n.y = off + step * (i + .5); });
    });
    let HT = H, strip = null;
    if (disc.length) {
      strip = { y: H + 44, h: PH + 84 };
      disc.forEach((n, i) => { n.x = Math.min(1 + i, Math.max(k - 1, 0)) * (PW + CG); n.y = strip.y + 56 + PH / 2; });
      HT = strip.y + strip.h;
    }
    // ports: spread a box's links along its edge, ordered by where the other end sits.
    // A box with a big fan-out (malie, pokemon-card.com …) sends them along one trunk instead.
    vis.forEach(n => {
      const outs = vl.filter(l => l.source === n).sort((a, b) => a.target.y - b.target.y);
      const ins = vl.filter(l => l.target === n).sort((a, b) => a.source.y - b.source.y);
      const spread = (arr, set) => arr.forEach((l, i) => set(l, arr.length > 1 ? (i / (arr.length - 1) - .5) * (PH - 14) : 0));
      spread(outs, (l, o) => { l.so = o; });
      spread(ins, (l, o) => { l.ti = o; });
      const right = outs.filter(l => l.target.x > n.x);
      outs.forEach(l => { l.trunk = false; });
      if (right.length >= 5) right.forEach(l => { l.so = 0; l.trunk = true; });
    });
    return { vis, vl, H, HT, strip, cols };
  }

  function linkPath(l) {
    const s = l.source, t = l.target, sy = s.y + l.so, ty = t.y + l.ti;
    const x1 = s.x + PW;
    if (l.trunk) {
      const jx = x1 + CG * .4, x2 = t.x - 7, dx = Math.max(30, (x2 - jx) * .5);
      return `M${x1},${sy} L${jx},${sy} C${jx + dx},${sy} ${x2 - dx},${ty} ${x2},${ty}`;
    }
    if (t.x > s.x) {
      const x2 = t.x - 7, dx = Math.max(40, (x2 - x1) * .5);
      return `M${x1},${sy} C${x1 + dx},${sy} ${x2 - dx},${ty} ${x2},${ty}`;
    }
    const x2 = t.x + PW + 7, off = 34 + Math.abs(ty - sy) * .12;   // same lane: loop out to the right
    return `M${x1},${sy} C${x1 + off},${sy} ${x2 + off},${ty} ${x2},${ty}`;
  }

  const svg = d3.select('#graph');
  const defs = svg.append('defs');
  const pat = defs.append('pattern').attr('id', 'hatch').attr('patternUnits', 'userSpaceOnUse').attr('width', 6).attr('height', 6).attr('patternTransform', 'rotate(45)');
  pat.append('rect').attr('width', 6).attr('height', 6).attr('fill', famColor('scan'));
  pat.append('line').attr('x1', 0).attr('y1', 0).attr('x2', 0).attr('y2', 6).attr('stroke', 'rgba(0,0,0,.45)').attr('stroke-width', 3);
  defs.append('clipPath').attr('id', 'pill-clip').append('rect').attr('width', PW).attr('height', PH).attr('rx', 10);
  const markerFor = new Map();
  function marker(color) {
    if (markerFor.has(color)) return markerFor.get(color);
    const id = 'm' + markerFor.size;
    defs.append('marker').attr('id', id).attr('viewBox', '0 -5 10 10').attr('refX', 8).attr('refY', 0)
      .attr('markerWidth', 6).attr('markerHeight', 6).attr('orient', 'auto')
      .append('path').attr('d', 'M0,-4L10,0L0,4').attr('fill', color);
    markerFor.set(color, id); return id;
  }
  const g = svg.append('g');
  const gLanes = g.append('g'), gStrip = g.append('g').attr('class', 'strip'), gLinks = g.append('g'), gNodes = g.append('g');
  const zoom = d3.zoom().scaleExtent([0.25, 3]).on('zoom', e => g.attr('transform', e.transform));
  svg.call(zoom).on('dblclick.zoom', null);
  svg.on('click', e => { if (!e.target.closest('.node')) { state.set = null; closePanel(); } });


  function shortName(n) {
    return n.short || n.name.replace(/ \(.*\)$/, '').replace(' card database', '').replace(' (game client)', '');
  }
  // badges on a box: [icon symbol, colour class, words for screen readers and tooltips]
  const TAG = {
    scan: ['i-scan', 'ic-scan', 'scans or photos only'], photo: ['i-photo', 'ic-photo', 'photos of real cards'],
    plusscan: ['i-plusscan', 'ic-scan', 'digital, plus some scans'], wm: ['i-wm', 'ic-warn', 'watermarked'],
    small: ['i-small', 'ic-warn', 'small images only (300×419)']
  };
  function tagsOf(n) {
    const t = [];
    if (n.scanOnly) t.push(TAG.scan);
    else if (n.imageNature === 'photo') t.push(TAG.photo);
    else if (n.imageNature === 'mixed') t.push(TAG.plusscan);
    if (n.watermark) t.push(TAG.wm);
    if (n.callout === 'zhcn') t.push(TAG.small);
    return t;
  }
  const iconHtml = ([sym, cls, label], extra = '') => `<svg class="ic ${cls}${extra}" role="img" aria-label="${label}"><title>${label}</title><use href="#${sym}"/></svg>`;
  function drawPill(sel) {
    sel.each(function (n) {
      const el = d3.select(this);
      el.append('rect').attr('class', 'pill').attr('width', PW).attr('height', PH).attr('rx', 10);

      el.append('rect').attr('class', 'pill-bar').attr('width', 8).attr('height', PH).attr('clip-path', 'url(#pill-clip)')
        .attr('fill', n.scanOnly ? 'url(#hatch)' : famColor(n.family));
      el.append('rect').attr('class', 'ico-bg').attr('x', 14).attr('y', (PH - 26) / 2).attr('width', 26).attr('height', 26).attr('rx', 6);
      el.append('image').attr('href', n.icon).attr('x', 16).attr('y', (PH - 22) / 2).attr('width', 22).attr('height', 22).attr('preserveAspectRatio', 'xMidYMid meet');
      const name = el.append('text').attr('class', 'name').attr('x', 48).attr('y', 19).text(shortName(n));
      // tags, right-aligned on the second line
      let tx = PW - 8;
      tagsOf(n).reverse().forEach(([sym, cls, label]) => {
        const w = 16; tx -= w;
        const tg = el.append('g').attr('class', 'bic ' + cls).attr('transform', `translate(${tx},${PH - 21})`);
        tg.append('use').attr('href', '#' + sym).attr('width', w).attr('height', w);
        tg.append('title').text(label);
        tx -= 4;
      });
      // flags on the second line, as many as fit
      const fl = uniqFlags(n.langs), sz = 13, gap = 3;
      const room = Math.floor((tx - 48 + gap) / (sz + gap));
      const shown = fl.length > room ? fl.slice(0, Math.max(room - 1, 0)) : fl;
      const fg = el.append('g').attr('class', 'flags').attr('transform', `translate(48,${PH - 18})`);
      shown.forEach((l, i) => fg.append('image').attr('href', flagUrl(l)).attr('x', i * (sz + gap)).attr('width', sz).attr('height', sz));
      if (shown.length < fl.length) fg.append('text').attr('class', 'more').attr('x', shown.length * (sz + gap)).attr('y', 10).text('+' + (fl.length - shown.length));
      // shorten the name until it fits
      const maxW = PW - 56; let s = shortName(n);
      while (name.node().getComputedTextLength() > maxW && s.length > 4) { s = s.slice(0, -1); name.text(s.trimEnd() + '…'); }
      el.append('title').text(`${n.name}\n${D.families[n.family].label}\n${n.langs.map(l => langInfo(l).label).join(', ')}`);
    });
  }

  let cur = null, nodeSel = d3.select(null), linkSel = d3.select(null);
  function render(animate) {
    const vis = nodes.filter(n => serves(n, state.lang));
    cur = layout(vis);
    const dur = animate ? 450 : 0;
    // lanes + headers
    gLanes.selectAll('*').remove();
    TIERS.forEach(([title, sub], t) => {
      const n = cur.cols[t].length;
      if (slot[t] == null) return;
      gLanes.append('rect').attr('class', 'lane').attr('x', colX(t) - 14).attr('y', -64).attr('width', PW + 28).attr('height', cur.H + 78).attr('rx', 16);
      gLanes.append('text').attr('class', 'lane-title').attr('x', colX(t)).attr('y', -40).text(`${t + 1} · ${title}`);
      gLanes.append('text').attr('class', 'lane-sub').attr('x', colX(t)).attr('y', -24).text(n ? `${sub} · ${n}` : 'none for this language');
    });
    gStrip.selectAll('*').remove();
    if (cur.strip) {
      const discLangs = LENS_DISC.filter(l => !state.lang || l === state.lang);
      gStrip.append('rect').attr('x', -14).attr('y', cur.strip.y).attr('width', GW + 28).attr('height', cur.strip.h).attr('rx', 16);
      gStrip.append('text').attr('class', 'strip-title').attr('x', 6).attr('y', cur.strip.y + 24)
        .text('DISCONTINUED LANGUAGES · ' + discLangs.map(l => `${l} (${langInfo(l).label})`).join(' · '));
      gStrip.append('text').attr('class', 'strip-sub').attr('x', 6).attr('y', cur.strip.y + 42)
        .text('Printed for a while, then dropped. TCGdex lists them but has no images; card data would come first.');
      const none = discLangs.filter(l => !cur.vis.some(n => n.disc && n.langs.includes(l)));
      if (none.length) gStrip.append('text').attr('class', 'strip-sub').attr('x', 6).attr('y', cur.strip.y + cur.strip.h - 14)
        .text(none.map(l => `${l} (${langInfo(l).label}): no source found`).join(' · '));
    }
    linkSel = gLinks.selectAll('path').data(cur.vl, l => l.from + '>' + l.to).join(
      enter => enter.append('path').attr('class', 'link').attr('opacity', 0).attr('d', linkPath)
        .call(p => p.append('title')),
      update => update,
      exit => exit.remove())
      .attr('stroke', l => EDGE[edgeKind(l)].color())

      .attr('stroke-width', l => CONF[l.confidence].w)
      .attr('stroke-dasharray', l => CONF[l.confidence].dash)
      .attr('marker-end', l => l.kind === 'shared' ? null : `url(#${marker(EDGE[edgeKind(l)].color())})`)
      .classed('faint', l => l.source.id === 'print');
    linkSel.select('title').text(l => `${l.source.name} → ${l.target.name}\n${l.scope}\n${CONF[l.confidence].label}: ${l.evidence}`);
    linkSel.transition().duration(dur).attr('opacity', 1).attr('d', linkPath);

    nodeSel = gNodes.selectAll('g.node').data(cur.vis, n => n.id).join(
      enter => enter.append('g').attr('class', n => 'node' + (n.id === 'tcgdex' ? ' hub' : ''))
        .attr('tabindex', -1).attr('role', 'button').attr('aria-label', n => `${n.name}, ${D.families[n.family].label}`)
        .attr('opacity', 0).attr('transform', n => `translate(${n.x},${n.y - PH / 2})`)
        .call(drawPill)
        .on('click', (e, n) => { e.stopPropagation(); openPanel(n.id); })
        .on('keydown', (e, n) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openPanel(n.id); return; }
          const m = neighbour(n, e.key); if (!m) return;
          e.preventDefault(); focusNode(m);
        })
        .on('mouseenter focus', (e, n) => { state.hover = n; highlight(); if (e.type === 'focus') rovingNode(n); })
        .on('mouseleave blur', () => { state.hover = null; highlight(); }),
      update => update,
      exit => exit.remove());
    nodeSel.transition().duration(dur).attr('opacity', 1).attr('transform', n => `translate(${n.x},${n.y - PH / 2})`);
    rovingNode(state.pinned && cur.vis.includes(state.pinned) ? state.pinned : cur.cols.find(c => c.length)?.[0]);
    renderList();
    // the printed cards feed ~20 scanners; their links stay hidden until asked for, a count stands in
    const nPrint = cur.vl.filter(l => l.source.id === 'print').length;
    nodeSel.filter(n => n.id === 'print').selectAll('text.calm-label').data(nPrint ? [nPrint] : []).join('text')
      .attr('class', 'calm-label').attr('x', PW - 8).attr('y', PH - 8).attr('text-anchor', 'end').text(k => `scanned by ${k} sites ›`);
    highlight();
    fitGraph(animate);
  }

  // keyboard: one box in the tab order, arrows move within a lane (↑↓) and across lanes (←→)
  function rovingNode(n) { nodeSel.attr('tabindex', m => m === n ? 0 : -1); }
  function focusNode(n) { nodeSel.filter(m => m === n).node()?.focus(); }
  function neighbour(n, key) {
    const lane = n.disc ? cur.vis.filter(m => m.disc) : cur.cols[n.tier];
    const i = lane.indexOf(n);
    if (key === 'ArrowDown') return lane[i + 1];
    if (key === 'ArrowUp') return lane[i - 1];
    if (key !== 'ArrowLeft' && key !== 'ArrowRight') return null;
    const dir = key === 'ArrowRight' ? 1 : -1;
    for (let t = n.tier + dir; t >= 0 && t < NCOL; t += dir) {
      if (cur.cols[t].length) return cur.cols[t].reduce((a, b) => Math.abs(b.y - n.y) < Math.abs(a.y - n.y) ? b : a);
    }
    return null;
  }

  // phones: the same sources as a list, lane by lane
  function renderList() {
    const box = document.getElementById('mobile-list');
    box.innerHTML = TIERS.map(([title, sub], t) => {
      const ns = cur.cols[t];
      return ns.length ? `<section><h3>${t + 1} · ${esc(title)}</h3><p class="ml-sub">${esc(sub)}</p>${ns.map(listRow).join('')}</section>` : '';
    }).join('') + (cur.vis.some(n => n.disc) ? `<section class="disc"><h3>Discontinued languages</h3>${cur.vis.filter(n => n.disc).map(listRow).join('')}</section>` : '');
    box.querySelectorAll('[data-go]').forEach(el => el.addEventListener('click', () => openPanel(el.dataset.go)));
  }
  const listRow = n => {
    const up = D.links.filter(l => l.to === n.id).length, down = D.links.filter(l => l.from === n.id).length;
    return `<button class="ml-row" data-go="${n.id}" data-id="${n.id}"><span class="ml-bar" style="background:${n.scanOnly ? 'repeating-linear-gradient(135deg,var(--c-scan) 0 3px,#0006 3px 6px)' : famColor(n.family)}"></span><img class="ico" src="${esc(n.icon)}" alt="">
      <span class="ml-main"><b>${esc(shortName(n))}</b><span class="ml-flags">${flagsOf(n.langs)}</span></span>
      <span class="ml-tags">${tagsOf(n).map(t => iconHtml(t)).join('')}<span class="ml-ud">↑${up} ↓${down}</span></span></button>`;
  };
  document.getElementById('map-toggle').addEventListener('click', e => {
    const on = document.body.classList.toggle('show-map');
    e.target.textContent = on ? 'Back to the list' : 'See the full map';
    if (on) requestAnimationFrame(() => fitGraph(false));
  });

  function fitGraph(animate) {
    const el = svg.node(), wrap = document.getElementById('graph-wrap');
    const w = el.clientWidth; if (!w || !cur) return;
    const bx = -30, by = -76, bw = GW + 90, bh = cur.HT + by * -1 + 20;
    const narrow = w < 760;
    // size the box to the content so a filtered lens doesn't leave a tall empty frame
    let k = narrow ? Math.max(Math.min(w / bw, 1.15), .52) : Math.min(w / bw, 1.15);
    const maxH = window.innerHeight * (narrow ? .65 : .86);
    wrap.style.height = Math.round(Math.max(narrow ? 220 : 320, Math.min(maxH, bh * k + 8))) + 'px';
    const h = el.clientHeight;
    if (!narrow) k = Math.min(k, h / bh);
    const tx = bw * k > w ? 8 - bx * k : (w - bw * k) / 2 - bx * k;
    const ty = bh * k > h ? 8 - by * k : (h - bh * k) / 2 - by * k;
    const t = d3.zoomIdentity.translate(tx, ty).scale(k);
    (animate ? svg.transition().duration(450) : svg).call(zoom.transform, t);
  }
  window.addEventListener('resize', () => fitGraph(false));
  document.getElementById('z-in').addEventListener('click', () => svg.transition().duration(250).call(zoom.scaleBy, 1.3));
  document.getElementById('z-out').addEventListener('click', () => svg.transition().duration(250).call(zoom.scaleBy, 1 / 1.3));
  document.getElementById('z-fit').addEventListener('click', () => fitGraph(true));

  // after opening the panel: bring the graph on screen and slide it so the box isn't under the panel
  function keepInView(n) {
    if (document.getElementById('view-network').hidden || !cur || !cur.vis.includes(n)) return;
    const wrap = document.getElementById('graph-wrap'), r = wrap.getBoundingClientRect();
    if (r.bottom < 80 || r.top > innerHeight - 80) wrap.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    const pr = panel.getBoundingClientRect();
    if (pr.left < 10) return;   // phone: the panel is a bottom sheet
    const t = d3.zoomTransform(svg.node());
    const right = r.left + t.applyX(n.x + PW), left = r.left + t.applyX(n.x);
    let dx = 0;
    if (right > pr.left - 24) dx = pr.left - 24 - right;
    if (left + dx < r.left + 12) dx = r.left + 12 - left;
    if (dx) svg.transition().duration(350).call(zoom.translateBy, dx / t.k, 0);
  }

  function upstream(n) {
    const up = new Set([n]); let grew = true;
    while (grew) { grew = false; links.forEach(l => { if (up.has(l.target) && !up.has(l.source)) { up.add(l.source); grew = true; } }); }
    return up;
  }
  function downstream(n) {
    const down = new Set([n]); let grew = true;
    while (grew) { grew = false; links.forEach(l => { if (l.kind !== 'shared' && down.has(l.source) && !down.has(l.target)) { down.add(l.target); grew = true; } }); }
    return down;
  }
  const upDownText = n => {
    const u = upstream(n).size - 1, d = downstream(n).size - 1;
    return `<span class="up-t">↑ ${u} source${u === 1 ? '' : 's'} feed it</span> · <span class="down-t">↓ ${d} site${d === 1 ? '' : 's'} use its images</span>`;
  };
  const isScanNode = n => n.scanOnly || n.imageNature === 'photo' || n.id === 'print';

  const state = { lang: '', mode: 'all', fam: null, set: null, pinned: null, hover: null, story: null, finding: null };
  function highlight() {
    const f = state.hover || state.pinned;
    let keep = null, keepLink = null, strong = false, up = null, down = null, now = null;
    if (f) {
      up = upstream(f); down = downstream(f); keep = new Set([...up, ...down]); strong = true;
      keepLink = l => (up.has(l.source) && up.has(l.target)) || (down.has(l.source) && down.has(l.target));
    }
    else if (state.story) {
      const steps = state.story.s.steps.slice(0, state.story.i + 1);
      keep = new Set(steps.flatMap(st => st.sources).map(id => nById[id]));
      const lk = new Set(steps.flatMap(st => st.links.map(([a, b]) => a + '>' + b)));
      keepLink = l => lk.has(l.from + '>' + l.to); strong = true;
      now = new Set(state.story.s.steps[state.story.i].sources.map(id => nById[id]));
    }
    else if (state.set) keep = new Set([...state.set.ids].map(id => nById[id]).filter(Boolean));
    else if (state.fam) { keep = new Set(nodes.filter(n => n.family === state.fam)); keepLink = l => keep.has(l.source) || keep.has(l.target); }
    else if (state.mode === 'tcgdex') { keep = upstream(nById.tcgdex); strong = true; }
    else if (state.mode === 'scans') {
      keep = new Set(nodes.filter(n => isScanNode(n) || n.imageNature === 'mixed'));
      keepLink = l => l.kind === 'scans' || (l.source.scanOnly && keep.has(l.target));
    }
    keepLink = keepLink || (l => keep.has(l.source) && keep.has(l.target));
    const calm = !keep && state.mode === 'all';
    linkSel.classed('calm', l => calm && l.source.id === 'print');
    nodeSel.classed('story-now', n => !!now && now.has(n));
    document.querySelectorAll('#mobile-list .ml-row').forEach(r => { const n = nById[r.dataset.id]; r.classList.toggle('dim', !!keep && !keep.has(n)); r.classList.toggle('on', n === state.pinned || (!!now && now.has(n))); });
    nodeSel.classed('dim', n => !!keep && !keep.has(n)).classed('pinned', n => n === state.pinned)
      .classed('up', n => !!up && n !== f && up.has(n)).classed('down', n => !!down && n !== f && down.has(n));
    linkSel.classed('dim', l => !!keep && !keepLink(l)).classed('hl', l => !!keep && strong && keepLink(l))
      .classed('hl-down', l => !!down && down.has(l.source) && down.has(l.target) && !(up && up.has(l.target)));
    // raise highlighted links above the rest
    if (keep) linkSel.filter(l => keepLink(l)).raise();
    if (!state.hover) syncMatrix(keep);
    const note = document.getElementById('focus-note');
    note.hidden = !state.set && !f;
    if (f) note.innerHTML = `<b>${esc(shortName(f))}</b>: ${upDownText(f)}`;
    else if (state.story) note.hidden = true;
    else if (state.set) note.innerHTML = `Highlighting the sources of <b>${esc(state.set.title)}</b> <button id="focus-clear">Clear</button>`;
    if (!f && state.set) document.getElementById('focus-clear').onclick = () => { state.set = null; highlight(); };
  }

  // mode switch
  function setMode(m) {
    document.querySelectorAll('#mode button').forEach(x => x.setAttribute('aria-checked', x.dataset.mode === m));
    rove(document.getElementById('mode'));
    state.mode = m; state.set = null; stopStory(true); highlight();
    setHash('m', m === 'all' ? '' : m);
  }
  document.querySelectorAll('#mode button').forEach(b => b.addEventListener('click', () => setMode(b.dataset.mode)));
  // radio groups: one tab stop, arrow keys move and select
  function rove(group) {
    group.querySelectorAll('[role=radio]').forEach(b => { b.tabIndex = b.getAttribute('aria-checked') === 'true' ? 0 : -1; });
  }
  ['mode'].forEach(id => document.getElementById(id).addEventListener('keydown', e => {
    const dir = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key]; if (!dir) return;
    const items = [...e.currentTarget.querySelectorAll('[role=radio]:not(:disabled)')];
    const i = items.indexOf(document.activeElement); if (i < 0) return;
    e.preventDefault();
    const b = items[(i + dir + items.length) % items.length];
    b.click(); b.focus();
  }));

  /* ---------- dropdowns in the control bar (language, follow one card) ---------- */
  const menus = [];
  function dropdown(btn, menu) {
    const items = () => [...menu.querySelectorAll('button:not(:disabled)')];
    const close = (focusBtn) => { if (menu.hidden) return; menu.hidden = true; btn.setAttribute('aria-expanded', 'false'); if (focusBtn) btn.focus(); };
    const open = () => {
      menus.forEach(m => m.close());
      menu.hidden = false; btn.setAttribute('aria-expanded', 'true');
      (menu.querySelector('[aria-checked="true"]') || items()[0])?.focus();
    };
    btn.addEventListener('click', e => { e.stopPropagation(); menu.hidden ? open() : close(); });
    menu.addEventListener('keydown', e => {
      if (e.key === 'Escape' || e.key === 'Tab') { close(e.key === 'Escape'); return; }
      const dir = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key]; if (!dir) return;
      e.preventDefault();
      const it = items(), i = it.indexOf(document.activeElement);
      it[(i + dir + it.length) % it.length].focus();
    });
    document.addEventListener('click', e => { if (!menu.contains(e.target) && e.target !== btn) close(); });
    const m = { open, close }; menus.push(m); return m;
  }

  // language picker
  const langMenu = document.getElementById('lang-menu'), langBtn = document.getElementById('lang-btn');
  const langOpt = (l, disc) => {
    const n = langCount(l);
    return `<button class="opt${disc ? ' disc' : ''}" role="radio" data-lang="${l}" aria-checked="false" ${n ? '' : 'disabled'} title="${esc(langInfo(l).label)}${disc ? ' — discontinued ' + esc(langInfo(l).discontinued) : ''}: ${n} source${n === 1 ? '' : 's'}">${flagImg(l)}<span class="c">${esc(l)}</span><span class="lbl">${esc(langInfo(l).label.replace(/ \(.*\)/, ''))}</span><span class="n">${n}</span></button>`;
  };
  langMenu.innerHTML = `<button class="opt all" role="radio" data-lang="" aria-checked="true">${flagImg('all')}<span class="lbl">All languages</span><span class="n">${nodes.length - 1}</span></button>` +
    LENS.map(l => langOpt(l)).join('') + `<div class="sep">Discontinued</div>` + LENS_DISC.map(l => langOpt(l, true)).join('');
  const langDD = dropdown(langBtn, langMenu);
  langMenu.querySelectorAll('.opt').forEach(b => b.addEventListener('click', () => { state.set = null; setLang(b.dataset.lang); langDD.close(true); }));
  function setLang(lang) {
    if (state.lang === lang && cur) return;
    state.lang = lang;
    langMenu.querySelectorAll('.opt').forEach(b => b.setAttribute('aria-checked', b.dataset.lang === lang));
    document.getElementById('lang-cur').innerHTML = lang
      ? `${flagImg(lang)}<span>${esc(langInfo(lang).label.replace(/ \(.*\)/, ''))}</span>`
      : `${flagImg('all')}<span>All languages</span>`;
    langBtn.classList.toggle('on', !!lang);
    if (state.pinned && !serves(state.pinned, lang)) closePanel(true);
    renderSummary();
    syncCoverage();
    render(true);
    setHash('l', lang);
  }
  function renderSummary() {
    const box = document.getElementById('lang-summary'), l = state.lang;
    if (!l) { box.hidden = true; return; }
    const gap = D.gaps.find(x => x.lang === l);
    const info = langInfo(l), n = langCount(l);
    const off = nodes.filter(x => x.official && serves(x, l) && x.id !== 'print');
    const fills = gap ? gap.fills.filter(f => f.count && f.kind !== 'upgrade').sort((a, b) => PERM_ORDER.indexOf(a.permission) - PERM_ORDER.indexOf(b.permission) || b.count - a.count).slice(0, 3) : [];
    box.innerHTML = `
      <div class="ls-head">${flagImg(l, 'flag xl')}<div><h3>${esc(info.label)} <span class="code">${esc(l)}</span></h3>
        <p>${n} source${n === 1 ? '' : 's'}${info.discontinued ? ` · printed ${esc(info.discontinued)}, then discontinued` : ''}</p></div></div>
      <dl>
        <div><dt>Official source</dt><dd>${off.length ? off.map(x => `<span class="who" data-go="${x.id}">${esc(shortName(x))}</span>`).join(', ') : '<span class="muted">none found</span>'}</dd></div>
        ${gap ? `<div><dt>TCGdex is missing</dt><dd>${gap.noData ? `almost everything: ${fmt(gap.missingCount)} card file${gap.missingCount === 1 ? '' : 's'}, no images` : `<b>${fmt(gap.missingCount)}</b> of ${fmt(gap.total)} images (${Math.round(gap.missingCount / gap.total * 100)}%)`}</dd></div>` : ''}
        ${fills.length ? `<div><dt>Could fill</dt><dd>${fills.map(f => `<span class="fillchip"><b>${fmt(f.count)}</b> <span class="who" data-go="${f.source}">${esc(shortName(nById[f.source]))}</span> <span class="perm ${f.permission}">${esc(D.permissions[f.permission].label)}</span></span>`).join(' ')} <a href="#" class="to-gaps">all details →</a></dd></div>` : ''}
      </dl>`;
    box.hidden = false;
    box.querySelectorAll('[data-go]').forEach(el => el.addEventListener('click', () => openPanel(el.dataset.go)));
    box.querySelector('.to-gaps')?.addEventListener('click', e => { e.preventDefault(); showView('gaps'); document.querySelector(`#gaps [data-lang="${l}"]`)?.scrollIntoView({ block: 'center' }); });
  }

  /* ---------- follow one card ---------- */
  const storyMenu = document.getElementById('story-menu'), card = document.getElementById('story-card');
  storyMenu.innerHTML = D.stories.map(s => `<button class="opt st-btn" role="menuitemradio" data-st="${s.id}" aria-checked="false">${flagImg(s.lang || 'en')}<span class="lbl">${esc(s.title)}</span></button>`).join('');
  const storyDD = dropdown(document.getElementById('story-btn'), storyMenu);
  storyMenu.querySelectorAll('.st-btn').forEach(b => b.addEventListener('click', () => {
    storyDD.close(true);
    if (state.story && state.story.s.id === b.dataset.st) stopStory();
    else { startStory(b.dataset.st); document.getElementById('map').scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  }));
  function startStory(id, step = 0) {
    const s = D.stories.find(x => x.id === id); if (!s) return;
    closePanel(true); state.set = null;
    const all = s.steps.flatMap(st => st.sources);
    setLang(s.lang && all.every(i => serves(nById[i], s.lang)) ? s.lang : '');
    state.story = { s, i: Math.min(Math.max(step, 0), s.steps.length - 1) };
    showStep();
  }
  function stopStory(quiet) {
    if (!state.story) return;
    state.story = null; card.hidden = true;
    storyMenu.querySelectorAll('.st-btn').forEach(b => b.setAttribute('aria-checked', 'false'));
    document.getElementById('story-btn').classList.remove('on');
    setHash('st', '');
    if (!quiet) highlight();
  }
  function showStep() {
    const { s, i } = state.story, st = s.steps[i], n = s.steps.length;
    storyMenu.querySelectorAll('.st-btn').forEach(b => b.setAttribute('aria-checked', b.dataset.st === s.id));
    document.getElementById('story-btn').classList.add('on');
    card.innerHTML = `
      <div class="sc-head"><b>${s.lang ? flagImg(s.lang) + ' ' : ''}${esc(s.title)}</b><span class="sc-n">${i + 1} / ${n}</span><button class="sc-close" aria-label="Stop following this card">×</button></div>
      <div class="sc-body"><div class="sc-text"><p>${esc(st.caption)}</p>
      <div class="sc-nav"><button class="sc-prev" ${i ? '' : 'disabled'}>← Back</button><div class="sc-dots">${s.steps.map((_, k) => `<span class="${k === i ? 'on' : ''}"></span>`).join('')}</div><button class="sc-next">${i < n - 1 ? 'Next →' : 'Done'}</button></div></div>
      ${st.example ? `<figure class="sc-fig"><img referrerpolicy="no-referrer" alt="${esc(st.example.label)}" src="${esc(st.example.url)}"><figcaption>${esc(st.example.label)} · loaded from ${esc(hostOf(st.example.url))}</figcaption></figure>` : ''}</div>`;
    card.hidden = false;
    const img = card.querySelector('img');
    if (img) img.onerror = () => { img.closest('figure').innerHTML = `<figcaption>${esc(hostOf(st.example.url))} doesn't allow embedding: <a href="${esc(st.example.url)}" target="_blank" rel="noopener noreferrer">open the image</a></figcaption>`; };
    card.querySelector('.sc-close').onclick = () => stopStory();
    card.querySelector('.sc-prev').onclick = () => { state.story.i--; showStep(); };
    card.querySelector('.sc-next').onclick = () => { if (i < n - 1) { state.story.i++; showStep(); } else stopStory(); };
    setHash('st', `${s.id}.${i + 1}`);
    highlight();
  }

  // search
  document.getElementById('node-list').innerHTML = D.sources.map(s => `<option value="${esc(s.name)}"></option>`).join('');
  const ns = document.getElementById('node-search');
  ns.addEventListener('change', () => {
    const q = ns.value.trim().toLowerCase(); if (!q) return;
    const s = D.sources.find(x => x.name.toLowerCase() === q) || D.sources.find(x => x.name.toLowerCase().includes(q) || x.id === q);
    if (!s) return;
    if (!serves(nById[s.id], state.lang)) setLang('');
    openPanel(s.id); ns.value = '';
  });

  // legend

  const sw = (dash, color, arrow, w = 2) => `<svg width="38" height="10" aria-hidden="true"><line x1="1" y1="5" x2="${arrow ? 30 : 37}" y2="5" stroke="${color}" stroke-width="${w}" ${dash ? `stroke-dasharray="${dash}"` : ''}/>${arrow ? `<path d="M30,1.5L37,5L30,8.5z" fill="${color}"/>` : ''}</svg>`;
  const boxSw = fill => `<svg width="22" height="16" aria-hidden="true"><rect x=".5" y=".5" width="21" height="15" rx="4" fill="var(--card)" stroke="var(--line)"/><rect x=".5" y=".5" width="5" height="15" rx="2" fill="${fill}"/></svg>`;
  document.getElementById('legend').innerHTML = `
    <div class="lg"><h4>Box colour = type <span class="muted">(click to highlight)</span></h4><div class="lg-items">${Object.entries(D.families).map(([k, f]) =>
      `<button class="lg-fam" data-f="${k}" aria-pressed="false" title="${esc(f.desc)}">${boxSw(famColor(k))}${esc(f.label)}</button>`).join('')}
      <span class="lg-it">${boxSw('url(#hatch)')}hatched = scans only</span></div></div>
    <div class="lg"><h4>Icons on a box</h4><div class="lg-items">${Object.values(TAG).map(t => `<span class="lg-it">${iconHtml(t)}${t[2]}</span>`).join('')}</div></div>

    <div class="lg"><h4>Arrow colour = what travels</h4><div class="lg-items">${Object.entries(EDGE).filter(([k]) => k !== 'shared').map(([, e]) => `<span class="lg-it">${sw(null, e.color(), true)}${e.label}</span>`).join('')}</div></div>
    <div class="lg"><h4>Line = how sure <span class="muted">(thicker = surer)</span></h4><div class="lg-items">${Object.entries(CONF).map(([k, c]) => `<span class="lg-it">${sw(c.dash, k === 'unknown-direction' ? EDGE.shared.color() : css2('--text'), false, c.w)}${c.label}</span>`).join('')}</div></div>`;
  document.querySelectorAll('.lg-fam').forEach(b => b.addEventListener('click', () => {
    const on = b.getAttribute('aria-pressed') !== 'true';
    document.querySelectorAll('.lg-fam').forEach(x => x.setAttribute('aria-pressed', 'false'));
    b.setAttribute('aria-pressed', on); state.fam = on ? b.dataset.f : null; state.set = null; stopStory(true); highlight();
    setHash('f', state.fam || '');
  }));

  /* ---------- detail panel ---------- */
  const panel = document.getElementById('panel');
  document.getElementById('panel-close').addEventListener('click', closePanel);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !panel.hidden) closePanel(); });
  let lastFocus = null;
  function closePanel(quiet) {
    const was = !panel.hidden;
    panel.hidden = true; state.pinned = null;
    if (!quiet) highlight();
    setHash('s', '');
    if (was && lastFocus && lastFocus.isConnected) lastFocus.focus({ preventScroll: true });
    lastFocus = null;
  }
  const apiLabel = { open: 'Open API', dump: 'Data dump', partner: 'Partner-only API', paid: 'Paid API', none: 'No API' };
  const natureLabel = { digital: 'digital', scan: 'scan', photo: 'photo', mixed: 'digital + scans', physical: 'physical' };
  function openPanel(id) {
    const s = byId[id]; if (!s) return;
    if (!serves(nById[id], state.lang)) setLang('');
    state.pinned = nById[id]; state.set = null; highlight();
    const fam = D.families[s.family];
    const ups = D.links.filter(l => l.to === id), downs = D.links.filter(l => l.from === id);
    const rel = (arr, key) => arr.length ? `<ul class="rel">${arr.map(l => `<li><img class="ico" src="${esc(byId[l[key]].icon)}" alt=""><span class="who" data-go="${l[key]}">${esc(byId[l[key]].name)}</span><span class="conf ${l.confidence}">${l.confidence.replace('-', ' ')}</span><div class="ev">${esc(l.scope)} — ${esc(l.evidence)}</div></li>`).join('')}</ul>` : '<p class="muted">—</p>';
    const co = D.callouts.find(c => c.sources.includes(id) && (c.kind === 'warn' || c.kind === 'good'));
    // long origin notes: first sentence(s) up to ~200 characters, the rest behind "more"
    let o1 = s.origin, o2 = '';
    if (s.origin.length > 240) {
      const cut = s.origin.slice(0, 220).lastIndexOf('. ');
      if (cut > 60) { o1 = s.origin.slice(0, cut + 1); o2 = s.origin.slice(cut + 2); }
    }
    const gapsHere = D.gaps.flatMap(g => g.fills.filter(f => f.source === id && f.count).map(f => ({ ...f, lang: g.lang })));
    document.getElementById('panel-body').innerHTML = `
      <span class="fam"><span class="dot" style="background:${famColor(s.family)}"></span>${esc(fam.label)}</span>
      <h2 id="panel-title"><img class="ico lg" src="${esc(s.icon)}" alt="">${esc(s.name)} <span class="hflags" aria-hidden="true">${flagsOf(s.langs, 'flag lg')}</span></h2>
      <a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(hostOf(s.url))} ↗</a>
      <p class="updown">${upDownText(nById[id])}</p>
      <div class="badges">
        ${s.official ? '<span class="badge official">OFFICIAL POKÉMON</span>' : ''}
        ${s.scanOnly ? '<span class="badge scan">SCANS ONLY</span>' : s.imageNature === 'mixed' ? '<span class="badge">DIGITAL + SCANS</span>' : s.imageNature === 'photo' ? '<span class="badge scan">PHOTOS</span>' : ''}
        ${s.watermark ? '<span class="badge wm">WATERMARKED</span>' : ''}
        <span class="badge">${apiLabel[s.api.kind] || 'No API'}</span>
        ${s.submissions.yes ? '<span class="badge ok">TAKES SUBMISSIONS</span>' : ''}
      </div>
      ${co ? `<div class="callout-box ${co.kind === 'good' ? 'good' : ''}"><b>${esc(co.title)}.</b> ${esc(co.short || co.body)} <a href="#finding-${co.id}" class="to-finding" data-c="${co.id}">details ↑</a></div>` : ''}
      <h4>Where its images come from</h4><p class="origin">${esc(o1)}${o2 ? ` <button class="more">more</button><span class="rest" hidden> ${esc(o2)}</span>` : ''}</p>
      <h4>Facts</h4>
      <dl class="kv">
        <dt>Languages</dt><dd class="langs">${langsHtml(s.langs)}</dd>
        <dt>Eras</dt><dd>${esc(s.eras)}</dd>
        <dt>Images</dt><dd>${esc(natureLabel[s.imageNature] || s.imageNature)} · ${esc(s.resolution)}</dd>
        <dt>API</dt><dd>${esc(apiLabel[s.api.kind] || '—')}${s.api.note ? ' — ' + esc(s.api.note) : ''}${s.api.url ? ` · <a href="${esc(s.api.url)}" target="_blank" rel="noopener">link</a>` : ''}</dd>
        <dt>Submissions</dt><dd>${s.submissions.yes ? esc(s.submissions.how) + (s.submissions.url ? ` · <a href="${esc(s.submissions.url)}" target="_blank" rel="noopener">link</a>` : '') : 'no'}</dd>
        ${s.terms ? `<dt>Terms</dt><dd>${esc(s.terms.summary)} ${s.terms.url ? `<a href="${esc(s.terms.url)}" target="_blank" rel="noopener">read ↗</a>` : ''}</dd>` : ''}
        ${s.stats.map(x => `<dt>${esc(x.label)}</dt><dd>${esc(x.value)}</dd>`).join('')}
      </dl>
      ${gapsHere.length ? `<h4>Could fill on TCGdex</h4><ul class="rel">${gapsHere.map(f => `<li><b>${fmt(f.count)}</b> ${esc(f.lang)} <span class="perm ${f.permission}">${esc(D.permissions[f.permission].label)}</span><div class="ev">${esc(f.note)}</div></li>`).join('')}</ul>` : ''}
      <h4>Gets images from</h4>${rel(ups, 'from')}
      <h4>Images end up at</h4>${rel(downs, 'to')}
      <h4>Example assets (where the original lives)</h4>
      ${s.examples.length ? s.examples.map((x, i) => `
        <div class="ex">
          <div class="row"><span>${esc(x.label)} <span class="badge ${x.nature !== 'digital' ? 'scan' : ''}">${esc(x.nature.toUpperCase())}</span>${x.note ? ` <span class="badge">${esc(x.note)}</span>` : ''}</span>
          <button data-prev="${i}">preview</button></div>
          <a class="url" href="${esc(x.url)}" target="_blank" rel="noopener noreferrer">${esc(x.url)}</a>
          <div class="pv"></div>
        </div>`).join('') : '<p class="muted">No public per-image link (see the site itself).</p>'}
    `;
    if (!panel.contains(document.activeElement) && document.activeElement !== document.body) lastFocus = document.activeElement;
    panel.hidden = false; panel.scrollTop = 0;
    document.getElementById('panel-close').focus({ preventScroll: true });
    panel.querySelector('.origin .more')?.addEventListener('click', e => { e.target.nextElementSibling.hidden = false; e.target.remove(); });
    panel.querySelector('.to-finding')?.addEventListener('click', e => {
      e.preventDefault();
      closePanel();
      showView('network');
      openFinding(e.target.dataset.c);
    });
    setTimeout(() => keepInView(nById[id]), 500);   // after a lens change's fit animation
    panel.querySelectorAll('[data-go]').forEach(el => el.addEventListener('click', () => openPanel(el.dataset.go)));
    // a language chip switches the graph to that language
    panel.querySelectorAll('.langs .lang').forEach(el => {
      const k = lensKey(el.dataset.l); if (!k) return;
      el.classList.add('click'); el.title += ' — show this language in the graph';
      el.addEventListener('click', () => { setLang(k); openPanel(id); });
    });
    panel.querySelectorAll('[data-prev]').forEach(b => b.addEventListener('click', () => {
      const x = s.examples[+b.dataset.prev], box = b.closest('.ex').querySelector('.pv');
      if (box.firstChild) { box.innerHTML = ''; b.textContent = 'preview'; return; }
      const img = new Image(); img.referrerPolicy = 'no-referrer'; img.alt = x.label; img.loading = 'lazy';
      img.onerror = () => { box.innerHTML = `<div class="err">The origin host doesn't allow embedding — open the link instead.</div>`; };
      img.src = x.url; box.appendChild(img); b.textContent = 'hide';
      box.insertAdjacentHTML('beforeend', `<div class="src-note">loaded from ${esc(hostOf(x.url))}, not hosted here</div>`);
    }));
    // show the first example straight away (card-image formats only; .dat and wiki pages stay behind the button)
    const first = s.examples.findIndex(x => /\.(png|jpe?g|webp)(\?|$)|\/large$/i.test(x.url));
    if (first >= 0) panel.querySelector(`[data-prev="${first}"]`)?.click();
    setHash('s', id);
  }

  /* ---------- gaps view ----------
     A bar is the language's missing images. Segments are the sources that could fill them, best
     permission first; alternatives (same cards, different sites) count once, everything is capped at
     what is missing, and the grey rest is what we found no source for. */
  const PERM_ORDER = ['none', 'maintainer', 'rights-holder', 'scanner', 'impossible'];
  document.getElementById('perm-legend').innerHTML = PERM_ORDER.map(k => `<div class="pl-it"><span class="perm ${k}">${esc(D.permissions[k].label)}</span><span>${esc(D.permissions[k].desc)}</span></div>`).join('') +
    `<div class="pl-it"><span class="perm nosrc">No source found</span><span>Missing, and we found no site that has it.</span></div>` +
    '<p class="muted pl-foot">Everything still needs TCGdex\'s OK for the submission itself (its CONTRIBUTING rules).</p>';
  const permColor = { none: '--p-none', maintainer: '--p-maintainer', 'rights-holder': '--p-rights', scanner: '--p-scanner', impossible: '--p-impossible' };
  function gapSegments(g) {
    const fills = g.fills.filter(f => f.count && f.kind !== 'upgrade' && f.permission !== 'impossible');
    const groups = new Map();
    fills.forEach(f => { const k = f.alt || f.source + '|' + f.count + '|' + f.note; (groups.get(k) || groups.set(k, []).get(k)).push(f); });
    const segs = [...groups.values()].map(fs => ({ perm: fs[0].permission, count: d3.max(fs, f => f.count), fs }))
      .sort((a, b) => PERM_ORDER.indexOf(a.perm) - PERM_ORDER.indexOf(b.perm) || b.count - a.count);
    let left = g.missingCount;
    segs.forEach(s => { s.shown = Math.min(s.count, left); left -= s.shown; });
    const byPerm = p => d3.sum(segs.filter(s => s.perm === p), s => s.shown);
    return { segs: segs.filter(s => s.shown > 0), rest: left, byPerm };
  }
  const fillRow = f => `<div class="fill">
        <div class="n">${f.count ? (f.note.startsWith('≈') ? '≈' : '') + fmt(f.count) : '—'}</div>
        <div class="meta"><img class="ico" src="${esc(byId[f.source].icon)}" alt=""><span class="src" data-go="${f.source}" tabindex="0" role="link">${esc(byId[f.source].name)}</span>
          <span class="perm ${f.permission}">${esc(D.permissions[f.permission].label)}</span>
          ${f.nature !== 'digital' ? '<span class="badge scan">SCAN</span>' : ''}</div>
        <div class="note">${esc(f.note.replace(/^≈ ?/, ''))}</div>
      </div>`;
  const gapCard = g => {
    const { segs, rest } = gapSegments(g);
    const miss = g.missingCount || 1;
    const rows = g.fills.filter(f => f.kind !== 'upgrade');
    const seen = new Set();
    const body = rows.map(f => {
      if (!f.alt) return fillRow(f);
      if (seen.has(f.alt)) return '';
      seen.add(f.alt);
      return `<div class="alt-group"><div class="alt-h">Alternatives: the same cards on different sites, counted once</div>${rows.filter(x => x.alt === f.alt).map(fillRow).join('')}</div>`;
    }).join('');
    const ups = g.fills.filter(f => f.kind === 'upgrade');
    const head = g.noData
      ? `<p class="missing"><b>${fmt(g.missingCount)}</b> card file${g.missingCount === 1 ? '' : 's'} on TCGdex, <b>0</b> images</p>`
      : `<p class="missing">TCGdex has <b>${fmt(g.have)}</b> of ${fmt(g.total)} images · <b>${fmt(g.missingCount)}</b> missing</p>`;
    const bar = g.noData
      ? `<div class="gbar nodata"><span>card data first: there is nothing to attach images to yet</span></div>`
      : `<div class="gbar" role="img" aria-label="${esc(segs.map(s => `${fmt(s.shown)} ${D.permissions[s.perm].label}`).concat(rest ? [`${fmt(rest)} no source found`] : []).join(', '))}">${segs.map(s => `<span title="${esc(s.fs.map(f => byId[f.source].name).join(' or '))}: ${fmt(s.shown)}${s.shown < s.count ? ` (of ${fmt(s.count)})` : ''} · ${esc(D.permissions[s.perm].label)}" style="width:${s.shown / miss * 100}%;background:var(${permColor[s.perm]})"></span>`).join('')}${rest ? `<span class="nosrc" title="No source found: ${fmt(rest)}" style="width:${rest / miss * 100}%"></span>` : ''}</div>`;
    return `<article class="gap${isDiscontinued(g.lang) ? ' disc' : ''}" data-lang="${esc(g.lang)}" id="gap-${esc(g.lang)}">
      <header><h3>${flagImg(g.lang, 'flag lg')} ${esc(g.name)}<span class="code">${esc(g.lang)}</span></h3><button class="to-net" data-lang="${esc(g.lang)}">Network →</button></header>
      ${head}
      ${g.missingNote ? `<p class="mnote">${esc(g.missingNote)}</p>` : ''}
      ${isDiscontinued(g.lang) ? `<p class="disc-note">Printed ${esc(langInfo(g.lang).discontinued)}, then discontinued.</p>` : ''}
      ${bar}
      ${body || '<p class="muted">We found no source.</p>'}
      ${ups.length ? `<div class="up-group"><div class="alt-h">Better versions of images TCGdex already has</div>${ups.map(fillRow).join('')}</div>` : ''}
    </article>`;
  };
  const bySize = (a, b) => (a.noData - b.noData) || b.missingCount - a.missingCount;
  const gapsCur = D.gaps.filter(g => !isDiscontinued(g.lang)).sort(bySize), gapsDisc = D.gaps.filter(g => isDiscontinued(g.lang)).sort(bySize);
  // scoreboard: every current language as one 100 % bar
  const pct = x => x > 0 && x < .005 ? '<1%' : Math.round(x * 100) + '%';
  document.getElementById('scoreboard').innerHTML = `<h3 class="group">Scoreboard <span class="muted">· share of each language's images</span></h3>
    <div class="sb-key"><span><i class="k-has"></i>TCGdex has it</span><span><i class="k-off"></i>fillable from an official image</span><span><i class="k-ask"></i>exists, needs someone's OK</span><span><i class="k-none"></i>no source found</span></div>
    <div class="sb-grid">` + gapsCur.map(g => {
      if (g.noData) return `<a class="sb-tile nodata" href="#gap-${g.lang}"><div class="sb-h">${flagImg(g.lang)} ${esc(g.name)}</div><div class="sb-big">—</div><div class="sb-sub">card data first</div></a>`;
      const { byPerm, rest } = gapSegments(g), T = g.total;
      const parts = [['has', g.have], ['off', byPerm('none')], ['ask', byPerm('maintainer') + byPerm('rights-holder') + byPerm('scanner')], ['none', rest]];
      return `<a class="sb-tile" href="#gap-${g.lang}" title="${esc(parts.map(([k, v]) => `${k}: ${fmt(v)}`).join(' · '))}"><div class="sb-h">${flagImg(g.lang)} ${esc(g.name)}</div>
        <div class="sb-big">${pct(g.have / T)}</div>
        <div class="sb-bar">${parts.map(([k, v]) => v ? `<span class="k-${k}" style="width:${v / T * 100}%"></span>` : '').join('')}</div>
        <div class="sb-sub">${parts.slice(1).map(([k, v]) => `<span class="t-${k}">+${pct(v / T)}</span>`).join(' ')}</div></a>`;
    }).join('') + '</div>';
  document.querySelectorAll('.sb-tile').forEach(a => a.addEventListener('click', e => { e.preventDefault(); document.querySelector(a.getAttribute('href')).scrollIntoView({ behavior: 'smooth', block: 'start' }); }));
  document.getElementById('gaps').innerHTML =
    `<h3 class="group">Current languages <span class="muted">· most missing first</span></h3><div class="gaps-grid">${gapsCur.map(gapCard).join('')}</div>` +
    (gapsDisc.length ? `<h3 class="group">Discontinued languages</h3><p class="group-note">${esc(D.meta.discontinuedNote || '')}</p><div class="gaps-grid">${gapsDisc.map(gapCard).join('')}</div>` : '');
  document.querySelectorAll('#gaps [data-go]').forEach(el => {
    el.addEventListener('click', () => openPanel(el.dataset.go));
    el.addEventListener('keydown', e => { if (e.key === 'Enter') openPanel(el.dataset.go); });
  });
  document.querySelectorAll('#gaps .to-net').forEach(el => el.addEventListener('click', () => { showView('network'); setLang(el.dataset.lang); }));

  /* ---------- overview: coverage per language ----------
     One bar per language, 100 % = every image TCGdex should have: what it has, then what could fill
     the rest (best permission first, same segments as the gaps view), then what we found no source for. */
  const COV_KEY = [['have', 'TCGdex has it'], ['none', 'official image, ready'], ['maintainer', 'official, watermarked'],
    ['rights-holder', 'ask the rights holder'], ['scanner', 'fan scan, ask the scanner'], ['rest', 'no source found']];
  document.getElementById('cov-key').innerHTML = COV_KEY.map(([k, l]) => `<span><i class="sw s-${k}"></i>${l}</span>`).join('');
  const shortLabel = l => langInfo(l).label.replace(/ \(.*\)/, '');
  const bestFill = g => {
    const s0 = gapSegments(g).segs[0];
    return s0 ? `${s0.fs.map(f => shortName(nById[f.source])).join(' / ')} · ${fmt(s0.shown)}` : 'no source found';
  };
  const officialFor = l => nodes.filter(x => x.official && x.id !== 'print' && serves(x, l)).map(shortName);
  function covRow(g) {
    const { segs, rest } = gapSegments(g), T = g.total || 1;
    const pctHave = Math.round(g.have / T * 100);
    const bar = g.noData
      ? `<span class="cbar nodata" title="No card data on TCGdex yet: images have nothing to attach to"></span>`
      : `<span class="cbar" role="img" aria-label="${esc(`TCGdex has ${fmt(g.have)} of ${fmt(g.total)}; ` + segs.map(x => `${fmt(x.shown)} ${D.permissions[x.perm].label}`).concat(rest ? [`${fmt(rest)} no source found`] : []).join(', '))}">` +
        `<i class="s-have" style="flex-grow:${g.have}" title="TCGdex has ${fmt(g.have)}"></i>` +
        segs.map(x => `<i class="s-${x.perm}" style="flex-grow:${x.shown}" title="${esc(x.fs.map(f => byId[f.source].name).join(' or '))}: ${fmt(x.shown)} · ${esc(D.permissions[x.perm].label)}"></i>`).join('') +
        (rest ? `<i class="s-rest" style="flex-grow:${rest}" title="No source found: ${fmt(rest)}"></i>` : '') + '</span>';
    const miss = g.noData ? `${fmt(g.missingCount)} card file${g.missingCount === 1 ? '' : 's'}, no images` : `<b>${fmt(g.missingCount)}</b> missing`;
    const off = officialFor(g.lang);
    return `<button class="crow${isDiscontinued(g.lang) ? ' disc' : ''}" data-lang="${esc(g.lang)}" aria-pressed="false">
      <span class="fl">${flagImg(g.lang, 'flag lg')}<span class="c">${esc(g.lang)}</span><span class="nm-ph">${esc(shortLabel(g.lang))}</span></span>
      ${bar}
      <span class="pct">${g.noData ? '—' : pctHave + '%'}<small>${g.noData ? 'no data' : 'has'}</small></span>
      <span class="meta"><span class="nm">${esc(shortLabel(g.lang))}</span><span class="ms">${miss}</span>${g.issue ? `<span class="issue ik-${g.issueKind || 'muted'}">${esc(g.issue)}</span>` : ''}</span>
      <span class="ph"><span class="dt">Official source</span><span class="dd">${esc(off.join(', ') || 'none — printed cards only')}</span>
        <span class="dt">Best fill</span><span class="dd">${esc(bestFill(g))}</span></span>
    </button>`;
  }
  {
    const main = D.gaps.filter(g => !g.noData && !isDiscontinued(g.lang)).sort((a, b) => b.missingCount - a.missingCount);
    const later = [...D.gaps.filter(g => g.noData && !isDiscontinued(g.lang)), ...D.gaps.filter(g => isDiscontinued(g.lang))];
    const half = Math.ceil(main.length / 2);
    document.getElementById('cov-grid').innerHTML =
      `<div class="cov-col"><h3>Most images missing</h3>${main.slice(0, half).map(covRow).join('')}</div>` +
      `<div class="cov-col"><h3>Fewer missing</h3>${main.slice(half).map(covRow).join('')}<h3>Card data first</h3>${later.map(covRow).join('')}</div>`;
    document.querySelectorAll('#cov-grid .crow').forEach(b => b.addEventListener('click', () => {
      state.set = null; stopStory(true);
      setLang(state.lang === b.dataset.lang ? '' : b.dataset.lang);
    }));
  }
  function syncCoverage() {
    document.querySelectorAll('#cov-grid .crow').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.lang === state.lang)));
    // phones: the rows are a swipeable strip, bring the picked language's card into view
    const grid = document.getElementById('cov-grid'), on = grid.querySelector('[aria-pressed="true"]');
    if (on && grid.scrollWidth > grid.clientWidth) grid.scrollLeft = on.offsetLeft - grid.offsetLeft - 16;
  }

  /* ---------- overview: which source has which language ---------- */
  const MX_GROUPS = ['Origin', 'First copy', 'Re-host · wiki', 'Shops · TCGdex', 'Discontinued'];
  const mxCols = nodes.slice().sort((a, b) => (a.disc - b.disc) || (a.tier - b.tier) || (a.f - b.f));
  const grp = n => n.disc ? 4 : n.tier;
  const mxRows = [...LENS, ...LENS_DISC];
  const natureWords = { digital: 'digital images', scan: 'scans', photo: 'photos', mixed: 'digital + scans', physical: 'the printed card itself' };
  {
    const start = (n, i) => i === 0 || grp(mxCols[i - 1]) !== grp(n);
    const groups = MX_GROUPS.map((t, k) => [t, mxCols.filter(n => grp(n) === k).length]).filter(([, c]) => c);
    let h = `<thead><tr class="tier"><th></th>${groups.map(([t, c]) => `<th colspan="${c}" scope="colgroup">${t}</th>`).join('')}</tr>
      <tr class="ico"><th></th>${mxCols.map((n, i) => `<th scope="col" class="${start(n, i) ? 'tstart' : ''}" data-s="${n.id}"><button aria-label="${esc(n.name)}"><img src="${esc(n.icon)}" alt=""></button></th>`).join('')}</tr></thead><tbody>`;
    mxRows.forEach(l => {
      h += `<tr class="${isDiscontinued(l) ? 'disc' : ''}" data-lang="${l}"><th scope="row"><button title="Show ${esc(langInfo(l).label)}">${flagImg(l)}${esc(l)}</button></th>` + mxCols.map((n, i) => {
        const has = serves(n, l);
        return `<td class="${start(n, i) ? 'tstart' : ''}" data-s="${n.id}" data-l="${l}">${has ? `<span class="mk ${n.imageNature}" style="--m:var(--c-${n.family})"></span>` : ''}</td>`;
      }).join('') + '</tr>';
    });
    const mx = document.getElementById('mx');
    mx.innerHTML = h + '</tbody>';
    const tip = document.createElement('div'); tip.className = 'mx-tip'; tip.hidden = true; document.body.appendChild(tip);
    mx.addEventListener('mousemove', e => {
      const c = e.target.closest('[data-s]'); if (!c) { tip.hidden = true; return; }
      const n = nById[c.dataset.s], l = c.dataset.l;
      tip.innerHTML = `<b>${esc(n.name)}</b> · ${esc(D.families[n.family].label)}<br>${esc(natureWords[n.imageNature] || n.imageNature)} · ${esc(n.resolution)}` +
        (l ? `<br>${serves(n, l) ? '✓ has' : '— no'} ${esc(langInfo(l).label)}` : '');
      tip.hidden = false;
      tip.style.left = Math.min(e.clientX + 14, innerWidth - tip.offsetWidth - 8) + 'px';
      tip.style.top = (e.clientY + 16) + 'px';
    });
    mx.addEventListener('mouseleave', () => { tip.hidden = true; });
    mx.addEventListener('click', e => {
      const row = e.target.closest('tbody th button');
      if (row) { state.set = null; const l = row.closest('tr').dataset.lang; setLang(state.lang === l ? '' : l); return; }
      const c = e.target.closest('[data-s]');
      if (c && (c.tagName === 'TH' || c.querySelector('.mk'))) openPanel(c.dataset.s);
    });
    document.getElementById('mx-key').innerHTML =
      [['digital', 'digital image'], ['mixed', 'digital + scans'], ['scan', 'scans / photos'], ['physical', 'the printed card']].map(([k, l]) => `<span><i class="mk ${k}" style="--m:var(--muted)"></i>${l}</span>`).join('') +
      `<span class="gap-k"></span>` + Object.entries(D.families).map(([k, f]) => `<span><i class="sw" style="background:var(--c-${k})"></i>${esc(f.label)}</span>`).join('');
  }
  // follow the page's focus: picked language row, dimmed columns outside the current highlight, the open source
  function syncMatrix(keep) {
    const mx = document.getElementById('mx'); if (!mx || !mx.rows.length) return;
    mx.querySelectorAll('tbody tr').forEach(r => r.classList.toggle('sel', r.dataset.lang === state.lang));
    mx.querySelectorAll('[data-s]').forEach(c => {
      const n = nById[c.dataset.s];
      c.classList.toggle('dim', !!keep && !keep.has(n));
      c.classList.toggle('pin', n === state.pinned);
    });
  }

  /* ---------- overview: one card, three copies (drawn to scale) ---------- */
  if (D.compare) {
    const C = D.compare, SC = matchMedia('(max-width: 760px)').matches ? 5 : 3;
    document.getElementById('one-sub').textContent = `${C.card} · checked ${C.checked}`;
    document.getElementById('copies').innerHTML = `<div class="chain">` + C.steps.map((st, i) => {
      const n = nById[st.source];
      const frame = st.url
        ? `<div class="frame" style="width:${Math.round(st.w / SC)}px;aspect-ratio:${st.w}/${st.h}"><img loading="lazy" referrerpolicy="no-referrer" src="${esc(st.url)}" alt="${esc(C.card)} as served by ${esc(n.name)}"></div>`
        : `<div class="frame empty" style="width:${Math.round(st.w / SC)}px;aspect-ratio:${st.w}/${st.h}"><span>${esc(st.empty)}</span></div>`;
      return (i ? `<div class="arrow${st.same ? ' same' : ''}"><svg aria-hidden="true"><use href="#i-arrow"/></svg><span>${esc(st.via)}</span></div>` : '') +
        `<div class="cc"><button class="who" data-go="${n.id}"><img class="ico" src="${esc(n.icon)}" alt="">${esc(shortName(n))}</button>${frame}
          <div class="spec">${st.url ? `<b>${esc(st.spec.split(' · ')[0])}</b>${st.spec.includes(' · ') ? ' · ' + esc(st.spec.split(' · ').slice(1).join(' · ')) : ''}<br><a href="${esc(st.url)}" target="_blank" rel="noopener noreferrer">${esc(hostOf(st.url))} ↗</a>` : `<b>origin</b><br>${esc(st.spec)}`}</div></div>`;
    }).join('') + `</div><div class="scale"><i style="width:${Math.round(300 / SC)}px"></i>300 px of image · ${esc(C.note.replace('3 px', SC + ' px'))}</div>`;
    document.querySelectorAll('#copies img').forEach(img => { img.onerror = () => { img.replaceWith(Object.assign(document.createElement('span'), { className: 'nofile', textContent: `${hostOf(img.src)} doesn't allow embedding — use the link` })); }; });
    document.querySelectorAll('#copies [data-go]').forEach(b => b.addEventListener('click', () => openPanel(b.dataset.go)));
  }

  /* ---------- first-visit guide (three steps, remembered) ---------- */
  const store = { get: k => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } } };
  const GUIDE = [
    ['#lang-btn', 'Pick a language. The bars, the map and the table below all filter to it.'],
    ['#cov-grid', 'Each bar is how much of a language TCGdex has. Green is missing but ready to fill from an official image; grey is what we found no source for.'],
    ['#map .sec-h', 'The map shows who copies whom, left to right. Hover a box to trace where its images come from, click it for the details.']
  ];
  let coach = null, ringEl = null, guideStep = -1;
  function endGuide() { coach?.remove(); ringEl?.classList.remove('target-ring'); coach = null; guideStep = -1; store.set('atlas-guide', 'done'); }
  function guide(i) {
    coach?.remove(); ringEl?.classList.remove('target-ring');
    if (i >= GUIDE.length) return endGuide();
    guideStep = i;
    const [sel, text] = GUIDE[i], t = document.querySelector(sel);
    if (!t || !t.offsetParent) return guide(i + 1);
    if (i > 0) t.scrollIntoView({ block: 'center' });
    ringEl = t; t.classList.add('target-ring');
    coach = document.createElement('div'); coach.className = 'coach'; coach.setAttribute('role', 'dialog'); coach.setAttribute('aria-label', `Guide, step ${i + 1} of ${GUIDE.length}`);
    coach.innerHTML = `<div class="st">${i + 1} / ${GUIDE.length}</div><p>${text}</p><div class="acts"><button class="next" type="button">${i === GUIDE.length - 1 ? 'Got it' : 'Next'}</button><button class="skip" type="button">Skip</button></div>`;
    document.body.appendChild(coach);
    const r = t.getBoundingClientRect(), w = coach.offsetWidth;
    const left = Math.max(12, Math.min(r.left + scrollX, document.documentElement.clientWidth - w - 12));
    coach.style.left = left + 'px';
    coach.style.top = (r.top + scrollY + Math.min(r.height, 64) + 12) + 'px';
    coach.style.setProperty('--ax', Math.max(14, Math.min(r.left + scrollX + 18 - left, w - 26)) + 'px');
    coach.querySelector('.next').onclick = () => guide(i + 1);
    coach.querySelector('.skip').onclick = endGuide;
    coach.addEventListener('keydown', e => { if (e.key === 'Escape') endGuide(); });
    coach.querySelector('.next').focus({ preventScroll: true });
  }
  document.getElementById('guide-btn').addEventListener('click', e => { e.stopPropagation(); showView('network'); scrollTo(0, 0); guide(0); });
  document.addEventListener('click', e => {
    if (!coach || coach.contains(e.target)) return;
    if (ringEl && ringEl.contains(e.target) && guideStep === 0) { const b = e.target.closest('button'); endGuide(); if (b) b.focus(); return; }
    endGuide();
  }, true);
  window.addEventListener('resize', () => { if (guideStep >= 0) guide(guideStep); });

  /* ---------- sources table ---------- */
  const feedsTcgdex = upstream(nById.tcgdex);
  const inN = s => D.links.filter(l => l.to === s.id).length, outN = s => D.links.filter(l => l.from === s.id).length;
  const resPx = s => +((String(s.resolution).match(/\d{3,4}/) || [0])[0]);
  // [key, header, cell, sort value]
  const cols2 = [
    ['name', 'Source', s => `<span class="dot" style="background:${famColor(s.family)}"></span><img class="ico" src="${esc(s.icon)}" alt=""><span class="nm">${esc(s.name)}</span>`, s => s.name.toLowerCase()],
    ['family', 'Type', s => esc(D.families[s.family].label), s => D.families[s.family].label],
    ['official', 'Official', s => s.official ? '<span class="badge official">YES</span>' : '<span class="no">no</span>', s => s.official ? 0 : 1],
    ['imageNature', 'Images', s => (s.scanOnly || s.imageNature === 'photo') ? `<span class="badge scan">${s.imageNature === 'photo' ? 'PHOTOS' : 'SCANS ONLY'}</span>` : esc(natureLabel[s.imageNature] || s.imageNature), s => s.imageNature],
    ['resolution', 'Size', s => esc(s.resolution), s => -resPx(s)],
    ['watermark', 'Watermark', s => s.watermark ? '<span class="badge wm">YES</span>' : '<span class="no">no</span>', s => s.watermark ? 0 : 1],
    ['api', 'API', s => s.api.kind === 'none' ? '<span class="no">—</span>' : esc(apiLabel[s.api.kind]), s => ['open', 'dump', 'partner', 'paid', 'none'].indexOf(s.api.kind)],
    ['submissions', 'Submissions', s => s.submissions.yes ? '<span class="yes">yes</span>' : '<span class="no">no</span>', s => s.submissions.yes ? 0 : 1],
    ['feeds', 'Feeds TCGdex', s => s.id !== 'tcgdex' && feedsTcgdex.has(nById[s.id]) ? '<span class="yes">yes</span>' : '<span class="no">—</span>', s => s.id !== 'tcgdex' && feedsTcgdex.has(nById[s.id]) ? 0 : 1],
    ['links', 'Links in · out', s => `<span class="mono">${inN(s)} · ${outN(s)}</span>`, s => -(inN(s) + outN(s))],
    ['langs', 'Languages', s => `<span class="langs">${langsHtml(s.langs)}</span>`, s => -s.langs.length],
    ['url', 'Link', s => `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(hostOf(s.url))}</a>`, s => hostOf(s.url)]
  ];
  let sortKey = null, sortDir = 1;
  const tbl = document.getElementById('src-table');
  const f = { q: document.getElementById('src-search'), off: document.getElementById('f-official'), scan: document.getElementById('f-scan'), api: document.getElementById('f-api'), sub: document.getElementById('f-sub') };
  function renderTable() {
    const q = f.q.value.toLowerCase();
    let rows = D.sources.filter(s =>
      (!q || JSON.stringify(s).toLowerCase().includes(q)) &&
      (!f.off.checked || s.official) &&
      (!f.scan.checked || ['scan', 'photo', 'mixed'].includes(s.imageNature)) &&
      (!f.api.checked || s.api.kind !== 'none') &&
      (!f.sub.checked || s.submissions.yes));
    if (sortKey) {
      const v = cols2.find(c => c[0] === sortKey)[3];
      rows = rows.slice().sort((a, b) => { const x = v(a), y = v(b); return (typeof x === 'number' ? x - y : String(x).localeCompare(String(y))) * sortDir; });
    }
    document.getElementById('src-count').textContent = `${rows.length} of ${D.sources.length} sources`;
    tbl.innerHTML = `<thead><tr>${cols2.map(c => `<th data-k="${c[0]}" tabindex="0" aria-sort="${sortKey === c[0] ? (sortDir > 0 ? 'ascending' : 'descending') : 'none'}">${c[1]}${sortKey === c[0] ? (sortDir > 0 ? ' ▲' : ' ▼') : ''}</th>`).join('')}</tr></thead>
      <tbody>${rows.map(s => `<tr data-go="${s.id}" tabindex="0">${cols2.map(c => `<td>${c[2](s)}</td>`).join('')}</tr>`).join('')}</tbody>`;
    tbl.querySelectorAll('th').forEach(th => {
      const go = () => { sortDir = sortKey === th.dataset.k ? -sortDir : 1; sortKey = th.dataset.k; renderTable(); tbl.querySelector(`th[data-k="${sortKey}"]`).focus(); };
      th.addEventListener('click', go);
      th.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
    });
    tbl.querySelectorAll('tbody tr').forEach(tr => {
      tr.addEventListener('click', e => { if (!e.target.closest('a')) openPanel(tr.dataset.go); });
      tr.addEventListener('keydown', e => { if (e.key === 'Enter') openPanel(tr.dataset.go); });
    });
  }
  Object.values(f).forEach(el => el.addEventListener('input', renderTable));
  renderTable();

  /* ---------- method ---------- */
  document.getElementById('view-method').innerHTML = `
    <h2>How the links were measured</h2>
    <p>Each site's images were mirrored or sampled and compared, pixel by pixel, against the official digital images (malie's PTCGO and TCG Live renders, pokemon.com, pokemon-card.com, asia.pokemon-card.com, pokemoncard.co.kr) and against every other mirrored fan site. A link is <span class="conf verified">verified</span> only when the files are the same picture, not merely the same card.</p>
    <div class="method-grid">
      <div class="step"><span class="num">01</span><br><b>dHash search</b><p class="muted">A 256-bit perceptual hash finds candidate matches within 56 bits.</p></div>
      <div class="step"><span class="num">02</span><br><b>Thumbnail correlation</b><p class="muted">Both at 180×252 greyscale, trying several crop insets (sites trim borders differently). Must reach 0.88.</p></div>
      <div class="step"><span class="num">03</span><br><b>Tile registration</b><p class="muted">Compared at the smaller image's resolution in 20 tiles, each aligned within ±5 px. A re-hosted digital file lines up within ≤ 1 px everywhere, even as a 400 px WebP. A scan never does: some tile drifts 1.4–7 px, because a card is never perfectly flat on the glass.</p></div>
      <div class="step"><span class="num">04</span><br><b>Metadata</b><p class="muted">EXIF camera (phone photos), scanner DPI headers (the Paradijs scans carry 762 dpi), editor software, transparent corners (game renders).</p></div>
    </div>
    <h3>Classes</h3>
    <ul>
      <li><b>official copy</b>: a site re-hosted an official digital file. Better to take it from the official source.</li>
      <li><b>near-official</b>: looks like the official image but fails the tile test: a clean scan, or a differently cropped export.</li>
      <li><b>fan copy</b>: identical to another fan site's file (e.g. the Paradijs scans). Says who shares it, not who made it.</li>
      <li><b>same card / unmatched</b>: different pixels, or no official digital version known: treated as a scan or photo.</li>
    </ul>
    <h3>Limits</h3>
    <ul>
      <li><i>Unmatched</i> can't prove an image isn't a digital file from a source not held here (press kits, retailer exports).</li>
      <li>Some sites (TCG Collector, Cardmarket) were sampled from the Internet Archive or their public image hosts.</li>
      <li>TCGplayer, Cardmarket, Serebii, PriceCharting, Scrydex and TCG Collector are samples (tens to hundreds of images), not full crawls. Analysed in full (for measurement only; no images are redistributed): pokemontcg.io, pkmcards.fr, bisafans, Pokémon Central, WikiDex, Bulbagarden JP, yuyu-tei, and all of TCGdex's English + German images.</li>
      <li>Numbers are a snapshot (${esc(D.meta.measured)}). Fan-site terms were read from the live pages; this is not legal advice.</li>
      <li>TCG Live renders published by malie and the game's own files are the same pixels, so a match to malie shows the render, not necessarily the route a site took.</li>
    </ul>
    <h3>Reuse the data</h3>
    <p>Everything on this page is in <a href="data.json"><code>data.json</code></a>. Corrections and additions are welcome as GitHub issues or pull requests.</p>`;

  /* ---------- init ---------- */
  const h0 = new URLSearchParams(location.hash.slice(1));
  renderFindings();
  showView(h0.get('v') || 'network');
  setLang(h0.get('l') || '');
  rove(document.getElementById('mode'));
  if (h0.get('m') && document.querySelector(`#mode [data-mode="${h0.get('m')}"]`)) setMode(h0.get('m'));
  if (h0.get('f')) document.querySelector(`.lg-fam[data-f="${h0.get('f')}"]`)?.click();
  // copy link: the hash already carries view, language, mode, type, source and story
  document.getElementById('copy-link').addEventListener('click', async e => {
    const b = e.currentTarget;
    try { await navigator.clipboard.writeText(location.href); b.textContent = 'Copied ✓'; }
    catch { window.prompt('Copy this link', location.href); }
    setTimeout(() => { b.textContent = 'Copy link'; }, 1600);
  });
  if (![...h0.keys()].length && store.get('atlas-guide') !== 'done') setTimeout(() => guide(0), 700);
  if (h0.get('s')) openPanel(h0.get('s'));
  else if (h0.get('st')) { const [sid, k] = h0.get('st').split('.'); startStory(sid, (+k || 1) - 1); }
})();
