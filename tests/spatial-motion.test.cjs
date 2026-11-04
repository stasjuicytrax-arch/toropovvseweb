const test = require('node:test');
const assert = require('node:assert/strict');

class Surface {
  listeners = new Map();
  hidden = false;
  addEventListener(event, fn) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event).add(fn);
  }
  removeEventListener(event, fn) { this.listeners.get(event)?.delete(fn); }
  async emit(event, data = {}) {
    for (const fn of [...(this.listeners.get(event) || [])]) await fn(data);
  }
  count(event) { return this.listeners.get(event)?.size || 0; }
}

async function setup({ reduced = false, permission } = {}) {
  const { connectMotion } = await import('../logo/src/motion.js');
  const win = new Surface(), doc = new Surface(), stage = new Surface(), activation = new Surface();
  const preference = new Surface();
  preference.matches = reduced;
  const frames = new Map(), timers = new Map(), poses = [];
  let sequence = 0, calls = 0;
  Object.assign(win, {
    isSecureContext: true, DeviceOrientationEvent: {}, performance: { now: () => 0 },
    screen: { orientation: Object.assign(new Surface(), { angle: 0 }) },
    matchMedia: query => query.includes('reduced') ? preference : Object.assign(new Surface(), { matches: query.includes('coarse') }),
    requestAnimationFrame: fn => { frames.set(++sequence, fn); return sequence; },
    cancelAnimationFrame: id => frames.delete(id),
    setTimeout: (fn, delay) => { timers.set(++sequence, { fn, delay }); return sequence; },
    clearTimeout: id => timers.delete(id)
  });
  if (permission) win.DeviceOrientationEvent.requestPermission = async () => { calls++; return permission; };
  stage.getBoundingClientRect = () => ({ left: 0, top: 0, width: 390, height: 844 });
  const controller = connectMotion({ win, doc, stage, activation, status: {}, onPose: (x, y) => poses.push({ x, y }) });
  return {
    win, doc, stage, activation, controller, frames, poses,
    calls: () => calls,
    async orient(beta, gamma) { await win.emit('deviceorientation', { beta, gamma }); },
    draw(time) { const batch = [...frames.values()]; frames.clear(); batch.forEach(fn => fn(time)); },
    timer(delay) { for (const [id, timer] of [...timers]) if (timer.delay === delay) { timers.delete(id); timer.fn(); } }
  };
}

test('actual tilt interrupts the camera entrance and rendering stops once settled', async () => {
  const t = await setup();
  await t.orient(40, 0);
  await t.orient(43, 3);
  for (let time = 16; time < 1800; time += 16) t.draw(time);
  const last = t.poses.at(-1);
  assert(Math.abs(last.x - .375) < .002);
  assert(Math.abs(last.y - .375) < .002);
  assert.equal(t.frames.size, 0);
  for (let sample = 0; sample < 10; sample++) await t.orient(43, 3);
  await t.orient(43.001, 3.001);
  assert.equal(t.frames.size, 0, 'stable sensor samples must not wake the renderer');
  t.controller.destroy();
});

test('reduced motion renders one neutral frame without sensors or autoplay', async () => {
  const t = await setup({ reduced: true, permission: 'granted' });
  assert.deepEqual(t.poses, [{ x: 0, y: 0 }]);
  assert.equal(t.frames.size, 0);
  assert.equal(t.win.count('deviceorientation'), 0);
  assert.equal(t.calls(), 0);
  t.controller.destroy();
});

test('permission waits for scene activation and denial leaves exploration available', async () => {
  const t = await setup({ permission: 'denied' });
  assert.equal(t.calls(), 0);
  t.timer(700);
  assert.equal(t.activation.hidden, false);
  await t.activation.emit('click');
  assert.equal(t.calls(), 1);
  assert.equal(t.activation.hidden, true);
  assert.equal(t.win.count('deviceorientation'), 0);
  t.controller.destroy();
});

test('hiding and destruction release sensors, animation and event handlers', async () => {
  const t = await setup();
  assert.equal(t.win.count('deviceorientation'), 1);
  t.doc.hidden = true;
  await t.doc.emit('visibilitychange');
  assert.equal(t.frames.size, 0);
  assert.equal(t.win.count('deviceorientation'), 0);
  t.doc.hidden = false;
  await t.doc.emit('visibilitychange');
  assert.equal(t.win.count('deviceorientation'), 1);
  t.controller.destroy();
  assert.equal(t.frames.size, 0);
  for (const target of [t.win, t.doc, t.stage, t.activation]) {
    for (const listeners of target.listeners.values()) assert.equal(listeners.size, 0);
  }
});
