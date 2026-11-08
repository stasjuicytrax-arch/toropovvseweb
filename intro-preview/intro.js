const experience = document.querySelector('#experience');
const stage = document.querySelector('#stage');
const portrait = document.querySelector('#portrait');
const reel = document.querySelector('#reel');
const scene = document.querySelector('#scene');
const heroContent = document.querySelector('#hero-content');
const skip = document.querySelector('#skip');
const advance = document.querySelector('#advance');
const context = scene.getContext('2d', { alpha: false });
const wide = matchMedia('(min-width: 960px) and (min-aspect-ratio: 4/3)');
const scrollMode = matchMedia('(min-width: 960px) and (min-aspect-ratio: 4/3) and (pointer: fine)');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

// Both contours are traced inside the tilted frames in the supplied photo.
const lenses = new Path2D();
lenses.addPath(new Path2D('M 35 80 C 36 58 45 38 63 33 C 84 27 113 33 144 44 C 161 50 176 57 173 72 C 170 92 155 117 137 131 C 116 147 92 151 71 141 C 47 130 34 107 35 80 Z'));
lenses.addPath(new Path2D('M 211 92 C 216 82 235 85 260 91 C 286 97 310 106 325 120 C 339 133 342 151 331 167 C 321 184 299 192 276 189 C 253 186 236 175 225 157 C 214 139 211 111 211 92 Z'));

const lensOrigin = { x: 440, y: 600 };
const lensBounds = { left: 473, right: 779, top: 628, bottom: 792 };
const cameraPoint = { x: 540, y: 684 };
const waitBeforePullback = 3.2;
const pullbackDuration = 1120;
const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
const mix = (start, end, amount) => start + (end - start) * amount;
const smooth = value => value * value * (3 - 2 * value);

let geometry;
let progress = 1;
let active = false;
let skipped = false;
let transitionAt = null;
let frame = 0;
let loadTimer = 0;
let playRequest = 0;
let photoReady = false;
let focusHeroOnReveal = false;
let lastPaint = -Infinity;

function measure() {
  const { width, height } = stage.getBoundingClientRect();
  const dpr = Math.min(devicePixelRatio || 1, 1.6);
  const isWide = wide.matches;
  const eyeLine = height * (isWide ? .40 : .41);
  const endScale = Math.max(eyeLine / 708, (height - eyeLine) / (1920 - 708), isWide ? height / 1300 : width / 1080);
  const endX = width / 2 - 598 * endScale;
  const endY = eyeLine - 708 * endScale;

  geometry = {
    width, height, dpr, endScale, endX, endY,
    startScale: Math.max(width / 98, height / 68) * 1.22,
    travel: scrollMode.matches ? Math.min(480, Math.round(height * .64)) : 0,
  };
  scene.width = Math.max(1, Math.round(width * dpr));
  scene.height = Math.max(1, Math.round(height * dpr));
  lastPaint = -Infinity;
  updateTravel();
  scheduleFrame();
}

function updateTravel() {
  experience.style.setProperty('--travel', `${active && !skipped ? geometry.travel : 0}px`);
}

