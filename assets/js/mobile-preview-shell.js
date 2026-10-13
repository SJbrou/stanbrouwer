(() => {
  'use strict';
  const root = document.querySelector('.mobile-preview-workbench');
  const form = root.querySelector('form');
  const frames = root.querySelector('[data-preview-frames]');
  const params = new URLSearchParams(location.search);
  for (const select of form.querySelectorAll('select')) {
    if ([...select.options].some(option => option.value === params.get(select.name))) select.value = params.get(select.name);
  }
  let compare = params.get('compare') === 'true';
  const names = { compact: 'Short, optional entrance', full: 'Full reversible sequence', tap: 'Tap to enter' };
  const values = () => Object.fromEntries(new FormData(form));
  const demoUrl = (entrance = form.elements.entrance.value) => {
    const url = new URL(root.dataset.demoUrl, location.href);
    url.search = new URLSearchParams({ ...values(), entrance }).toString();
    return url;
  };
  function update() {
    const url = new URL(location.href);
    url.search = new URLSearchParams({ ...values(), ...(compare ? { compare: 'true' } : {}) });
    history.replaceState(null, '', url);
    root.querySelector('[data-preview-open]').href = demoUrl().href;
    root.querySelector('[data-preview-compare]').setAttribute('aria-pressed', String(compare));
    frames.classList.toggle('is-comparing', compare);
    frames.style.setProperty('--preview-width', form.elements.width.value + 'px');
    root.querySelector('[data-preview-status]').textContent = compare ? 'The three entrances have identical content. Scroll and interact with each phone independently.' : names[form.elements.entrance.value] + '. Scroll inside the phone to explore.';
  }
  function render() {
    frames.replaceChildren();
    for (const entrance of compare ? Object.keys(names) : [form.elements.entrance.value]) {
      const panel = document.createElement('section');
      const heading = document.createElement('h2');
      heading.textContent = names[entrance];
      const frame = document.createElement('iframe');
      frame.title = names[entrance] + ' mobile preview';
      frame.src = demoUrl(entrance).href;
      frame.dataset.entrance = entrance;
      panel.append(heading, frame);
      frames.append(panel);
    }
    update();
  }
  form.addEventListener('submit', event => event.preventDefault());
  form.addEventListener('change', event => {
    if (['view', 'fixture'].includes(event.target.name)) {
      for (const frame of frames.querySelectorAll('iframe')) frame.contentWindow.postMessage({ type: 'perspective-preview', ...values() }, location.origin);
      update();
    } else if (event.target.name === 'width') update();
    else render();
  });
  root.querySelector('[data-preview-compare]').addEventListener('click', () => { compare = !compare; render(); });
  root.querySelector('[data-preview-replay]').addEventListener('click', () => {
    form.elements.view.value = 'collection';
    // Reload isolated documents: old controllers, media and listeners are disposed together.
    render();
  });
  window.addEventListener('message', event => {
    if (event.origin !== location.origin || ![...frames.querySelectorAll('iframe')].some(frame => frame.contentWindow === event.source)) return;
    if (event.data?.type === 'perspective-view' && !compare) {
      form.elements.view.value = event.data.view;
      update();
    }
  });
  render();
})();
