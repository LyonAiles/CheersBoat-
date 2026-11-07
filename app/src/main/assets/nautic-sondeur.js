(() => {
  const map = document.getElementById('mapWrap');
  if (!map) return;

  const toggle = document.createElement('button');
  toggle.id = 'sondeurToggle';
  toggle.type = 'button';
  toggle.textContent = 'Sondeur';
  toggle.setAttribute('aria-expanded', 'false');
  map.append(toggle);

  const panel = document.createElement('section');
  panel.id = 'nauticSondeur';
  panel.hidden = true;
  panel.setAttribute('aria-label', 'Sondeur');
  panel.innerHTML = `
    <div class="sondeur-tools">
      <strong id="sondeurTitle">Sondeur · simulation</strong>
      <button type="button" id="sondeurPlay">Démarrer</button>
      <button type="button" id="sondeurOptions" aria-label="Réglages du sondeur" aria-expanded="false">⚙</button>
      <button type="button" id="sondeurClose" aria-label="Fermer le sondeur">×</button>
    </div>
    <div class="sondeur-settings" id="sondeurSettings" hidden>
      <label>Transparence <input id="sondeurAlpha" type="range" min="0" max="90"><output id="sondeurAlphaValue"></output></label>
      <label>Profondeur max. <input id="sondeurMax" type="number" min="0.5" max="30" step="0.1"> m</label>
      <label>Seuil d’alerte <input id="sondeurAlert" type="number" min="0.1" max="30" step="0.01"> m</label>
      <label>Largeur <input id="sondeurWidth" type="range" min="2" max="24"><output id="sondeurWidthValue"></output></label>
    </div>
    <div class="sondeur-plot">
      <div class="sondeur-picture"></div>
      <div class="sondeur-scale">
        <div class="sondeur-bars" aria-hidden="true"></div>
        <svg class="sondeur-hull" viewBox="0 0 430 135" role="img" aria-label="Coupe schématique de coque, largeur 4,30 m, tirant d’eau 1,35 m">
          <path d="M0 0H430C427 48 406 88 366 110Q328 129 244 130L237 135H193L186 130Q102 129 64 110C24 88 3 48 0 0Z"/>
        </svg>
      </div>
      <output class="sondeur-reading">— m</output>
    </div>`;
  map.append(panel);

  const get = id => panel.querySelector('#' + id);
  const bars = panel.querySelector('.sondeur-bars');
  const picture = panel.querySelector('.sondeur-picture');
  const reading = panel.querySelector('.sondeur-reading');
  const wave = (mean, amplitude) => Array.from({length: 100}, (_, i) =>
    Math.round((mean + amplitude * Math.sin(i * Math.PI / 50)) * 100) / 100);
  const samples = [...wave(2.30, 0.80), ...wave(1.55, 0.20)];
  const plot = panel.querySelector('.sondeur-plot');
  const scale = panel.querySelector('.sondeur-scale');
  const hull = panel.querySelector('.sondeur-hull');
  const settingsKey = 'nautic-sondeur-settings';
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(settingsKey)) || {}; } catch (_) {}
  const clamp = (value, min, max, fallback) => Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
  const inputs = {
    alpha: get('sondeurAlpha'),
    max: get('sondeurMax'),
    alert: get('sondeurAlert'),
    width: get('sondeurWidth')
  };
  let settings = {
    alpha: clamp(saved.alpha, 0, 90, 25),
    max: clamp(saved.max, 0.5, 30, 3),
    alert: clamp(saved.alert, 0.1, 30, 1.45),
    width: clamp(saved.width, 2, 24, 5)
  };
  for (const [key, input] of Object.entries(inputs)) input.value = settings[key];

  const history = [];
  let next = 0;
  let timer = null;
  const format = new Intl.NumberFormat('fr-FR', {minimumFractionDigits: 2, maximumFractionDigits: 2});

  let audio = null;
  let lastPing = -Infinity;

  function enableAudio() {
    try {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) return;
      audio ||= new Audio();
      if (audio.state === 'suspended') audio.resume().catch(() => {});
    } catch (_) {}
  }

  function ping(depth) {
    if (panel.hidden || document.hidden || depth > settings.alert ||
        !audio || audio.state !== 'running' || audio.currentTime - lastPing < 2) return;
    const now = audio.currentTime;
    lastPing = now;
    const tone = audio.createOscillator();
    const volume = audio.createGain();
    tone.frequency.setValueAtTime(970, now);
    tone.frequency.exponentialRampToValueAtTime(720, now + 0.18);
    volume.gain.setValueAtTime(0.001, now);
    volume.gain.exponentialRampToValueAtTime(0.18, now + 0.025);
    volume.gain.exponentialRampToValueAtTime(0.001, now + 0.65);
    tone.connect(volume);
    volume.connect(audio.destination);
    tone.start(now);
    tone.stop(now + 0.7);
    tone.onended = () => { tone.disconnect(); volume.disconnect(); };
  }

  function fitHull() {
    const pixelsPerMetre = Math.min(plot.clientHeight / settings.max, plot.clientWidth * 0.84 / 4.30);
    scale.style.height = (pixelsPerMetre * settings.max) + 'px';
    hull.style.width = (pixelsPerMetre * 4.30) + 'px';
  }
  if (window.ResizeObserver) new ResizeObserver(fitHull).observe(plot);

  function draw() {
    fitHull();
    picture.style.opacity = bars.style.opacity = String(1 - settings.alpha / 100);
    get('sondeurAlphaValue').textContent = settings.alpha + ' %';
    get('sondeurWidthValue').textContent = settings.width + ' px';
    const columns = history.map(depth => {
      const bar = document.createElement('span');
      if (depth <= settings.alert) bar.className = 'shallow';
      bar.style.height = (Math.max(0, settings.max - depth) / settings.max * 100) + '%';
      bar.style.width = settings.width + 'px';
      return bar;
    });
    bars.replaceChildren(...columns);
    reading.textContent = history.length ? format.format(history.at(-1)) + ' m' : '— m';
  }

  function append(depth) {
    if (!Number.isFinite(depth) || depth < 0) return false;
    history.push(depth);
    if (history.length > samples.length) history.shift();
    if (!panel.hidden) draw();
    ping(depth);
    return true;
  }

  function stop() {
    if (timer !== null) clearInterval(timer);
    timer = null;
    get('sondeurPlay').textContent = next === samples.length ? 'Rejouer' : next ? 'Reprendre' : 'Démarrer';
  }

  function play() {
    if (timer !== null) { stop(); return; }
    enableAudio();
    if (next === samples.length || get('sondeurTitle').dataset.live) {
      next = 0;
      history.length = 0;
    }
    delete get('sondeurTitle').dataset.live;
    get('sondeurTitle').textContent = 'Sondeur · simulation';
    const tick = () => {
      if (window.nauticMapInteracting || window.nauticQuietMode || document.hidden) return;
      append(samples[next++]);
      if (next === samples.length) stop();
    };
    get('sondeurPlay').textContent = 'Pause';
    timer = setInterval(tick, 500);
    tick();
  }

  for (const [key, input] of Object.entries(inputs)) {
    input.addEventListener('input', () => {
      if (!input.value || !input.validity.valid) return;
      settings[key] = Number(input.value);
      try { localStorage.setItem(settingsKey, JSON.stringify(settings)); } catch (_) {}
      draw();
    });
  }

  function show(visible) {
    panel.hidden = !visible;
    toggle.setAttribute('aria-expanded', String(visible));
    if (visible) draw();
    else stop();
  }
  toggle.onclick = () => { if (panel.hidden) enableAudio(); show(panel.hidden); };
  get('sondeurClose').onclick = () => show(false);
  get('sondeurPlay').onclick = play;
  get('sondeurOptions').onclick = () => {
    const options = get('sondeurSettings');
    options.hidden = !options.hidden;
    get('sondeurOptions').setAttribute('aria-expanded', String(!options.hidden));
  };
  // Entry point for a future sensor adapter. Depth is expressed in metres.
  window.nauticSondeur = {
    addReading(depth) {
      if (!Number.isFinite(depth) || depth < 0) return false;
      if (!get('sondeurTitle').dataset.live) {
        stop();
        history.length = 0;
        next = 0;
        get('sondeurTitle').dataset.live = '1';
        get('sondeurTitle').textContent = 'Sondeur';
        get('sondeurPlay').textContent = 'Simulation';
      }
      return append(depth);
    }
  };
})();
