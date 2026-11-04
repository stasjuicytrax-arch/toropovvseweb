const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');
const code = fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8');

function setup({ reduced = false, permission, secure = true, supported = true, finePointer = false } = {}) {
  const events = new Map(), timers = new Map(), rafs = new Map(), vars = new Map();
  let seq = 0, permissionCalls = 0;
  const elements = new Map();
  for (const name of ['.scene', '#sensor-activation', '#scene-hint', '#status']) {
    elements.set(name, {
      disabled: false, hidden: true, textContent: '', listeners: {},
      classList: { add() {}, remove() {} },
      addEventListener(event, fn) { this.listeners[event] = fn; },
      getBoundingClientRect() { return { left: 0, top: 0, width: 300, height: 400 }; }
    });
  }
  const document = {
    hidden: false, documentElement: { style: { setProperty(k, v) { vars.set(k, v); } } },
    querySelector: s => elements.get(s), querySelectorAll: () => [],
    addEventListener(event, fn) { events.set('document:' + event, fn); }
  };
  const window = {
    isSecureContext: secure, DeviceOrientationEvent: supported ? {} : undefined,
    addEventListener(event, fn) { events.set(event, fn); },
    removeEventListener(event, fn) { if (events.get(event) === fn) events.delete(event); }
  };
  if (permission) window.DeviceOrientationEvent.requestPermission = async () => {
    permissionCalls++;
    if (permission === 'error') throw new Error('Permission unavailable');
    return permission;
  };
  const preference = { matches: reduced, addEventListener(_, fn) { this.change = fn; } };
  vm.runInNewContext(code, {
    document, window, screen: { orientation: { angle: 0, addEventListener() {} } },
    performance: { now: () => 0 },
    matchMedia: q => q.includes('reduced') ? preference : { matches: q === '(pointer: fine)' && finePointer },
    setTimeout(fn, delay) { timers.set(++seq, { fn, delay }); return seq; },
    clearTimeout: id => timers.delete(id),
    requestAnimationFrame(fn) { rafs.set(++seq, fn); return seq; },
    cancelAnimationFrame: id => rafs.delete(id)
  });
  return {
    events, rafs, vars, document, preference,
    activation: elements.get('#sensor-activation'),
    permissionCalls: () => permissionCalls,
    status: () => elements.get('#status').textContent,
    click: () => elements.get('#sensor-activation').listeners.click(),
    orient(beta, gamma) { events.get('deviceorientation')?.({ beta, gamma }); },
    draw(time) { const pending = [...rafs.values()]; rafs.clear(); pending.forEach(fn => fn(time)); },
    timeout(delay) {
      for (const [id, timer] of [...timers]) if (timer.delay === delay) { timers.delete(id); timer.fn(); }
    }
  };
}

test('starts motion and silently subscribes without requesting permission', () => {
  const t = setup({ permission: 'granted' });
  assert(t.events.has('deviceorientation'));
  assert(t.rafs.size > 0);
  assert.equal(t.permissionCalls(), 0);
  t.timeout(700);
  assert.equal(t.activation.hidden, false);
});

test('receiving already-authorized sensors needs no tap or permission call', () => {
  const t = setup({ permission: 'granted' });
  t.orient(40, 0);
  t.timeout(700);
  assert.equal(t.activation.hidden, true);
  assert.equal(t.permissionCalls(), 0);
});

test('desktop with only a mouse does not show a touch permission hint', () => {
  const t = setup({ permission: 'granted', finePointer: true });
  t.timeout(700);
  assert.equal(t.activation.hidden, true);
  assert.equal(t.permissionCalls(), 0);
});

test('automatically calibrates sensors, limits movement and follows tilt', () => {
  const t = setup();
  t.orient(40, 0);
  t.draw(3600);
  t.orient(49, 9);
  t.draw(3616);
  assert(+t.vars.get('--x') > 0);
  assert(+t.vars.get('--y') > 0);
  t.orient(120, 90);
  for (let time = 3632; time < 5000; time += 16) t.draw(time);
  assert(+t.vars.get('--x') <= 1);
  assert(+t.vars.get('--y') <= 1);
});

test('permission is requested only on scene activation and hint disappears', async () => {
  const t = setup({ permission: 'granted' });
  t.timeout(700);
  await t.click();
  assert.equal(t.permissionCalls(), 1);
  assert.equal(t.activation.hidden, true);
  t.orient(40, 0);
  t.timeout(5000);
  assert(t.events.has('deviceorientation'));
});

test('a small three-degree tilt produces a clearly usable movement range', () => {
  const t = setup();
  t.orient(40, 0);
  t.draw(3600);
  t.orient(43, 3);
  for (let time = 3616; time < 5000; time += 16) t.draw(time);
  assert(+t.vars.get('--x') >= .37);
  assert(+t.vars.get('--y') >= .37);
});

for (const permission of ['denied', 'error']) {
  test(`${permission} permission preserves fallback without repeated prompts`, async () => {
    const t = setup({ permission });
    await t.click();
    assert.equal(t.activation.hidden, true);
    assert(!t.events.has('deviceorientation'));
    t.document.hidden = true;
    t.events.get('document:visibilitychange')();
    t.document.hidden = false;
    t.events.get('document:visibilitychange')();
    assert(!t.events.has('deviceorientation'));
    assert.equal(t.permissionCalls(), 1);
  });
}

test('missing readings after consent give a safe fallback', async () => {
  const t = setup({ permission: 'granted' });
  await t.click();
  t.timeout(5000);
  assert(!t.events.has('deviceorientation'));
  assert(t.status().includes('недоступны'));
  assert.equal(t.activation.hidden, true);
});

for (const options of [{ secure: false }, { supported: false }]) {
  test(`fallback works without sensors: ${JSON.stringify(options)}`, () => {
    const t = setup(options);
    assert(!t.events.has('deviceorientation'));
    assert(t.rafs.size > 0);
    assert.equal(t.activation.hidden, true);
    for (let time = 16; time < 5000; time += 16) t.draw(time);
    assert.equal(t.rafs.size, 0);
  });
}

test('reduced motion prevents autoplay, sensors and activation prompt', () => {
  const t = setup({ reduced: true, permission: 'granted' });
  assert.equal(t.rafs.size, 0);
  assert(!t.events.has('deviceorientation'));
  assert.equal(t.activation.hidden, true);
  assert.equal(t.permissionCalls(), 0);
});

test('hiding suspends all motion; returning silently reconnects and recalibrates', () => {
  const t = setup();
  t.orient(40, 0);
  t.document.hidden = true;
  t.events.get('document:visibilitychange')();
  assert(!t.events.has('deviceorientation'));
  assert.equal(t.rafs.size, 0);
  t.document.hidden = false;
  t.events.get('document:visibilitychange')();
  assert(t.events.has('deviceorientation'));
  t.orient(65, 20);
  t.draw(16);
  assert.equal(+t.vars.get('--x'), 0);
  assert.equal(+t.vars.get('--y'), 0);
});
