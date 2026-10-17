const LIBRARY_KEY = 'mic-plot-library-v2';
const LEGACY_KEY = 'mic-plot-v1';
const MAX_BACKUPS = 10;

export function readLibrary() {
  try {
    const parsed = JSON.parse(localStorage.getItem(LIBRARY_KEY));
    if (parsed?.version === 2 && parsed.shows && typeof parsed.shows === 'object') return parsed;
  } catch { /* start with a clean library */ }
  return { version: 2, currentId: null, shows: {}, backups: {} };
}

export function readLegacyPlot() {
  try { return JSON.parse(localStorage.getItem(LEGACY_KEY)); } catch { return null; }
}

export function savePlotToLibrary(plot, { backup = false } = {}) {
  const library = readLibrary();
  const now = new Date().toISOString();
  const previous = library.shows[plot.id];
  library.shows[plot.id] = { plot, updatedAt: now };
  library.currentId = plot.id;
  if (backup && previous?.plot && JSON.stringify(previous.plot) !== JSON.stringify(plot)) {
    library.backups[plot.id] = [{ plot: previous.plot, savedAt: previous.updatedAt || now }, ...(library.backups[plot.id] || [])].slice(0, MAX_BACKUPS);
  }
  localStorage.setItem(LIBRARY_KEY, JSON.stringify(library));
  localStorage.setItem(LEGACY_KEY, JSON.stringify(plot));
  return library;
}

export function deleteStoredPlot(id) {
  const library = readLibrary();
  delete library.shows[id];
  delete library.backups[id];
  if (library.currentId === id) library.currentId = null;
  localStorage.setItem(LIBRARY_KEY, JSON.stringify(library));
  return library;
}

export function listStoredPlots() {
  return Object.values(readLibrary().shows).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
}

export function getBackups(id) {
  return readLibrary().backups[id] || [];
}
