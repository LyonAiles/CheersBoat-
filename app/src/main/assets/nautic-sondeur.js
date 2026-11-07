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
      <div class="sondeur-actions">
        <button type="button" id="sondeurPlay" aria-label="Démarrer la simulation">▶</button>
      <button type="button" id="sondeurOptions" aria-label="Réglages du sondeur" aria-expanded="false">⚙</button>
      <button type="button" id="sondeurClose" aria-label="Replier le fond et arrêter la simulation">×</button>
      </div>
    </div>
    <div class="sondeur-settings" id="sondeurSettings" hidden>
      <label>Transparence <input id="sondeurAlpha" type="range" min="0" max="90"><output id="sondeurAlphaValue"></output></label>
      <label>Profondeur max. <input id="sondeurMax" type="number" min="0.5" max="30" step="0.1"> m</label>
      <label>Seuil de prudence <input id="sondeurCaution" type="number" min="0.1" max="30" step="0.01"> m</label>
      <label>Tirant d’eau <input id="sondeurDraft" type="number" min="0.1" max="30" step="0.01"> m</label>
      <label>Seuil d’alerte <input id="sondeurAlert" type="number" min="0.1" max="2" step="0.01"> m</label>
      <label><input id="sondeurAuto" type="checkbox"> Fond automatique au seuil de prudence</label>
      <label class="sondeur-axis-setting">Position du relevé <input id="sondeurAxis" type="range" min="10" max="95" step="1"><output id="sondeurAxisValue"></output></label>
      <label>Largeur <input id="sondeurWidth" type="range" min="2" max="24"><output id="sondeurWidthValue"></output></label>
    </div>
    <div class="sondeur-replay" hidden>
      <button type="button" id="sondeurBack" aria-label="Retour rapide vers les alertes">⏪</button>
      <button type="button" id="sondeurReplayPlay" aria-label="Lire les relevés">▶</button>
      <time id="sondeurReplayTime"></time>
      <button type="button" id="sondeurReplayClose">Quitter</button>
    </div>
    <div class="sondeur-plot" hidden>
      <div class="sondeur-picture"></div>
      <div class="sondeur-scale">
        <div class="sondeur-depth-marks" aria-hidden="true"></div>
        <div class="sondeur-bars" aria-hidden="true"></div>
        <div class="sondeur-extension" aria-hidden="true"></div>
        <div class="sondeur-alert-mark" aria-hidden="true"></div>
      </div>
    </div>`;
  const replayButton = document.createElement('button');
  replayButton.type = 'button';
  replayButton.textContent = '↶';
  replayButton.setAttribute('aria-label', 'Relire la dernière heure');
  panel.querySelector('.sondeur-actions').append(toggle, replayButton);
  map.append(panel);

  const get = id => panel.querySelector('#' + id);
  const extension = panel.querySelector('.sondeur-extension');
  const bars = panel.querySelector('.sondeur-bars');
  const playButton = get('sondeurPlay');
  const reading = panel.querySelector('.sondeur-reading');
  const wave = (mean, amplitude) => Array.from({length: 100}, (_, i) =>
    Math.round((mean + amplitude * Math.sin(i * Math.PI / 50)) * 100) / 100);
  const samples = [
    ...wave(2.30, 0.80), ...wave(1.55, 0.20),
    ...wave(2.10, 0.65), ...wave(1.65, 0.30)
  ];
  const plot = panel.querySelector('.sondeur-plot');
  for (const index of [18, 19, 72, 138, 139, 140, 267, 356]) samples[index] = null;
  const marks = panel.querySelector('.sondeur-depth-marks');
  const auto = get('sondeurAuto');
  const settingsKey = 'nautic-sondeur-settings';
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(settingsKey)) || {}; } catch (_) {}
  const clamp = (value, min, max, fallback) => Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
  const inputs = {
    alpha: get('sondeurAlpha'),
    max: get('sondeurMax'),
    alert: get('sondeurAlert'),
    caution: get('sondeurCaution'),
    draft: get('sondeurDraft'),
    axis: get('sondeurAxis'),
    width: get('sondeurWidth')
  };
  const caution = clamp(saved.caution, 0.1, 30, 2);
  const settings = {
    alpha: clamp(saved.alpha, 0, 90, 25),
    max: clamp(saved.max, 0.5, 30, 3),
    alert: clamp(saved.critical ?? saved.alert ?? 1.50, 0.1, caution, Math.min(1.50, caution)),
    caution,
    axis: clamp(saved.axis, 10, 95, 50),
    draft: clamp(saved.draft, 0.1, 30, 1.35),
    width: clamp(saved.width, 2, 24, 5),
    auto: saved.auto === true
  };
  for (const [key, input] of Object.entries(inputs)) input.value = settings[key];

  auto.checked = settings.auto;
  let manualPlot = false;
  let autoSuppressed = false;
  const history = [];
  const recordingsKey = 'nautic-sondeur-recordings';
  const oneHour = 3600000;
  let recordings = [];
  try {
    recordings = JSON.parse(localStorage.getItem(recordingsKey)) || [];
    recordings = recordings.filter(entry => Number.isFinite(entry?.time) && (Number.isFinite(entry.depth) || (entry.missing && entry.depth === null)) && entry.time >= Date.now() - oneHour);
  } catch (_) { recordings = []; }
  let lastSave = 0;
  let replay = null;
  let replayTimer = null;
  const replayBar = panel.querySelector('.sondeur-replay');

  function persistRecordings() {
    try { localStorage.setItem(recordingsKey, JSON.stringify(recordings)); } catch (_) {}
    lastSave = Date.now();
  }

  function record(depth) {
    const time = Date.now();
    while (recordings.length && recordings[0].time < time - oneHour) recordings.shift();
    const simulated = !get('sondeurTitle').dataset.live;
    const missing = depth === null;
    const previous = missing ? recordings.findLast(entry => entry.simulated === simulated) : null;
    const entry = {time, depth: missing ? previous?.depth ?? null : depth, simulated, missing};
    recordings.push(entry);
    if (time - lastSave >= 5000) persistRecordings();
    return entry;
  }

  function renderReplay() {
    const entry = replay.entries[replay.index];
    history.splice(0, history.length, ...replay.entries.slice(Math.max(0, replay.index - 199), replay.index + 1));
    get('sondeurReplayTime').textContent = new Date(entry.time).toLocaleTimeString('fr-FR') + (entry.simulated ? ' · simulation' : '') + (entry.missing ? ' · sans écho' : '');
    refreshView();
  }

  function stopReplayPlayback() {
    clearTimeout(replayTimer);
    replayTimer = null;
    get('sondeurReplayPlay').textContent = '▶';
    get('sondeurReplayPlay').setAttribute('aria-label', 'Lire les relevés');
    get('sondeurBack').setAttribute('aria-pressed', 'false');
  }

  function replayInDirection(direction) {
    if (!replay) return;
    stopReplayPlayback();
    get('sondeurReplayPlay').textContent = '⏸';
    get('sondeurReplayPlay').setAttribute('aria-label', 'Mettre la relecture en pause');
    get('sondeurBack').setAttribute('aria-pressed', String(direction < 0));
    function step() {
      const index = replay.index + direction;
      if (index < 0 || index >= replay.entries.length) {
        stopReplayPlayback();
        return;
      }
      const current = replay.entries[replay.index];
      const upcoming = replay.entries[index];
      const interval = Math.max(100, Math.min(1000, Math.abs(upcoming.time - current.time)));
      const nearAlert = [current, upcoming].some(entry => Number.isFinite(entry.depth) && entry.depth < settings.alert);
      replayTimer = setTimeout(() => {
        replay.index = index;
        renderReplay();
        step();
      }, direction < 0 && !nearAlert ? Math.max(20, interval / 20) : interval);
    }
    step();
  }

  function endReplay() {
    if (!replay) return;
    stopReplayPlayback();
    const restored = recordings.filter(entry => entry.time >= Date.now() - oneHour && entry.simulated === !get('sondeurTitle').dataset.live);
    history.splice(0, history.length, ...restored.slice(-200));
    manualPlot = replay.manualPlot;
    replay = null;
    replayBar.hidden = true;
    refreshView();
  }

  replayButton.onclick = () => {
    if (replay) { endReplay(); return; }
    const available = recordings.filter(entry => entry.time >= Date.now() - oneHour);
    if (!available.length) {
      replayBar.hidden = false;
      get('sondeurReplayTime').textContent = 'Aucun relevé';
      return;
    }
    stop();
    const entries = available;
    replay = {entries, index: entries.length - 1, manualPlot};
    replayBar.hidden = false;
    manualPlot = true;
    renderReplay();
  };
  get('sondeurBack').onclick = () => replayInDirection(-1);
  get('sondeurReplayPlay').onclick = () => {
    if (!replay) return;
    if (replayTimer !== null) { stopReplayPlayback(); return; }
    if (replay.index === replay.entries.length - 1) {
      replay.index = 0;
      renderReplay();
    }
    replayInDirection(1);
  };
  get('sondeurReplayClose').onclick = () => {
    endReplay();
    replayBar.hidden = true;
  };
  window.addEventListener('pagehide', persistRecordings);
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
    setSound(cautionSound, audible && depth < settings.caution);
    setSound(alertSound, audible && depth < settings.alert);
  }

  function draw() {
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
    const columns = history.map(({depth, missing}) => {
      const bar = document.createElement('span');
      if (missing) bar.className = 'missing';
      else if (depth < settings.alert) bar.className = 'shallow';
      else if (depth < settings.caution) bar.className = 'caution';
      bar.style.height = Number.isFinite(depth) ? (Math.max(0, settings.max - depth) / settings.max * 100) + '%' : '3px';
      bar.style.width = settings.width + 'px';
      return bar;
    });
    bars.replaceChildren(...columns);
    const latestBar = columns.at(-1);
    extension.className = 'sondeur-extension ' + (latestBar?.className || '');
    extension.style.height = latestBar?.style.height || '0';
  }

  function append(depth) {
    if (depth !== null && (!Number.isFinite(depth) || depth < 0)) return false;
    const entry = record(depth);
    if (replay) return true;
    history.push(entry);
    if (history.length > 200) history.shift();
    if (depth >= settings.caution) autoSuppressed = false;
    refreshView();
    updateSound(entry.depth);
    return true;
  }

  function setPlayButton(running) {
    playButton.textContent = running ? '⏸' : '▶';
    playButton.setAttribute('aria-label', running ? 'Mettre la simulation en pause' : 'Démarrer ou reprendre la simulation');
  }

  function stop() {
    if (timer !== null) clearInterval(timer);
    timer = null;
    persistRecordings();
    updateSound();
    refreshView();
    setPlayButton(false);
  }

  function play() {
    endReplay();
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
    setPlayButton(true);
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
      if (!replay && (timer !== null || get('sondeurTitle').dataset.live)) updateSound(history.at(-1)?.depth);
    });
  }

  function refreshView() {
    inputs.alert.max = settings.caution;
    inputs.caution.min = settings.alert;
    const latest = history.at(-1)?.depth;
    const missing = history.at(-1)?.missing;
    const receiving = timer !== null || get('sondeurTitle').dataset.live;
    plot.hidden = !(manualPlot || (settings.auto && receiving && !autoSuppressed && Number.isFinite(latest) && latest < settings.caution));
    toggle.setAttribute('aria-expanded', String(!plot.hidden));
    reading.textContent = Number.isFinite(latest) ? format.format(latest) + (missing ? '*' : '') : '—';
    reading.title = missing ? 'Sans écho · dernière valeur connue' : '';
    const level = !Number.isFinite(latest) ? '' : latest < settings.alert ? 'alert' : latest < settings.caution ? 'caution' : '';
    reading.dataset.level = missing ? 'missing' : level;
    plot.dataset.level = level;
    get('sondeurAxisValue').textContent = settings.axis + ' %';
    plot.style.setProperty('--sondeur-axis', settings.axis + '%');
    plot.style.setProperty('--sondeur-half-bar', (settings.width / 2) + 'px');
    plot.style.setProperty('--sondeur-draft-position', (settings.draft / settings.max * 100) + '%');
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
    else if (!replay && (timer !== null || get('sondeurTitle').dataset.live)) updateSound(history.at(-1)?.depth);
  });
  get('sondeurClose').onclick = () => {
    endReplay();
    replayBar.hidden = true;
    manualPlot = false;
    autoSuppressed = true;
    stop();
  };
  playButton.onclick = play;
  get('sondeurOptions').onclick = () => {
    const options = get('sondeurSettings');
    options.hidden = !options.hidden;
    get('sondeurOptions').setAttribute('aria-expanded', String(!options.hidden));
  };
  // Entry point for a future sensor adapter. Depth is expressed in metres.
  window.nauticSondeur = {
    addReading(depth) {
      if (depth !== null && (!Number.isFinite(depth) || depth < 0)) return false;
      if (replay) {
        get('sondeurTitle').dataset.live = '1';
        record(depth);
        return true;
      }
      if (!get('sondeurTitle').dataset.live) {
        stop();
        history.length = 0;
        next = 0;
        get('sondeurTitle').dataset.live = '1';
        get('sondeurTitle').textContent = 'Sondeur';
      }
      return append(depth);
    }
  };
})();
