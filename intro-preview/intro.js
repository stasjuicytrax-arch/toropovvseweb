const portrait = document.querySelector('#portrait');
const reel = document.querySelector('#reel');
const lens = document.querySelector('#lens-window');
const reflection = document.querySelector('#reflection');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const glass = reflection.getContext('2d', { alpha: false });
const sample = document.createElement('canvas');
sample.width = 320;
sample.height = 155;
const sampleContext = sample.getContext('2d', { alpha: false });
const hasVideoFrameCallback = typeof reel.requestVideoFrameCallback === 'function';

const width = reflection.width;
const height = reflection.height;
const sourceWidth = sample.height * width / height;
const sourceX = (sample.width - sourceWidth) / 2;
const strips = 12;
const curve = value => value - .34 * Math.sin(value * Math.PI * 2) / (Math.PI * 2);
const distortion = Array.from({ length: strips }, (_, index) => {
  const left = index / strips;
  const right = (index + 1) / strips;
  const position = (left + right) / 2;
  const stretch = height * (.14 + .23 * Math.sin(position * Math.PI));
  const tilt = height * .13 * (position - .5);
  return [
    sourceX + curve(left) * sourceWidth, 0, (curve(right) - curve(left)) * sourceWidth, sample.height,
    left * width, -stretch / 2 + tilt, width / strips + .35, height + stretch,
  ];
});
const tint = glass?.createLinearGradient(0, 0, width, height);
tint?.addColorStop(0, 'rgba(197, 126, 104, .18)');
tint?.addColorStop(.48, 'rgba(86, 42, 52, .08)');
tint?.addColorStop(1, 'rgba(38, 21, 38, .21)');

let pendingFrame = null;
let photoReady = false;

function paintReflection() {
  if (!glass || !sampleContext || reel.readyState < 2) return;

  // Sample each decoded frame once before applying the curved reflection.
  sampleContext.drawImage(reel, 0, 0, sample.width, sample.height);
  for (const strip of distortion) glass.drawImage(sample, ...strip);
  glass.fillStyle = tint;
  glass.fillRect(0, 0, width, height);
  if (reflection.hidden) reflection.hidden = false;
}

function queueReflection() {
  if (!glass || !sampleContext || pendingFrame !== null || document.hidden || reel.paused) return;
  const nextFrame = () => {
    pendingFrame = null;
    paintReflection();
    queueReflection();
  };
  pendingFrame = hasVideoFrameCallback ? reel.requestVideoFrameCallback(nextFrame) : setTimeout(nextFrame, 34);
}

function cancelReflection() {
  if (pendingFrame === null) return;
  if (hasVideoFrameCallback) reel.cancelVideoFrameCallback(pendingFrame);
  else clearTimeout(pendingFrame);
  pendingFrame = null;
}

function hideReflection() {
  cancelReflection();
  lens.hidden = true;
  lens.classList.remove('is-playing');
}

function syncPlayback() {
  if (!photoReady || reducedMotion.matches || document.hidden) {
    reel.pause();
    cancelReflection();
    if (reducedMotion.matches) hideReflection();
    return;
  }

  lens.hidden = false;
  reel.play().catch(() => {
    if (reel.paused && !document.hidden) hideReflection();
  });
}

reel.addEventListener('playing', () => {
  paintReflection();
  lens.classList.add('is-playing');
  queueReflection();
});
reel.addEventListener('pause', cancelReflection);
reel.addEventListener('error', hideReflection);
document.addEventListener('visibilitychange', syncPlayback);
reducedMotion.addEventListener('change', syncPlayback);

portrait.decode().then(() => {
  photoReady = true;
  syncPlayback();
}).catch(hideReflection);
