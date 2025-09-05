// DOM refs
const input = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const clearBtn  = document.getElementById('clearBtn');
const resultsEl = document.getElementById('results');
const emptyEl   = document.getElementById('empty');
const toggleTime = document.getElementById('toggleTime');

// Only run this on the Home page where elements exist
if (input && searchBtn && clearBtn && resultsEl && emptyEl) {
  let cache = null;

  // City/place -> IANA time zone for optional Task 10
  const tzMap = {
    "Sydney, Australia": "Australia/Sydney",
    "Melbourne, Australia": "Australia/Melbourne",
    "Tokyo, Japan": "Asia/Tokyo",
    "Kyoto, Japan": "Asia/Tokyo",
    "Rio de Janeiro, Brazil": "America/Sao_Paulo",
    "São Paulo, Brazil": "America/Sao_Paulo",
    "Angkor Wat, Cambodia": "Asia/Phnom_Penh",
    "Taj Mahal, India": "Asia/Kolkata",
    "Bora Bora, French Polynesia": "Pacific/Tahiti",
    "Copacabana Beach, Brazil": "America/Sao_Paulo",
  };

  function fmtTimeFor(zone) {
    try {
      return new Date().toLocaleTimeString('en-US', { timeZone: zone, hour12: true, hour: 'numeric', minute: 'numeric', second: 'numeric' });
    } catch {
      return '';
    }
  }

  function normalizeKeyword(raw) {
    const k = (raw || '').trim().toLowerCase();
    // very light stemming for plurals
    if (k.endsWith('es')) return k.slice(0, -2);
    if (k.endsWith('s'))  return k.slice(0, -1);
    return k;
  }

  async function loadData() {
    if (cache) return cache;
    const res = await fetch('travel_recommendation_api.json', { cache: 'no-store' });
    if (!res.ok) throw new Error('Failed to load JSON');
    cache = await res.json();
    // For debugging while developing:
    console.log('Loaded data:', cache);
    return cache;
  }

  function clearResults() {
    resultsEl.innerHTML = '';
    emptyEl.style.display = 'block';
  }

  function card({ tag, name, imageUrl, description }) {
    const tz = tzMap[name] || '';
    const timeRow = toggleTime.checked && tz ? `<div class="time">Local time: ${fmtTimeFor(tz)}</div>` : '';
    return `
      <article class="card">
        <img src="${imageUrl}" alt="${name}" loading="lazy" />
        <div class="body">
          <span class="tag">${tag}</span>
          <div class="title">${name}</div>
          <div class="desc">${description}</div>
          ${timeRow}
        </div>
      </article>
    `;
  }

  function render(list) {
    if (!list.length) {
      clearResults();
      return;
    }
    emptyEl.style.display = 'none';
    resultsEl.innerHTML = list.map(card).join('');
  }

  function pickForKeyword(db, keyword) {
    const k = normalizeKeyword(keyword);

    // category keywords
    if (['beach', 'temple', 'country'].includes(k)) {
      if (k === 'beach')  return db.beaches.map(b => ({ tag: 'Beach', ...b }));
      if (k === 'temple') return db.temples.map(t => ({ tag: 'Temple', ...t }));
      if (k === 'country') {
        // Flatten countries->cities
        return db.countries.flatMap(c =>
          c.cities.map(city => ({ tag: c.name, ...city }))
        );
      }
    }

    // otherwise, try to match by country name or city/poi name (case-insensitive)
    const byCountry = db.countries
      .filter(c => c.name.toLowerCase().includes(k))
      .flatMap(c => c.cities.map(city => ({ tag: c.name, ...city })));

    const byCity = db.countries
      .flatMap(c => c.cities)
      .filter(city => city.name.toLowerCase().includes(k))
      .map(city => ({ tag: 'City', ...city }));

    const byTemple = db.temples
      .filter(t => t.name.toLowerCase().includes(k))
      .map(t => ({ tag: 'Temple', ...t }));

    const byBeach = db.beaches
      .filter(b => b.name.toLowerCase().includes(k))
      .map(b => ({ tag: 'Beach', ...b }));

    return [...byCountry, ...byCity, ...byTemple, ...byBeach];
  }

  async function onSearch() {
    const q = input.value;
    if (!q.trim()) {
      clearResults();
      return;
    }
    try {
      const db = await loadData();
      const results = pickForKeyword(db, q);
      // If category chosen, ensure at least two items show (dataset already has ≥2 per category)
      render(results.slice(0, Math.max(results.length, 2)));
    } catch (e) {
      console.error(e);
      resultsEl.innerHTML = `<div class="empty">Could not load recommendations. Check the JSON path and try again.</div>`;
      emptyEl.style.display = 'none';
    }
  }

  // Event wiring
  searchBtn.addEventListener('click', onSearch);
  clearBtn.addEventListener('click', () => { input.value = ''; clearResults(); });
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') onSearch(); });
  toggleTime?.addEventListener('change', () => {
    // re-render if results are present
    const hasCards = resultsEl.children.length > 0;
    if (hasCards) onSearch();
  });

  // initial state
  clearResults();
}

