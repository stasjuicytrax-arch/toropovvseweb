/* User-supplied liquid-glass recipe: one edge displacement map, separate backplates. */
(() => {
  const BEZEL = 32;
  const map = "<svg xmlns='http://www.w3.org/2000/svg' width='256' height='256' viewBox='0 0 256 256'>" +
    "<defs>" +
    "<linearGradient id='x' x1='0' x2='1' y1='0' y2='0'><stop offset='0' stop-color='#000'/><stop offset='1' stop-color='#f00'/></linearGradient>" +
    "<linearGradient id='y' x1='0' x2='0' y1='0' y2='1'><stop offset='0' stop-color='#000'/><stop offset='1' stop-color='#0f0'/></linearGradient>" +
    "<filter id='b'><feGaussianBlur stdDeviation='" + BEZEL / 3 + "'/></filter>" +
    "</defs>" +
    "<rect width='256' height='256' fill='url(#x)'/>" +
    "<rect width='256' height='256' fill='url(#y)' style='mix-blend-mode:screen'/>" +
    "<rect x='" + BEZEL + "' y='" + BEZEL + "' width='" + (256 - BEZEL * 2) + "' height='" + (256 - BEZEL * 2) + "' rx='" + BEZEL + "' fill='#808000' filter='url(#b)'/>" +
    '</svg>';
  const image = document.querySelector('#liquid-map');
  if (image) {
    const url = 'data:image/svg+xml,' + encodeURIComponent(map);
    image.setAttribute('href', url);
    image.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', url);
    const chromium = /Chrome\/|Edg\/|YaBrowser\//.test(navigator.userAgent) && !/Firefox\//.test(navigator.userAgent);
    if (chromium && window.CSS && CSS.supports('backdrop-filter', 'url(#liquid)')) document.documentElement.classList.add('glass-svg');
  }
  const portrait = document.querySelector('#portrait');
  if (portrait) portrait.addEventListener('error', () => { portrait.hidden = true; }, { once: true });
})();
