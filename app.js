(async function () {
  const D = await fetch('data.json').then(r => r.json());
  const byId = Object.fromEntries(D.sources.map(s => [s.id, s]));
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const famColor = f => css('--c-' + f);
  const TIERS = ['Origin', 'Extract · scan · dataset', 'Re-host · wiki · fan DB', 'Consumers · marketplaces'];
  const CONF = {
    'verified': { dash: null, label: 'verified (pixel match)' },
    'stated': { dash: '10 5', label: 'stated by the site' },
    'likely': { dash: '4 4', label: 'likely (indirect evidence)' },
    'unknown-direction': { dash: '1 5', label: 'same files, direction unknown' }
  };
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const hostOf = u => { try { return new URL(u).host.replace(/^www\./, ''); } catch { return u; } };
  const fmt = n => n.toLocaleString('en-US');
  document.getElementById('updated').textContent = D.meta.updated;

  /* ---------- callouts ---------- */
  const tagFor = { warn: 'ONLY', good: 'BETTER', info: 'NOTE' };
  document.getElementById('callouts').innerHTML = D.callouts.map(c => `
    <article class="callout ${c.kind}" data-src="${c.sources[0]}" tabindex="0">
      <h3><span class="tag">${tagFor[c.kind]}</span>${esc(c.title)}</h3>
      <p>${esc(c.body)}</p>
    </article>`).join('');
  document.querySelectorAll('.callout').forEach(el => {
    const go = () => { showView('network'); openPanel(el.dataset.src); };
    el.addEventListener('click', go);
    el.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
  });

  /* ---------- tabs + routing ---------- */
  const tabs = document.querySelectorAll('.tabs button');
  function showView(v) {
    tabs.forEach(b => b.setAttribute('aria-selected', b.dataset.view === v));
    document.querySelectorAll('.view').forEach(s => { s.hidden = s.id !== 'view-' + v; });
    if (v === 'network') requestAnimationFrame(fitGraph);
    const h = new URLSearchParams(location.hash.slice(1)); h.set('v', v);
    history.replaceState(null, '', '#' + h.toString());
  }
  tabs.forEach(b => b.addEventListener('click', () => showView(b.dataset.view)));

  /* ---------- network ---------- */
  const nodes = D.sources.map(s => ({ ...s }));
  const nById = Object.fromEntries(nodes.map(n => [n.id, n]));
  const links = D.links.map(l => ({ ...l, source: nById[l.from], target: nById[l.to] }));
  nodes.forEach(n => { n.deg = links.filter(l => l.source === n || l.target === n).length; });
  nodes.forEach(n => { n.r = n.id === 'tcgdex' ? 32 : n.id === 'malie' ? 30 : n.id === 'print' ? 24 : 18 + Math.min(n.deg, 12) * 0.6; });

  // Layered layout, hand-ordered into bands: scans on top, malie / digital in the middle, Asia at the bottom.
  const ORDER = [
    { print: .03, ptcgo: .30, tcgl: .41, pcom: .53, pcj: .66, asia: .77, kr: .88, wechat: .98 },
    { bisafans: .02, pokecardex: .11, yuyutei: .20, paradijs: .31, malie: .50, pokeca: .72, duanxr: .98 },
    { pkmncards: .10, pokemontcgio: .22, pkmcardsfr: .34, pokemoncentral: .45, wikidex: .55, bulbagarden: .66, limitless: .77, krfan: .88, mikmoe: .98 },
    { pricecharting: .03, scrydex: .20, tcgplayer: .33, cardmarket: .45, tcgdex: .57, tcgcollector: .72, serebii: .86 }
  ];
  const W = 1400, H = 900, padX = 150, padY = 70;
  ORDER.forEach((col, t) => Object.entries(col).forEach(([id, f], i) => {
    const n = nById[id]; n.tier = t;
    n.x = padX + t * (W - 2 * padX) / 3 + (t % 2 ? (i % 2 ? 30 : -30) : 0);
    n.y = padY + 20 + f * (H - 2 * padY - 20);
  }));
  nodes.filter(n => n.x == null).forEach((n, i) => { n.x = padX + n.tier * (W - 2 * padX) / 3; n.y = H - padY; });

  const svg = d3.select('#graph');
  const defs = svg.append('defs');
  const pat = defs.append('pattern').attr('id', 'hatch').attr('patternUnits', 'userSpaceOnUse').attr('width', 6).attr('height', 6).attr('patternTransform', 'rotate(45)');
  pat.append('rect').attr('width', 6).attr('height', 6).attr('fill', famColor('scan'));
  pat.append('line').attr('x1', 0).attr('y1', 0).attr('x2', 0).attr('y2', 6).attr('stroke', 'rgba(0,0,0,.45)').attr('stroke-width', 3);
  const edgeColor = l => l.kind === 'scans' ? famColor('scan') : l.kind === 'shared' ? css('--muted') : l.source.family === 'official' ? famColor('official') : l.source.family === 'extract' ? famColor('extract') : css('--muted');
  const markerFor = new Map();
  function marker(color) {
    if (markerFor.has(color)) return markerFor.get(color);
    const id = 'm' + markerFor.size;
    defs.append('marker').attr('id', id).attr('viewBox', '0 -5 10 10').attr('refX', 9).attr('refY', 0)
      .attr('markerWidth', 7).attr('markerHeight', 7).attr('orient', 'auto')
      .append('path').attr('d', 'M0,-4L10,0L0,4').attr('fill', color);
    markerFor.set(color, id); return id;
  }
  const g = svg.append('g');
  const zoom = d3.zoom().scaleExtent([0.3, 3]).on('zoom', e => { g.attr('transform', e.transform); placeTierLabels(e.transform); });
  svg.call(zoom).on('dblclick.zoom', null);

  const path = l => {
    const s = l.source, t = l.target;
    const dx = t.x - s.x, dy = t.y - s.y, dist = Math.hypot(dx, dy) || 1;
    const sx = s.x + dx / dist * s.r, sy = s.y + dy / dist * s.r;
    const tx = t.x - dx / dist * (t.r + 4), ty = t.y - dy / dist * (t.r + 4);
    const bend = s.tier === t.tier ? 0.35 : 0.12;
    const mx = (sx + tx) / 2 - dy * bend, my = (sy + ty) / 2 + dx * bend;
    return `M${sx},${sy} Q${mx},${my} ${tx},${ty}`;
  };
  const linkSel = g.append('g').selectAll('path').data(links).join('path')
    .attr('class', 'link').attr('d', path)
    .attr('stroke', edgeColor).attr('stroke-width', l => l.confidence === 'verified' ? 1.8 : 1.4)
    .attr('stroke-opacity', l => l.source.id === 'print' ? .3 : .8)
    .attr('stroke-dasharray', l => CONF[l.confidence].dash)
    .attr('marker-end', l => l.kind === 'shared' ? null : `url(#${marker(edgeColor(l))})`);
  linkSel.append('title').text(l => `${l.source.name} → ${l.target.name}\n${l.scope}\n${CONF[l.confidence].label}: ${l.evidence}`);

  const nodeSel = g.append('g').selectAll('g').data(nodes).join('g')
    .attr('class', 'node').attr('transform', n => `translate(${n.x},${n.y})`)
    .on('click', (e, n) => openPanel(n.id))
    .on('mouseenter', (e, n) => highlight(n)).on('mouseleave', () => highlight(null));
  nodeSel.filter(n => n.id === 'tcgdex').append('circle').attr('r', n => n.r + 7).attr('fill', 'none')
    .attr('stroke', famColor('tcgdex')).attr('stroke-width', 1.5).attr('stroke-dasharray', '3 3');
  // Ring = family colour (hatched for scan-only sources), violet dashed halo = also hosts scans, site icon inside.
  nodeSel.filter(n => n.imageNature === 'mixed').append('circle').attr('r', n => n.r + 4).attr('fill', 'none')
    .attr('stroke', famColor('scan')).attr('stroke-width', 2).attr('stroke-dasharray', '3 2');
  nodeSel.append('circle').attr('class', 'body').attr('r', n => n.r)
    .attr('fill', n => n.scanOnly ? 'url(#hatch)' : famColor(n.family));
  nodeSel.append('circle').attr('r', n => n.r - 4).attr('fill', '#fff');
  nodeSel.each(function (n) {
    const cid = 'clip-' + n.id, ri = n.r - 4;
    defs.append('clipPath').attr('id', cid).append('circle').attr('r', ri);
    const sz = ri * 1.55;
    d3.select(this).append('image').attr('href', n.icon).attr('x', -sz / 2).attr('y', -sz / 2)
      .attr('width', sz).attr('height', sz).attr('clip-path', `url(#${cid})`).attr('preserveAspectRatio', 'xMidYMid meet');
  });
  const wm = nodeSel.filter(n => n.watermark).append('g').attr('transform', n => `translate(${n.r * 0.72},${-n.r * 0.72})`);
  wm.append('circle').attr('r', 8).attr('fill', css('--warn')).attr('stroke', css('--bg2')).attr('stroke-width', 1.5);
  wm.append('text').attr('class', 'badge').attr('text-anchor', 'middle').attr('dy', 3).attr('fill', '#fff').text('WM');
  nodeSel.append('text').attr('dy', n => n.r + 14).attr('text-anchor', 'middle').text(n => shortName(n));
  nodeSel.filter(n => n.scanOnly).append('text').attr('class', 'badge').attr('text-anchor', 'middle')
    .attr('dy', n => n.r + 25).attr('fill', famColor('scan')).text('SCANS ONLY');
  nodeSel.filter(n => n.callout === 'korean' || n.callout === 'zhcn').append('text').attr('class', 'badge').attr('text-anchor', 'middle')
    .attr('dy', n => -n.r - 6).attr('fill', css('--warn')).text(n => n.callout === 'korean' ? '⚠ WATERMARK ONLY' : '⚠ 300×419 MAX');
  nodeSel.append('title').text(n => n.name);

  function shortName(n) {
    return n.id === 'paradijs' ? 'Paradijs scans (Martin)' : n.name.replace(/ \(.*\)$/, '').replace(' card database', '').replace(' (game client)', '').replace('Pokémon ', 'Pokémon ');
  }

  // tier labels follow pan/zoom
  const tl = document.getElementById('tier-labels');
  tl.innerHTML = TIERS.map(t => `<span>${t}</span>`).join('');
  function placeTierLabels(t) {
    [...tl.children].forEach((el, i) => { el.style.left = (t.applyX(padX + i * (W - 2 * padX) / 3)) + 'px'; });
  }
  function fitGraph() {
    const el = document.getElementById('graph'); const w = el.clientWidth, h = el.clientHeight;
    if (!w) return;
    const k = Math.min(w / (W + 40), h / (H + 60));
    svg.call(zoom.transform, d3.zoomIdentity.translate((w - W * k) / 2, (h - H * k) / 2 + 12).scale(k));
  }
  window.addEventListener('resize', fitGraph);

  // up/downstream closure
  function lineage(n) {
    const up = new Set([n]), down = new Set([n]);
    let grew = true;
    while (grew) {
      grew = false;
      links.forEach(l => {
        if (down.has(l.source) && !down.has(l.target) && l.kind !== 'shared') { down.add(l.target); grew = true; }
        if (up.has(l.target) && !up.has(l.source)) { up.add(l.source); grew = true; }
        if (l.kind === 'shared' && (up.has(l.target)) && !up.has(l.source)) { up.add(l.source); grew = true; }
      });
    }
    return new Set([...up, ...down]);
  }

  const state = { fams: new Set(Object.keys(D.families)), lang: '', lineage: false, scans: false, pinned: null };
  function visible(n) {
    if (!state.fams.has(n.family)) return false;
    if (state.lang && !n.langs.some(l => l === 'all' || l.startsWith(state.lang))) return false;
    return true;
  }
  function highlight(n) {
    const focus = n || state.pinned || (state.lineage ? nById.tcgdex : null);
    const keep = focus ? (state.lineage && !n && !state.pinned ? upstream(nById.tcgdex) : lineage(focus)) : null;
    nodeSel.classed('dim', d => !visible(d) || (keep && !keep.has(d)) || (state.scans && !d.scanOnly && d.imageNature !== 'mixed' && d.id !== 'print' && !(keep && keep.has(d))));
    linkSel.classed('dim', l => !visible(l.source) || !visible(l.target) || (keep && !(keep.has(l.source) && keep.has(l.target))) || (state.scans && l.kind !== 'scans' && !(l.source.scanOnly)))
      .classed('hl', l => !!(keep && keep.has(l.source) && keep.has(l.target) && focus && (l.source === focus || l.target === focus)));
  }
  function upstream(n) {
    const up = new Set([n]); let grew = true;
    while (grew) { grew = false; links.forEach(l => { if (up.has(l.target) && !up.has(l.source)) { up.add(l.source); grew = true; } }); }
    return up;
  }

  // chips + toggles
  const chipBox = document.getElementById('family-chips');
  chipBox.innerHTML = Object.entries(D.families).map(([k, f]) =>
    `<button class="chip" aria-pressed="true" data-f="${k}" title="${esc(f.desc)}"><span class="dot" style="background:${k === 'scan' ? 'repeating-linear-gradient(135deg,' + famColor('scan') + ' 0 3px,#0006 3px 5px)' : famColor(k)}"></span>${esc(f.label)}</button>`).join('');
  chipBox.querySelectorAll('.chip').forEach(c => c.addEventListener('click', () => {
    const on = c.getAttribute('aria-pressed') !== 'true'; c.setAttribute('aria-pressed', on);
    on ? state.fams.add(c.dataset.f) : state.fams.delete(c.dataset.f); highlight(null);
  }));
  document.getElementById('t-lineage').addEventListener('change', e => { state.lineage = e.target.checked; highlight(null); });
  document.getElementById('t-scans').addEventListener('change', e => { state.scans = e.target.checked; highlight(null); });
  const langs = [...new Set(D.sources.flatMap(s => s.langs.map(l => l.split(' ')[0])))].filter(l => l !== 'all').sort();
  const lf = document.getElementById('lang-filter');
  lf.innerHTML += langs.map(l => `<option value="${l}">${l}</option>`).join('');
  lf.addEventListener('change', () => { state.lang = lf.value; highlight(null); });

  // legend
  const sw = (dash, color) => `<svg width="34" height="8"><line x1="1" y1="4" x2="33" y2="4" stroke="${color}" stroke-width="2" ${dash ? `stroke-dasharray="${dash}"` : ''}/></svg>`;
  document.getElementById('legend').innerHTML =
    Object.entries(CONF).map(([k, c]) => `<div class="row">${sw(c.dash, css('--text'))}${c.label}</div>`).join('') +
    `<div class="row">${sw(null, famColor('official'))}from an official source</div>` +
    `<div class="row">${sw(null, famColor('scan'))}scanned / photographed from print</div>` +
    `<div class="row"><svg width="34" height="18"><circle cx="17" cy="9" r="8" fill="none" stroke="${famColor('scan')}" stroke-width="2" stroke-dasharray="3 2"/><circle cx="17" cy="9" r="5" fill="${famColor('rehost')}"/></svg>dashed violet halo = also hosts scans</div>` +
    `<div class="row"><svg width="34" height="18"><circle cx="17" cy="9" r="7" fill="url(#hatch)"/><circle cx="17" cy="9" r="4" fill="#fff"/></svg>hatched ring = scans only</div>` +
    `<div class="row"><svg width="34" height="18"><circle cx="17" cy="9" r="7" fill="${css('--warn')}"/><text x="17" y="12" font-size="7" font-weight="700" text-anchor="middle" fill="#fff">WM</text></svg>watermarked</div>` +
    `<div class="row">ring colour = type · icon = the site's own favicon/logo</div>`;

  /* ---------- detail panel ---------- */
  const panel = document.getElementById('panel');
  document.getElementById('panel-close').addEventListener('click', closePanel);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closePanel(); });
  function closePanel() {
    panel.hidden = true; state.pinned = null; highlight(null);
    const h = new URLSearchParams(location.hash.slice(1)); h.delete('s'); history.replaceState(null, '', '#' + h.toString());
  }
  const apiLabel = { open: 'Open API', dump: 'Data dump', partner: 'Partner-only API', paid: 'Paid API', none: 'No API' };
  const natureLabel = { digital: 'digital', scan: 'scan', photo: 'photo', mixed: 'digital + scans', physical: 'physical' };
  function openPanel(id) {
    const s = byId[id]; if (!s) return;
    state.pinned = nById[id]; highlight(null);
    const fam = D.families[s.family];
    const ups = D.links.filter(l => l.to === id), downs = D.links.filter(l => l.from === id);
    const rel = (arr, key) => arr.length ? `<ul class="rel">${arr.map(l => `<li><img class="ico" src="${esc(byId[l[key]].icon)}" alt=""><span class="who" data-go="${l[key]}">${esc(byId[l[key]].name)}</span><span class="conf ${l.confidence}">${l.confidence.replace('-', ' ')}</span><div class="ev">${esc(l.scope)} — ${esc(l.evidence)}</div></li>`).join('')}</ul>` : '<p class="muted">—</p>';
    const co = D.callouts.find(c => c.sources.includes(id) && (c.kind === 'warn' || c.kind === 'good'));
    const gapsHere = D.gaps.flatMap(g => g.fills.filter(f => f.source === id && f.count).map(f => ({ ...f, lang: g.lang })));
    document.getElementById('panel-body').innerHTML = `
      <span class="fam"><span class="dot" style="background:${famColor(s.family)}"></span>${esc(fam.label)}</span>
      <h2><img class="ico lg" src="${esc(s.icon)}" alt="">${esc(s.name)}</h2>
      <a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(hostOf(s.url))} ↗</a>
      <div class="badges">
        ${s.official ? '<span class="badge official">OFFICIAL POKÉMON</span>' : ''}
        ${s.scanOnly ? '<span class="badge scan">SCANS ONLY</span>' : s.imageNature === 'mixed' ? '<span class="badge">DIGITAL + SCANS</span>' : s.imageNature === 'photo' ? '<span class="badge scan">PHOTOS</span>' : ''}
        ${s.watermark ? '<span class="badge wm">WATERMARKED</span>' : ''}
        <span class="badge">${apiLabel[s.api.kind] || 'No API'}</span>
        ${s.submissions.yes ? '<span class="badge ok">TAKES SUBMISSIONS</span>' : ''}
      </div>
      ${co ? `<div class="callout-box ${co.kind === 'good' ? 'good' : ''}"><b>${esc(co.title)}.</b> ${esc(co.body)}</div>` : ''}
      <h4>Where its images come from</h4><p>${esc(s.origin)}</p>
      <h4>Facts</h4>
      <dl class="kv">
        <dt>Languages</dt><dd>${esc(s.langs.join(', '))}</dd>
        <dt>Eras</dt><dd>${esc(s.eras)}</dd>
        <dt>Images</dt><dd>${esc(natureLabel[s.imageNature] || s.imageNature)} · ${esc(s.resolution)}</dd>
        <dt>API</dt><dd>${esc(apiLabel[s.api.kind] || '—')}${s.api.note ? ' — ' + esc(s.api.note) : ''}${s.api.url ? ` · <a href="${esc(s.api.url)}" target="_blank" rel="noopener">link</a>` : ''}</dd>
        <dt>Submissions</dt><dd>${s.submissions.yes ? esc(s.submissions.how) + (s.submissions.url ? ` · <a href="${esc(s.submissions.url)}" target="_blank" rel="noopener">link</a>` : '') : 'no'}</dd>
        ${s.terms ? `<dt>Terms</dt><dd>${esc(s.terms.summary)} ${s.terms.url ? `<a href="${esc(s.terms.url)}" target="_blank" rel="noopener">read ↗</a>` : ''}</dd>` : ''}
        ${s.stats.map(x => `<dt>${esc(x.label)}</dt><dd>${esc(x.value)}</dd>`).join('')}
      </dl>
      ${gapsHere.length ? `<h4>Could fill on TCGdex</h4><ul class="rel">${gapsHere.map(f => `<li><b>${fmt(f.count)}</b> ${esc(f.lang)} <span class="perm ${f.permission}">${esc(D.permissions[f.permission].label)}</span><div class="ev">${esc(f.note)}</div></li>`).join('')}</ul>` : ''}
      <h4>Example assets (where the original lives)</h4>
      ${s.examples.length ? s.examples.map((x, i) => `
        <div class="ex">
          <div class="row"><span>${esc(x.label)} <span class="badge ${x.nature !== 'digital' ? 'scan' : ''}">${esc(x.nature.toUpperCase())}</span>${x.note ? ` <span class="badge">${esc(x.note)}</span>` : ''}</span>
          <button data-prev="${i}">preview</button></div>
          <a class="url" href="${esc(x.url)}" target="_blank" rel="noopener noreferrer">${esc(x.url)}</a>
          <div class="pv"></div>
        </div>`).join('') : '<p class="muted">No public per-image link (see the site itself).</p>'}
      <h4>Gets images from</h4>${rel(ups, 'from')}
      <h4>Images end up at</h4>${rel(downs, 'to')}
    `;
    panel.hidden = false; panel.scrollTop = 0;
    panel.querySelectorAll('[data-go]').forEach(el => el.addEventListener('click', () => openPanel(el.dataset.go)));
    panel.querySelectorAll('[data-prev]').forEach(b => b.addEventListener('click', () => {
      const x = s.examples[+b.dataset.prev], box = b.closest('.ex').querySelector('.pv');
      if (box.firstChild) { box.innerHTML = ''; b.textContent = 'preview'; return; }
      const img = new Image(); img.referrerPolicy = 'no-referrer'; img.alt = x.label; img.loading = 'lazy';
      img.onerror = () => { box.innerHTML = `<div class="err">The origin host doesn't allow embedding — open the link instead.</div>`; };
      img.src = x.url; box.appendChild(img); b.textContent = 'hide';
    }));
    const h = new URLSearchParams(location.hash.slice(1)); h.set('s', id); history.replaceState(null, '', '#' + h.toString());
  }

  /* ---------- gaps view ---------- */
  document.getElementById('perm-legend').innerHTML = Object.entries(D.permissions).map(([k, p]) => `<span class="perm ${k}" title="${esc(p.desc)}">${esc(p.label)}</span>`).join('') +
    '<span class="muted" style="font-size:12.5px">Everything still needs TCGdex\'s OK for the submission itself (its CONTRIBUTING rules).</span>';
  const permColor = { none: '--p-none', maintainer: '--p-maintainer', 'rights-holder': '--p-rights', scanner: '--p-scanner', impossible: '--p-impossible' };
  document.getElementById('gaps').innerHTML = D.gaps.map(g => {
    const tot = d3.sum(g.fills, f => f.count) || 1;
    return `<article class="gap">
      <header><h3>${esc(g.name)}<span class="code">${esc(g.lang)}</span></h3><span class="missing">missing: ${esc(g.missing)}</span></header>
      <div class="bar">${g.fills.filter(f => f.count).map(f => `<span title="${esc(byId[f.source].name)}: ${fmt(f.count)}" style="width:${f.count / tot * 100}%;background:var(${permColor[f.permission]})"></span>`).join('')}</div>
      ${g.fills.map(f => `<div class="fill">
        <div class="n">${f.count ? (f.note.startsWith('≈') ? '≈' : '') + fmt(f.count) : '—'}</div>
        <div class="meta"><img class="ico" src="${esc(byId[f.source].icon)}" alt=""><span class="src" data-go="${f.source}">${esc(byId[f.source].name)}</span>
          <span class="perm ${f.permission}">${esc(D.permissions[f.permission].label)}</span>
          ${f.nature !== 'digital' ? '<span class="badge scan">SCAN</span>' : ''}</div>
        <div class="note">${esc(f.note.replace(/^≈ ?/, ''))}</div>
      </div>`).join('')}
    </article>`;
  }).join('');
  document.querySelectorAll('#gaps [data-go]').forEach(el => el.addEventListener('click', () => openPanel(el.dataset.go)));

  /* ---------- sources table ---------- */
  const cols2 = [
    ['name', 'Source', s => `<span class="dot" style="background:${famColor(s.family)}"></span><img class="ico" src="${esc(s.icon)}" alt=""><span class="nm" data-go="${s.id}">${esc(s.name)}</span>`],
    ['family', 'Type', s => esc(D.families[s.family].label)],
    ['official', 'Official', s => s.official ? '<span class="badge official">YES</span>' : '<span class="no">no</span>'],
    ['imageNature', 'Images', s => (s.scanOnly || s.imageNature === 'photo') ? `<span class="badge scan">${s.imageNature === 'photo' ? 'PHOTOS' : 'SCANS ONLY'}</span>` : esc(natureLabel[s.imageNature] || s.imageNature)],
    ['resolution', 'Size', s => esc(s.resolution)],
    ['watermark', 'Watermark', s => s.watermark ? '<span class="badge wm">YES</span>' : '<span class="no">no</span>'],
    ['api', 'API', s => s.api.kind === 'none' ? '<span class="no">—</span>' : esc(apiLabel[s.api.kind])],
    ['submissions', 'Submissions', s => s.submissions.yes ? '<span class="yes">yes</span>' : '<span class="no">no</span>'],
    ['langs', 'Languages', s => esc(s.langs.join(', '))],
    ['url', 'Link', s => `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(hostOf(s.url))}</a>`]
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
    if (sortKey) rows = rows.slice().sort((a, b) => String(JSON.stringify(a[sortKey])).localeCompare(String(JSON.stringify(b[sortKey]))) * sortDir);
    tbl.innerHTML = `<thead><tr>${cols2.map(c => `<th data-k="${c[0]}">${c[1]}${sortKey === c[0] ? (sortDir > 0 ? ' ▲' : ' ▼') : ''}</th>`).join('')}</tr></thead>
      <tbody>${rows.map(s => `<tr>${cols2.map(c => `<td>${c[2](s)}</td>`).join('')}</tr>`).join('')}</tbody>`;
    tbl.querySelectorAll('th').forEach(th => th.addEventListener('click', () => { sortDir = sortKey === th.dataset.k ? -sortDir : 1; sortKey = th.dataset.k; renderTable(); }));
    tbl.querySelectorAll('[data-go]').forEach(el => el.addEventListener('click', () => openPanel(el.dataset.go)));
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
  if (h0.get('s')) openPanel(h0.get('s'));
  highlight(null);
})();
