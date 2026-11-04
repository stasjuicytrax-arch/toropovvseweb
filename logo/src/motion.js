export const clamp = value => Math.max(-1, Math.min(1, value));
const difference = (a, b) => ((a - b + 540) % 360) - 180;

export function orientationPose(beta, gamma, baseline, angle = 0) {
  const horizontal = difference(gamma, baseline.gamma) / 8;
  const vertical = difference(beta, baseline.beta) / 8;
  const radians = angle * Math.PI / 180;
  return {
    x: clamp(horizontal * Math.cos(radians) + vertical * Math.sin(radians)),
    y: clamp(vertical * Math.cos(radians) - horizontal * Math.sin(radians))
  };
}

export function connectMotion({ stage, activation, status, onPose,
  win = window, doc = document }) {
  const reduced = win.matchMedia('(prefers-reduced-motion: reduce)');
  const fine = win.matchMedia('(pointer: fine)');
  const coarse = win.matchMedia('(any-pointer: coarse)');
  const Orientation = win.DeviceOrientationEvent;
  const supported = win.isSecureContext && Boolean(Orientation);
  const permissionRequired = supported && typeof Orientation.requestPermission === 'function';
  const cleanup = [];
  let frame = 0, previousTime = 0, x = 0, y = 0, targetX = 0, targetY = 0;
  let baseline = null, ready = false, listening = false, declined = false, pending = false;
  let intro = !reduced.matches, started = win.performance.now(), hintTimer = 0, sensorTimer = 0;
  let dragging = false, bounds = stage.getBoundingClientRect(), destroyed = false;
  if (intro) { x = -.95; y = .28; }
  const say = message => { status.textContent = message; };
  const on = (target, event, handler, options) => {
    target.addEventListener(event, handler, options);
    cleanup.push(() => target.removeEventListener(event, handler, options));
  };
  function queue() {
    if (!frame && !doc.hidden && !reduced.matches && !destroyed) frame = win.requestAnimationFrame(tick);
  }
  function tick(time) {
    frame = 0;
    const dt = previousTime ? Math.min(time - previousTime, 64) : 16;
    previousTime = time;
    if (intro) {
      const progress = Math.min((time - started) / 3200, 1);
      const envelope = (1 - progress) ** 3;
      targetX = -.95 * envelope;
      targetY = .28 * envelope;
      if (progress === 1) intro = false;
    }
    const ease = 1 - Math.exp(-dt / 85);
    x += (targetX - x) * ease;
    y += (targetY - y) * ease;
    onPose(x, y);
    if (intro || Math.abs(x - targetX) + Math.abs(y - targetY) > .0008) queue();
    else previousTime = 0;
  }
  function cancelTimers() {
    win.clearTimeout(hintTimer);
    win.clearTimeout(sensorTimer);
    hintTimer = sensorTimer = 0;
  }
  function stopSensors() {
    win.removeEventListener('deviceorientation', orient);
    listening = ready = false;
    baseline = null;
    cancelTimers();
    activation.hidden = true;
  }
  function orient(event) {
    if (!listening || doc.hidden || reduced.matches ||
      !Number.isFinite(event.beta) || !Number.isFinite(event.gamma)) return;
    if (!ready) {
      ready = true;
      cancelTimers();
      activation.hidden = true;
      say('Перспектива следует за наклоном телефона.');
    }
    if (!baseline) baseline = { beta: event.beta, gamma: event.gamma };
    const pose = orientationPose(event.beta, event.gamma, baseline,
      win.screen?.orientation?.angle ?? win.orientation ?? 0);
    if (intro && Math.abs(pose.x) + Math.abs(pose.y) < .025) return;
    intro = false;
    targetX = pose.x;
    targetY = pose.y;
    queue();
  }
  function startSensors() {
    if (!supported || listening || reduced.matches || declined || doc.hidden) return;
    listening = true;
    win.addEventListener('deviceorientation', orient, { passive: true });
    if (permissionRequired && (coarse.matches || !fine.matches)) {
      hintTimer = win.setTimeout(() => {
        if (!ready && !pending && !doc.hidden && !reduced.matches) activation.hidden = false;
      }, 700);
    }
  }
  on(activation, 'click', async () => {
    if (!permissionRequired || pending || reduced.matches || doc.hidden) return;
    pending = true;
    activation.disabled = true;
    try {
      const result = await Orientation.requestPermission();
      activation.hidden = true;
      if (result !== 'granted') {
        declined = true;
        stopSensors();
        say('Наклон закрыт. Пространство можно исследовать касанием.');
        return;
      }
      if (destroyed || doc.hidden || reduced.matches || ready) return;
      startSensors();
      cancelTimers();
      sensorTimer = win.setTimeout(() => {
        if (!ready) { stopSensors(); say('Используй касание для изменения перспективы.'); }
      }, 5000);
    } catch {
      declined = true;
      stopSensors();
      say('Используй касание для изменения перспективы.');
    } finally { pending = false; activation.disabled = false; }
  });
  on(stage, 'pointerdown', event => {
    if (event.pointerType === 'touch' && !ready) dragging = true;
  }, { passive: true });
  on(stage, 'pointermove', event => {
    if (reduced.matches || pending || ready || doc.hidden) return;
    if (event.pointerType === 'touch' ? !dragging : !fine.matches) return;
    intro = false;
    targetX = clamp(((event.clientX - bounds.left) / bounds.width - .5) * 2);
    targetY = clamp(((event.clientY - bounds.top) / bounds.height - .5) * 2);
    queue();
  }, { passive: true });
  function rest() {
    dragging = false;
    if (!ready && !intro) { targetX = targetY = 0; queue(); }
  }
  on(stage, 'pointerleave', rest);
  on(stage, 'pointerup', () => { dragging = false; });
  on(stage, 'pointercancel', rest);
  on(stage, 'keydown', event => {
    if (reduced.matches || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Escape'].includes(event.key)) return;
    event.preventDefault();
    intro = false;
    if (event.key === 'Escape') targetX = targetY = 0;
    if (event.key === 'ArrowLeft') targetX = clamp(targetX - .2);
    if (event.key === 'ArrowRight') targetX = clamp(targetX + .2);
    if (event.key === 'ArrowUp') targetY = clamp(targetY - .2);
    if (event.key === 'ArrowDown') targetY = clamp(targetY + .2);
    queue();
  });
  on(win, 'resize', () => { bounds = stage.getBoundingClientRect(); });
  function recalibrate() { baseline = null; targetX = targetY = 0; if (!intro) queue(); }
  if (win.screen?.orientation) on(win.screen.orientation, 'change', recalibrate);
  on(win, 'orientationchange', recalibrate);
  function suspend() {
    stopSensors();
    win.cancelAnimationFrame(frame);
    frame = previousTime = 0;
  }
  function resume() {
    if (destroyed) return;
    intro = false;
    targetX = targetY = 0;
    if (reduced.matches) { x = y = 0; onPose(0, 0); }
    else { queue(); startSensors(); }
  }
  on(doc, 'visibilitychange', () => doc.hidden ? suspend() : resume());
  on(reduced, 'change', () => { suspend(); resume(); });
  on(win, 'pagehide', suspend);
  on(win, 'pageshow', event => { if (event.persisted) resume(); });
  onPose(x, y);
  queue();
  startSensors();
  return {
    destroy() {
      destroyed = true;
      suspend();
      for (const remove of cleanup) remove();
    }
  };
}
