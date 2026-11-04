(() => {
  'use strict';
  const root = document.documentElement;
  const scene = document.querySelector('.scene');
  const activation = document.querySelector('#sensor-activation');
  const hint = document.querySelector('#scene-hint');
  const status = document.querySelector('#status');
  const world = document.querySelector('.world');
  const poster = document.querySelector('.poster');
  const layerImages = Array.from(document.querySelectorAll('.scene-layer'));
  let assetsReady = layerImages.length === 0;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const fine = matchMedia('(pointer: fine)');
  const coarse = matchMedia('(any-pointer: coarse)');
  const orientation = window.DeviceOrientationEvent;
  const supported = window.isSecureContext && Boolean(orientation);
  const needsPermission = supported && typeof orientation.requestPermission === 'function';
  let mode = 'idle', baseline = null, ready = false, listening = false;
  let pending = false, declined = false, hintTimer = 0, sensorTimer = 0;
  let frame = 0, previousTime = 0, started = 0;
  let x = 0, y = 0, targetX = 0, targetY = 0, sensorX = 0, sensorY = 0;
  const clamp = n => Math.max(-1, Math.min(1, n));
  const delta = (a, b) => ((a - b + 540) % 360) - 180;
  const say = message => { status.textContent = message; };

  function queue() {
    if (!frame && !document.hidden && !reduce.matches) {
      scene.classList.add('moving');
      frame = requestAnimationFrame(draw);
    }
  }
  function draw(time) {
    frame = 0;
    const dt = previousTime ? Math.min(time - previousTime, 64) : 16;
    previousTime = time;
    if (mode === 'intro') {
      const progress = Math.min((time - started) / 3600, 1);
      const envelope = Math.sin(Math.PI * progress);
      targetX = Math.sin(progress * Math.PI * 2) * envelope * .85;
      targetY = Math.cos(progress * Math.PI * 2) * envelope * .5;
      if (progress === 1) {
        mode = ready ? 'sensor' : 'idle';
        targetX = ready ? sensorX : 0;
        targetY = ready ? sensorY : 0;
      }
    }
    const easing = 1 - Math.exp(-dt / 70);
    x += (targetX - x) * easing;
    y += (targetY - y) * easing;
    root.style.setProperty('--x', x.toFixed(4));
    root.style.setProperty('--y', y.toFixed(4));
    if (mode === 'intro' || Math.abs(x - targetX) + Math.abs(y - targetY) > .001) queue();
    else { previousTime = 0; scene.classList.remove('moving'); }
  }
  function clearTimers() {
    clearTimeout(hintTimer);
    clearTimeout(sensorTimer);
    hintTimer = sensorTimer = 0;
  }
  function disconnect() {
    window.removeEventListener('deviceorientation', onOrientation);
    listening = false;
    clearTimers();
    baseline = null;
    ready = false;
    activation.hidden = true;
  }
  function onOrientation(event) {
    if (!listening || document.hidden || reduce.matches ||
        !Number.isFinite(event.beta) || !Number.isFinite(event.gamma)) return;
    if (!ready) {
      ready = true;
      clearTimers();
      activation.hidden = true;
      hint.textContent = 'Наклони телефон. Сцена изменит перспективу.';
      say('Реакция на наклон включена.');
    }
    if (!baseline) baseline = { beta: event.beta, gamma: event.gamma };
    const horizontal = delta(event.gamma, baseline.gamma) / 8;
    const vertical = delta(event.beta, baseline.beta) / 8;
    const angle = (screen.orientation?.angle ?? window.orientation ?? 0) * Math.PI / 180;
    sensorX = clamp(horizontal * Math.cos(angle) + vertical * Math.sin(angle));
    sensorY = clamp(vertical * Math.cos(angle) - horizontal * Math.sin(angle));
    if (mode !== 'intro') {
      mode = 'sensor';
      targetX = sensorX;
      targetY = sensorY;
    }
    queue();
  }
  function connect() {
    if (!supported || listening || declined || reduce.matches || document.hidden) return;
    // Subscribing is silent; requestPermission is only called on a scene tap.
    listening = true;
    window.addEventListener('deviceorientation', onOrientation, { passive: true });
    if (needsPermission && (coarse.matches || !fine.matches)) {
      hintTimer = setTimeout(() => {
        if (!ready && !pending && !declined && !document.hidden && !reduce.matches) activation.hidden = false;
      }, 700);
    }
  }
  activation.addEventListener('click', async () => {
    if (!needsPermission || pending || reduce.matches || document.hidden) return;
    pending = true;
    activation.disabled = true;
    try {
      // Keep this call within the deliberate user gesture required by Safari.
      const permission = await orientation.requestPermission();
      if (permission !== 'granted') {
        declined = true;
        disconnect();
        say('Доступ к наклону закрыт. Сцена остаётся доступной без датчиков.');
        return;
      }
      activation.hidden = true;
      if (document.hidden || reduce.matches || ready) return;
      connect();
      clearTimers();
      sensorTimer = setTimeout(() => {
        if (!ready) {
          disconnect();
          say('Датчики недоступны. Сцена остаётся доступной без наклона.');
        }
      }, 5000);
    } catch {
      declined = true;
      disconnect();
      say('Браузер не разрешил наклон. Сцена остаётся доступной без датчиков.');
    } finally {
      pending = false;
      activation.disabled = false;
    }
  });
  scene.addEventListener('pointermove', event => {
    if (!fine.matches || event.pointerType !== 'mouse' || reduce.matches || ready || pending) return;
    const bounds = scene.getBoundingClientRect();
    mode = 'pointer';
    targetX = clamp(((event.clientX - bounds.left) / bounds.width - .5) * 2);
    targetY = clamp(((event.clientY - bounds.top) / bounds.height - .5) * 2);
    queue();
  }, { passive: true });
  scene.addEventListener('pointerleave', () => {
    if (mode === 'pointer') { mode = 'idle'; targetX = targetY = 0; queue(); }
  });
  function resetOrientation() {
    baseline = null;
    sensorX = sensorY = 0;
    if (mode !== 'intro') { targetX = targetY = 0; queue(); }
  }
  screen.orientation?.addEventListener('change', resetOrientation);
  window.addEventListener('orientationchange', resetOrientation);
  function suspend() {
    disconnect();
    cancelAnimationFrame(frame);
    frame = 0;
    previousTime = 0;
    mode = 'idle';
    scene.classList.remove('moving');
  }
  function start(intro) {
    suspend();
    if (!assetsReady) return;
    if (world && poster) {
      world.hidden = reduce.matches;
      poster.hidden = !reduce.matches;
    }
    if (reduce.matches || document.hidden) {
      x = y = targetX = targetY = 0;
      root.style.setProperty('--x', 0);
      root.style.setProperty('--y', 0);
      hint.textContent = 'Глубина — с первого взгляда.';
      return;
    }
    hint.textContent = fine.matches ? 'Двигай курсором. Сцена изменит перспективу.' : 'Глубина — с первого взгляда.';
    if (intro) { mode = 'intro'; started = performance.now(); }
    else targetX = targetY = 0;
    queue();
    connect();
  }
  reduce.addEventListener('change', () => start(!reduce.matches));
  document.addEventListener('visibilitychange', () => document.hidden ? suspend() : start(false));
  window.addEventListener('pagehide', suspend);
  window.addEventListener('pageshow', event => { if (event.persisted) start(false); });
  if (layerImages.length) {
    Promise.all(layerImages.map(image => image.decode())).then(() => {
      assetsReady = true;
      start(true);
    }).catch(() => {
      suspend();
      say('Показываем неподвижную сцену.');
    });
  } else start(true);
})();
