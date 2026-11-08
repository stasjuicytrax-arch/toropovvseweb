const experience = document.querySelector('#experience');
const stage = document.querySelector('#stage');
const portrait = document.querySelector('#portrait');
const reel = document.querySelector('#reel');
const scene = document.querySelector('#scene');
const identity = document.querySelector('#identity');
const projects = document.querySelector('#projects');
const caption = document.querySelector('#caption');
const skip = document.querySelector('#skip');
const advance = document.querySelector('#advance');
const replay = document.querySelector('#replay');
const context = scene.getContext('2d', { alpha: false });
const wide = matchMedia('(min-width: 900px) and (orientation: landscape)');
const scrollMode = matchMedia('(min-width: 900px) and (orientation: landscape) and (pointer: fine)');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

// Curves traced inside the original frames. Coordinates are in the 1080 × 1920 photo.
const lenses = new Path2D();
lenses.addPath(new Path2D('M 46 111 C 49 78 67 57 103 51 C 135 45 197 46 228 54 C 255 61 273 74 268 97 C 262 128 247 163 222 187 C 193 215 159 224 121 214 C 86 206 59 188 49 155 C 44 140 44 125 46 111 Z'));
lenses.addPath(new Path2D('M 333 96 C 333 75 350 63 379 59 C 415 54 475 54 499 66 C 531 79 545 105 543 140 C 540 182 520 207 484 221 C 456 232 420 230 397 217 C 366 201 346 168 337 134 C 333 119 331 106 333 96 Z'));

const lensOrigin = { x: 270, y: 800 };
const lensBounds = { left: 314, right: 815, top: 844, bottom: 1030 };
const cameraPoint = { x: 419, y: 923 };
const waitBeforePullback = 3.2;
const pullbackDuration = 1120;
const reflectionDuration = 4200;
const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
const mix = (start, end, amount) => start + (end - start) * amount;
const smooth = value => value * value * (3 - 2 * value);

let geometry;
let progress = 1;
let active = false;
let transitionAt = null;
let reflectedAt = null;
let frame = 0;
let loadTimer = 0;
let playRequest = 0;
let photoReady = false;
let focusProjectsOnReveal = false;

function measure() {
  const { width, height } = stage.getBoundingClientRect();
  const dpr = Math.min(devicePixelRatio || 1, 1.6);
  const isWide = wide.matches;
  const eyeLine = height * (isWide ? .43 : .45);
  const endScale = Math.max((height - eyeLine) / (1920 - 930), isWide ? height / 1540 : width / 1080);
  const endX = width * (isWide ? .55 : .5) - 540 * endScale;
  const endY = eyeLine - 930 * endScale;

  geometry = {
    width, height, dpr, endScale, endX, endY,
    startScale: Math.max(width / 178, height / 112) * 1.25,
    travel: scrollMode.matches ? Math.min(480, Math.round(height * .64)) : 0,
  };
  scene.width = Math.max(1, Math.round(width * dpr));
  scene.height = Math.max(1, Math.round(height * dpr));
  updateTravel();
  scheduleFrame();
}

function updateTravel() {
  experience.style.setProperty('--travel', `${active ? geometry.travel : 0}px`);
}

function setState(state) {
  if (stage.dataset.state === state) return;
  const showPortrait = state === 'portrait';
  const previousFocus = document.activeElement;

  stage.dataset.state = state;
  identity.hidden = !showPortrait;
  projects.hidden = !showPortrait;
  caption.hidden = !showPortrait;
  skip.hidden = showPortrait;
  advance.hidden = state !== 'film' || !scrollMode.matches;
  replay.hidden = !showPortrait || reducedMotion.matches;

  if (showPortrait && (focusProjectsOnReveal || previousFocus === skip || previousFocus === advance)) {
    focusProjectsOnReveal = false;
    projects.focus({ preventScroll: true });
  } else if (!showPortrait && previousFocus === replay) {
    skip.focus({ preventScroll: true });
  }
}

function coverVideo(x, y, width, height) {
  const scale = Math.max(width / reel.videoWidth, height / reel.videoHeight);
  const sourceWidth = width / scale;
  const sourceHeight = height / scale;
  context.drawImage(
    reel, (reel.videoWidth - sourceWidth) / 2, (reel.videoHeight - sourceHeight) / 2,
    sourceWidth, sourceHeight, x, y, width, height,
  );
}

