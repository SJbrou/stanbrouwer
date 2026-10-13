(() => {
  'use strict';
  const params = new URLSearchParams(location.search);
  const entrance = ['compact', 'full', 'tap'].includes(params.get('entrance')) ? params.get('entrance') : 'compact';
  const fixtures = ['populated', 'long', 'no-image', 'failed-image', 'empty', 'unavailable', 'closed'];
  let fixture = fixtures.includes(params.get('fixture')) ? params.get('fixture') : 'populated';
  document.querySelector('[data-collection-welcome]').dataset.welcomeVariant = entrance;
  const images = Object.fromEntries(Object.entries(window.MOBILE_PREVIEW_ASSETS).map(([key, source]) => [key, new URL(source, location.href).href]));
  const projects = Object.values(window.CollectionProjects.examples).map(project => structuredClone(project));
  projects[0].image = images.harbour;
  projects[2].image = images.home;
  const event = {
    id: 'mobile-preview-gathering', title: 'An evening at De Loods', publish: true,
    dateIso: '2027-04-12', dateLabel: '12 April 2027', startTime: '18:00', endTime: '23:00',
    location: 'De Loods', address: 'Hoorn', heroImage: images.harbour,
    introMarkdown: '**Food, music, and good company.**',
    detailsMarkdown: 'A gathering for curious neighbours. Come on your own, bring a friend, or meet someone new at the table.',
    ticketingOpen: '2026-07-01T00:00:00Z', ticketingClose: '2027-04-12T18:00:00Z',
    ticketTypes: [
      { id: 'general', name: 'General admission', descriptionMarkdown: 'The full evening, including dinner.', price: '€12.50', max: 4 },
      { id: 'supporter', name: 'Supporter', descriptionMarkdown: 'A little extra support for the next gathering.', price: '€20', max: 2 }
    ]
  };
  const table = rows => ({ status: 'ok', table: { cols: 'ABCDEF'.split('').map(id => ({ id, label: '', type: 'string' })), rows: rows.map(values => ({ c: values.map(v => v ? { v } : null) })) } });
  const image = source => fixture === 'no-image' ? '' : fixture === 'failed-image' ? new URL('missing-preview-image.jpg', location.href).href : source;
  function eventExample() {
    const result = structuredClone(event);
    result.heroImage = image(result.heroImage);
    if (fixture === 'closed') result.ticketingClose = '2026-07-31T18:00:00Z';
    if (fixture === 'long') {
      result.title = 'An evening of listening, making, and neighbourhood stories.';
      result.detailsMarkdown += '\n\n## A little more room\n' + 'The programme moves between listening sessions, shared meals, and small experiments in making.\n\n'.repeat(8);
    }
    return result;
  }
  function projectExample(index = 0) {
    const result = structuredClone(projects[index] || projects[0]);
    result.image = image(result.image);
    if (fixture === 'no-image') result.category = '';
    if (fixture === 'long' && index === 0) { result.title = 'An everyday object, seen from another angle: studies in light, proportion, and the places we share'; result.description = projects[2].description; }
    return result;
  }
  function loadSheet(tab) {
    if (fixture === 'unavailable') throw new Error('Sample unavailable-content state');
    if (fixture === 'empty') return table([]);
    const rows = {
      WORDS: [
        ['June', 'A room becomes a place through the things we do together', 'Stan Brouwer', 'https://example.com/words'],
        ['May', 'The pleasure of paying attention', 'Collected notes', 'https://example.com/attention'],
        ['April', 'Making room for an unfamiliar perspective', 'Stan Brouwer', 'https://example.com/perspective'],
        ['March', 'Small interventions, lasting impressions', 'Collected notes', 'https://example.com/interventions']
      ],
      SOUNDS: [
        ['June', 'An afternoon with nowhere to be', 'Listening notes', '04:12', 'https://soundcloud.com/example/afternoon'],
        ['May', 'A track that stays', 'Collected sounds', '06:30', 'https://soundcloud.com/example/stays'],
        ['April', 'The space between two songs', 'Listening notes', '03:48', 'https://soundcloud.com/example/space']
      ],
      PLACES: [
        ['June', 'De Loods, a place to gather', image(images.harbour), 'Hoorn'],
        ['May', 'An orange house, a familiar view', image(images.home), 'At home'],
        ['April', 'Another way to see the harbour', image(images.harbour), 'Hoorn'],
        ['March', 'A quiet afternoon outside', image(images.home), 'At home'],
        ['February', 'The light at the end of the day', image(images.harbour), 'Hoorn'],
        ['January', 'A different view from the doorway', image(images.home), 'At home'],
        ['December', 'An open door and a shared table', image(images.harbour), 'Hoorn'],
        ['November', 'Returning to a familiar place', image(images.home), 'At home']
      ],
      PROJECTS: projects.map((_, index) => { const p = projectExample(index); return [p.date, p.title, p.category, p.image, p.externalUrl || '', p.description]; })
    };
    if (fixture === 'no-image') rows.WORDS.forEach(row => { row[2] = ''; });
    if (fixture === 'long') rows.WORDS[0][1] += ', and the small details that make the ordinary feel worth another look';
    return table(rows[tab] || []);
  }
  function previewImage(row, tab) {
    if (row.media?.kind === 'image') return row.media.source;
    // Local stand-ins for website thumbnails and SoundCloud artwork.
    if (tab === 'WORDS') return image(images.home);
    if (tab === 'SOUNDS') return image(images.harbour);
    return '';
  }
  window.MobilePreviewData = { entrance, fixtures, now: new Date('2026-08-01T12:00:00Z'), event: eventExample, project: projectExample, previewImage, get fixture() { return fixture; }, setFixture(value) { if (fixtures.includes(value)) fixture = value; }, loadSheet };
  window.COLLECTION_PREVIEW_OPTIONS = {
    disableFloatingMedia: true, preserveText: true, loadSheet,
    loadInvites: () => fixture === 'unavailable' ? Promise.reject(new Error('Sample unavailable-content state')) : Promise.resolve(fixture === 'empty' ? [] : [eventExample()])
  };
})();