function setState(state) {
  if (stage.dataset.state === state) return;
  const showPortrait = state === 'portrait';
  const previousFocus = document.activeElement;

  stage.dataset.state = state;
  heroContent.hidden = !showPortrait;
  skip.hidden = showPortrait;
  advance.hidden = showPortrait || state === 'loading' || !scrollMode.matches;

  if (showPortrait && (focusHeroOnReveal || previousFocus === skip || previousFocus === advance)) {
    focusHeroOnReveal = false;
    heroContent.focus({ preventScroll: true });
  } else if (!showPortrait && heroContent.contains(previousFocus)) {
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

function reflectVideo(x, y, width, height, strength) {
  if (strength < .015) {
    coverVideo(x, y, width, height);
    return;
  }

  const scale = Math.max(width / reel.videoWidth, height / reel.videoHeight);
  const sourceWidth = width / scale;
  const sourceHeight = height / scale;
  const sourceX = (reel.videoWidth - sourceWidth) / 2;
  const sourceY = (reel.videoHeight - sourceHeight) / 2;
  const strips = 24;
  // Stretch the centre of the reflection and compress the image near the glass edges.
  const curve = value => value - .34 * strength * Math.sin(value * Math.PI * 2) / (Math.PI * 2);

  for (let index = 0; index < strips; index += 1) {
    const left = index / strips;
    const right = (index + 1) / strips;
    const position = left + .5 / strips;
    const bulge = Math.sin(position * Math.PI);
    const extraHeight = height * strength * (.14 + .23 * bulge);
    const tilt = height * strength * .13 * (position - .5);
    const start = curve(left);
    const end = curve(right);

    context.drawImage(
      reel, sourceX + start * sourceWidth, sourceY, (end - start) * sourceWidth, sourceHeight,
      x + left * width, y - extraHeight / 2 + tilt, width / strips + .35, height + extraHeight,
    );
  }

  const tint = context.createLinearGradient(x, y, x + width, y + height);
  tint.addColorStop(0, `rgba(197, 126, 104, ${.22 * strength})`);
  tint.addColorStop(.48, `rgba(86, 42, 52, ${.10 * strength})`);
  tint.addColorStop(1, `rgba(38, 21, 38, ${.24 * strength})`);
  context.fillStyle = tint;
  context.fillRect(x, y, width, height);
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

  context.fillStyle = '#100f0f';
  context.fillRect(0, 0, width, height);
  context.drawImage(portrait, x, y, 1080 * zoom, 1920 * zoom);

  // Blend the sides of the photo into the matching dark backdrop on wide screens.
  const edgeWidth = Math.min(40, 66 * zoom);
  const rightEdge = x + 1080 * zoom;
  if (x + edgeWidth > 0) {
    const leftFade = context.createLinearGradient(x, 0, x + edgeWidth, 0);
    leftFade.addColorStop(0, '#100f0f');
    leftFade.addColorStop(1, 'rgba(16, 15, 15, 0)');
    context.fillStyle = leftFade;
    context.fillRect(x, 0, edgeWidth, height);
  }
  if (rightEdge - edgeWidth < width) {
    const rightFade = context.createLinearGradient(rightEdge - edgeWidth, 0, rightEdge, 0);
    rightFade.addColorStop(0, 'rgba(16, 15, 15, 0)');
    rightFade.addColorStop(1, '#100f0f');
    context.fillStyle = rightFade;
    context.fillRect(rightEdge - edgeWidth, 0, edgeWidth, height);
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
      const refraction = smooth(clamp((amount - .2) / .8, 0, 1));
      context.globalAlpha = 1 - .10 * refraction;
      reflectVideo(left, top, right - left, bottom - top, refraction);
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
    if (skipped) {
      progress = 1;
    } else if (scrollMode.matches) {
      const target = clamp(scrollY / geometry.travel, 0, 1);
      const distance = target - progress;
      easing = Math.abs(distance) > .002;
      progress = easing ? progress + distance * .18 : target;
    } else {
      if (transitionAt === null && reel.currentTime >= waitBeforePullback) transitionAt = now;
      if (transitionAt !== null) {
        progress = smooth(clamp((now - transitionAt) / pullbackDuration, 0, 1));
        easing = progress < 1;
      }
    }

    setState(progress === 1 ? 'portrait' : progress < .05 ? 'film' : 'pullback');
  }

  if ((!active || hasFrame) && (progress < 1 || now - lastPaint >= 31)) {
    draw(progress, active && hasFrame);
    lastPaint = now;
  }
  if (active && (!reel.paused || easing)) scheduleFrame();
}

function showPortrait() {
  playRequest += 1;
  clearTimeout(loadTimer);
  active = false;
  progress = 1;
  lastPaint = -Infinity;
  reel.pause();
  updateTravel();
  setState('portrait');
  scheduleFrame();
}

function skipIntro() {
  skipped = true;
  progress = 1;
  lastPaint = -Infinity;
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
  skipped = false;
  progress = 0;
  transitionAt = null;
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
    if (active && !skipped) start();
  });
  reducedMotion.addEventListener('change', () => {
    if (reducedMotion.matches) showPortrait();
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

  skip.addEventListener('click', skipIntro);
  advance.addEventListener('click', event => {
    focusHeroOnReveal = event.detail === 0;
    window.scrollTo({ top: geometry.travel, behavior: 'instant' });
  });
  portrait.decode().then(() => {
    photoReady = true;
    if (reducedMotion.matches) scheduleFrame();
    else start();
  }).catch(showPortrait);
}