function draw(amount, useVideo) {
  if (!photoReady || !geometry.width || !geometry.height) return;
  const { width, height, dpr, startScale, endScale, endX, endY } = geometry;
  context.setTransform(dpr, 0, 0, dpr, 0, 0);

  if (amount === 0 && useVideo) {
    coverVideo(0, 0, width, height);
    scene.hidden = false;
    return;
  }

  const zoom = endScale * (startScale / endScale) ** ((1 - amount) ** 1.3);
  const anchorX = mix(width / 2, endX + cameraPoint.x * endScale, amount);
  const anchorY = mix(height / 2, endY + cameraPoint.y * endScale, amount);
  const x = anchorX - cameraPoint.x * zoom;
  const y = anchorY - cameraPoint.y * zoom;

  context.fillStyle = '#e9e8e5';
  context.fillRect(0, 0, width, height);
  context.drawImage(portrait, x, y, 1080 * zoom, 1920 * zoom);

  if (wide.matches && amount > .84) {
    context.fillStyle = `rgba(23, 25, 21, ${.13 * smooth((amount - .84) / .16)})`;
    context.fillRect(x, 0, 1, height);
    context.fillRect(x + 1080 * zoom - 1, 0, 1, height);
  }

  if (useVideo) {
    const left = clamp(x + lensBounds.left * zoom, 0, width);
    const right = clamp(x + lensBounds.right * zoom, 0, width);
    const top = clamp(y + lensBounds.top * zoom, 0, height);
    const bottom = clamp(y + lensBounds.bottom * zoom, 0, height);

    if (right > left && bottom > top) {
      context.save();
      context.translate(x + lensOrigin.x * zoom, y + lensOrigin.y * zoom);
      context.scale(zoom, zoom);
      context.clip(lenses);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.globalAlpha = 1 - .12 * smooth(clamp((amount - .68) / .32, 0, 1));
      coverVideo(left, top, right - left, bottom - top);
      context.restore();
    }
  }

  scene.hidden = false;
}

function scheduleFrame() {
  if (!frame) frame = requestAnimationFrame(update);
}

function update(now) {
  frame = 0;
  const hasFrame = reel.readyState >= 2 && reel.videoWidth > 0;
  let easing = false;

  if (active && hasFrame) {
    if (scrollMode.matches) {
      const target = clamp(scrollY / geometry.travel, 0, 1);
      const distance = target - progress;
      easing = Math.abs(distance) > .002;
      progress = easing ? progress + distance * .18 : target;
      if (target < 1 && reflectedAt !== null && reel.paused) playReel();
    } else {
      if (transitionAt === null && reel.currentTime >= waitBeforePullback) transitionAt = now;
      if (transitionAt !== null) {
        progress = smooth(clamp((now - transitionAt) / pullbackDuration, 0, 1));
        easing = progress < 1;
      }
    }

    setState(progress === 1 ? 'portrait' : progress < .05 ? 'film' : 'pullback');
    if (progress === 1) {
      reflectedAt ??= now;
      if (now - reflectedAt > reflectionDuration) reel.pause();
    } else {
      reflectedAt = null;
    }
  }

  if (!active || hasFrame) draw(progress, active && hasFrame);
  if (active && (!reel.paused || easing)) scheduleFrame();
}

function showPortrait() {
  playRequest += 1;
  clearTimeout(loadTimer);
  active = false;
  progress = 1;
  reel.pause();
  updateTravel();
  setState('portrait');
  scheduleFrame();
}

function armFallback() {
  clearTimeout(loadTimer);
  loadTimer = setTimeout(showPortrait, 6500);
}

function playReel() {
  const request = ++playRequest;
  reel.play().catch(() => {
    if (request === playRequest) showPortrait();
  });
}

function start() {
  if (!photoReady || reducedMotion.matches) return;
  active = true;
  progress = 0;
  transitionAt = null;
  reflectedAt = null;
  reel.currentTime = 0;
  reel.muted = true;
  scene.hidden = true;
  updateTravel();
  window.scrollTo({ top: 0, behavior: 'instant' });
  setState('loading');
  armFallback();
  playReel();
}

if (context) {
  measure();
  const resize = new ResizeObserver(measure);
  resize.observe(stage);
  scrollMode.addEventListener('change', () => {
    if (active) start();
  });
  reducedMotion.addEventListener('change', () => {
    if (reducedMotion.matches) {
      showPortrait();
      replay.hidden = true;
    } else if (photoReady) {
      replay.hidden = false;
    }
  });

  addEventListener('scroll', scheduleFrame, { passive: true });
  reel.addEventListener('playing', () => {
    clearTimeout(loadTimer);
    scheduleFrame();
  });
  reel.addEventListener('waiting', () => {
    if (active) armFallback();
  });
  reel.addEventListener('error', showPortrait);

  skip.addEventListener('click', showPortrait);
  advance.addEventListener('click', event => {
    focusProjectsOnReveal = event.detail === 0;
    window.scrollTo({ top: geometry.travel, behavior: 'instant' });
  });
  replay.addEventListener('click', start);

  portrait.decode().then(() => {
    photoReady = true;
    if (reducedMotion.matches) scheduleFrame();
    else start();
  }).catch(showPortrait);
}
