const contactTrigger = document.querySelector('#contact-trigger');
const contactDialog = document.querySelector('#contact-dialog');

if (typeof contactDialog.showModal === 'function') {
  const form = contactDialog.querySelector('.contact-form');

  contactTrigger.setAttribute('aria-haspopup', 'dialog');
  contactTrigger.addEventListener('click', (event) => {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    contactDialog.showModal();
  });

  contactDialog.querySelector('.contact-close').addEventListener('click', () => contactDialog.close());
  contactDialog.addEventListener('click', (event) => {
    if (event.target === contactDialog) contactDialog.close();
  });
  contactDialog.addEventListener('close', () => contactTrigger.focus({ preventScroll: true }));

  form.addEventListener('input', (event) => event.target.setCustomValidity(''));
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const name = data.get('name').trim();
    const phone = data.get('phone').trim();
    const message = data.get('message').trim();

    const invalidField = !name ? 'name' : phone.replace(/\D/g, '').length < 7 ? 'phone' : !message ? 'message' : null;
    if (invalidField) {
      const field = form.elements.namedItem(invalidField);
      const errors = { name: 'Введите ваше имя.', phone: 'Введите номер телефона с кодом.', message: 'Введите сообщение.' };
      field.setCustomValidity(errors[invalidField]);
      field.reportValidity();
      return;
    }

    const url = new URL(contactTrigger.href);
    const draft = `Имя: ${name}\nТелефон: ${phone}\n\n${message}`;
    url.search = `text=${encodeURIComponent(draft)}`;
    window.location.assign(url.href);
  });
}
