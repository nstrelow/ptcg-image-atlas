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

  /* ---------- key findings ---------- */

  document.getElementById('callouts').innerHTML = D.callouts.map(c => `
    <article class="finding ${c.kind}" id="finding-${c.id}">
      <h3><span class="tag">${esc(c.tag || 'NOTE')}</span>${c.lang ? flagImg(c.lang) : ''}${esc(c.title)}</h3>
      <p class="short">${esc(c.short || c.body)}</p>
      <div class="f-foot">
        <details><summary>Details</summary><p>${esc(c.body)}</p></details>
        <button class="f-show" data-callout="${c.id}">Show in network →</button>
      </div>
    </article>`).join('');
  document.querySelectorAll('.f-show').forEach(b => b.addEventListener('click', () => {
    const c = D.callouts.find(x => x.id === b.dataset.callout);
    showView('network');
    closePanel(true);
    setLang(c.lang || '');
    state.set = { ids: new Set(c.sources), title: c.title };
    highlight();
    document.getElementById('view-network').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }));

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
    if (v === 'network') requestAnimationFrame(() => fitGraph(false));
    setHash('v', v);
  }
  tabs.forEach(b => b.addEventListener('click', () => showView(b.dataset.view)));

  /* ---------- network ----------
     Left → right flow: four lanes (origin → consumers). Every source is a box: coloured bar =
     type, icon, name, its languages as flags, and tags (SCANS, WM …). Links leave a box on the
     right and enter the next one on the left; the order inside each lane is tuned to cross less. */

  const PW = 250, PH = 46, CG = 120, RG = 14, NCOL = 4;
  const colX = t => t * (PW + CG);
  const GW = colX(NCOL - 1) + PW;
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
    { pricecharting: .03, scrydex: .14, apps: .25, tcgplayer: .36, cardmarket: .46, tcgdex: .57, tcgcollector: .68, pokellector: .79, serebii: .90 }
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
    const maxN = d3.max(cols, c => c.length) || 1;
    const H = maxN * (PH + RG);
    cols.forEach((c, t) => {
      const step = Math.min(H / c.length, (PH + RG) * 1.7), off = (H - step * c.length) / 2;
      c.forEach((n, i) => { n.x = colX(t); n.y = off + step * (i + .5); });
    });
    let HT = H, strip = null;
    if (disc.length) {
      strip = { y: H + 44, h: PH + 84 };
      disc.forEach((n, i) => { n.x = colX(Math.min(1 + i, NCOL - 1)); n.y = strip.y + 56 + PH / 2; });
      HT = strip.y + strip.h;
    }
    // ports: spread a box's links along its edge, ordered by where the other end sits
    vis.forEach(n => {
      const outs = vl.filter(l => l.source === n).sort((a, b) => a.target.y - b.target.y);
      const ins = vl.filter(l => l.target === n).sort((a, b) => a.source.y - b.source.y);
      const spread = (arr, set) => arr.forEach((l, i) => set(l, arr.length > 1 ? (i / (arr.length - 1) - .5) * (PH - 14) : 0));
      spread(outs, (l, o) => { l.so = o; });
      spread(ins, (l, o) => { l.ti = o; });
    });
    return { vis, vl, H, HT, strip, cols };
  }

  function linkPath(l) {
    const s = l.source, t = l.target, sy = s.y + l.so, ty = t.y + l.ti;
    const x1 = s.x + PW;
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
  function tagsOf(n) {
    const t = [];
    if (n.scanOnly) t.push(['SCANS', 'scan']);
    else if (n.imageNature === 'photo') t.push(['PHOTOS', 'scan']);
    else if (n.imageNature === 'mixed') t.push(['+SCANS', 'scan-o']);
    if (n.watermark) t.push(['WM', 'warn']);
    if (n.callout === 'zhcn') t.push(['300×419', 'warn']);
    return t;
  }
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
      tagsOf(n).reverse().forEach(([txt, cls]) => {
        const w = txt.length * 5.6 + 8; tx -= w;
        const tg = el.append('g').attr('class', 'tag ' + cls).attr('transform', `translate(${tx},${PH - 18})`);
        tg.append('rect').attr('width', w).attr('height', 13).attr('rx', 3);
        tg.append('text').attr('x', w / 2).attr('y', 9.5).attr('text-anchor', 'middle').text(txt);
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
        .attr('tabindex', 0).attr('role', 'button').attr('aria-label', n => n.name)
        .attr('opacity', 0).attr('transform', n => `translate(${n.x},${n.y - PH / 2})`)
        .call(drawPill)
        .on('click', (e, n) => { e.stopPropagation(); openPanel(n.id); })
        .on('keydown', (e, n) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openPanel(n.id); } })
        .on('mouseenter focus', (e, n) => { state.hover = n; highlight(); })
        .on('mouseleave blur', () => { state.hover = null; highlight(); }),
      update => update,
      exit => exit.remove());
    nodeSel.transition().duration(dur).attr('opacity', 1).attr('transform', n => `translate(${n.x},${n.y - PH / 2})`);
    highlight();
    fitGraph(animate);
  }

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

  const state = { lang: '', mode: 'all', fam: null, set: null, pinned: null, hover: null };
  function highlight() {
    const f = state.hover || state.pinned;
    let keep = null, keepLink = null, strong = false, up = null, down = null;
    if (f) {
      up = upstream(f); down = downstream(f); keep = new Set([...up, ...down]); strong = true;
      keepLink = l => (up.has(l.source) && up.has(l.target)) || (down.has(l.source) && down.has(l.target));
    }
    else if (state.set) keep = new Set([...state.set.ids].map(id => nById[id]).filter(Boolean));
    else if (state.fam) { keep = new Set(nodes.filter(n => n.family === state.fam)); keepLink = l => keep.has(l.source) || keep.has(l.target); }
    else if (state.mode === 'tcgdex') { keep = upstream(nById.tcgdex); strong = true; }
    else if (state.mode === 'scans') {
      keep = new Set(nodes.filter(n => isScanNode(n) || n.imageNature === 'mixed'));
      keepLink = l => l.kind === 'scans' || (l.source.scanOnly && keep.has(l.target));
    }
    keepLink = keepLink || (l => keep.has(l.source) && keep.has(l.target));
    nodeSel.classed('dim', n => !!keep && !keep.has(n)).classed('pinned', n => n === state.pinned)
      .classed('up', n => !!up && n !== f && up.has(n)).classed('down', n => !!down && n !== f && down.has(n));
    linkSel.classed('dim', l => !!keep && !keepLink(l)).classed('hl', l => !!keep && strong && keepLink(l))
      .classed('hl-down', l => !!down && down.has(l.source) && down.has(l.target) && !(up && up.has(l.target)));
    // raise highlighted links above the rest
    if (keep) linkSel.filter(l => keepLink(l)).raise();
    const note = document.getElementById('focus-note');
    note.hidden = !state.set && !f;
    if (f) note.innerHTML = `<b>${esc(shortName(f))}</b>: ${upDownText(f)}`;
    else if (state.set) note.innerHTML = `Highlighting the sources of <b>${esc(state.set.title)}</b> <button id="focus-clear">Clear</button>`;
    if (!f && state.set) document.getElementById('focus-clear').onclick = () => { state.set = null; highlight(); };
  }

  // mode switch
  document.querySelectorAll('#mode button').forEach(b => b.addEventListener('click', () => {
    document.querySelectorAll('#mode button').forEach(x => x.setAttribute('aria-checked', x === b));
    state.mode = b.dataset.mode; state.set = null; highlight();
  }));

  // language lens
  const lens = document.getElementById('lens');
  const lensBtn = (l, disc) => {
    const n = langCount(l);
    return `<button role="radio" class="lb${disc ? ' disc' : ''}" data-lang="${l}" aria-checked="false" ${n ? '' : 'disabled'} title="${esc(langInfo(l).label)}${disc ? ' — discontinued' : ''}: ${n} source${n === 1 ? '' : 's'}">${flagImg(l)}<span class="code">${esc(l)}</span><span class="n">${n}</span></button>`;
  };
  lens.innerHTML = `<button role="radio" class="lb" data-lang="" aria-checked="true"><span class="code">All</span><span class="n">${nodes.length - 1}</span></button>` +
    LENS.map(l => lensBtn(l)).join('') + `<span class="lens-sep" title="Discontinued languages">discontinued</span>` + LENS_DISC.map(l => lensBtn(l, true)).join('');
  lens.querySelectorAll('.lb').forEach(b => b.addEventListener('click', () => { state.set = null; setLang(b.dataset.lang); }));
  function setLang(lang) {
    if (state.lang === lang && cur) return;
    state.lang = lang;
    lens.querySelectorAll('.lb').forEach(b => {
      b.setAttribute('aria-checked', b.dataset.lang === lang);
      if (b.dataset.lang === lang && lens.scrollWidth > lens.clientWidth) lens.scrollLeft = b.offsetLeft - lens.clientWidth / 2 + b.offsetWidth / 2;
    });
    if (state.pinned && !serves(state.pinned, lang)) closePanel(true);
    renderSummary();
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
    <div class="lg"><h4>Tags</h4><div class="lg-items">
      <span class="lg-it"><span class="tagx scan">SCANS</span>scans / photos only</span>
      <span class="lg-it"><span class="tagx scan-o">+SCANS</span>digital, plus some scans</span>
      <span class="lg-it"><span class="tagx warn">WM</span>watermarked</span>
      <span class="lg-it"><span class="tagx warn">300×419</span>small images only</span></div></div>

    <div class="lg"><h4>Arrow colour = what travels</h4><div class="lg-items">${Object.entries(EDGE).filter(([k]) => k !== 'shared').map(([, e]) => `<span class="lg-it">${sw(null, e.color(), true)}${e.label}</span>`).join('')}</div></div>
    <div class="lg"><h4>Line = how sure <span class="muted">(thicker = surer)</span></h4><div class="lg-items">${Object.entries(CONF).map(([k, c]) => `<span class="lg-it">${sw(c.dash, k === 'unknown-direction' ? EDGE.shared.color() : css2('--text'), false, c.w)}${c.label}</span>`).join('')}</div></div>`;
  document.querySelectorAll('.lg-fam').forEach(b => b.addEventListener('click', () => {
    const on = b.getAttribute('aria-pressed') !== 'true';
    document.querySelectorAll('.lg-fam').forEach(x => x.setAttribute('aria-pressed', 'false'));
    b.setAttribute('aria-pressed', on); state.fam = on ? b.dataset.f : null; state.set = null; highlight();
  }));

  /* ---------- detail panel ---------- */
  const panel = document.getElementById('panel');
  document.getElementById('panel-close').addEventListener('click', closePanel);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !panel.hidden) closePanel(); });
  function closePanel(quiet) {
    panel.hidden = true; state.pinned = null;
    if (!quiet) highlight();
    setHash('s', '');
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
      <h2><img class="ico lg" src="${esc(s.icon)}" alt="">${esc(s.name)} <span class="hflags" aria-hidden="true">${flagsOf(s.langs, 'flag lg')}</span></h2>
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
    panel.hidden = false; panel.scrollTop = 0;
    panel.querySelector('.origin .more')?.addEventListener('click', e => { e.target.nextElementSibling.hidden = false; e.target.remove(); });
    panel.querySelector('.to-finding')?.addEventListener('click', e => {
      e.preventDefault();
      const art = document.getElementById('finding-' + e.target.dataset.c);
      closePanel();
      art.querySelector('details').open = true;
      art.scrollIntoView({ behavior: 'smooth', block: 'center' });
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
    }));
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
  document.getElementById('gaps').innerHTML =
    `<h3 class="group">Current languages <span class="muted">· most missing first</span></h3><div class="gaps-grid">${gapsCur.map(gapCard).join('')}</div>` +
    (gapsDisc.length ? `<h3 class="group">Discontinued languages</h3><p class="group-note">${esc(D.meta.discontinuedNote || '')}</p><div class="gaps-grid">${gapsDisc.map(gapCard).join('')}</div>` : '');
  document.querySelectorAll('#gaps [data-go]').forEach(el => {
    el.addEventListener('click', () => openPanel(el.dataset.go));
    el.addEventListener('keydown', e => { if (e.key === 'Enter') openPanel(el.dataset.go); });
  });
  document.querySelectorAll('#gaps .to-net').forEach(el => el.addEventListener('click', () => { showView('network'); setLang(el.dataset.lang); }));

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
  showView(h0.get('v') || 'network');
  setLang(h0.get('l') || '');
  if (h0.get('s')) openPanel(h0.get('s'));
})();
