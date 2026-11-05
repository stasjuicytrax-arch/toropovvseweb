const track = document.querySelector('#project-track');
const cards = [...track.querySelectorAll('.project-link')];
const controls = document.querySelector('.project-controls');
const previous = controls.querySelector('.project-prev');
const next = controls.querySelector('.project-next');
const pagination = document.querySelector('.project-pagination');
const buttons = [...pagination.querySelectorAll('button')];
const hint = document.querySelector('.project-hint');
const hintText = hint.querySelector('span');
const portrait = document.querySelector('#portrait');
let activeIndex = 0;

portrait.addEventListener('error', () => { portrait.hidden = true; }, { once: true });

function updateProjectPosition() {
  const scrollRange = track.scrollWidth - track.clientWidth;
  if (!scrollRange) return;

  const progress = Math.max(0, Math.min(1, track.scrollLeft / scrollRange));
  const position = progress * (cards.length - 1);
  const betweenDots = position % 1;
  const stretch = 1 + 1.15 * Math.sin(Math.PI * betweenDots);
  pagination.style.setProperty('--project-position', position);
  pagination.style.setProperty('--project-stretch', stretch);

  const nextIndex = Math.round(position);
  if (nextIndex === activeIndex) return;

  buttons[activeIndex].removeAttribute('aria-current');
  buttons[nextIndex].setAttribute('aria-current', 'true');
  const isLast = nextIndex === cards.length - 1;
  previous.disabled = nextIndex === 0;
  next.disabled = isLast;
  hintText.textContent = isLast ? 'Листай влево' : 'Листай вправо';
  hint.classList.toggle('project-hint-back', isLast);
  activeIndex = nextIndex;
}

function showProject(index) {
  cards[index]?.scrollIntoView({ block: 'nearest', inline: 'center' });
}

buttons.forEach((button, index) => button.addEventListener('click', () => showProject(index)));
previous.addEventListener('click', () => showProject(activeIndex - 1));
next.addEventListener('click', () => showProject(activeIndex + 1));
track.addEventListener('scroll', updateProjectPosition, { passive: true });
track.addEventListener('focusin', (event) => {
  if (event.target.matches('.project-link:focus-visible')) {
    event.target.scrollIntoView({ behavior: 'instant', block: 'nearest', inline: 'center' });
  }
});
updateProjectPosition();
controls.hidden = false;
