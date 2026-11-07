(() => {
  const map = document.getElementById('mapWrap');
  if (!map) return;

  const toggle = document.createElement('button');
  toggle.id = 'sondeurToggle';
  toggle.type = 'button';
  toggle.textContent = 'Fond';
  toggle.setAttribute('aria-expanded', 'false');

  const panel = document.createElement('section');
  panel.id = 'nauticSondeur';
  panel.setAttribute('aria-label', 'Sondeur');
  panel.innerHTML = `
    <div class="sondeur-tools">
      <strong id="sondeurTitle">Sondeur · simulation</strong>
      <output class="sondeur-reading" aria-label="Profondeur">—</output>
      <button type="button" id="sondeurPlay">Démarrer</button>
      <button type="button" id="sondeurOptions" aria-label="Réglages du sondeur" aria-expanded="false">⚙</button>
      <button type="button" id="sondeurClose" aria-label="Replier le fond et arrêter la simulation">×</button>
    </div>
    <div class="sondeur-settings" id="sondeurSettings" hidden>
      <label>Transparence <input id="sondeurAlpha" type="range" min="0" max="90"><output id="sondeurAlphaValue"></output></label>
      <label>Profondeur max. <input id="sondeurMax" type="number" min="0.5" max="30" step="0.1"> m</label>
      <label>Seuil d’alerte <input id="sondeurAlert" type="number" min="0.1" max="2" step="0.01"> m</label>
      <label><input id="sondeurAuto" type="checkbox"> Fond automatique sous 2 m</label>
      <label>Largeur <input id="sondeurWidth" type="range" min="2" max="24"><output id="sondeurWidthValue"></output></label>
    </div>
    <div class="sondeur-plot" hidden>
      <div class="sondeur-picture"></div>
      <div class="sondeur-scale">
        <div class="sondeur-depth-marks" aria-hidden="true"></div>
        <div class="sondeur-bars" aria-hidden="true"></div>
        <svg class="sondeur-hull" viewBox="0 0 430 135" role="img" aria-label="Coupe schématique de coque, largeur 4,30 m, tirant d’eau 1,35 m">
          <path d="M0 0H430C426 38 408 70 373 86C333 105 287 105 238 105L232 135H198L192 105C143 105 97 105 57 86C22 70 4 38 0 0Z"/>
        </svg>
      </div>
    </div>`;
  panel.querySelector('.sondeur-tools').append(toggle);
  map.append(panel);

  const get = id => panel.querySelector('#' + id);
  const bars = panel.querySelector('.sondeur-bars');
  const reading = panel.querySelector('.sondeur-reading');
  const wave = (mean, amplitude) => Array.from({length: 100}, (_, i) =>
    Math.round((mean + amplitude * Math.sin(i * Math.PI / 50)) * 100) / 100);
  const samples = [
    ...wave(2.30, 0.80), ...wave(1.55, 0.20),
    ...wave(2.10, 0.65), ...wave(1.65, 0.30)
  ];
  const plot = panel.querySelector('.sondeur-plot');
  const marks = panel.querySelector('.sondeur-depth-marks');
  const hull = panel.querySelector('.sondeur-hull');
  const auto = get('sondeurAuto');
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
    alert: clamp(saved.critical, 0.1, 2, 1.50),
    width: clamp(saved.width, 2, 24, 5),
    auto: saved.auto === true
  };
  for (const [key, input] of Object.entries(inputs)) input.value = settings[key];

  auto.checked = settings.auto;
  let manualPlot = false;
  let autoSuppressed = false;
  const history = [];
  let next = 0;
  let timer = null;
  const format = new Intl.NumberFormat('fr-FR', {minimumFractionDigits: 2, maximumFractionDigits: 2});

  const cautionSound = new Audio('prudencefond2.mp3');
  const alertSound = new Audio('alertefond.mp3');
  for (const sound of [cautionSound, alertSound]) {
    sound.preload = 'auto';
    sound.loop = true;
  }

  function setSound(sound, shouldPlay) {
    if (shouldPlay) {
      if (sound.paused) sound.play().catch(() => {});
    } else if (!sound.paused) {
      sound.pause();
      sound.currentTime = 0;
    }
  }

  function updateSound(depth) {
    const audible = !document.hidden && Number.isFinite(depth);
    setSound(cautionSound, audible && depth < 2);
    setSound(alertSound, audible && depth < settings.alert);
  }

  function fitHull() {
    const pixelsPerMetre = plot.clientHeight / settings.max;
    hull.style.width = (pixelsPerMetre * 4.30) + 'px';
  }
  if (window.ResizeObserver) new ResizeObserver(fitHull).observe(plot);

  function draw() {
    fitHull();
    plot.style.opacity = String(1 - settings.alpha / 100);
    const step = settings.max <= 4 ? 0.5 : Math.ceil(settings.max / 8);
    const depths = [0];
    for (let depth = step; depth < settings.max; depth += step) depths.push(depth);
    depths.push(settings.max);
    marks.replaceChildren(...depths.map(depth => {
      const mark = document.createElement('span');
      mark.style.top = (depth / settings.max * 100) + '%';
      mark.textContent = format.format(depth);
      return mark;
    }));
    get('sondeurAlphaValue').textContent = settings.alpha + ' %';
    get('sondeurWidthValue').textContent = settings.width + ' px';
    const columns = history.map(depth => {
      const bar = document.createElement('span');
      if (depth < settings.alert) bar.className = 'shallow';
      else if (depth < 2) bar.className = 'caution';
      bar.style.height = (Math.max(0, settings.max - depth) / settings.max * 100) + '%';
      bar.style.width = settings.width + 'px';
      return bar;
    });
    bars.replaceChildren(...columns);
  }

  function append(depth) {
    if (!Number.isFinite(depth) || depth < 0) return false;
    history.push(depth);
    if (history.length > 200) history.shift();
    if (depth >= 2) autoSuppressed = false;
    refreshView();
    updateSound(depth);
    return true;
  }

  function stop() {
    if (timer !== null) clearInterval(timer);
    timer = null;
    updateSound();
    refreshView();
    get('sondeurPlay').textContent = history.length ? 'Reprendre' : 'Démarrer';
  }

  function play() {
    if (timer !== null) { stop(); return; }
    if (get('sondeurTitle').dataset.live) {
      next = 0;
      history.length = 0;
    }
    delete get('sondeurTitle').dataset.live;
    get('sondeurTitle').textContent = 'Sondeur · simulation';
    const tick = () => {
      if (window.nauticMapInteracting || window.nauticQuietMode || document.hidden) return;
      const depth = samples[next];
      next = (next + 1) % samples.length;
      append(depth);
    };
    manualPlot = !settings.auto;
    autoSuppressed = false;
    get('sondeurPlay').textContent = 'Pause';
    timer = setInterval(tick, 500);
    tick();
  }

  function saveSettings() {
    try { localStorage.setItem(settingsKey, JSON.stringify({...settings, critical: settings.alert})); } catch (_) {}
  }

  for (const [key, input] of Object.entries(inputs)) {
    input.addEventListener('input', () => {
      if (!input.value || !input.validity.valid) return;
      settings[key] = Number(input.value);
      saveSettings();
      refreshView();
      if (timer !== null || get('sondeurTitle').dataset.live) updateSound(history.at(-1));
    });
  }

  function refreshView() {
    const latest = history.at(-1);
    const receiving = timer !== null || get('sondeurTitle').dataset.live;
    plot.hidden = !(manualPlot || (settings.auto && receiving && !autoSuppressed && latest < 2));
    toggle.setAttribute('aria-expanded', String(!plot.hidden));
    reading.textContent = Number.isFinite(latest) ? format.format(latest) : '—';
    if (!plot.hidden) draw();
  }
  auto.addEventListener('change', () => {
    settings.auto = auto.checked;
    manualPlot = false;
    autoSuppressed = false;
    saveSettings();
    refreshView();
  });
  toggle.onclick = () => {
    manualPlot = plot.hidden;
    autoSuppressed = !manualPlot;
    refreshView();
  };
  refreshView();
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) updateSound();
    else if (timer !== null || get('sondeurTitle').dataset.live) updateSound(history.at(-1));
  });
  get('sondeurClose').onclick = () => {
    manualPlot = false;
    autoSuppressed = true;
    stop();
  };
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
