(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const body = document.body;
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const ease = t => 1 - Math.pow(1 - t, 3);

  /* ================= deferred images ================= */
  let deferredDone = false;
  const loadDeferred = () => {
    if (deferredDone) return; deferredDone = true;
    $$('img[data-src]').forEach((im, i) => setTimeout(() => { im.src = im.dataset.src; im.removeAttribute('data-src'); }, i * 120));
  };
  addEventListener('load', () => setTimeout(loadDeferred, 2500));

  /* ================= OPENING: tap the ribbon -> ribbon slides away (video) -> soft circular reveal of the invitation ================= */
  const gate = $('#gate'), gvid = $('#gvid'), hero = $('#hero');
  const REVEAL_AT = 3.15, STOP_AT = 3.6;          // ribbon gone by ~3.5s; the envelope flap would start to lift at ~3.6s
  let opened = false, revealing = false, done = false;
  // feathered reveal: the invitation blooms through a very soft glow from the centre while the envelope dissolves —
  // no edge, no circle line; mask-size + opacity are animated by CSS transitions (smooth on phones).
  const irisReveal = () => {
    if (revealing) return; revealing = true;
    body.classList.add('printed', 'open'); body.classList.remove('locked'); scrollTo(0, 0); loadDeferred();
    hero.classList.add('bloom-from'); gate.classList.add('dissolve');
    hero.getBoundingClientRect();
    requestAnimationFrame(() => requestAnimationFrame(() => hero.classList.add('bloom-to')));
    const end = () => {
      if (done) return; done = true;
      hero.classList.remove('bloom-from', 'bloom-to'); gate.remove();
      try { gvid && gvid.pause(); } catch (e) {}
    };
    setTimeout(end, reduce ? 50 : 2300);
  };
  const finish = () => {
    if (opened) { irisReveal(); return; }      // a second tap skips straight to the reveal
    opened = true; gate.classList.add('playing'); window.__music && window.__music();
    if (reduce || !gvid) { irisReveal(); return; }
    const watch = () => { if (done) return; const t = gvid.currentTime;
      if (t >= REVEAL_AT) irisReveal();
      if (t >= STOP_AT) { gvid.pause(); return; }
      requestAnimationFrame(watch); };
    requestAnimationFrame(watch);
    gvid.addEventListener('error', irisReveal);
    const p = gvid.play(); if (p && p.catch) p.catch(irisReveal);
    setTimeout(irisReveal, 7000);                 // safety net
  };
  gate.addEventListener('click', finish);
  gate.addEventListener('keydown', e => { if (['Enter', ' ', 'ArrowDown'].includes(e.key)) { e.preventDefault(); finish(); } });
  let gy = null;
  gate.addEventListener('touchstart', e => { gy = e.touches[0].clientY; }, { passive: true });
  gate.addEventListener('touchmove', e => { if (gy !== null && Math.abs(e.touches[0].clientY - gy) > 30) { gy = null; finish(); } }, { passive: true });
  gate.addEventListener('wheel', e => { if (!opened && Math.abs(e.deltaY) > 4) finish(); }, { passive: true });

  /* ================= music: from the gesture that opens the scroll, slow fade in ================= */
  (() => {
    const song = $('#song'), btn = $('#musicBtn'); if (!song || !btn) return;
    let ctx = null, gain = null, started = false, off = false;
    try { off = localStorage.getItem('ssMusicOff') === '1'; } catch (e) {}
    const ramp = (v, sec) => {
      if (gain) { const t = ctx.currentTime; gain.gain.cancelScheduledValues(t); gain.gain.setValueAtTime(gain.gain.value, t); gain.gain.linearRampToValueAtTime(v, t + sec); }
      else { const t0 = performance.now(), v0 = song.volume; const st = () => { const k = Math.min(1, (performance.now() - t0) / (sec * 1000)); song.volume = v0 + (v - v0) * k; if (k < 1) requestAnimationFrame(st); }; st(); }
    };
    const graph = () => {
      if (ctx) return;
      try {
        if (navigator.audioSession) navigator.audioSession.type = 'playback';
        const AC = window.AudioContext || window.webkitAudioContext; ctx = new AC();
        const src = ctx.createMediaElementSource(song); gain = ctx.createGain(); gain.gain.value = 0; src.connect(gain); gain.connect(ctx.destination);
      } catch (e) { ctx = null; gain = null; }
    };
    const play = () => {
      graph(); if (ctx && ctx.state === 'suspended') ctx.resume();
      if (gain) gain.gain.value = 0; else song.volume = 0;
      const p = song.play(); if (p && p.then) p.then(() => { started = true; ramp(.85, 6); btn.classList.remove('off'); }).catch(() => {});
    };
    const stop = () => { ramp(0, .8); setTimeout(() => song.pause(), 850); btn.classList.add('off'); };
    window.__music = () => { if (!off) play(); else btn.classList.add('off'); };
    // if opened by wheel (no gesture), start on the next tap anywhere
    const retry = () => { if (!started && !off && body.classList.contains('open')) play(); };
    addEventListener('pointerup', retry); addEventListener('keydown', retry);
    btn.addEventListener('click', e => {
      e.stopPropagation();
      if (song.paused || btn.classList.contains('off')) { off = false; try { localStorage.removeItem('ssMusicOff'); } catch (_) {} play(); }
      else { off = true; try { localStorage.setItem('ssMusicOff', '1'); } catch (_) {} stop(); }
    });
    btn.hidden = false;
    song.addEventListener('loadedmetadata', () => { btn.hidden = false; });
    song.addEventListener('error', () => { btn.hidden = true; });
    if (song.readyState >= 1) btn.hidden = false;
  })();

  /* ================= gold dust (gate) ================= */
  $$('canvas.dust').forEach(cv => {
    const ctx = cv.getContext('2d'); const N = +cv.dataset.dust || 40; let w, h; const P = [];
    const size = () => { const d = Math.min(devicePixelRatio || 1, 2); w = cv.clientWidth; h = cv.clientHeight; cv.width = w * d; cv.height = h * d; ctx.setTransform(d, 0, 0, d, 0, 0); };
    size(); addEventListener('resize', size);
    for (let i = 0; i < N; i++) P.push({ x: Math.random(), y: Math.random(), r: Math.random() * 1.5 + .4, s: Math.random() * .0003 + .0001, p: Math.random() * 6.3 });
    const tick = t => {
      if (!cv.isConnected) return; ctx.clearRect(0, 0, w, h);
      for (const q of P) { q.y -= q.s; if (q.y < -.02) { q.y = 1.02; q.x = Math.random(); }
        ctx.beginPath(); ctx.arc(q.x * w + Math.sin(t / 2400 + q.p) * 8, q.y * h, q.r, 0, 6.3);
        ctx.fillStyle = `rgba(243,215,150,${.3 + .4 * Math.sin(t / 900 + q.p)})`; ctx.fill(); }
      if (!reduce) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });

  /* ================= petals (hero) ================= */
  const pc = $('#petals');
  if (pc && !reduce) {
    const ctx = pc.getContext('2d'); let w, h; const P = []; let vis = true;
    const size = () => { const d = Math.min(devicePixelRatio || 1, 2); w = pc.clientWidth; h = pc.clientHeight; pc.width = w * d; pc.height = h * d; ctx.setTransform(d, 0, 0, d, 0, 0); };
    size(); addEventListener('resize', size);
    const cols = ['#f29a2e', '#e8781c', '#f6c04a', '#fff6e6', '#f3e2c4'];
    const n = innerWidth < 600 ? 16 : 26;
    for (let i = 0; i < n; i++) P.push({ x: Math.random(), y: Math.random() * -1, s: .00045 + Math.random() * .0005, r: 4 + Math.random() * 5, a: Math.random() * 6.3, v: (Math.random() - .5) * .03, c: cols[i % cols.length], sw: Math.random() * 6.3 });
    new IntersectionObserver(([e]) => vis = e.isIntersecting).observe(pc);
    const tick = t => {
      if (vis && body.classList.contains('open')) {
        ctx.clearRect(0, 0, w, h);
        for (const q of P) {
          q.y += q.s; q.a += q.v; if (q.y > 1.05) { q.y = -.05; q.x = Math.random(); }
          const x = q.x * w + Math.sin(t / 1600 + q.sw) * 24, y = q.y * h;
          ctx.save(); ctx.translate(x, y); ctx.rotate(q.a); ctx.globalAlpha = .85;
          ctx.fillStyle = q.c; ctx.beginPath(); ctx.ellipse(0, 0, q.r, q.r * .55, 0, 0, 6.3); ctx.fill(); ctx.restore();
        }
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  /* ================= scroll cue / reveal ================= */
  $$('[data-scroll]').forEach(b => b.addEventListener('click', () => $(b.dataset.scroll).scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' })));
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: .15, rootMargin: '0px 0px -6% 0px' });
  $$('.reveal').forEach(el => io.observe(el));

  /* ================= "Our Two Celebrations": keep the painting's lighthouse clear of the cards on wide screens ================= */
  (() => {
    const sec = $('#journey.cities'), art = sec && $('.ct-art', sec), pair = sec && $('.ct-pair', sec); if (!sec) return;
    const fit = () => {
      if (innerWidth / innerHeight < .8) { sec.style.minHeight = ''; art.style.top = ''; return; }
      const W = sec.clientWidth, cardsBottom = pair.getBoundingClientRect().bottom - sec.getBoundingClientRect().top;
      const LM = .448;                                         // top of the tallest landmark (Kailasagiri statue)
      const want = cardsBottom + 64;                          // ...sits 64px under the cards
      const artH = 1920 * (W / 1080);
      const secH = Math.max(innerHeight, Math.round(want + (.93 - LM) * artH));      // show down to the palms
      sec.style.minHeight = secH + 'px';
      const off = Math.min(Math.max(LM * artH - want, 0), artH - secH);
      art.style.top = (-off) + 'px';
    };
    const waves = $('.waves', sec);
    const lh = () => waves && waves.style.setProperty('--lh', waves.getBoundingClientRect().height.toFixed(2) + 'px');
    addEventListener('resize', lh); addEventListener('load', lh); lh();
    addEventListener('resize', fit); addEventListener('load', fit); document.fonts && document.fonts.ready.then(fit); fit();
    const vid = $('video.ct-bg', sec);
    if (vid && !reduce) {
      vid.muted = true;
      new IntersectionObserver(es => es.forEach(e => {
        if (e.isIntersecting) { if (vid.preload !== 'auto') vid.preload = 'auto'; const p = vid.play(); p && p.catch && p.catch(() => {}); }
        else vid.pause();
      }), { rootMargin: '200px 0px' }).observe(sec);
    }
  })();

  /* ================= continuous scroll flow: florals at every section join, hanging garlands, drifting petals ================= */
  (() => {
    if (reduce) return;
    const layer = document.createElement('div'); layer.className = 'flow'; layer.setAttribute('aria-hidden', 'true');
    document.body.appendChild(layer);
    const joins = ['#events'].map(q => $(q)).filter(Boolean);   // one floral moment only (client: repetitive)
    const items = [];
    joins.forEach((sec, n) => {
      ['l', 'r'].forEach(side => {
        const im = document.createElement('img'); im.src = side === 'l' ? 'assets/img/sprig.webp' : 'assets/img/sprig-r.webp'; im.alt = ''; im.loading = 'lazy';
        im.className = 'fl-sprig ' + side; layer.appendChild(im);
        items.push({ el: im, sec, side, kind: 'sprig', n });
      });
    });
    const ev = $('#events');
    if (ev) ['l', 'r'].forEach(side => {
      const g = document.createElement('img'); g.src = 'assets/img/garland.webp'; g.alt = ''; g.loading = 'lazy';
      g.className = 'fl-garland ' + side; layer.appendChild(g); items.push({ el: g, sec: ev, side, kind: 'garland' });
    });
    const place = () => {
      const docTop = scrollY;
      layer.style.height = document.documentElement.scrollHeight + 'px';
      items.forEach(it => { it.top = it.sec.getBoundingClientRect().top + docTop; it.el.style.top = it.top + 'px'; });
    };
    let tk = false;
    const run = () => {
      tk = false; const vh = innerHeight, y = scrollY;
      items.forEach(it => {
        const rel = it.top - y;                                   // join position in the viewport
        const p = Math.max(0, Math.min(1, (vh - rel) / (vh * .7)));   // 0 = join just below screen, 1 = well inside
        const e = 1 - Math.pow(1 - p, 3), dir = it.side === 'l' ? -1 : 1;
        if (it.kind === 'sprig') {
          it.el.style.translate = `${(1 - e) * dir * 60}% ${(1 - e) * 30}px`;
          it.el.style.rotate = `${(1 - e) * dir * 14 + (rel / vh) * dir * -4}deg`;
          it.el.style.opacity = (0.15 + .85 * e).toFixed(3);
        } else {
          it.el.style.translate = `0 ${(-(1 - e) * 55).toFixed(1)}%`;
          it.el.style.opacity = e.toFixed(3);
        }
      });
    };
    const kick = () => { if (!tk) { tk = true; requestAnimationFrame(run); } };
    addEventListener('scroll', kick, { passive: true });
    addEventListener('resize', () => { place(); run(); });
    addEventListener('load', () => { place(); run(); });
    new ResizeObserver(() => { place(); run(); }).observe(document.body);
    place(); run();

    // the sacred turmeric thread: one continuous line that draws itself down the page as you scroll,
    // running down a margin through each section and crossing sides at every section join
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg'); svg.setAttribute('class', 'fl-thread');
    const glow = document.createElementNS(NS, 'path'), line = document.createElementNS(NS, 'path'), bead = document.createElementNS(NS, 'circle');
    glow.setAttribute('class', 'th-glow'); line.setAttribute('class', 'th-line'); bead.setAttribute('class', 'th-bead'); bead.setAttribute('r', '3.2');
    svg.append(glow, line, bead); layer.prepend(svg);
    let TL = 0, lut = [];
    const buildThread = () => {
      const W = document.documentElement.clientWidth, docTop = scrollY;
      const m = Math.max(8, Math.min(46, W * .025)), xs = [m, W - m];
      const ys = joins.map(sec => sec.getBoundingClientRect().top + docTop);
      const end = (document.querySelector('.signoff') || joins[joins.length - 1]).getBoundingClientRect().bottom + docTop - 40;
      const band = Math.min(160, W * .3);
      let side = 0, d = `M ${xs[side]} ${ys[0] - 60}`;
      for (let i = 0; i < ys.length; i++) {
        const next = i + 1 < ys.length ? ys[i + 1] : end;
        if (i + 1 < ys.length) {
          const a = next - band, b = next + band / 2, ns = 1 - side;
          d += ` L ${xs[side]} ${a} C ${xs[side]} ${next}, ${xs[ns]} ${next - band * .2}, ${xs[ns]} ${b}`;
          side = ns;
        } else d += ` L ${xs[side]} ${next}`;
      }
      svg.setAttribute('width', W); svg.setAttribute('height', document.documentElement.scrollHeight);
      glow.setAttribute('d', d); line.setAttribute('d', d);
      TL = line.getTotalLength(); lut = [];
      for (let l = 0; l <= TL; l += 24) lut.push([line.getPointAtLength(l).y, l]);
      line.style.strokeDasharray = glow.style.strokeDasharray = TL + ' ' + TL;
    };
    const drawThread = () => {
      if (!TL) return;
      const yTip = scrollY + innerHeight * .78;
      let l = 0; for (const [y, ll] of lut) { if (y <= yTip) l = ll; else break; }
      line.style.strokeDashoffset = glow.style.strokeDashoffset = (TL - l).toFixed(1);
      const pt = line.getPointAtLength(l); bead.setAttribute('cx', pt.x); bead.setAttribute('cy', pt.y);
      bead.style.opacity = l > 2 && l < TL - 2 ? 1 : 0;
    };
    const rebuild = () => { buildThread(); drawThread(); };
    addEventListener('scroll', () => requestAnimationFrame(drawThread), { passive: true });
    addEventListener('resize', rebuild); addEventListener('load', rebuild);
    new ResizeObserver(rebuild).observe(document.body);
    document.fonts && document.fonts.ready.then(rebuild);
    rebuild();

    // drifting petals across the page (very sparse, behind content edges)
    const cv = document.createElement('canvas'); cv.className = 'fl-petals'; document.body.appendChild(cv);
    const ctx = cv.getContext('2d'); let W = 0, H = 0, dpr = Math.min(2, devicePixelRatio || 1);
    const size = () => { W = innerWidth; H = innerHeight; cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + 'px'; cv.style.height = H + 'px'; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); };
    size(); addEventListener('resize', size);
    const cols = ['#f2a33a', '#e8862a', '#f6c453', '#c8323a', '#fff3e0'];
    const P = Array.from({ length: 10 }, (_, i) => ({ x: Math.random() * W, y: Math.random() * H, r: 4 + Math.random() * 4, vy: .25 + Math.random() * .35, a: Math.random() * 6.28, va: (Math.random() - .5) * .02, sw: Math.random() * 6.28, c: cols[i % cols.length] }));
    let last = 0, lastY = scrollY;
    const tick = t => {
      requestAnimationFrame(tick);
      if (!body.classList.contains('open') || document.hidden) return;
      if (t - last < 33) return; last = t;            // ~30fps is plenty for drifting petals
      const dy = scrollY - lastY; lastY = scrollY;
      ctx.clearRect(0, 0, W, H);
      P.forEach(p => {
        p.sw += .02; p.a += p.va; p.y += p.vy - dy * .15; p.x += Math.sin(p.sw) * .35;
        if (p.y > H + 20) { p.y = -20; p.x = Math.random() * W; } if (p.y < -30) { p.y = H + 10; }
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a); ctx.globalAlpha = .55; ctx.fillStyle = p.c;
        ctx.beginPath(); ctx.ellipse(0, 0, p.r, p.r * .55, 0, 0, 6.283); ctx.fill(); ctx.restore();
      });
    };
    requestAnimationFrame(tick);
  })();

  /* ================= subtle parallax while scrolling ================= */
  (() => {
    if (reduce) return;
    const mark = (sel, f) => $$(sel).forEach(el => el.dataset.par = f);
    mark('.ev-art .arch img', .07);       // paintings float gently inside their arches
    // headings stay put (their drift brought them too close to the line above)
    mark('.so-mono, .count .medal, .count .cd-medal', -.06);
    const els = $$('[data-par]'), hero = $('.hero-inner');
    let tk = false;
    const run = () => {
      tk = false; const vh = innerHeight;
      if (body.classList.contains('open') && hero) {
        const y = Math.max(0, scrollY);
        if (y < vh * 1.2) { hero.style.translate = `0 ${(-y * .12).toFixed(1)}px`; hero.style.opacity = Math.max(0, 1 - y / (vh * .7)).toFixed(3); }
        const cue = $('.scroll-cue'); if (cue) cue.style.opacity = Math.max(0, 1 - y / 90).toFixed(3);
      }
      els.forEach(el => {
        const r = el.getBoundingClientRect(); if (r.bottom < -100 || r.top > vh + 100) return;
        const off = (r.top + r.height / 2 - vh / 2) * -(+el.dataset.par);
        el.style.translate = `0 ${off.toFixed(1)}px`;
      });
    };
    addEventListener('scroll', () => { if (!tk) { tk = true; requestAnimationFrame(run); } }, { passive: true });
    addEventListener('resize', run); run();
  })();

  /* ================= THE JOURNEY: scroll down the painted map, Warangal -> Vizag ================= */
  (() => {
    const vm = $('#vm'), world = $('#vmWorld'); if (!vm) return;
    const trail = $('#vmTrail'), plane = $('#vPlane'), pW = $('#vpW'), pV = $('#vpV');
    const IW = 1152, IH = 2048, FX = 585;   // FX = map x kept centred on narrow screens
    const L = trail.getTotalLength();
    let sc = 1, ox = 0, ticking = false;
    const place = el => { el.style.left = (+el.dataset.x * sc + ox) + 'px'; el.style.top = (+el.dataset.y * sc) + 'px'; };
    const layout = () => {
      const fw = vm.clientWidth;
      let h = Math.max(innerHeight * 1.7, 900), w = h * IW / IH;
      if (w < fw) { w = fw; h = w * IH / IW; }
      sc = w / IW; ox = 0;
      vm.style.height = h + 'px';
      world.style.width = w + 'px'; world.style.height = h + 'px';
      const left = Math.min(0, Math.max(fw - w, fw / 2 - FX * sc));
      world.style.left = left + 'px';
      vm.style.setProperty('--s', Math.min(1.25, Math.max(.85, fw / 420)).toFixed(3));
      $$('.vpin,.vcard,.vlm', world).forEach(place);
      // cards sit beside the route, on whichever side has more room, never on top of it
      const pathX = y => { let lo = 0, hi = L; for (let i = 0; i < 18; i++) { const m = (lo + hi) / 2; if (trail.getPointAtLength(m).y < y) lo = m; else hi = m; } return trail.getPointAtLength(lo).x; };
      const gs = +getComputedStyle(vm).getPropertyValue('--s') || 1;
      $$('.vcard', world).forEach(c => {
        const y = +c.dataset.y, cw = c.offsetWidth, gap = 32 * gs;
        const px = pathX(y) * sc + left, roomL = px - 12, roomR = fw - 12 - px;
        let x = roomR >= roomL ? px + gap : px - gap - cw;
        x = Math.max(12, Math.min(fw - cw - 12, x));
        c.style.left = (x - left) + 'px';
      });
      update();
    };
    const update = () => {
      ticking = false;
      const r = vm.getBoundingClientRect(), vh = innerHeight;
      const yW = 362 * sc, yV = 1690 * sc;
      // the plane rides at 55% of the viewport height while you scroll down the map
      const yIn = vh * .55 - r.top;
      const p = clamp((yIn - yW) / (yV - yW));
      // find the length along the curve whose y matches (curve is monotonic in y)
      let lo = 0, hi = L;
      const target = 362 + p * (1690 - 362);
      for (let i = 0; i < 18; i++) { const m = (lo + hi) / 2; if (trail.getPointAtLength(m).y < target) lo = m; else hi = m; }
      const len = p >= 1 ? L : lo, q = trail.getPointAtLength(len), q2 = trail.getPointAtLength(Math.min(L, len + 4)), q0 = trail.getPointAtLength(Math.max(0, len - 4));
      trail.style.opacity = len > 2 ? 1 : 0;
      revealMask(len);
      const ang = Math.atan2(q2.y - q0.y, q2.x - q0.x) * 57.2958;
      const fly = p > 0 && p < 1, lift = fly ? Math.sin(Math.PI * p) : 0;
      plane.style.left = (q.x * sc) + 'px'; plane.style.top = (q.y * sc) + 'px';
      plane.style.transform = `translate(-50%,-50%) rotate(${ang}deg) scale(${.85 + lift * .35})`;
      plane.style.filter = `drop-shadow(${5 + lift * 14}px ${6 + lift * 16}px ${3 + lift * 4}px rgba(40,15,0,${.45 - lift * .2}))`;
      if (r.top < vh * .7) pW.classList.add('drop');
      pV.classList.toggle('drop', p >= .985);
      $$('.vcard,.vlm', world).forEach(c => c.classList.toggle('in', c.getBoundingClientRect().top < vh * .85));
    };
    // dashed trail revealed up to `len` with a mask path (dash + reveal can't share one dasharray)
    const svg = $('.vm-svg'), NS = 'http://www.w3.org/2000/svg';
    const defs = document.createElementNS(NS, 'defs'), mask = document.createElementNS(NS, 'mask'), mp = document.createElementNS(NS, 'path');
    mask.setAttribute('id', 'vmMask'); mask.setAttribute('maskUnits', 'userSpaceOnUse'); mask.setAttribute('x', 0); mask.setAttribute('y', 0); mask.setAttribute('width', IW); mask.setAttribute('height', IH);
    mp.setAttribute('d', 'M630 362 C860 760 330 1240 535 1690'); mp.setAttribute('fill', 'none'); mp.setAttribute('stroke', '#fff'); mp.setAttribute('stroke-width', '40');
    mp.style.strokeDasharray = `${L} ${L}`;
    mask.appendChild(mp); defs.appendChild(mask); svg.insertBefore(defs, svg.firstChild);
    trail.setAttribute('mask', 'url(#vmMask)');
    const revealMask = len => { mp.style.strokeDashoffset = (L - len); };
    const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
    addEventListener('scroll', onScroll, { passive: true });
    addEventListener('resize', layout); addEventListener('load', layout);
    document.fonts && document.fonts.ready.then(layout);
    layout();
  })();

  /* ================= calendar + maps buttons ================= */
  const ua = navigator.userAgent, apple = /iPhone|iPad|iPod|Macintosh/.test(ua) && !/Android/.test(ua);
  const icoCal = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>';
  const icoPin = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>';
  $$('.ev-copy[data-cal]').forEach(c => {
    const box = $('.ev-actions', c), d = c.dataset;
    const cal = document.createElement('a'); cal.className = 'ev-btn'; cal.innerHTML = icoCal + 'Add to Calendar';
    if (apple) { cal.href = `assets/cal/${d.cal}.ics`; cal.setAttribute('download', `sai-sushmitha-${d.cal}.ics`); }
    else {
      const dates = d.allday ? d.allday : `${d.start}/${d.end}`;
      cal.href = 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + encodeURIComponent(d.title) + '&dates=' + dates + '&location=' + encodeURIComponent(d.loc) + '&details=' + encodeURIComponent('With love, the Vadnala family') + '&ctz=Asia/Kolkata';
      cal.target = '_blank'; cal.rel = 'noopener';
    }
    box.appendChild(cal);
    if (d.maps) {
      const m = document.createElement('a'); m.className = 'ev-btn'; m.innerHTML = icoPin + 'Location';
      m.href = apple ? 'https://maps.apple.com/?q=' + encodeURIComponent(d.maps) : 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(d.maps);
      m.target = '_blank'; m.rel = 'noopener'; box.appendChild(m);
    }
  });

  /* ================= countdown ================= */
  const target = new Date('2026-12-13T20:21:00+05:30').getTime();
  const cells = Object.fromEntries($$('#cd [data-u]').map(b => [b.dataset.u, b]));
  const pad2 = n => String(n).padStart(2, '0');
  const cd = () => {
    let s = Math.max(0, Math.floor((target - Date.now()) / 1000));
    const d = Math.floor(s / 86400); s %= 86400; const h = Math.floor(s / 3600); s %= 3600; const m = Math.floor(s / 60); s %= 60;
    cells.d.textContent = pad2(d); cells.h.textContent = pad2(h); cells.m.textContent = pad2(m); cells.s.textContent = pad2(s);
  };
  cd(); setInterval(cd, 1000);
})();
