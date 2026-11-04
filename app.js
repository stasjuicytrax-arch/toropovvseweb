(() => {
  'use strict';
  const root = document.documentElement;
  const scene = document.querySelector('.scene');
  const enable = document.querySelector('#enable');
  const pause = document.querySelector('#pause');
  const recenter = document.querySelector('#recenter');
  const replay = document.querySelector('#replay');
  const status = document.querySelector('#status');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const fine = matchMedia('(pointer: fine)');
  let mode = 'idle', paused = false, baseline = null, sensorTimer = 0;
  let frame = 0, previousTime = 0, started = 0, received = false, pending = false;
  let x = 0, y = 0, targetX = 0, targetY = 0;
  const clamp = n => Math.max(-1, Math.min(1, n));
  const delta = (a, b) => ((a - b + 540) % 360) - 180;
  const say = message => { status.textContent = message; };

  function queue() {
    if (!frame && !document.hidden && !paused && !reduce.matches) {
      scene.classList.add('moving');
      frame = requestAnimationFrame(draw);
    }
  }
  function draw(time) {
    frame = 0;
    const dt = previousTime ? Math.min(time - previousTime, 64) : 16;
    previousTime = time;
    if (mode === 'demo') {
      const progress = Math.min((time - started) / 3600, 1);
      const envelope = Math.sin(Math.PI * progress);
      targetX = Math.sin(progress * Math.PI * 2) * envelope * .85;
      targetY = Math.cos(progress * Math.PI * 2) * envelope * .5;
      if (progress === 1) { mode = 'idle'; targetX = targetY = 0; }
    }
    const easing = 1 - Math.exp(-dt / 85);
    x += (targetX - x) * easing;
    y += (targetY - y) * easing;
    root.style.setProperty('--x', x.toFixed(4));
    root.style.setProperty('--y', y.toFixed(4));
    if (mode === 'demo' || Math.abs(x - targetX) + Math.abs(y - targetY) > .001) queue();
    else { previousTime = 0; scene.classList.remove('moving'); }
  }
  function stopSensor() {
    window.removeEventListener('deviceorientation', onOrientation);
    clearTimeout(sensorTimer);
    sensorTimer = 0;
    baseline = null;
    recenter.disabled = true;
    enable.textContent = 'Включить наклон';
  }
  function neutral() { targetX = targetY = 0; queue(); }
  function onOrientation(event) {
    if (paused || reduce.matches || mode !== 'sensor' ||
        !Number.isFinite(event.beta) || !Number.isFinite(event.gamma)) return;
    if (!received) {
      received = true;
      clearTimeout(sensorTimer);
      recenter.disabled = false;
      enable.textContent = 'Наклон включён';
      say('Наклон работает. Держи телефон удобно и слегка покачай его.');
    }
    if (!baseline) baseline = { beta: event.beta, gamma: event.gamma };
    const horizontal = delta(event.gamma, baseline.gamma) / 18;
    const vertical = delta(event.beta, baseline.beta) / 18;
    const angle = (screen.orientation?.angle ?? window.orientation ?? 0) * Math.PI / 180;
    targetX = clamp(horizontal * Math.cos(angle) + vertical * Math.sin(angle));
    targetY = clamp(vertical * Math.cos(angle) - horizontal * Math.sin(angle));
    queue();
  }
  function idleMessage() {
    say(fine.matches ? 'Поводи курсором по сцене. На телефоне включи наклон.' :
      'Нажми «Включить наклон». Браузер может запросить разрешение.');
  }
  function startDemo() {
    if (reduce.matches || pending) return;
    stopSensor();
    paused = false;
    pause.textContent = 'Пауза';
    mode = 'demo';
    started = performance.now();
    queue();
    idleMessage();
  }
  enable.addEventListener('click', async () => {
    if (pending || reduce.matches) return;
    if (!window.isSecureContext) {
      say('Для датчиков открой страницу по HTTPS. Пока можно показать автоматическое движение.');
      return;
    }
    const orientation = window.DeviceOrientationEvent;
    if (!orientation) { say('Этот браузер не предоставляет датчики. Нажми «Показать движение».'); return; }
    pending = true;
    enable.disabled = true;
    try {
      // Must be invoked directly from the click handler, before any other await.
      if (typeof orientation.requestPermission === 'function') {
        const permission = await orientation.requestPermission();
        if (permission !== 'granted') {
          say('Доступ к наклону закрыт. Можно показать движение без датчиков.');
          return;
        }
      }
      if (document.hidden || reduce.matches) return;
      stopSensor();
      received = false;
      paused = false;
      pause.textContent = 'Пауза';
      mode = 'sensor';
      neutral();
      say('Ждём датчики. Держи телефон в удобном положении.');
      window.addEventListener('deviceorientation', onOrientation, { passive: true });
      sensorTimer = setTimeout(() => {
        if (!received) {
          stopSensor();
          mode = 'idle';
          neutral();
          say('Данные наклона не поступают. Проверь разрешение браузера или нажми «Показать движение».');
        }
      }, 5000);
    } catch {
      say('Браузер не разрешил доступ к наклону. Попробуй снова или покажи движение без датчиков.');
    } finally {
      pending = false;
      enable.disabled = reduce.matches;
    }
  });
  recenter.addEventListener('click', () => {
    baseline = null;
    neutral();
    say('Новое положение станет центром при следующем показании датчика.');
  });
  pause.addEventListener('click', () => {
    paused = !paused;
    pause.textContent = paused ? 'Продолжить' : 'Пауза';
    if (paused) {
      cancelAnimationFrame(frame);
      frame = 0;
      previousTime = 0;
      stopSensor();
      mode = 'idle';
      scene.classList.remove('moving');
      say('Движение на паузе.');
    } else startDemo();
  });
  replay.addEventListener('click', startDemo);
  scene.addEventListener('pointermove', event => {
    if (!fine.matches || event.pointerType !== 'mouse' || paused || reduce.matches || mode === 'sensor' || pending) return;
    const bounds = scene.getBoundingClientRect();
    mode = 'pointer';
    targetX = clamp(((event.clientX - bounds.left) / bounds.width - .5) * 2);
    targetY = clamp(((event.clientY - bounds.top) / bounds.height - .5) * 2);
    queue();
  }, { passive: true });
  scene.addEventListener('pointerleave', () => {
    if (mode === 'pointer') { mode = 'idle'; neutral(); }
  });
  function resetOrientation() { baseline = null; neutral(); }
  screen.orientation?.addEventListener('change', resetOrientation);
  window.addEventListener('orientationchange', resetOrientation);
  function applyPreference() {
    stopSensor();
    cancelAnimationFrame(frame);
    frame = 0;
    previousTime = 0;
    mode = 'idle';
    x = y = targetX = targetY = 0;
    root.style.setProperty('--x', 0);
    root.style.setProperty('--y', 0);
    scene.classList.remove('moving');
    enable.disabled = pause.disabled = replay.disabled = reduce.matches;
    if (reduce.matches) say('В устройстве включено уменьшение движения. Показываем неподвижную сцену.');
    else startDemo();
  }
  reduce.addEventListener('change', applyPreference);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      stopSensor();
      cancelAnimationFrame(frame);
      frame = 0;
      previousTime = 0;
      mode = 'idle';
      scene.classList.remove('moving');
      say('Движение остановлено. Наклон можно включить снова.');
    } else if (!paused && !reduce.matches) neutral();
  });
  window.addEventListener('pagehide', () => {
    stopSensor();
    cancelAnimationFrame(frame);
    frame = 0;
  });
  applyPreference();
})();
