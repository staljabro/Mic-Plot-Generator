export const DEFAULT_STATES = [
  { id: 'off', name: 'Off', abbreviation: '', color: '#fbfcfc', locked: true },
  { id: 'on', name: 'On', abbreviation: 'ON', color: '#2d7259', locked: true }
];
export const LEGACY_STATES = {
  ens: { id: 'ens', name: 'Ensemble', abbreviation: 'ENS', color: '#e7773d' },
  bss: { id: 'bss', name: 'Backstage singer', abbreviation: 'BSS', color: '#6e75d8' }
};

export const cleanFilename = value => String(value || 'mic-plot').replace(/[<>:"/\\|?*\x00-\x1f]+/g, '-').trim() || 'mic-plot';

export function cycleState(states, value) {
  const ids = states.map(state => state.id);
  const current = ids.includes(value) ? value : 'off';
  return ids[(ids.indexOf(current) + 1) % ids.length];
}

export function createBlankPlot(company, showName) {
  return {
    id: crypto.randomUUID(), company, showName, title: `${company} - ${showName}`,
    scenes: [], characters: [], groups: [], showLogo: '', showLogo2: '',
    states: DEFAULT_STATES.map(state => ({ ...state })), cells: {}
  };
}

export function normalisePlot(input) {
  if (!input || !Array.isArray(input.characters) || !Array.isArray(input.scenes) || !input.cells || typeof input.cells !== 'object') {
    throw new Error('Invalid project structure');
  }
  const seen = new Set();
  const uniqueId = (candidate, prefix) => {
    let id = typeof candidate === 'string' && candidate ? candidate : `${prefix}-${crypto.randomUUID()}`;
    while (seen.has(id) || id.includes(':')) id = `${prefix}-${crypto.randomUUID()}`;
    seen.add(id);
    return id;
  };
  const characters = input.characters.map(item => ({
    id: uniqueId(item?.id, 'character'),
    name: String(item?.name || 'Unnamed character').slice(0, 200),
    actor: String(item?.actor || '').slice(0, 200),
    defaultGroup: String(item?.defaultGroup || '').slice(0, 100)
  }));
  const scenes = input.scenes.map(item => ({ id: uniqueId(item?.id, 'scene'), name: String(item?.name || 'Unnamed scene').slice(0, 200) }));
  const validCharacterIds = new Set(characters.map(item => item.id));
  const validSceneIds = new Set(scenes.map(item => item.id));
  const suppliedStates = Array.isArray(input.states) ? input.states : [];
  const states = [];
  suppliedStates.filter(Boolean).forEach(state => {
    const required = DEFAULT_STATES.find(item => item.id === state.id);
    if (required && !states.some(item => item.id === required.id)) {
      states.push({ ...required, color: /^#[0-9a-f]{6}$/i.test(state.color) ? state.color : required.color });
      return;
    }
    const id = String(state.id || '').replace(/[^a-z0-9-]/gi, '').slice(0, 40);
    if (id && !states.some(item => item.id === id)) states.push({ id, name: String(state.name || 'Custom').slice(0, 40), abbreviation: String(state.abbreviation || state.name || 'CUSTOM').slice(0, 6).toUpperCase(), color: /^#[0-9a-f]{6}$/i.test(state.color) ? state.color : '#668ba6' });
  });
  DEFAULT_STATES.forEach(required => { if (!states.some(item => item.id === required.id)) states.push({ ...required }); });
  const usedLegacy = new Set(Object.values(input.cells).map(value => value === 'plus' ? 'bss' : value));
  Object.values(LEGACY_STATES).forEach(state => { if (usedLegacy.has(state.id) && !states.some(item => item.id === state.id)) states.push({ ...state }); });
  const validStates = new Set(states.map(state => state.id));
  const cells = Object.create(null);
  Object.entries(input.cells).forEach(([key, value]) => {
    const splitAt = key.indexOf(':');
    const characterId = key.slice(0, splitAt);
    const sceneId = key.slice(splitAt + 1);
    if (splitAt > 0 && validCharacterIds.has(characterId) && validSceneIds.has(sceneId)) {
      const migrated = value === 'plus' ? 'bss' : value;
      cells[key] = validStates.has(migrated) ? migrated : 'off';
    }
  });
  return {
    id: typeof input.id === 'string' && input.id ? input.id : crypto.randomUUID(),
    company: String(input.company || '').slice(0, 200),
    showName: String(input.showName || input.title || 'Untitled Production').slice(0, 200),
    title: String(input.title || input.showName || 'Untitled Production').slice(0, 300),
    showLogo: /^data:image\/(png|jpeg|webp);base64,/i.test(input.showLogo || '') && String(input.showLogo).length < 3_000_000 ? String(input.showLogo) : '',
    showLogo2: /^data:image\/(png|jpeg|webp);base64,/i.test(input.showLogo2 || '') && String(input.showLogo2).length < 3_000_000 ? String(input.showLogo2) : '',
    characters, scenes, states, cells,
    groups: [...new Set((Array.isArray(input.groups) ? input.groups : []).map(value => String(value).trim().slice(0, 100)).filter(Boolean))]
  };
}

export function removeCharacterFromPlot(plot, id) {
  const prefix = `${id}:`;
  return { ...plot, characters: plot.characters.filter(item => item.id !== id), cells: Object.fromEntries(Object.entries(plot.cells).filter(([key]) => !key.startsWith(prefix))) };
}

export function removeSceneFromPlot(plot, id) {
  return { ...plot, scenes: plot.scenes.filter(item => item.id !== id), cells: Object.fromEntries(Object.entries(plot.cells).filter(([key]) => !key.endsWith(`:${id}`))) };
}

export function collateCastRows(plot, collate) {
  const groups = new Map();
  plot.characters.forEach(character => {
    const actor = character.actor.trim();
    const key = actor ? actor.toLocaleLowerCase() : `unassigned:${character.id}`;
    if (!groups.has(key)) groups.set(key, { key, actor: actor || 'Uncast', characters: [] });
    groups.get(key).characters.push(character);
  });
  const stateFor = (characters, sceneId) => {
    const values = characters.map(character => plot.cells[`${character.id}:${sceneId}`]);
    if (values.includes('on')) return 'on';
    return plot.states.find(state => state.id !== 'off' && values.includes(state.id))?.id || 'off';
  };
  return [...groups.values()].flatMap(group => collate
    ? [{ id: group.characters.map(item => item.id).join(':'), groupId: group.key, actor: group.actor, character: `${group.characters[0].name}${group.characters.length > 1 ? ` +${group.characters.length - 1}` : ''}`, states: Object.fromEntries(plot.scenes.map(scene => [scene.id, stateFor(group.characters, scene.id)])) }]
    : group.characters.map(character => ({ id: character.id, groupId: group.key, actor: group.actor, character: character.name, states: Object.fromEntries(plot.scenes.map(scene => [scene.id, stateFor([character], scene.id)])) })));
}

export function parseTabular(text) {
  const rows = String(text).trim().split(/\r?\n/).map(row => row.split('\t').map(value => value.trim())).filter(row => row.some(Boolean));
  if (!rows.length) return [];
  const first = rows[0].map(value => value.toLowerCase());
  const offset = first[0]?.includes('character') ? 1 : 0;
  return rows.slice(offset).filter(row => row[0]).map(row => ({ name: row[0], actor: row[1] || '', defaultGroup: row[2] || '' }));
}
