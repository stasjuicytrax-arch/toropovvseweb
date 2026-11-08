import { DirectionalLight, HemisphereLight, OrthographicCamera, Scene, WebGLRenderer } from 'three';
import { makeLetters, makeLights, makeRibbon } from './effects.js';

const choices = {
  ribbon: { title: 'Стеклянная лента', create: makeRibbon },
  lights: { title: 'Сценический свет', create: makeLights },
  letters: { title: 'TOROPOV', create: makeLetters },
};
const variant = new URLSearchParams(location.search).get('scene');
const choice = Object.hasOwn(choices, variant) ? choices[variant] : choices.ribbon;
document.title = choice.title + ' — Стас Торопов';

const portrait = document.querySelector('#portrait');
const host = document.querySelector('#scene-effects');
const replay = document.querySelector('#scene-replay');
const status = document.querySelector('#scene-status');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const svgNS = 'http://www.w3.org/2000/svg';

// Traces follow the foreground edge of the original portraits in photo pixels.
const mobileOutline = 'M0 791 C48 747 95 739 155 740 C218 738 284 749 338 744 C333 712 332 686 344 653 C365 625 400 600 431 584 L460 568 Q476 551 476 524 C466 523 463 515 468 502 L476 476 C478 451 491 433 516 424 C547 412 570 420 587 446 C602 467 602 496 598 521 L591 552 L581 566 C595 583 612 601 637 617 C677 640 688 671 690 718 C782 721 875 725 941 805 L941 1672 H0 Z';
const desktopOutline = 'M0 527 C188 527 361 507 431 487 C439 434 468 382 514 355 C569 323 634 335 736 336 C730 309 733 284 746 265 C767 243 794 227 820 211 L839 194 C838 183 833 170 833 156 Q833 146 841 140 C843 112 864 93 888 92 C915 91 932 113 933 141 C934 160 931 180 922 197 L919 204 C936 221 959 235 978 247 C993 263 1000 291 1000 318 C1087 317 1157 344 1205 410 C1232 447 1248 497 1253 544 L1672 541 V941 H0 Z';

const scene = new Scene();
const camera = new OrthographicCamera(0, 1, 0, -1, 1, 4000);
camera.position.z = 2000;
const sky = new HemisphereLight('#fff1f7', '#ae8f67', 2.1);
const key = new DirectionalLight('#fff0d2', 2.65);
key.position.set(-240, 700, 620);
const rim = new DirectionalLight('#b1c2ff', 1.5);
rim.position.set(900, 300, -250);
scene.add(sky, key, rim);

let renderer;
let effect;
let foreground;
let source = '';
let frame = 0;
let started = 0;
let lastPaint = -Infinity;
let contextLost = false;

function svg(tag, attributes) {
  const element = document.createElementNS(svgNS, tag);
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
  return element;
}

function addForeground(width, height, desktop) {
  foreground?.remove();
  foreground = svg('svg', { viewBox: [0, 0, width, height].join(' '), 'aria-hidden': 'true' });
  const defs = svg('defs', {});
  const clip = svg('clipPath', { id: 'scene-foreground-clip' });
  clip.append(svg('path', { d: desktop ? desktopOutline : mobileOutline }));
  defs.append(clip);
  foreground.append(defs, svg('image', {
    href: source, width, height, 'clip-path': 'url(#scene-foreground-clip)',
  }));
  host.append(foreground);
}

function disposeEffect() {
  if (!effect) return;
  const materials = new Set();
  effect.object.traverse(node => {
    node.geometry?.dispose();
    if (node.material) for (const material of [node.material].flat()) materials.add(material);
  });
  materials.forEach(material => material.dispose());
  scene.remove(effect.object);
  effect = null;
}

function paint(seconds) {
  effect.render(seconds);
  renderer.render(scene, camera);
}

function elapsed(now) {
  if (reduced.matches) return effect.duration;
  const seconds = (now - started) / 1000;
  return effect.idle ? seconds : Math.min(effect.duration, seconds);
}

function tick(now) {
  frame = 0;
  if (!effect || document.hidden || contextLost) return;
  const seconds = elapsed(now);
  if (reduced.matches || seconds < effect.duration || !effect.idle || now - lastPaint >= 32) {
    paint(seconds);
    lastPaint = now;
  }
  if (!reduced.matches && (seconds < effect.duration || effect.idle)) frame = requestAnimationFrame(tick);
}

function play() {
  cancelAnimationFrame(frame);
  started = performance.now();
  lastPaint = -Infinity;
  tick(started);
}

function fit() {
  if (!renderer || contextLost || !portrait.naturalWidth) return;
  const { width, height } = host.getBoundingClientRect();
  const imageWidth = portrait.naturalWidth;
  const imageHeight = portrait.naturalHeight;
  const desktop = imageWidth > imageHeight;
  const scale = Math.max(width / imageWidth, height / imageHeight);
  const offsetX = (width - imageWidth * scale) / 2;
  const offsetY = desktop ? 0 : (height - imageHeight * scale) / 2;
  const changed = source !== portrait.currentSrc;

  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.25));
  renderer.setSize(width, height);
  camera.left = -offsetX / scale;
  camera.right = (width - offsetX) / scale;
  camera.top = offsetY / scale;
  camera.bottom = (offsetY - height) / scale;
  camera.updateProjectionMatrix();

  if (changed) {
    source = portrait.currentSrc;
    disposeEffect();
    effect = choice.create(imageWidth, imageHeight, desktop);
    scene.add(effect.object);
    addForeground(imageWidth, imageHeight, desktop);
  }

  Object.assign(foreground.style, {
    left: offsetX + 'px', top: offsetY + 'px',
    width: imageWidth * scale + 'px', height: imageHeight * scale + 'px',
  });
  effect.fit?.(width / scale);
  if (changed) play();
  else paint(elapsed(performance.now()));
}

async function init() {
  try {
    await portrait.decode();
    renderer = new WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
  } catch {
    status.hidden = false;
    return;
  }

  renderer.setClearColor(0x000000, 0);
  renderer.domElement.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    contextLost = true;
    cancelAnimationFrame(frame);
    host.hidden = true;
    replay.hidden = true;
  });
  renderer.domElement.addEventListener('webglcontextrestored', () => {
    contextLost = false;
    host.hidden = false;
    replay.hidden = reduced.matches;
    fit();
  });

  host.append(renderer.domElement);
  replay.hidden = reduced.matches;
  replay.addEventListener('click', play);
  portrait.addEventListener('load', fit);
  new ResizeObserver(fit).observe(host);
  reduced.addEventListener('change', () => {
    replay.hidden = reduced.matches;
    play();
  });
  document.addEventListener('visibilitychange', () => {
    cancelAnimationFrame(frame);
    if (!document.hidden && effect) tick(performance.now());
  });
  fit();
}

init();
