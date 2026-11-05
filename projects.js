const track = document.querySelector('#project-track');
const cards = [...track.querySelectorAll('.project-link')];
const pagination = document.querySelector('.project-pagination');
const buttons = [...pagination.querySelectorAll('button')];
const hint = document.querySelector('.project-hint');
const hintText = hint.querySelector('span');
const portrait = document.querySelector('#portrait');
let activeIndex = 0;

portrait.addEventListener('error', () => { portrait.hidden = true; }, { once: true });

function updateActiveProject() {
  const scrollRange = track.scrollWidth - track.clientWidth;
  if (!scrollRange) return;

  const progress = Math.max(0, Math.min(1, track.scrollLeft / scrollRange));
  const nextIndex = Math.round(progress * (cards.length - 1));
  if (nextIndex === activeIndex) return;

  buttons[activeIndex].removeAttribute('aria-current');
  buttons[nextIndex].setAttribute('aria-current', 'true');
  const isLast = nextIndex === cards.length - 1;
  hintText.textContent = isLast ? 'Листай влево' : 'Листай вправо';
  hint.classList.toggle('project-hint-back', isLast);
  activeIndex = nextIndex;
}

buttons.forEach((button, index) => {
  button.addEventListener('click', () => {
    cards[index].scrollIntoView({ block: 'nearest', inline: 'center' });
  });
});
track.addEventListener('scroll', updateActiveProject, { passive: true });
track.addEventListener('focusin', (event) => {
  if (event.target.matches('.project-link:focus-visible')) {
    event.target.scrollIntoView({ behavior: 'instant', block: 'nearest', inline: 'center' });
  }
});
updateActiveProject();
pagination.hidden = false;
