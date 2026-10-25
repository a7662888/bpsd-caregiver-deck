(() => {
  const slides = [...document.querySelectorAll('.slide')];
  const stage = document.getElementById('stage');
  const voice = document.getElementById('voice');
  const bgm = document.getElementById('bgm');
  const sub = document.getElementById('sub');
  const chap = document.getElementById('chap');
  const num = document.getElementById('num');
  const sq = document.getElementById('sq');
  const bPlay = document.getElementById('bPlay');
  const bSub = document.getElementById('bSub');
  const bBgm = document.getElementById('bBgm');
  const BEATS = window.BEATS || [];

  let cur = 0, step = 0, playing = false, beatIdx = -1, subOn = true, bgmOn = true, subTimer = null;
  const pad = n => String(n).padStart(2, '0');

  // ---- stage scale ----
  const fit = () => {
    const s = Math.min(innerWidth / 1920, innerHeight / 1080);
    stage.style.transform = `scale(${s})`;
  };
  addEventListener('resize', fit); fit();

  // ---- scenario progress squares (signature detail) ----
  for (let i = 0; i < 6; i++) sq.appendChild(document.createElement('i'));

  const maxStep = el => +el.dataset.steps || 0;

  function render() {
    slides.forEach((s, i) => s.classList.toggle('active', i === cur));
    const s = slides[cur];
    s.querySelectorAll('[data-s]').forEach(el => el.classList.toggle('on', step >= +el.dataset.s));
    s.querySelectorAll('.opt').forEach(o => {
      if (step >= +o.dataset.reveal) o.classList.add('shown');
      else if (!o.dataset.clicked) o.classList.remove('shown');
    });
    s.querySelectorAll('.j-hl').forEach(el => el.classList.toggle('hl', step >= 2));
    chap.textContent = s.dataset.chap;
    num.textContent = `${pad(cur + 1)} / ${pad(slides.length)}`;
    const scn = +(s.dataset.scn || 0);
    [...sq.children].forEach((q, i) => {
      q.className = '';
      if (scn && i + 1 === scn) q.className = step >= 4 ? 'done' : 'now';
      else if (cur > 9 || (scn && i + 1 < scn)) q.className = 'done';
    });
    if (location.hash !== `#${cur + 1}`) history.replaceState(null, '', `#${cur + 1}`);
  }

  function go(i, st = 0) {
    cur = Math.max(0, Math.min(slides.length - 1, i));
    step = st;
    slides[cur].querySelectorAll('.opt').forEach(o => { delete o.dataset.clicked; o.classList.remove('shown'); });
    render();
  }

  function next() {
    if (step < maxStep(slides[cur])) { step++; render(); }
    else if (cur < slides.length - 1) go(cur + 1, 1);
  }
  function prev() {
    if (step > 1) { step--; render(); }
    else if (cur > 0) go(cur - 1, maxStep(slides[cur - 1]));
  }

  // ---- subtitles: split a beat into short lines, timed by character share ----
  function chunks(text) {
    const parts = text.split(/(?<=[。！？；])/).flatMap(p => {
      if (p.length <= 26) return [p];
      const out = []; let buf = '';
      p.split(/(?<=[，、：])/).forEach(seg => {
        if ((buf + seg).length > 26 && buf) { out.push(buf); buf = seg; } else buf += seg;
      });
      if (buf) out.push(buf);
      return out;
    }).map(t => t.trim()).filter(Boolean);
    return parts;
  }
  function showSubs(beat) {
    clearInterval(subTimer);
    const lines = chunks(beat.text);
    const total = lines.reduce((a, l) => a + l.length, 0);
    let acc = 0;
    const marks = lines.map(l => { const t = acc / total; acc += l.length; return t; });
    const tick = () => {
      const p = voice.duration ? voice.currentTime / voice.duration : 0;
      let k = 0; marks.forEach((m, i) => { if (p >= m) k = i; });
      sub.textContent = lines[k].replace(/[，。、；：]$/, '');
    };
    tick();
    sub.classList.toggle('on', subOn);
    subTimer = setInterval(tick, 120);
  }
  function hideSubs() { clearInterval(subTimer); sub.classList.remove('on'); }

  // ---- narration engine ----
  function duck(on) { bgm.volume = on ? 0.55 : 1.0; }
  function playBeat(i) {
    if (i >= BEATS.length) { stop(); return; }
    beatIdx = i;
    const b = BEATS[i];
    if (b.slide - 1 !== cur) go(b.slide - 1, b.step); else { step = b.step; render(); }
    voice.src = b.src;
    voice.play().catch(() => stop());
    showSubs(b);
    duck(true);
  }
  voice.addEventListener('ended', () => {
    hideSubs(); duck(false);
    if (!playing) return;
    const nextB = BEATS[beatIdx + 1];
    const gap = nextB && nextB.slide !== BEATS[beatIdx].slide ? 1100 : 450;
    setTimeout(() => { if (playing) playBeat(beatIdx + 1); }, gap);
  });
  function start() {
    playing = true; bPlay.setAttribute('aria-pressed', 'true'); bPlay.textContent = '⏸ 暫停';
    if (bgmOn) bgm.play().catch(() => {});
    // paused mid-beat on the same step: resume that clip
    const b0 = BEATS[beatIdx];
    if (b0 && voice.currentTime > 0 && !voice.ended && b0.slide - 1 === cur && b0.step === step) {
      voice.play(); showSubs(b0); duck(true); return;
    }
    // otherwise start from the beat that narrates the step on screen
    let i = BEATS.findIndex(b => b.slide - 1 === cur && b.step >= Math.max(step, 1));
    if (i < 0) i = BEATS.findIndex(b => b.slide - 1 > cur);
    playBeat(i < 0 ? 0 : i);
  }
  function stop() {
    playing = false; voice.pause(); hideSubs(); bgm.pause();
    bPlay.setAttribute('aria-pressed', 'false'); bPlay.textContent = '▶ 播放解說';
  }
  const toggle = () => (playing ? stop() : start());
  const manual = fn => () => { if (playing) stop(); fn(); };

  // ---- quiz mode: click an option to reveal its verdict ----
  document.querySelectorAll('.opt').forEach(o => o.addEventListener('click', () => {
    if (playing) stop();
    o.dataset.clicked = '1'; o.classList.add('shown');
    const s = slides[cur];
    if ([...s.querySelectorAll('.opt')].every(x => x.classList.contains('shown'))) { step = Math.max(step, 4); render(); }
  }));

  // ---- controls ----
  // drop focus after a click so the toolbar fades back instead of covering the subtitles
  document.querySelectorAll('#ctl button').forEach(b => b.addEventListener('mouseup', () => b.blur()));
  document.getElementById('bPrev').onclick = manual(prev);
  document.getElementById('bNext').onclick = manual(next);
  bPlay.onclick = toggle;
  bSub.onclick = () => { subOn = !subOn; bSub.setAttribute('aria-pressed', subOn); if (!subOn) sub.classList.remove('on'); else if (playing) sub.classList.add('on'); };
  bBgm.onclick = () => { bgmOn = !bgmOn; bBgm.setAttribute('aria-pressed', bgmOn); if (!bgmOn) bgm.pause(); else if (playing) bgm.play(); };
  addEventListener('keydown', e => {
    if (e.target.closest && e.target.closest('#start')) return;
    switch (e.key) {
      case 'ArrowRight': case 'PageDown': e.preventDefault(); manual(next)(); break;
      case 'ArrowLeft': case 'PageUp': e.preventDefault(); manual(prev)(); break;
      case ' ': e.preventDefault(); toggle(); break;
      case 's': case 'S': bSub.click(); break;
      case 'm': case 'M': bBgm.click(); break;
      case 'Home': manual(() => go(0, 1))(); break;
      case 'End': manual(() => go(slides.length - 1, maxStep(slides.at(-1))))(); break;
    }
  });
  const startBox = document.getElementById('start');
  document.getElementById('goPlay').onclick = () => { startBox.classList.add('hide'); go(cur, 0); start(); };
  document.getElementById('goSelf').onclick = () => { startBox.classList.add('hide'); go(cur, 1); };

  // ---- deep link / QA hooks ----
  const params = new URLSearchParams(location.search);
  const h = parseInt(location.hash.slice(1), 10);
  go(Number.isFinite(h) ? h - 1 : 0, 1);
  if (params.has('all')) {
    // QA view: every slide at its final state, so audits and screenshots see all content
    startBox.classList.add('hide');
    document.querySelectorAll('[data-s]').forEach(el => el.classList.add('on'));
    document.querySelectorAll('.opt').forEach(o => { o.dataset.clicked = '1'; o.classList.add('shown'); });
    document.querySelectorAll('.j-hl').forEach(el => el.classList.add('hl'));
    go(cur, maxStep(slides[cur]));
    addEventListener('hashchange', () => go(parseInt(location.hash.slice(1), 10) - 1, maxStep(slides[parseInt(location.hash.slice(1), 10) - 1])));
  }
  if (params.has('nostart')) startBox.classList.add('hide');
  window.__deck = { go, slides, maxStep, get step() { return step; } };
})();
