/* A shared rounded-rectangle displacement map for the equal-size project cards.
   Lens falloff adapted from the Apple Tahoe Liquid Glass reference on 21st.dev. */
(() => {
  const map = document.querySelector('#liquid-map');
  const glass = document.querySelector('.project-link .glass');
  const portrait = document.querySelector('#portrait');
  if (portrait) portrait.addEventListener('error', () => { portrait.hidden = true; }, { once: true });

  const chromium = /Chrome\/|Edg\/|YaBrowser\//.test(navigator.userAgent) && !/Firefox\//.test(navigator.userAgent);
  if (!map || !glass || !chromium || !CSS.supports('backdrop-filter', 'url(#liquid)')) return;

  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) return;

  let lastRadius;
  function updateLens() {
    const width = glass.offsetWidth;
    const height = glass.offsetHeight;
    const radius = parseFloat(getComputedStyle(glass).borderTopLeftRadius);
    if (!width || !height || !radius) return;
    if (canvas.width === width && canvas.height === height && lastRadius === radius) return;

    canvas.width = width;
    canvas.height = height;
    lastRadius = radius;
    const field = context.createImageData(width, height);
    const bezel = Math.min(32, height / 2);
    const innerWidth = width / 2 - radius;
    const innerHeight = height / 2 - radius;

    for (let row = 0; row < height; row++) {
      const y = row + .5 - height / 2;
      const edgeY = Math.abs(y) - innerHeight;
      for (let column = 0; column < width; column++) {
        const x = column + .5 - width / 2;
        const edgeX = Math.abs(x) - innerWidth;
        const cornerX = Math.max(0, edgeX);
        const cornerY = Math.max(0, edgeY);
        const corner = Math.hypot(cornerX, cornerY);
        const distance = corner + Math.min(0, Math.max(edgeX, edgeY)) - radius;
        const pixel = (row * width + column) * 4;
        field.data[pixel] = field.data[pixel + 1] = field.data[pixel + 2] = 128;
        field.data[pixel + 3] = 255;

        if (distance > 0 || distance <= -bezel) continue;
        const depth = -distance / bezel;
        const bend = 1 - Math.sqrt(depth * (2 - depth));
        const normalX = corner ? cornerX / corner : Number(edgeX > edgeY);
        const normalY = corner ? cornerY / corner : Number(edgeY >= edgeX);
        field.data[pixel] = 128 - 127 * Math.sign(x) * normalX * bend;
        field.data[pixel + 1] = 128 - 127 * Math.sign(y) * normalY * bend;
      }
    }
    context.putImageData(field, 0, 0);
    map.setAttribute('href', canvas.toDataURL());
    document.documentElement.classList.add('glass-svg');
  }

  updateLens();
  new ResizeObserver(updateLens).observe(glass);
})();
