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

  /* ================= OPENING: tap the ribbon -> envelope video -> invitation ================= */
  const gate = $('#gate'), gvid = $('#gvid');
  let opened = false, revealed = false;
  const inner = $('.hero-inner');
  // the names are printed on the card: they ride in with the card in the film, then simply stay
  const ride = k => {
    body.classList.add('film', 'printed');
    const e = 1 - Math.pow(1 - k, 3);
    inner.style.opacity = Math.min(1, Math.max(0, (k - .22) / .35)).toFixed(3);
    // on portrait screens keep the text inside the card while it widens out of the envelope
    if (innerWidth / innerHeight < .75) { const x = Math.max(0, Math.min(1, 1 - (k - .3) / .55)) * 31; inner.style.clipPath = x > 0 ? `inset(0 ${x.toFixed(2)}% 0 ${x.toFixed(2)}%)` : 'none'; }
    inner.style.transform = `translateY(${(1 - e) * 14}vh) scale(${(.62 + .38 * e).toFixed(4)})`;
  };
  const reveal = () => {
    if (revealed) return; revealed = true;
    body.classList.add('printed'); inner.style.opacity = 1; inner.style.transform = 'none'; inner.style.clipPath = 'none';
    gate.classList.add('done'); body.classList.add('open'); body.classList.remove('locked');
    scrollTo(0, 0); setTimeout(() => { gate.remove(); body.classList.remove('film'); }, 700); loadDeferred();
  };
  const finish = () => {
    if (opened) { reveal(); return; }          // second tap skips the rest of the video
    opened = true; gate.classList.add('playing'); window.__music && window.__music();
    if (reduce || !gvid) { reveal(); return; }
    // watch every frame: the last ~1.2s of the film is the still hero background, so hand off the moment it settles
    const watch = () => { if (revealed) return; const d = gvid.duration, t = gvid.currentTime;
      if (d) { if (t > d - 2.6) ride(Math.min(1, (t - (d - 2.6)) / 1.35)); if (t > d - 2) gate.classList.add('ending'); if (t > d - 1.05) { reveal(); return; } }
      requestAnimationFrame(watch); };
    requestAnimationFrame(watch);
    gvid.addEventListener('ended', reveal);
    gvid.addEventListener('error', reveal);
    const p = gvid.play(); if (p && p.catch) p.catch(reveal);
    setTimeout(reveal, 11000);                    // safety net
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
