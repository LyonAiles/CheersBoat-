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
      <div class="sondeur-title"><strong id="sondeurTitle">Sondeur</strong></div>
      <output class="sondeur-reading" aria-label="Profondeur">—</output>
      <div class="sondeur-actions">
        <button type="button" id="sondeurPlay" aria-label="Démarrer la simulation">▶</button>
        <button type="button" id="sondeurOptions" aria-label="Réglages du sondeur" aria-expanded="false">⚙</button>
      </div>
    </div>
    <div class="sondeur-settings" id="sondeurSettings" hidden>
      <label>Transparence <input id="sondeurAlpha" type="range" min="0" max="90"><output id="sondeurAlphaValue"></output></label>
      <label>Profondeur max. <input id="sondeurMax" type="number" min="0.5" max="30" step="0.1"> m</label>
      <label>Seuil de prudence <input id="sondeurCaution" type="number" min="0.1" max="30" step="0.01"> m</label>
      <label>Tirant d’eau <input id="sondeurDraft" type="number" min="0.1" max="30" step="0.01"> m</label>
      <label>Seuil d’alerte <input id="sondeurAlert" type="number" min="0.1" max="2" step="0.01"> m</label>
      <label><input id="sondeurAuto" type="checkbox"> Fond automatique au seuil de prudence</label>
      <label><input type="checkbox" id="sondeurBlackBars"> Barres uniformes noires</label>
      <label><input type="checkbox" id="sondeurHullOutline"> Contour léger de la coque</label>
      <label><input type="checkbox" id="sondeurShimmer"> Scintillement du fond</label>
      <label class="sondeur-axis-setting">Position du relevé <input id="sondeurAxis" type="range" min="10" max="95" step="1"><output id="sondeurAxisValue"></output></label>
      <label>Courriel de test <input id="sondeurTestEmail" type="email" placeholder="Ton adresse"></label>
      <button type="button" id="sondeurAlertList">Alertes sur la carte</button>
      <label>Cadence <select id="sondeurTempoMode"><option value="auto">Automatique</option><option value="manual">Manuelle</option></select></label>
      <label>Intervalle <input id="sondeurPeriod" type="number" min="0.1" max="60" step="0.01"> s</label>
      <output id="sondeurTempoStatus"></output>
      <label>Largeur <input id="sondeurWidth" type="range" min="2" max="24"><output id="sondeurWidthValue"></output></label>
    </div>
    <div class="sondeur-replay" hidden>
      <button type="button" id="sondeurBack" aria-label="Retour rapide vers les alertes">⏪</button>
      <button type="button" id="sondeurReplayPlay" aria-label="Lire les relevés">▶</button>
      <time id="sondeurReplayTime"></time>
      <button type="button" id="sondeurReplayGps" aria-label="Centrer la carte sur l’alerte" hidden>⌖</button>
      <button type="button" id="sondeurReplayClose">Quitter</button>
    </div>
    <div class="sondeur-plot" hidden>
      <div class="sondeur-picture"></div>
      <div class="sondeur-scale">
        <div class="sondeur-depth-marks" aria-hidden="true"></div>
        <div class="sondeur-bars" aria-hidden="true"></div>
        <div class="sondeur-extension" aria-hidden="true"></div>
        <svg class="sondeur-hull-outline" viewBox="0 0 120 60" preserveAspectRatio="none" aria-hidden="true">
          <path d="M2 5 C8 27 23 50 51 53 L55 59 H65 L69 53 C97 50 112 27 118 5"/>
        </svg>
        <div class="sondeur-alert-mark" aria-hidden="true"></div>
      </div>
    </div>`;
  const replayButton = document.createElement('button');
  replayButton.id = 'sondeurReplay';
  replayButton.type = 'button';
  replayButton.textContent = '↶';
  replayButton.setAttribute('aria-label', 'Relire la dernière heure');
  panel.querySelector('.sondeur-title').append(replayButton);
  panel.querySelector('.sondeur-actions').prepend(toggle);
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
    period: get('sondeurPeriod'),
    width: get('sondeurWidth')
  };
  const caution = clamp(saved.caution, 0.1, 30, 2);
  const settings = {
    alpha: clamp(saved.alpha, 0, 90, 25),
    max: clamp(saved.max, 0.5, 30, 3),
    alert: clamp(saved.critical ?? saved.alert ?? 1.50, 0.1, caution, Math.min(1.50, caution)),
    caution,
    axis: clamp(saved.axis, 10, 95, 50),
    period: clamp(saved.period, 0.1, 60, 0.5),
    tempoMode: saved.tempoMode === 'manual' ? 'manual' : 'auto',
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
  let alertRecorded = false;
  let simulatedAlertCount = 0;

  function alertPosition(simulated) {
    const fix = typeof latest === 'undefined' ? null : latest;
    if (!Number.isFinite(fix?.lat) || !Number.isFinite(fix.lon)) return null;
    if (!simulated) {
      return {lat: fix.lat, lon: fix.lon};
    }
    const index = simulatedAlertCount++;
    const distance = [150, 500, 1500, 3500][index % 4];
    const angle = index * 1.4;
    return {
      lat: Math.max(-90, Math.min(90, fix.lat + Math.cos(angle) * distance / 111320)),
      lon: ((fix.lon + Math.sin(angle) * distance / (111320 * Math.max(0.01, Math.cos(fix.lat * Math.PI / 180))) + 540) % 360) - 180
    };
  }

  const alertsKey = 'nautic-sondeur-map-alerts';
  let savedAlerts = [];
  try {
    const saved = JSON.parse(localStorage.getItem(alertsKey));
    if (Array.isArray(saved)) savedAlerts = saved.filter(entry => entry?.gps && !entry.simulated);
  } catch (_) {}
  const alerts = new Map(savedAlerts.map(entry => [entry.time, entry]));
  for (const entry of recordings) {
    if (entry.gps && !entry.simulated) alerts.set(entry.time, entry);
  }

  function saveAlerts() {
    try { localStorage.setItem(alertsKey, JSON.stringify([...alerts.values()])); } catch (_) {}
  }
  saveAlerts();

  window.nauticSondeurAlertPoints = () => [
    ...alerts.values(),
    ...recordings.filter(entry => entry.simulated && entry.gps && entry.time >= Date.now() - oneHour)
  ];

  const testEmail = get('sondeurTestEmail');
  const testEmailKey = 'nautic-sondeur-test-email';
  try { testEmail.value = localStorage.getItem(testEmailKey) || ''; } catch (_) {}
  testEmail.addEventListener('input', () => {
    if (testEmail.validity.valid) {
      try { localStorage.setItem(testEmailKey, testEmail.value); } catch (_) {}
    }
  });

  get('sondeurAlertList').onclick = () => {
    modal('Alertes du sondeur', '<button type="button" id="sondeurResetAlerts">Remettre les points à zéro</button><div id="sondeurSavedAlerts"></div>');
    const reset = document.getElementById('sondeurResetAlerts');
    reset.onclick = () => {
      if (!window.confirm('Supprimer tous les points d’alerte enregistrés sur la carte ?')) return;
      alerts.clear();
      for (const entry of recordings) delete entry.gps;
      for (const entry of replay?.entries || []) delete entry.gps;
      get('sondeurReplayGps').hidden = true;
      saveAlerts();
      persistRecordings();
      list.textContent = 'Aucune alerte localisée.';
      reset.disabled = true;
    };
    const list = document.getElementById('sondeurSavedAlerts');
    const entries = window.nauticSondeurAlertPoints().sort((a, b) => b.time - a.time);
    reset.disabled = !entries.length;
    if (!entries.length) list.textContent = 'Aucune alerte localisée.';
    for (const entry of entries) {
      const row = document.createElement('p');
      const focus = document.createElement('button');
      focus.type = 'button';
      const date = new Date(entry.time).toLocaleString('fr-FR');
      const depth = format.format(entry.depth) + ' m';
      focus.textContent = (entry.simulated ? '◇ ' : '! ') + date + ' · ' + depth;
      const revealMap = () => {
        document.getElementById('dialog').close();
        get('sondeurSettings').hidden = true;
        get('sondeurOptions').setAttribute('aria-expanded', 'false');
        endReplay();
        manualPlot = false;
        autoSuppressed = true;
        refreshView();
      };
      focus.onclick = () => { revealMap(); window.nauticFocusSondeurAlert?.(entry.gps); };
      row.append(focus);
      const recipient = entry.simulated ? (testEmail.validity.valid ? testEmail.value.trim() : '') : 'uti.valdeloireseine@vnf.fr';
      if (recipient) {
        const mail = document.createElement('a');
        mail.textContent = entry.simulated ? 'Préparer le courriel de test' : 'Préparer le courriel VNF';
        const subject = (entry.simulated ? '[TEST] ' : '') + 'Signalement à vérifier — haut-fond ou anomalie de profondeur';
        const coordinates = entry.gps.lat.toFixed(6) + ',' + entry.gps.lon.toFixed(6);
        const mapLink = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(coordinates);
        const attachMap = Boolean(window.NauticAndroid?.composeSondeurMail);
        if (attachMap) mail.textContent += ' avec carte (5 km)';
        mail.href = 'mailto:' + recipient;
        let preparing = false;
        mail.onclick = async event => {
          event.preventDefault();
          if (preparing) return;
          preparing = true;
          let commune = '[à préciser]';
          let boat = {};
          try {
            const key = 'nautic-extensions';
            boat = JSON.parse(window.NauticAndroid?.readSetting?.(key) || localStorage.getItem(key) || '{}') || {};
          } catch (_) {}
          if (!entry.simulated) {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 3000);
            try {
              const {lat, lon} = entry.gps;
              const response = await fetch('https://geo.api.gouv.fr/communes?lat=' + lat + '&lon=' + lon + '&fields=nom', {signal: controller.signal});
              if (response.ok) {
                const communes = await response.json();
                if (communes.length === 1 && communes[0].nom) commune = communes[0].nom;
              }
            } catch (_) {
              // Keep the editable commune field if the lookup is unavailable.
            } finally {
              clearTimeout(timeout);
            }
          }
          const body = [
            'Bonjour,', '',
            ...(entry.simulated ? ['Simulation Nautic — position et profondeur fictives.', ''] : []),
            'Je vous signale une faible profondeur relevée au sondeur, susceptible d’indiquer un haut-fond ou une anomalie.',
            'Voie d’eau : [à préciser]',
            'Commune : ' + commune,
            'PK : [à confirmer]',
            'Date et heure locales : ' + date,
            'Position GPS du bateau au relevé : ' + coordinates,
            mapLink,
            'Profondeur affichée par le sondeur : ' + depth, '',
            'Pouvez-vous vérifier ce point et m’indiquer la suite donnée ?', '', 'Cordialement,',
            'Bateau : ' + (boat.boatName?.trim() || '[à préciser]'),
            'Téléphone : ' + (boat.contactPhone?.trim() || '[à préciser]')
          ].join('\r\n');
          const mailto = 'mailto:' + recipient + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
          let restoreMap;
          try {
            if (!attachMap) {
              window.location.href = mailto;
              return;
            }
            revealMap();
            restoreMap = await window.nauticCaptureSondeurMap(entry.gps);
            const bounds = map.getBoundingClientRect();
            window.nauticSondeurCaptureDone = restoreMap;
            window.NauticAndroid.composeSondeurMail(recipient, subject, body, bounds.left, bounds.top, bounds.width, bounds.height, window.devicePixelRatio);
          } catch (_) {
            restoreMap?.();
            window.location.href = mailto;
          } finally {
            preparing = false;
          }
        };
        row.append(' ', mail);
      } else {
        row.append(' · Renseigne le courriel de test dans les paramètres du sondeur.');
      }
      list.append(row);
    }
  };
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
    if (!missing) {
      if (depth >= settings.alert) alertRecorded = false;
      else if (!alertRecorded) {
        const gps = alertPosition(simulated);
        if (gps) {
          entry.gps = gps;
          if (!simulated) {
            alerts.set(entry.time, entry);
            saveAlerts();
          }
          alertRecorded = true;
        }
      }
    }
    recordings.push(entry);
    if (entry.gps) persistRecordings();
    if (time - lastSave >= 5000) persistRecordings();
    return entry;
  }

  function renderReplay() {
    const entry = replay.entries[replay.index];
    history.splice(0, history.length, ...replay.entries.slice(Math.max(0, replay.index - 199), replay.index + 1));
    get('sondeurReplayGps').hidden = !entry.gps;
    get('sondeurReplayTime').textContent = new Date(entry.time).toLocaleTimeString('fr-FR') + (entry.simulated ? ' · ◇' : '') + (entry.missing ? ' · sans écho' : '');
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
  get('sondeurReplayGps').onclick = () => {
    const gps = replay?.entries[replay.index]?.gps;
    if (!gps) return;
    endReplay();
    manualPlot = false;
    autoSuppressed = true;
    refreshView();
    window.nauticFocusSondeurAlert?.(gps);
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

  const tempoMode = get('sondeurTempoMode');
  tempoMode.value = settings.tempoMode;
  const intervals = [];
  let lastArrival = null;
  let missingTimer = null;

  function estimatedPeriod() {
    if (intervals.length < 3) return null;
    const sorted = intervals.slice().sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
  }

  function refreshTempo() {
    const manual = settings.tempoMode === 'manual';
    inputs.period.disabled = !manual;
    const period = manual ? settings.period * 1000 : estimatedPeriod();
    get('sondeurTempoStatus').textContent = period
      ? format.format(60000 / period) + ' relevés/min'
      : 'Cadence en attente de relevés';
  }

  function watchForMissingReading() {
    clearTimeout(missingTimer);
    if (lastArrival === null) return;
    const period = settings.tempoMode === 'manual' ? settings.period * 1000 : estimatedPeriod();
    if (!period) return;
    function markMissing() {
      append(null);
      missingTimer = setTimeout(markMissing, period);
    }
    missingTimer = setTimeout(markMissing, Math.max(0, lastArrival + period * 1.5 - performance.now()));
  }

  tempoMode.addEventListener('change', () => {
    settings.tempoMode = tempoMode.value;
    saveSettings();
    refreshTempo();
    watchForMissingReading();
  });
  refreshTempo();

  function play() {
    endReplay();
    if (timer !== null) { stop(); return; }
    if (get('sondeurTitle').dataset.live) {
      next = 0;
      history.length = 0;
    }
    clearTimeout(missingTimer);
    lastArrival = null;
    intervals.length = 0;
    refreshTempo();
    alertRecorded = false;
    delete get('sondeurTitle').dataset.live;
    const tick = () => {
      if (window.nauticMapInteracting || window.nauticQuietMode || document.hidden) return;
      const depth = samples[next];
      next = (next + 1) % samples.length;
      append(depth);
    };
    manualPlot = !settings.auto;
    autoSuppressed = false;
    setPlayButton(true);
    timer = setInterval(tick, settings.tempoMode === 'manual' ? settings.period * 1000 : 500);
    tick();
  }

  function saveSettings() {
    try { localStorage.setItem(settingsKey, JSON.stringify({...settings, critical: settings.alert})); } catch (_) {}
  }

  for (const [key, input] of Object.entries(inputs)) {
    input.addEventListener('input', () => {
      if (!input.value || !input.validity.valid) return;
      settings[key] = Number(input.value);
      if (key === 'period') {
        refreshTempo();
        watchForMissingReading();
      }
      saveSettings();
      refreshView();
      if (!replay && (timer !== null || get('sondeurTitle').dataset.live)) updateSound(history.at(-1)?.depth);
    });
  }

  for (const [key, id] of Object.entries({
    blackBars: 'sondeurBlackBars',
    hullOutline: 'sondeurHullOutline',
    shimmer: 'sondeurShimmer'
  })) {
    const input = get(id);
    settings[key] = input.checked = saved[key] === true;
    plot.classList.toggle(id, input.checked);
    input.addEventListener('change', () => {
      settings[key] = input.checked;
      plot.classList.toggle(id, input.checked);
      saveSettings();
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
    plot.style.setProperty('--sondeur-hull-ratio', '4.30 / ' + settings.draft);
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
      if (!get('sondeurTitle').dataset.live) {
        stop();
        history.length = 0;
        next = 0;
        alertRecorded = false;
        get('sondeurTitle').dataset.live = '1';
      }
      const now = performance.now();
      if (lastArrival !== null) {
        const interval = now - lastArrival;
        if (interval >= 50 && interval <= 60000) {
          intervals.push(interval);
          if (intervals.length > 9) intervals.shift();
        }
      }
      lastArrival = now;
      refreshTempo();
      watchForMissingReading();
      return append(depth);
    }
  };
})();
