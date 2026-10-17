import React, { forwardRef, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Check, CircleHelp, Download, GripVertical, Pencil, Plus, Redo2, Search, Settings, Trash2, Undo2, Users, X } from 'lucide-react';
import './styles.css';
import './dark-theme.css';
import { cleanFilename, collateCastRows, createBlankPlot, cycleState, DEFAULT_STATES, normalisePlot, parseTabular, removeCharacterFromPlot, removeSceneFromPlot } from './model.js';
import { deleteStoredPlot, getBackups, listStoredPlots, readLegacyPlot, readLibrary, savePlotToLibrary } from './storage.js';
import { usePlotHistory } from './usePlotHistory.js';
import { APP_VERSION } from './version.js';

const scenesSeed = [
  'Prologue · Vanuatu 2000', '1 · Glam Rock Concert', '2 · Dance Sequence',
  '3 · Moil Mansion', '4 · LA Flashback 2002', '5 · Present Day Mansion',
  '6 · Later That Night', '7 · Vanuatu 2000', '8 · Present Day', '9 · 2010 Mansion'
];

const characterSeed = [
  ['John Jay Moil', 'Zachary Winter'], ['Veronica Moil / Champion', 'Evangeline Wiedemann'],
  ['Robert Cratchet', 'Joseph Lawson'], ['Lazzo Ares', 'Dale Leishman'],
  ['Patrick', 'Yuri Erlandson'], ['Jacob Marley / Jake Marlo', ''],
  ['Mrs Tham / Loretta', 'Ebony Curtis'], ['Trude Bosley', 'Gracie Rowe'],
  ['Scooter', 'Asher Wiedemann'], ['Samantha (PA 5)', 'Ella Field'],
  ['Detective Jenkins', 'Harry Ryan'], ['Terrance', ''], ['Bob', 'Jake Stewart']
];

const pattern = [
  ['on','plus','on','on','on','on','on','on','on','on'],
  ['on','plus','on','on','on','off','plus','on','plus','on'],
  ['off','off','plus','on','off','plus','on','off','plus','on'],
  ['plus','on','off','off','off','off','off','plus','on','on'],
  ['off','off','off','off','off','off','off','off','off','off'],
  ['plus','on','off','off','plus','on','off','off','off','off'],
  ['off','off','off','off','off','off','off','off','off','off'],
  ['off','off','off','off','off','off','off','off','off','off'],
  ['off','off','off','off','off','off','off','off','plus','on'],
  ['off','off','plus','on','off','off','off','off','plus','on'],
  ['off','off','plus','on','off','off','off','off','off','off'],
  ['off','off','off','off','off','off','off','off','off','off'],
  ['off','off','off','off','off','off','off','off','off','off']
];

const STATE_COLORS = ['#2d7259','#3f8668','#668ba6','#4775b8','#6e75d8','#8b63ad','#b65372','#c65b52','#e7773d','#d99a36','#b6a737','#6f8f42','#477d79','#596b73','#7b6b5d'];
const contrastText = color => {
  const value = String(color || '#ffffff').replace('#', '');
  const [r, g, b] = [0, 2, 4].map(index => parseInt(value.slice(index, index + 2), 16));
  return (r * 299 + g * 587 + b * 114) / 1000 > 155 ? '#20302b' : '#ffffff';
};
const hexToRgb = color => [1, 3, 5].map(index => parseInt(color.slice(index, index + 2), 16));

const initial = {
  title: 'Untitled Production',
  states: DEFAULT_STATES.map(state => ({ ...state })),
  scenes: scenesSeed.map((name, i) => ({ id: `s${i}`, name })),
  characters: characterSeed.map(([name, actor], i) => ({ id: `c${i}`, name, actor })),
  cells: Object.fromEntries(characterSeed.flatMap((_, r) => scenesSeed.map((__, c) => [`c${r}:s${c}`, pattern[r][c] === 'plus' ? 'bss' : pattern[r][c] === 'on' ? 'on' : 'off'])))
};

const SmartField = forwardRef(function SmartField({ value, onChange, suggestions = [], onAdvance, onSubmit, ...props }, ref) {
  const [open, setOpen] = useState(false);
  const matches = useMemo(() => {
    const query = value.trim().toLowerCase();
    if (!query) return [];
    return suggestions.filter(item => item.toLowerCase().includes(query)).sort((a, b) => Number(b.toLowerCase().startsWith(query)) - Number(a.toLowerCase().startsWith(query)) || a.localeCompare(b)).slice(0, 6);
  }, [value, suggestions]);
  const accept = candidate => { onChange(candidate); setOpen(false); };
  return <div className="smart-field">
    <input ref={ref} value={value} onChange={e => { onChange(e.target.value); setOpen(true); }} onFocus={() => value.trim() && setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 100)} onKeyDown={e => {
      if (e.key === 'Tab' && !e.shiftKey) {
        const resolved = value.trim() && matches.length ? matches[0] : value;
        if (resolved !== value) onChange(resolved);
        setOpen(false);
        if (onAdvance) {
          e.preventDefault();
          requestAnimationFrame(() => onAdvance(resolved));
        }
      }
      if (e.key === 'Escape') setOpen(false);
      if (e.key === 'Enter' && onSubmit) {
        e.preventDefault();
        setOpen(false);
        onSubmit(value);
      }
    }} {...props}/>
    {open && matches.length > 0 && <div className="smart-options">{matches.map((item, index) => <button type="button" className={index === 0 ? 'top-match' : ''} key={item} onMouseDown={e => { e.preventDefault(); accept(item); onAdvance?.(item); }}>{item}</button>)}</div>}
  </div>;
});

function loadSession() {
  try {
    const library = readLibrary();
    const stored = library.currentId && library.shows[library.currentId]?.plot;
    if (stored) return { plot: normalisePlot(stored), hasCurrent: true };
    const legacy = readLegacyPlot();
    if (legacy) {
      const plot = normalisePlot({ ...legacy, id: legacy.id || crypto.randomUUID(), company: legacy.company || '', showName: legacy.showName || legacy.title || 'Untitled Production' });
      return { plot, hasCurrent: true };
    }
    return { plot: { ...initial, id: null }, hasCurrent: false };
  } catch { return { plot: { ...initial, id: null }, hasCurrent: false }; }
}

function App() {
  const [session] = useState(loadSession);
  const { plot, setPlot, resetPlot, undo, redo, canUndo, canRedo, undoLabel, redoLabel } = usePlotHistory(session.plot);
  const [startupStep, setStartupStep] = useState(session.hasCurrent ? null : 'choose');
  const [newShow, setNewShow] = useState({ company: '', name: '' });
  const [loadError, setLoadError] = useState('');
  const [query, setQuery] = useState('');
  const [saved, setSaved] = useState(true);
  const [draggingId, setDraggingId] = useState(null);
  const [castMenu, setCastMenu] = useState(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [collateCast, setCollateCast] = useState(() => localStorage.getItem('mic-plot-collate-cast') === 'true');
  const [easterEgg, setEasterEgg] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [drawer, setDrawer] = useState(null);
  const [selectedCharacterId, setSelectedCharacterId] = useState(null);
  const [selectedSceneId, setSelectedSceneId] = useState(null);
  const [selectedCastName, setSelectedCastName] = useState('');
  const [selectedSceneIds, setSelectedSceneIds] = useState([]);
  const [bulkDraft, setBulkDraft] = useState({ name: '', actor: '', defaultGroup: '' });
  const [pasteText, setPasteText] = useState('');
  const [setupPasteOpen, setSetupPasteOpen] = useState(false);
  const [editMode, setEditMode] = useState('direct');
  const [selectedCells, setSelectedCells] = useState([]);
  const [cellAnchor, setCellAnchor] = useState(null);
  const [paintState, setPaintState] = useState(null);
  const [libraryRevision, setLibraryRevision] = useState(0);
  const [saveMessage, setSaveMessage] = useState('Saved locally');
  const [pdfOptions, setPdfOptions] = useState({ format: 'a3', orientation: 'landscape', fontSize: 6.5, selectedOnly: false, includeLegend: true, logoPosition: 'left', logo2Position: 'right', dataLayout: 'cast', showCharacterNumber: false, showMicNumber: true });
  const [pdfPreviewOpen, setPdfPreviewOpen] = useState(false);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState('');
  const [pdfPreviewLoading, setPdfPreviewLoading] = useState(false);
  const [pdfPreviewError, setPdfPreviewError] = useState('');
  const [pdfPreviewPages, setPdfPreviewPages] = useState(0);
  const [pdfPreviewScale, setPdfPreviewScale] = useState('page-width');
  const [setupTab, setSetupTab] = useState('show');
  const [setupCharacter, setSetupCharacter] = useState({ name: '', actor: '', defaultGroup: '' });
  const [setupSceneName, setSetupSceneName] = useState('');
  const [stateDraft, setStateDraft] = useState({ name: '', abbreviation: '', color: STATE_COLORS[2] });
  const [colorPickerId, setColorPickerId] = useState(null);
  const [setupDragging, setSetupDragging] = useState(null);
  const [stateTemplateId, setStateTemplateId] = useState('');
  const [groupTemplateId, setGroupTemplateId] = useState('');
  const lastBackupRef = useRef(0);
  const massDraggingRef = useRef(false);
  const stateById = Object.fromEntries(plot.states.map(state => [state.id, state]));
  const labels = Object.fromEntries(plot.states.map(state => [state.id, state.abbreviation]));
  const showFileRef = useRef(null);
  const bulkNameRef = useRef(null);
  const bulkActorRef = useRef(null);
  const bulkGroupRef = useRef(null);
  const setupCharacterNameRef = useRef(null);
  const setupCharacterActorRef = useRef(null);
  const setupCharacterGroupRef = useRef(null);
  const showLogoInputRef = useRef(null);
  const showLogo2InputRef = useRef(null);

  useEffect(() => {
    if (!plot.id) return;
    setSaved(false);
    setSaveMessage('Saving changes…');
    const id = setTimeout(() => {
      try {
        const shouldBackup = Date.now() - lastBackupRef.current > 5 * 60 * 1000;
        savePlotToLibrary(plot, { backup: shouldBackup });
        if (shouldBackup) lastBackupRef.current = Date.now();
        setSaved(true);
        setSaveMessage(`Saved ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`);
        setLibraryRevision(value => value + 1);
      } catch { setSaveMessage('Local save failed — download a backup'); }
    }, 350);
    return () => clearTimeout(id);
  }, [plot]);

  useEffect(() => {
    const warn = event => { if (!saved) event.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [saved]);

  const createShow = () => {
    const company = newShow.company.trim();
    const showName = newShow.name.trim();
    if (!company || !showName) return;
    const created = createBlankPlot(company, showName);
    resetPlot(created);
    setSetupTab('show');
    setStartupStep('setup');
  };

  const loadShowFile = async file => {
    if (!file) return;
    if (!saved && !confirm('The latest changes have not finished saving. Open another project anyway?')) return;
    setLoadError('');
    try {
      const parsed = JSON.parse(await file.text());
      const imported = parsed.format === 'micplot' ? parsed.plot : parsed;
      if (!imported || !Array.isArray(imported.characters) || !Array.isArray(imported.scenes) || typeof imported.cells !== 'object') throw new Error('Invalid project');
      resetPlot(normalisePlot({ ...imported, id: imported.id || crypto.randomUUID() }));
      setStartupStep(null);
    } catch {
      setLoadError('This file is not a valid mic plot project.');
    } finally {
      if (showFileRef.current) showFileRef.current.value = '';
    }
  };

  const visible = useMemo(() => plot.characters.filter(c => `${c.name} ${c.actor}`.toLowerCase().includes(query.toLowerCase())), [plot.characters, query]);
  const castSuggestions = useMemo(() => [...new Set(plot.characters.map(c => c.actor.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b)), [plot.characters]);
  const groupSuggestions = useMemo(() => [...new Set([...(plot.groups || []), ...plot.characters.map(c => (c.defaultGroup || '').trim())].filter(Boolean))].sort((a, b) => a.localeCompare(b)), [plot.characters, plot.groups]);
  const activeCount = Object.values(plot.cells).filter(value => value !== 'off' && stateById[value]).length;
  const characterWidth = Math.max(50, Math.ceil(Math.max('CHARACTER'.length, ...plot.characters.map(c => c.name.length)) * 6.2 + 24));
  const actorWidth = Math.max(50, Math.ceil(Math.max('CAST MEMBER'.length, ...plot.characters.map(c => c.actor.length)) * 6.2 + 24));
  const castReportRows = useMemo(() => collateCastRows(plot, collateCast), [plot, collateCast]);
  const storedShows = useMemo(() => listStoredPlots(), [libraryRevision, startupStep]);
  const backups = useMemo(() => plot.id ? getBackups(plot.id) : [], [plot.id, libraryRevision, startupStep]);
  const templateShows = storedShows.filter(item => item.plot.id !== plot.id);
  const setupChecks = [
    { label: 'Show details', done: Boolean(plot.company.trim() && plot.showName.trim()), tab: 'show' },
    { label: 'Characters', done: plot.characters.length > 0, tab: 'characters' },
    { label: 'Scenes', done: plot.scenes.length > 0, tab: 'scenes' }
  ];

  useEffect(() => { localStorage.setItem('mic-plot-collate-cast', String(collateCast)); }, [collateCast]);
  useEffect(() => {
    const onKeyDown = event => {
      if (event.key === 'Escape') {
        if (pdfPreviewOpen) { setPdfPreviewOpen(false); return; }
        setHelpOpen(false); setDrawer(null); setCastMenu(null); setSelectedCells([]); setSelectedSceneIds([]); setSelectedSceneId(null); setCellAnchor(null); if (startupStep === 'setup') setStartupStep(null);
      }
      if ((event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLowerCase() === 'z') { event.preventDefault(); undo(); }
      if ((event.ctrlKey || event.metaKey) && ((event.shiftKey && event.key.toLowerCase() === 'z') || event.key.toLowerCase() === 'y')) { event.preventDefault(); redo(); }
      const typing = event.target.matches('input, textarea, select');
      const plainKey = !typing && !event.ctrlKey && !event.metaKey && !event.altKey;
      const plotKey = plainKey && !startupStep && !drawer && !helpOpen && !reportOpen && !pdfPreviewOpen;
      if (plainKey && event.key.toLowerCase() === 'd') { event.preventDefault(); setEditMode('direct'); setSelectedCells([]); }
      if (plainKey && event.key.toLowerCase() === 'm') { event.preventDefault(); setEditMode('mass'); setCellAnchor(null); }
      if (!event.target.matches('input, textarea, select') && (event.key === 'Delete' || event.key === 'Backspace') && selectedCells.length) { event.preventDefault(); applyStateToSelection('off'); }
      if (plotKey && editMode === 'direct' && cellAnchor && event.key.startsWith('Arrow')) {
        const [characterId, sceneId] = cellAnchor.split(':');
        const row = visible.findIndex(item => item.id === characterId);
        const column = plot.scenes.findIndex(item => item.id === sceneId);
        if (row >= 0 && column >= 0) {
          const nextRow = Math.max(0, Math.min(visible.length - 1, row + (event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0)));
          const nextColumn = Math.max(0, Math.min(plot.scenes.length - 1, column + (event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0)));
          const nextKey = `${visible[nextRow].id}:${plot.scenes[nextColumn].id}`;
          event.preventDefault();
          setCellAnchor(nextKey);
          requestAnimationFrame(() => document.querySelector(`[data-cell-key="${nextKey}"]`)?.focus({ preventScroll: true }));
        }
      }
      if (plotKey && editMode === 'direct' && cellAnchor) {
        const index = Number(event.key);
        if (Number.isInteger(index) && plot.states[index]) { event.preventDefault(); setCellState(cellAnchor, plot.states[index].id); }
      } else if (plotKey && selectedCells.length) {
        const index = Number(event.key);
        if (Number.isInteger(index) && plot.states[index]) { event.preventDefault(); applyStateToSelection(plot.states[index].id); }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [undo, redo, selectedCells, plot.states, plot.scenes, visible, startupStep, drawer, helpOpen, reportOpen, pdfPreviewOpen, editMode, cellAnchor]);

  useEffect(() => {
    const selector = pdfPreviewOpen ? '.pdf-preview-dialog' : helpOpen ? '.help-panel' : startupStep ? '.startup-modal' : drawer ? '.advanced-drawer' : null;
    if (!selector) return;
    const container = document.querySelector(selector);
    if (!container) return;
    const previous = document.activeElement;
    const focusable = () => [...container.querySelectorAll('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), a[href]')];
    requestAnimationFrame(() => focusable()[0]?.focus());
    const trap = event => {
      if (event.key !== 'Tab') return;
      const items = focusable();
      if (!items.length) return;
      const first = items[0]; const last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    container.addEventListener('keydown', trap);
    return () => { container.removeEventListener('keydown', trap); previous?.focus?.(); };
  }, [pdfPreviewOpen, helpOpen, startupStep, drawer]);

  useEffect(() => {
    if (!colorPickerId) return;
    const close = event => { if (!event.target.closest('.color-picker')) setColorPickerId(null); };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [colorPickerId]);

  const updateCell = (cid, sid) => setPlot(p => {
    const key = `${cid}:${sid}`;
    return { ...p, cells: { ...p.cells, [key]: cycleState(p.states, p.cells[key]) } };
  });
  const setCellState = (key, value) => setPlot(p => ({ ...p, cells: { ...p.cells, [key]: value } }));
  const applyStateToSelection = value => {
    if (!selectedCells.length) return;
    setPlot(p => ({ ...p, cells: { ...p.cells, ...Object.fromEntries(selectedCells.map(key => [key, value])) } }));
  };
  const selectCellRange = key => {
    if (!cellAnchor) { setCellAnchor(key); setSelectedCells([key]); return; }
    const [anchorCharacter, anchorScene] = cellAnchor.split(':');
    const [targetCharacter, targetScene] = key.split(':');
    const rowA = plot.characters.findIndex(item => item.id === anchorCharacter);
    const rowB = plot.characters.findIndex(item => item.id === targetCharacter);
    const colA = plot.scenes.findIndex(item => item.id === anchorScene);
    const colB = plot.scenes.findIndex(item => item.id === targetScene);
    if ([rowA, rowB, colA, colB].includes(-1)) return;
    const range = [];
    for (let row = Math.min(rowA, rowB); row <= Math.max(rowA, rowB); row += 1) for (let col = Math.min(colA, colB); col <= Math.max(colA, colB); col += 1) range.push(`${plot.characters[row].id}:${plot.scenes[col].id}`);
    setSelectedCells(range);
  };

  const addCharacter = () => {
    const id = crypto.randomUUID();
    setQuery('');
    setPlot(p => ({ ...p, characters: [...p.characters, { id, name: 'New character', actor: '', defaultGroup: '' }] }));
    setSelectedCharacterId(id);
    setDrawer('character');
  };
  const duplicateCharacter = id => setPlot(p => {
    const source = p.characters.find(character => character.id === id);
    if (!source) return p;
    const newId = crypto.randomUUID();
    const index = p.characters.findIndex(character => character.id === id);
    const characters = [...p.characters];
    characters.splice(index + 1, 0, { ...source, id: newId, name: `${source.name} copy` });
    const cells = { ...p.cells };
    p.scenes.forEach(scene => { cells[`${newId}:${scene.id}`] = cells[`${id}:${scene.id}`] || 'off'; });
    return { ...p, characters, cells };
  });
  const addScene = () => {
    const id = crypto.randomUUID();
    setPlot(p => ({ ...p, scenes: [...p.scenes, { id, name: 'New scene' }] }));
    setSelectedSceneIds([id]);
    setSelectedSceneId(id);
    setDrawer('scene');
  };
  const addSetupScene = () => {
    const names = setupSceneName.split(/\r?\n/).map(name => name.trim()).filter(Boolean);
    if (!names.length) return;
    setPlot(p => ({ ...p, scenes: [...p.scenes, ...names.map(name => ({ id: crypto.randomUUID(), name }))] }));
    setSetupSceneName('');
  };
  const addSetupCharacter = () => {
    const name = setupCharacter.name.trim();
    if (!name) return;
    setPlot(p => ({ ...p, characters: [...p.characters, { id: crypto.randomUUID(), name, actor: setupCharacter.actor.trim(), defaultGroup: setupCharacter.defaultGroup.trim() }] }));
    setSetupCharacter({ name: '', actor: '', defaultGroup: '' });
    requestAnimationFrame(() => setupCharacterNameRef.current?.focus());
  };
  const addState = () => {
    const name = stateDraft.name.trim();
    const abbreviation = stateDraft.abbreviation.trim().toUpperCase();
    if (!name || !abbreviation) return;
    setPlot(p => {
    const id = `state-${crypto.randomUUID().slice(0, 8)}`;
      return { ...p, states: [...p.states, { id, name, abbreviation: abbreviation.slice(0, 6), color: stateDraft.color }] };
    });
    const nextColor = STATE_COLORS.find(color => !plot.states.some(state => state.color === color) && color !== stateDraft.color) || STATE_COLORS[2];
    setStateDraft({ name: '', abbreviation: '', color: nextColor });
    setColorPickerId(null);
  };
  const updateState = (id, field, value) => setPlot(p => ({ ...p, states: p.states.map(state => state.id === id ? { ...state, [field]: value } : state) }));
  const removeState = id => setPlot(p => ({ ...p, states: p.states.filter(state => state.id !== id), cells: Object.fromEntries(Object.entries(p.cells).map(([key, value]) => [key, value === id ? 'off' : value])) }));
  const stateUseCount = id => Object.values(plot.cells).filter(value => value === id).length;
  const characterUseCount = id => plot.scenes.filter(scene => (plot.cells[`${id}:${scene.id}`] || 'off') !== 'off').length;
  const sceneUseCount = id => plot.characters.filter(character => (plot.cells[`${character.id}:${id}`] || 'off') !== 'off').length;
  const confirmRemoveState = state => confirm(`Remove “${state.name}”? ${stateUseCount(state.id)} cue assignment${stateUseCount(state.id) === 1 ? '' : 's'} will be reset to Off.`);
  const confirmRemoveCharacter = character => confirm(`Delete “${character.name}”? ${characterUseCount(character.id)} cue assignment${characterUseCount(character.id) === 1 ? '' : 's'} will also be removed.`);
  const confirmRemoveScene = scene => confirm(`Delete “${scene.name}”? ${sceneUseCount(scene.id)} cue assignment${sceneUseCount(scene.id) === 1 ? '' : 's'} will also be removed.`);
  const copyStateTemplate = () => {
    const source = storedShows.find(item => item.plot.id === stateTemplateId)?.plot;
    if (!source) return;
    const sourceStates = normalisePlot(source).states.map(state => ({ ...state }));
    const validIds = new Set(sourceStates.map(state => state.id));
    const resetCount = Object.values(plot.cells).filter(value => !validIds.has(value) && value !== 'off').length;
    if (!confirm(`Use the state set from “${source.title}”?${resetCount ? ` ${resetCount} assignment${resetCount === 1 ? '' : 's'} using unavailable states will be reset to Off.` : ''}`)) return;
    setPlot(p => ({ ...p, states: sourceStates, cells: Object.fromEntries(Object.entries(p.cells).map(([key, value]) => [key, validIds.has(value) ? value : 'off'])) }));
  };
  const copyGroupTemplate = () => {
    const source = storedShows.find(item => item.plot.id === groupTemplateId)?.plot;
    if (!source) return;
    const groups = [...new Set([...(source.groups || []), ...source.characters.map(character => (character.defaultGroup || '').trim())].filter(Boolean))];
    setPlot(p => ({ ...p, groups: [...new Set([...(p.groups || []), ...groups])].sort((a, b) => a.localeCompare(b)) }));
  };
  const moveState = (fromId, toId) => {
    if (!fromId || fromId === toId) return;
    setPlot(p => {
      const states = [...p.states];
      const fromIndex = states.findIndex(state => state.id === fromId);
      const toIndex = states.findIndex(state => state.id === toId);
      if (fromIndex < 0 || toIndex < 0) return p;
      const [moved] = states.splice(fromIndex, 1);
      states.splice(toIndex, 0, moved);
      return { ...p, states };
    });
  };
  const updateShowIdentity = (field, value) => setPlot(p => {
    const next = { ...p, [field]: value };
    next.title = `${field === 'company' ? value : p.company} - ${field === 'showName' ? value : p.showName}`;
    return next;
  });
  const uploadShowLogo = (file, slot = 'showLogo') => {
    if (!file) return;
    if (!file.type.startsWith('image/')) { setSaveMessage('Logo must be an image file'); return; }
    const source = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      const scale = Math.min(1, 800 / image.width, 320 / image.height);
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
      setPlot(p => ({ ...p, [slot]: canvas.toDataURL('image/png') }));
      setPdfOptions(options => slot === 'showLogo'
        ? { ...options, logoPosition: options.logoPosition === 'off' ? (options.logo2Position === 'left' ? 'right' : 'left') : options.logoPosition }
        : { ...options, logo2Position: options.logo2Position === 'off' ? (options.logoPosition === 'right' ? 'left' : 'right') : options.logo2Position });
      URL.revokeObjectURL(source);
      const input = slot === 'showLogo' ? showLogoInputRef.current : showLogo2InputRef.current;
      if (input) input.value = '';
    };
    image.onerror = () => { URL.revokeObjectURL(source); setSaveMessage('Logo image could not be read'); };
    image.src = source;
  };
  const updateCharacter = (id, field, value) => setPlot(p => ({ ...p, characters: p.characters.map(c => c.id === id ? { ...c, [field]: value } : c) }));
  const updateScene = (id, value) => setPlot(p => ({ ...p, scenes: p.scenes.map(s => s.id === id ? { ...s, name: value } : s) }));
  const removeCharacter = id => setPlot(p => removeCharacterFromPlot(p, id));
  const removeScene = id => setPlot(p => removeSceneFromPlot(p, id));
  const matchingCast = value => {
    const query = value.trim().toLowerCase();
    return castSuggestions
      .filter(name => !query || name.toLowerCase().includes(query))
      .sort((a, b) => {
        const aStarts = a.toLowerCase().startsWith(query);
        const bStarts = b.toLowerCase().startsWith(query);
        return Number(bStarts) - Number(aStarts) || a.localeCompare(b);
      })
      .slice(0, 8);
  };
  const chooseCast = (characterId, name) => {
    updateCharacter(characterId, 'actor', name);
    setCastMenu(null);
  };
  const addBulkCharacter = groupValue => {
    const name = bulkDraft.name.trim();
    if (!name) { bulkNameRef.current?.focus(); return; }
    const id = crypto.randomUUID();
    setPlot(p => ({ ...p, characters: [...p.characters, { id, name, actor: bulkDraft.actor.trim(), defaultGroup: String(groupValue ?? bulkDraft.defaultGroup).trim() }] }));
    setBulkDraft({ name: '', actor: '', defaultGroup: '' });
    requestAnimationFrame(() => bulkNameRef.current?.focus());
  };
  const toggleGroupForScenes = group => {
    if (!selectedSceneIds.length) return;
    const members = plot.characters.filter(character => character.defaultGroup === group);
    if (!members.length) return;
    setPlot(p => {
      const cells = { ...p.cells };
      const values = selectedSceneIds.flatMap(sceneId => members.map(character => cells[`${character.id}:${sceneId}`] || 'off'));
      const sharedState = values.every(value => value === values[0]) ? values[0] : 'off';
      const nextState = cycleState(p.states, sharedState);
      selectedSceneIds.forEach(sceneId => members.forEach(character => { cells[`${character.id}:${sceneId}`] = nextState; }));
      return { ...p, cells };
    });
  };
  const toggleGroupSelection = group => {
    if (!selectedSceneIds.length) return;
    const members = plot.characters.filter(character => character.defaultGroup === group);
    const keys = members.flatMap(character => selectedSceneIds.map(sceneId => `${character.id}:${sceneId}`));
    setSelectedCells(current => {
      const currentSet = new Set(current);
      const remove = keys.length > 0 && keys.every(key => currentSet.has(key));
      keys.forEach(key => remove ? currentSet.delete(key) : currentSet.add(key));
      return [...currentSet];
    });
  };
  const selectMassCell = key => {
    setSelectedCells(current => current.includes(key) ? current.filter(item => item !== key) : [...current, key]);
    setCellAnchor(key);
  };
  const addMassCell = key => setSelectedCells(current => current.includes(key) ? current : [...current, key]);
  const selectSceneHeading = id => {
    setSelectedSceneIds(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]);
  };
  const inspectScene = id => {
    setSelectedSceneId(id);
    setSelectedCharacterId(null);
    setDrawer('scene');
  };
  const moveCharacter = (fromId, toId) => {
    if (!fromId || fromId === toId) return;
    setPlot(p => {
      const characters = [...p.characters];
      const fromIndex = characters.findIndex(c => c.id === fromId);
      const toIndex = characters.findIndex(c => c.id === toId);
      if (fromIndex < 0 || toIndex < 0) return p;
      const [moved] = characters.splice(fromIndex, 1);
      characters.splice(toIndex, 0, moved);
      return { ...p, characters };
    });
  };
  const moveScene = (fromId, toId) => {
    if (!fromId || fromId === toId) return;
    setPlot(p => {
      const scenes = [...p.scenes];
      const fromIndex = scenes.findIndex(item => item.id === fromId);
      const toIndex = scenes.findIndex(item => item.id === toId);
      if (fromIndex < 0 || toIndex < 0) return p;
      const [moved] = scenes.splice(fromIndex, 1);
      scenes.splice(toIndex, 0, moved);
      return { ...p, scenes };
    });
  };
  const duplicateScene = id => setPlot(p => {
    const source = p.scenes.find(scene => scene.id === id);
    if (!source) return p;
    const newId = crypto.randomUUID();
    const index = p.scenes.findIndex(scene => scene.id === id);
    const scenes = [...p.scenes];
    scenes.splice(index + 1, 0, { id: newId, name: `${source.name} copy` });
    const cells = { ...p.cells };
    p.characters.forEach(character => { cells[`${character.id}:${newId}`] = cells[`${character.id}:${id}`] || 'off'; });
    return { ...p, scenes, cells };
  });
  const importPastedCharacters = text => {
    const rows = parseTabular(text);
    if (!rows.length) return false;
    setPlot(p => ({ ...p, characters: [...p.characters, ...rows.map(row => ({ id: crypto.randomUUID(), ...row }))] }));
    return true;
  };
  const duplicateStoredShow = item => {
    const copy = normalisePlot({ ...item.plot, id: crypto.randomUUID(), title: `${item.plot.title} copy`, showName: `${item.plot.showName || item.plot.title} copy` });
    resetPlot(copy);
    setStartupStep(null);
  };

  const exportCsv = () => {
    const q = v => `"${String(v).replaceAll('"', '""')}"`;
    const lines = [['Character','Cast member',...plot.scenes.map(s => s.name)], ...plot.characters.map(c => [c.name,c.actor,...plot.scenes.map(s => labels[plot.cells[`${c.id}:${s.id}`] || 'off'])])];
    const blob = new Blob(['\ufeff', lines.map(r => r.map(q).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${cleanFilename(plot.title)}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 0);
  };

  const downloadShow = () => {
    const project = JSON.stringify({ format: 'micplot', version: 1, plot }, null, 2);
    const blob = new Blob([project], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${cleanFilename(plot.title)}.micplot`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 0);
  };

  const buildPdf = async () => {
    const [{ jsPDF }, { autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
    const scenes = pdfOptions.selectedOnly && selectedSceneIds.length ? plot.scenes.filter(scene => selectedSceneIds.includes(scene.id)) : plot.scenes;
    const doc = new jsPDF({ orientation: pdfOptions.orientation, unit: 'mm', format: pdfOptions.format });
    const exportHeading = `MIC PLOT - LISTED BY ${pdfOptions.dataLayout === 'cast' ? 'CAST' : 'CHARACTER'} - ${pdfOptions.format.toUpperCase()} EXPORT`;
    const exportTimestamp = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date());
    doc.setProperties({ title: `${exportHeading} - ${exportTimestamp}` });
    const stateValues = character => scenes.map(scene => labels[plot.cells[`${character.id}:${scene.id}`] || 'off']);
    let identityHeaders;
    let body;
    const continuationCells = new Set();
    if (pdfOptions.dataLayout === 'cast') {
      const groups = new Map();
      plot.characters.forEach((character, characterIndex) => {
        const actor = character.actor.trim();
        const key = actor ? actor.toLocaleLowerCase() : `unassigned:${character.id}`;
        if (!groups.has(key)) groups.set(key, { actor: actor || 'Uncast', characters: [] });
        const group = groups.get(key);
        group.characters.push({ character, characterIndex });
      });
      const orderedGroups = [...groups.values()];
      identityHeaders = ['Channel #', ...(pdfOptions.showMicNumber ? ['Mic #'] : []), 'Cast member', ...(pdfOptions.showCharacterNumber ? ['Character #'] : []), 'Character'];
      let castRowIndex = 0;
      body = orderedGroups.flatMap((group, groupIndex) => group.characters.map(({ character, characterIndex }, roleIndex) => {
        const row = [
          roleIndex === 0 ? String(groupIndex + 1) : '',
          ...(pdfOptions.showMicNumber ? [''] : []),
          roleIndex === 0 ? group.actor : '',
          ...(pdfOptions.showCharacterNumber ? [String(characterIndex + 1)] : []),
          character.name,
          ...stateValues(character)
        ];
        if (roleIndex > 0) {
          continuationCells.add(`${castRowIndex}:${pdfOptions.showMicNumber ? 2 : 1}`);
        }
        castRowIndex += 1;
        return row;
      }));
    } else {
      identityHeaders = ['#', 'Character', 'Cast member'];
      body = plot.characters.map((character, index) => [String(index + 1), character.name, character.actor, ...stateValues(character)]);
    }
    const sceneColumnStart = identityHeaders.length;
    const head = [[...identityHeaders, ...scenes.map(scene => scene.name)]];
    const measureColumn = (values, fontSize = pdfOptions.fontSize, fontStyle = 'normal') => {
      doc.setFont('helvetica', fontStyle);
      doc.setFontSize(fontSize);
      return Math.max(...values.map(value => doc.getTextWidth(String(value || ''))), 1) + 3;
    };
    const centeredHeaders = new Set(['#', 'Channel #', 'Mic #', 'Character #']);
    const verticalIdentityHeaders = new Set(pdfOptions.dataLayout === 'cast' ? ['Channel #', 'Mic #', 'Character #'] : []);
    const verticalHeaderIndices = new Set(identityHeaders.flatMap((header, index) => verticalIdentityHeaders.has(header) ? [index] : []));
    const columnStyles = Object.fromEntries(identityHeaders.map((header, index) => [index, {
      cellWidth: verticalIdentityHeaders.has(header) ? Math.max(7, measureColumn(body.map(row => row[index]))) : measureColumn([header, ...body.map(row => row[index])]),
      ...(centeredHeaders.has(header) ? { halign: 'center' } : {})
    }]));
    scenes.forEach((scene, index) => {
      columnStyles[index + sceneColumnStart] = { cellWidth: Math.max(7, measureColumn(body.map(row => row[index + sceneColumnStart]), pdfOptions.fontSize, 'bold')), halign: 'center' };
    });
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.5);
    const verticalHeaderHeight = Math.max(18, ...scenes.map(scene => doc.getTextWidth(scene.name) + 6), ...[...verticalHeaderIndices].map(index => doc.getTextWidth(identityHeaders[index]) + 6));
    const pageWidth = doc.internal.pageSize.getWidth();
    const makeLogoMetrics = (image, position) => {
      if (!image || position === 'off') return null;
      try {
        const properties = doc.getImageProperties(image);
        let height = 40;
        let width = height * properties.width / properties.height;
        if (width > 75) { width = 75; height = width * properties.height / properties.width; }
        return { image, position, width, height, x: position === 'left' ? 14 : pageWidth - 14 - width, y: 7 };
      } catch { return null; }
    };
    const logos = [makeLogoMetrics(plot.showLogo, pdfOptions.logoPosition), makeLogoMetrics(plot.showLogo2, pdfOptions.logo2Position)].filter(Boolean);
    const leftLogo = logos.find(logo => logo.position === 'left');
    const rightLogo = logos.find(logo => logo.position === 'right');
    const headerTextX = leftLogo ? leftLogo.x + leftLogo.width + 8 : 10;
    const headerRightEdge = rightLogo ? rightLogo.x - 8 : pageWidth - 10;
    const logoAreaTop = logos.length ? Math.min(...logos.map(logo => logo.y)) : 3;
    const imageBottom = logos.length ? Math.max(...logos.map(logo => logo.y + logo.height)) : 16;
    const headerMidpoint = (logoAreaTop + imageBottom) / 2;
    const headerTitleY = logos.length ? headerMidpoint - 3.25 : 10;
    const headerDetailY = headerTitleY + 6;
    const headerTimestampY = headerDetailY + 4;
    const legendLayout = () => {
      if (!pdfOptions.includeLegend) return { items: [], bottom: headerTimestampY };
      doc.setFontSize(6.5);
      let x = headerTextX; let row = 0;
      const items = plot.states.map(state => {
        const shortName = state.abbreviation || 'OFF';
        const badgeWidth = Math.max(8, doc.getTextWidth(shortName) + 3.5);
        const nameWidth = doc.getTextWidth(state.name);
        const width = badgeWidth + nameWidth + 5;
        if (x + width > headerRightEdge && x > headerTextX) { x = headerTextX; row += 1; }
        const item = { state, shortName, badgeWidth, x, row };
        x += width;
        return item;
      });
      const lastRow = items.at(-1)?.row || 0;
      const lastBaseline = Math.max(headerTimestampY + 6 + lastRow * 5.5, imageBottom - 1);
      items.forEach(item => { item.y = lastBaseline - (lastRow - item.row) * 5.5; });
      return { items, bottom: lastBaseline + 1 };
    };
    const legend = legendLayout();
    const tableTop = Math.max(25, legend.bottom + 8, imageBottom + 8);
    const drawPageHeader = (pageNumber, pageCount) => {
      logos.forEach(logo => doc.addImage(logo.image, logo.x, logo.y, logo.width, logo.height));
      doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.setTextColor(23, 63, 52); doc.text(plot.title || 'Mic Plot', headerTextX, headerTitleY);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(100, 115, 108); doc.text(exportHeading, headerTextX, headerDetailY);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.text(`${exportTimestamp} - ${pageNumber} of ${pageCount}`, headerTextX, headerTimestampY);
      legend.items.forEach(({ state, shortName, badgeWidth, x, y }) => {
        const [r, g, b] = hexToRgb(state.color);
        doc.setFillColor(r, g, b); doc.setDrawColor(190, 202, 196); doc.roundedRect(x, y - 3.4, badgeWidth, 4.4, .6, .6, 'FD');
        doc.setFont('helvetica', 'bold'); doc.setFontSize(6); doc.setTextColor(...hexToRgb(contrastText(state.color))); doc.text(shortName, x + badgeWidth / 2, y - .5, { align: 'center' });
        doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(90, 108, 99); doc.text(state.name, x + badgeWidth + 1.5, y - .5);
      });
    };

    autoTable(doc, {
      head,
      body,
      startY: tableTop,
      margin: { top: tableTop, right: 10, bottom: 12, left: 10 },
      theme: 'grid',
      styles: { font: 'helvetica', fontSize: pdfOptions.fontSize, cellPadding: 1.5, lineColor: [207, 217, 211], lineWidth: 0.2, textColor: [42, 62, 55], valign: 'middle' },
      headStyles: { fillColor: [237, 242, 239], textColor: [42, 62, 55], fontStyle: 'bold', fontSize: 5.5, minCellHeight: verticalHeaderHeight, halign: 'center', valign: 'bottom' },
      columnStyles,
      showHead: 'everyPage',
      horizontalPageBreak: true,
      horizontalPageBreakRepeat: identityHeaders.map((_, index) => index),
      horizontalPageBreakBehaviour: 'immediately',
      didParseCell: data => {
        if (data.section === 'body' && continuationCells.has(`${data.row.index}:${data.column.index}`)) {
          data.cell.text = [];
          data.cell.styles.halign = 'center';
          return;
        }
        if (data.section === 'head' && (data.column.index >= sceneColumnStart || verticalHeaderIndices.has(data.column.index))) {
          data.cell.text = [];
          data.cell.styles.minCellHeight = verticalHeaderHeight;
          return;
        }
        if (data.section !== 'body' || data.column.index < sceneColumnStart) return;
        data.cell.styles.halign = 'center';
        data.cell.styles.fontStyle = 'bold';
        const state = plot.states.find(item => item.abbreviation === data.cell.raw && item.id !== 'off');
        if (state) { data.cell.styles.fillColor = hexToRgb(state.color); data.cell.styles.textColor = contrastText(state.color) === '#ffffff' ? [255, 255, 255] : [32, 48, 43]; }
      },
      didDrawCell: data => {
        if (data.section === 'body' && continuationCells.has(`${data.row.index}:${data.column.index}`)) {
          const x = data.cell.x + data.cell.width / 2;
          const y = data.cell.y + data.cell.height / 2;
          doc.setDrawColor(145, 145, 145);
          doc.setLineWidth(0.25);
          doc.line(x - 1.5, y - 1.2, x - 1.5, y + 0.7);
          doc.line(x - 1.5, y + 0.7, x + 1.25, y + 0.7);
          doc.line(x + 1.25, y + 0.7, x + 0.35, y - 0.1);
          doc.line(x + 1.25, y + 0.7, x + 0.35, y + 1.5);
          return;
        }
        if (data.section !== 'head' || (data.column.index < sceneColumnStart && !verticalHeaderIndices.has(data.column.index))) return;
        const name = String(data.cell.raw || '');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(5.5);
        doc.setTextColor(42, 62, 55);
        doc.text(name, data.cell.x + data.cell.width / 2 + 1.4, data.cell.y + data.cell.height - 2.5, { angle: 90 });
      },
      didDrawPage: () => {}
    });
    const pageCount = doc.getNumberOfPages();
    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
      doc.setPage(pageNumber);
      drawPageHeader(pageNumber, pageCount);
    }
    return doc;
  };

  const exportPdf = async () => {
    try {
      const doc = await buildPdf();
      doc.save(`${cleanFilename(plot.title)}.pdf`);
    } catch { setSaveMessage('PDF export failed'); }
  };

  const exportCastPdf = async () => {
    try {
    const [{ jsPDF }, { autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
    const doc = new jsPDF({ orientation: pdfOptions.orientation, unit: 'mm', format: pdfOptions.format });
    const scenes = pdfOptions.selectedOnly && selectedSceneIds.length ? plot.scenes.filter(scene => selectedSceneIds.includes(scene.id)) : plot.scenes;
    const head = [['Cast member', 'Character', ...scenes.map(scene => scene.name)]];
    const body = castReportRows.map((row, index) => [
      !collateCast && index > 0 && castReportRows[index - 1].groupId === row.groupId ? '' : row.actor,
      row.character,
      ...scenes.map(scene => labels[row.states[scene.id]])
    ]);

    autoTable(doc, {
      head,
      body,
      startY: 25,
      margin: { top: 25, right: 10, bottom: 12, left: 10 },
      theme: 'grid',
      styles: { font: 'helvetica', fontSize: pdfOptions.fontSize, cellPadding: 1.5, lineColor: [207, 217, 211], lineWidth: 0.2, textColor: [42, 62, 55], valign: 'middle' },
      headStyles: { fillColor: [237, 242, 239], textColor: [42, 62, 55], fontStyle: 'bold', fontSize: 5.5, minCellHeight: 18, halign: 'center', valign: 'bottom' },
      columnStyles: { 0: { cellWidth: 42 }, 1: { cellWidth: 48 } },
      horizontalPageBreak: true,
      horizontalPageBreakRepeat: [0, 1],
      horizontalPageBreakBehaviour: 'immediately',
      didParseCell: data => {
        if (data.section === 'head' && data.column.index >= 2) {
          data.cell.text = [];
          data.cell.styles.cellWidth = 11;
          data.cell.styles.minCellHeight = 34;
          return;
        }
        if (data.section !== 'body' || data.column.index < 2) return;
        data.cell.styles.halign = 'center';
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.cellWidth = 11;
        const state = plot.states.find(item => item.abbreviation === data.cell.raw && item.id !== 'off');
        if (state) { data.cell.styles.fillColor = hexToRgb(state.color); data.cell.styles.textColor = contrastText(state.color) === '#ffffff' ? [255, 255, 255] : [32, 48, 43]; }
      },
      didDrawCell: data => {
        if (data.section !== 'head' || data.column.index < 2) return;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(5.5);
        doc.setTextColor(42, 62, 55);
        doc.text(String(data.cell.raw || ''), data.cell.x + data.cell.width / 2 + 1.4, data.cell.y + data.cell.height - 2.5, { angle: 90 });
      },
      didDrawPage: () => {
        doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.setTextColor(23, 63, 52); doc.text(plot.title || 'Mic Plot', 10, 12);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(100, 115, 108); doc.text(`${pdfOptions.format.toUpperCase()} CAST VIEW · ${collateCast ? 'COLLATED ROLES' : 'EXPANDED ROLES'}`, 10, 18);
        if (pdfOptions.includeLegend) doc.text(plot.states.map(state => `${state.abbreviation || 'OFF'} · ${state.name}`).join('   '), 90, 18);
      }
    });

    doc.save(`${cleanFilename(plot.title)} - cast view${collateCast ? ' - collated' : ''}.pdf`);
    } catch { setSaveMessage('PDF export failed'); }
  };

  useEffect(() => {
    if (!pdfPreviewOpen) {
      setPdfPreviewUrl(current => { if (current) URL.revokeObjectURL(current); return ''; });
      return;
    }
    let cancelled = false;
    setPdfPreviewLoading(true);
    setPdfPreviewError('');
    const timer = setTimeout(async () => {
      try {
        const doc = await buildPdf();
        const url = URL.createObjectURL(doc.output('blob'));
        if (cancelled) { URL.revokeObjectURL(url); return; }
        setPdfPreviewPages(doc.getNumberOfPages());
        setPdfPreviewUrl(current => { if (current) URL.revokeObjectURL(current); return url; });
      } catch {
        if (!cancelled) setPdfPreviewError('The PDF preview could not be generated.');
      } finally {
        if (!cancelled) setPdfPreviewLoading(false);
      }
    }, 250);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [pdfPreviewOpen, pdfOptions, plot, selectedSceneIds]);

  const selectedCharacter = plot.characters.find(character => character.id === selectedCharacterId);
  const selectedScene = plot.scenes.find(scene => scene.id === selectedSceneId);
  const selectedCastCharacters = plot.characters.filter(character => (character.actor || '').trim().toLocaleLowerCase() === selectedCastName.trim().toLocaleLowerCase());
  const renameSelectedCast = value => {
    const oldName = selectedCastName;
    setPlot(p => ({ ...p, characters: p.characters.map(character => (character.actor || '').trim().toLocaleLowerCase() === oldName.trim().toLocaleLowerCase() ? { ...character, actor: value } : character) }));
    setSelectedCastName(value);
  };

  return <div className="app advanced">
    <main onKeyDown={e => {
      if (e.key === 'Enter' && e.target.matches('input, textarea')) {
        e.preventDefault();
        e.target.blur();
      }
    }}>
      <section className="title-row">
        <div>
          <div className="eyebrow">MIC PLOT STUDIO · v{APP_VERSION}</div>
          <input className="title-input" value={plot.title} onChange={e => setPlot({ ...plot, title: e.target.value })}/>
          <p>Build your cast-to-scene microphone plan. Click any cell to change its status.</p>
        </div>
      </section>

      <section className="toolbar">
        <div className="toolbar-left">
          {reportOpen ? <div className="report-mode-label"><Users size={16}/><strong>Read-only cast view</strong><label className="toggle"><input type="checkbox" checked={collateCast} onChange={e => setCollateCast(e.target.checked)}/><span></span> Collate multiple roles</label></div> : <>
            <label className="search"><Search size={16}/><input placeholder="Find a character or cast member…" value={query} onChange={e => setQuery(e.target.value)}/></label>
            <div className="legend">{plot.states.map(state => <span key={state.id}><i className={state.id === 'off' ? 'empty-dot' : 'dot'} style={state.id === 'off' ? undefined : { background: state.color }}></i>{state.name}</span>)}</div>
          </>}
        </div>
        <div className="button-group">
          <span className={`save-state ${saved ? 'saved' : saveMessage.startsWith('Local save failed') ? 'failed' : 'saving'}`} aria-live="polite"><Check size={14}/> {saved ? saveMessage : saveMessage.startsWith('Local save failed') ? saveMessage : 'Unsaved · saving…'}</span>
          <button className="icon-action" onClick={undo} disabled={!canUndo} aria-label={canUndo ? `Undo ${undoLabel}` : 'Nothing to undo'} title={canUndo ? `Undo ${undoLabel} (Ctrl+Z)` : 'Nothing to undo'}><Undo2 size={16}/></button>
          <button className="icon-action" onClick={redo} disabled={!canRedo} aria-label={canRedo ? `Redo ${redoLabel}` : 'Nothing to redo'} title={canRedo ? `Redo ${redoLabel} (Ctrl+Shift+Z)` : 'Nothing to redo'}><Redo2 size={16}/></button>
          <button className="secondary" data-tooltip={reportOpen ? 'Return to the editable microphone plot' : 'View assignments grouped by cast member'} onClick={() => setReportOpen(value => !value)}><Users size={16}/> {reportOpen ? 'Plot view' : 'Cast view'}</button>
          <button className="secondary" data-tooltip="Open, download, export, or start a new show" onClick={() => setStartupStep('manage')}><Download size={16}/> Save / Load</button>
          <button className="secondary" onClick={() => { setSetupTab('show'); setStartupStep('setup'); }}><Settings size={16}/> Show setup</button>
          <button className="icon-help" data-tooltip="Open the Mic Plot user guide" onClick={() => setHelpOpen(true)} aria-label="Help"><CircleHelp size={18}/></button>
        </div>
      </section>

      {!reportOpen && <section className={`advanced-bar mode-${editMode}`}>
        <div className="edit-mode-toggle" role="group" aria-label="Edit mode"><button className={editMode === 'direct' ? 'active' : ''} title="Direct Edit (D)" onClick={() => { setEditMode('direct'); setSelectedCells([]); }}>Direct Edit <kbd>D</kbd></button><button className={editMode === 'mass' ? 'active' : ''} title="Mass Edit (M)" onClick={() => { setEditMode('mass'); setCellAnchor(null); }}>Mass Edit <kbd>M</kbd></button></div>
        <div className="selection-tools"><button className="clear-selection" title="Clear selected cells and scenes (Esc)" disabled={!selectedCells.length && !selectedSceneIds.length && !(editMode === 'direct' && cellAnchor)} onClick={() => { setSelectedCells([]); setSelectedSceneIds([]); setCellAnchor(null); }}>Clear selection</button><div className="selection-summary" aria-live="polite"><strong>{selectedSceneIds.length}</strong> scene{selectedSceneIds.length === 1 ? '' : 's'}{editMode === 'mass' && <> · <strong>{selectedCells.length}</strong> cell{selectedCells.length === 1 ? '' : 's'}</>}</div>{editMode === 'mass' && <div className="cell-actions" aria-label="Selected cell tools">{plot.states.map((state, index) => <button key={state.id} disabled={!selectedCells.length} title={`Apply ${state.name} (${index})`} style={{ background: state.color, color: contrastText(state.color) }} onClick={() => applyStateToSelection(state.id)}>{state.abbreviation || 'OFF'}<kbd>{index}</kbd></button>)}</div>}</div>
        <span className="bar-divider"></span>
        <div className="group-actions"><span>GROUPS</span>{groupSuggestions.length ? groupSuggestions.map(group => <button key={group} title={!selectedSceneIds.length ? 'Select one or more scenes first' : editMode === 'mass' ? `Toggle ${group} cells in the selected scenes` : `Cycle ${group} through the configured states in selected scenes`} disabled={!selectedSceneIds.length} onClick={() => editMode === 'mass' ? toggleGroupSelection(group) : toggleGroupForScenes(group)}>{group}</button>) : <em>Add default groups to characters to see them here.</em>}</div>
      </section>}

      {!reportOpen && <section className="grid-shell">
        <div className="table-scroll">
          <table style={{ '--character-width': `${characterWidth}px`, '--actor-width': `${actorWidth}px`, '--actor-left': `${26 + characterWidth}px` }}>
            <thead><tr>
              <th className="num-col">#</th><th className="character-col">CHARACTER</th><th className="actor-col">CAST MEMBER</th>
              {plot.scenes.map((s, i) => <th className={`scene-col ${selectedSceneIds.includes(s.id) ? 'scene-selected' : ''}`} key={s.id} draggable onDragStart={e => e.dataTransfer.setData('application/x-scene', s.id)} onDragOver={e => e.preventDefault()} onDrop={e => { const id = e.dataTransfer.getData('application/x-scene'); if (id) moveScene(id, s.id); }}>
                <button className="scene-edit" title={`Edit ${s.name}`} aria-label={`Edit ${s.name}`} onClick={e => { e.stopPropagation(); inspectScene(s.id); }}><Pencil size={11}/></button>
                <button className="scene-heading" aria-pressed={selectedSceneIds.includes(s.id)} aria-label={`${s.name}. Toggle scene selection.${i > 0 ? ' Use Alt and arrow keys to reorder.' : ''}`} onClick={() => selectSceneHeading(s.id)} onKeyDown={e => { if (e.altKey && e.key === 'ArrowLeft' && i > 0) { e.preventDefault(); moveScene(s.id, plot.scenes[i - 1].id); } if (e.altKey && e.key === 'ArrowRight' && i < plot.scenes.length - 1) { e.preventDefault(); moveScene(s.id, plot.scenes[i + 1].id); } }}>{s.name}</button>
              </th>)}
              <th className="add-col"><button title="Add scene" onClick={addScene}><Plus/></button></th>
            </tr></thead>
            <tbody>{visible.map(c => <tr key={c.id} className={draggingId === c.id ? 'dragging' : ''} onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }} onDrop={e => { e.preventDefault(); moveCharacter(draggingId || e.dataTransfer.getData('text/plain'), c.id); setDraggingId(null); }}>
              <td className={`num-col drag-handle ${selectedCharacterId === c.id ? 'character-selected' : ''}`} tabIndex="0" role="button" aria-label={`${c.name}. Open details, drag, or use Alt and arrow keys to reorder`} draggable title="Open details or drag to reorder" onKeyDown={e => { const index = plot.characters.findIndex(item => item.id === c.id); if (e.altKey && e.key === 'ArrowUp' && index > 0) { e.preventDefault(); moveCharacter(c.id, plot.characters[index - 1].id); } if (e.altKey && e.key === 'ArrowDown' && index < plot.characters.length - 1) { e.preventDefault(); moveCharacter(c.id, plot.characters[index + 1].id); } if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedCharacterId(c.id); setDrawer('character'); } }} onClick={() => { setSelectedCharacterId(c.id); setDrawer('character'); }} onDragStart={e => { setDraggingId(c.id); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', c.id); }} onDragEnd={() => setDraggingId(null)}>{plot.characters.findIndex(item => item.id === c.id) + 1}</td>
              <td className="character-col"><button className="row-value" onClick={() => { setSelectedCharacterId(c.id); setDrawer('character'); }}>{c.name}</button></td>
              <td className={`actor-col actor-cell ${castMenu?.id === c.id ? 'menu-open' : ''}`}><button className="row-value cast-value" onClick={() => { setSelectedCastName(c.actor || ''); setSelectedCharacterId(null); setDrawer('cast'); }}>{c.actor || 'Uncast'}</button>
              </td>
              {plot.scenes.map(s => { const key = `${c.id}:${s.id}`; const raw = plot.cells[key]; const st = stateById[raw] ? raw : 'off'; const state = stateById[st]; return <td className={`plot-cell ${selectedCells.includes(key) ? 'cell-selected' : ''} ${editMode === 'direct' && cellAnchor === key ? 'cell-focused' : ''}`} key={s.id}><button data-cell-key={key} title={`${c.name} · ${s.name}: ${state.name}. ${editMode === 'mass' ? selectedCells.includes(key) ? 'Click to remove from selection.' : 'Click or drag to add to selection.' : 'Click to cycle, then use arrow and number keys.'}`} aria-label={`${c.name}, ${s.name}: ${state.name}`} className={`state ${st}`} style={st === 'off' ? undefined : { background: state.color, color: contrastText(state.color) }} onPointerDown={e => { if (editMode === 'mass') { e.preventDefault(); massDraggingRef.current = true; selectMassCell(key); return; } setCellAnchor(key); const next = cycleState(plot.states, st); setPaintState(next); setCellState(key, next); }} onPointerEnter={e => { if (editMode === 'mass' && massDraggingRef.current && e.buttons === 1) addMassCell(key); else if (editMode === 'direct' && paintState && e.buttons === 1) setCellState(key, paintState); }} onPointerUp={() => { setPaintState(null); massDraggingRef.current = false; }}>{state.abbreviation}</button></td> })}
              <td className="add-col"></td>
            </tr>)}
              <tr className="add-character-row"><td colSpan={plot.scenes.length + 4}><button onClick={addCharacter}><Plus size={14}/> Add character</button></td></tr>
            </tbody>
          </table>
          {!visible.length && <div className="empty">{plot.characters.length ? <>No characters match “{query}”.</> : <>No characters yet. Add them in Show Setup.</>}</div>}
        </div>
      </section>}
      {reportOpen && <section className="cast-workspace">
        <div className="report-scroll">
          <table className="report-table">
            <thead><tr><th className="report-actor">CAST MEMBER</th><th className="report-character">CHARACTER</th>{plot.scenes.map(scene => <th className="report-scene" key={scene.id}><span>{scene.name}</span></th>)}</tr></thead>
            <tbody>{castReportRows.map((row, index) => <tr key={row.id} className={!collateCast && index > 0 && castReportRows[index - 1].groupId === row.groupId ? 'same-actor' : ''}>
              <td className="report-actor">{!collateCast && index > 0 && castReportRows[index - 1].groupId === row.groupId ? '' : row.actor}</td><td className="report-character">{row.character}</td>
              {plot.scenes.map(scene => { const state = stateById[row.states[scene.id]] || stateById.off; return <td className="report-state" style={state.id === 'off' ? undefined : { background: state.color, color: contrastText(state.color) }} key={scene.id}>{state.abbreviation}</td> })}
            </tr>)}</tbody>
          </table>
        </div>
      </section>}
    </main>
    {drawer && !reportOpen && <aside className="advanced-drawer">
      <div className="drawer-heading"><div><span>MIC PLOT</span><h3>{drawer === 'bulk' ? 'Quick add characters' : drawer === 'cast' ? 'Cast details' : drawer === 'scene' ? 'Scene properties' : 'Character details'}</h3></div><button onClick={() => setDrawer(null)} aria-label="Close drawer">×</button></div>
      {drawer === 'bulk' ? <>
        <p>Use Tab to move through the fields. Tab from Default group adds the character and starts the next one.</p>
        <div className="drawer-fields">
          <label>Character name<input ref={bulkNameRef} value={bulkDraft.name} onChange={e => setBulkDraft({ ...bulkDraft, name: e.target.value })} onKeyDown={e => { if (e.key === 'Tab' && !e.shiftKey) { e.preventDefault(); bulkActorRef.current?.focus(); } if (e.key === 'Enter') { e.preventDefault(); addBulkCharacter(); } }} placeholder="Character name"/></label>
          <label>Cast name<SmartField ref={bulkActorRef} value={bulkDraft.actor} onChange={value => setBulkDraft(current => ({ ...current, actor: value }))} suggestions={castSuggestions} onAdvance={() => bulkGroupRef.current?.focus()} onSubmit={() => addBulkCharacter()} placeholder="Cast member"/></label>
          <label>Default group<SmartField ref={bulkGroupRef} value={bulkDraft.defaultGroup} onChange={value => setBulkDraft(current => ({ ...current, defaultGroup: value }))} suggestions={groupSuggestions} onAdvance={addBulkCharacter} onSubmit={value => addBulkCharacter(value)} placeholder="Optional group"/></label>
        </div>
        <button className="primary drawer-add" disabled={!bulkDraft.name.trim()} onClick={() => addBulkCharacter()}><Plus size={15}/> Add character</button>
      </> : drawer === 'scene' && selectedScene ? <>
        <p>Changes are saved immediately. Scene selection remains independent from this inspector.</p>
        <div className="drawer-fields"><label>Scene name<input value={selectedScene.name} onChange={e => updateScene(selectedScene.id, e.target.value)}/></label></div>
        <div className="drawer-row"><button className="secondary" onClick={() => duplicateScene(selectedScene.id)}>Duplicate</button><button className="drawer-delete" onClick={() => { if (confirmRemoveScene(selectedScene)) { removeScene(selectedScene.id); setSelectedSceneIds(ids => ids.filter(id => id !== selectedScene.id)); setSelectedSceneId(null); setDrawer(null); } }}><Trash2 size={14}/> Delete scene</button></div>
      </> : drawer === 'cast' ? <>
        <p>Edit this cast name for every linked character, or choose a role to open its character details.</p>
        <div className="drawer-fields"><label>Cast name<SmartField value={selectedCastName} onChange={renameSelectedCast} suggestions={castSuggestions.filter(name => name.toLocaleLowerCase() !== selectedCastName.toLocaleLowerCase())} placeholder="Uncast"/></label></div>
        <div className="cast-role-list"><span>CHARACTERS PLAYED</span>{selectedCastCharacters.map(character => <button key={character.id} onClick={() => { setSelectedCharacterId(character.id); setDrawer('character'); }}><strong>{character.name}</strong><small>{character.defaultGroup || 'No default group'}</small></button>)}</div>
      </> : selectedCharacter ? <>
        <p>Changes are saved immediately to this character.</p>
        <div className="drawer-fields">
          <label>Character name<input value={selectedCharacter.name} onChange={e => updateCharacter(selectedCharacter.id, 'name', e.target.value)} /></label>
          <label>Cast name<SmartField value={selectedCharacter.actor} onChange={value => updateCharacter(selectedCharacter.id, 'actor', value)} suggestions={castSuggestions.filter(name => name !== selectedCharacter.actor)} /></label>
          <label>Default group<SmartField value={selectedCharacter.defaultGroup || ''} onChange={value => updateCharacter(selectedCharacter.id, 'defaultGroup', value)} suggestions={groupSuggestions.filter(group => group !== selectedCharacter.defaultGroup)} onAdvance={() => document.activeElement?.blur()} /></label>
        </div>
        <div className="drawer-row"><button className="secondary" onClick={() => duplicateCharacter(selectedCharacter.id)}>Duplicate</button><button className="drawer-delete" onClick={() => { if (confirmRemoveCharacter(selectedCharacter)) { removeCharacter(selectedCharacter.id); setSelectedCharacterId(null); setDrawer(null); } }}><Trash2 size={14}/> Delete character</button></div>
      </> : null}
    </aside>}
    {helpOpen && <div className="help-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setHelpOpen(false); }}>
      <section className="help-panel" role="dialog" aria-modal="true" aria-labelledby="help-title">
        <div className="help-heading"><div><span>MIC PLOT GUIDE</span><h2 id="help-title">How to use the app</h2></div><button onClick={() => setHelpOpen(false)} aria-label="Close help"><X size={18}/></button></div>
        <div className="help-grid">
          <article><strong>1</strong><div><h3>Create the show</h3><p>Enter the company and show name. Show Setup opens automatically with empty character and scene lists.</p></div></article>
          <article><strong>2</strong><div><h3>Configure it</h3><p>Choose states and colours, upload logos, add or paste characters, and add scenes. Drag each list into the required order.</p></div></article>
          <article><strong>3</strong><div><h3>Build assignments</h3><p>In Direct Edit, click a cell to cycle it. Move the active cell with arrow keys and assign its numbered state with a number key.</p></div></article>
          <article><strong>4</strong><div><h3>Edit many cells</h3><p>Press M for Mass Edit, then click or drag to select cells. Select scenes before using a group button, then apply a state.</p></div></article>
          <article><strong>5</strong><div><h3>Review the cast</h3><p>Open Cast View to group assignments by performer. Turn on role collation when one combined row per performer is useful.</p></div></article>
          <article><strong>6</strong><div><h3>Save and transfer</h3><p>Changes autosave locally. Open Save / Load to switch shows, restore snapshots, or download and open .micplot backups.</p></div></article>
          <article><strong>7</strong><div><h3>Export the result</h3><p>Choose Export PDF, adjust the full-document preview, then download it. CSV and browser print are also available.</p></div></article>
        </div>
        <div className="help-support"><h3>Documentation and support</h3><p>Read the complete guide or report issues and feature requests through the public GitHub repository.</p><a href="https://github.com/staljabro/Mic-Plot-Generator/tree/main/docs" target="_blank" rel="noopener noreferrer">Open documentation on GitHub ↗</a></div>
        <div className="help-footer"><span><b>Mic Plot Studio v{APP_VERSION}</b> · Created by Joshua Braithwaite<br/>Tip: hover over controls for a quick explanation.</span><button className="primary" onClick={() => setHelpOpen(false)}>Got it</button></div>
      </section>
    </div>}
    {pdfPreviewOpen && <div className="pdf-preview-backdrop">
      <section className="pdf-preview-dialog" role="dialog" aria-modal="true" aria-labelledby="pdf-preview-title">
        <header className="pdf-preview-header"><div><span>EXPORT PDF</span><h2 id="pdf-preview-title">Preview all pages</h2><p>This is the exact PDF that will be downloaded.</p></div><div className="pdf-preview-actions"><a className={`primary ${!pdfPreviewUrl ? 'disabled' : ''}`} href={pdfPreviewUrl || undefined} download={`${cleanFilename(plot.title)}.pdf`} aria-disabled={!pdfPreviewUrl}><Download size={15}/> Download PDF</a><button className="setup-close" onClick={() => setPdfPreviewOpen(false)} aria-label="Close PDF preview"><X size={18}/></button></div></header>
        <div className="pdf-preview-toolbar">
          <label>Data layout<select value={pdfOptions.dataLayout} onChange={e => setPdfOptions({ ...pdfOptions, dataLayout: e.target.value })}><option value="character">Character</option><option value="cast">Cast</option></select></label>
          <label>Paper<select value={pdfOptions.format} onChange={e => setPdfOptions({ ...pdfOptions, format: e.target.value })}><option value="a4">A4</option><option value="a3">A3</option></select></label>
          <label>Page layout<select value={pdfOptions.orientation} onChange={e => setPdfOptions({ ...pdfOptions, orientation: e.target.value })}><option value="landscape">Landscape</option><option value="portrait">Portrait</option></select></label>
          <label>Text size<input type="number" min="5" max="10" step="0.5" value={pdfOptions.fontSize} onChange={e => setPdfOptions({ ...pdfOptions, fontSize: Number(e.target.value) })}/></label>
          <label>Scale<select value={pdfPreviewScale} onChange={e => setPdfPreviewScale(e.target.value)}><option value="page-fit">Fit page</option><option value="page-width">Fit width</option><option value="50">50%</option><option value="75">75%</option><option value="100">100%</option><option value="125">125%</option><option value="150">150%</option></select></label>
          <label>Logo 1<select disabled={!plot.showLogo} value={plot.showLogo ? pdfOptions.logoPosition : 'off'} onChange={e => { const position = e.target.value; setPdfOptions(options => ({ ...options, logoPosition: position, logo2Position: position !== 'off' && options.logo2Position === position ? 'off' : options.logo2Position })); }}><option value="off">Off</option><option value="left">Left</option><option value="right">Right</option></select></label>
          <label>Logo 2<select disabled={!plot.showLogo2} value={plot.showLogo2 ? pdfOptions.logo2Position : 'off'} onChange={e => { const position = e.target.value; setPdfOptions(options => ({ ...options, logo2Position: position, logoPosition: position !== 'off' && options.logoPosition === position ? 'off' : options.logoPosition })); }}><option value="off">Off</option><option value="left">Left</option><option value="right">Right</option></select></label>
          {pdfOptions.dataLayout === 'cast' && <label className="preview-check"><input type="checkbox" checked={pdfOptions.showCharacterNumber} onChange={e => setPdfOptions({ ...pdfOptions, showCharacterNumber: e.target.checked })}/> Character #</label>}
          {pdfOptions.dataLayout === 'cast' && <label className="preview-check"><input type="checkbox" checked={pdfOptions.showMicNumber} onChange={e => setPdfOptions({ ...pdfOptions, showMicNumber: e.target.checked })}/> Mic #</label>}
          <label className="preview-check"><input type="checkbox" checked={pdfOptions.includeLegend} onChange={e => setPdfOptions({ ...pdfOptions, includeLegend: e.target.checked })}/> Include legend</label>
          <label className="preview-check"><input type="checkbox" disabled={!selectedSceneIds.length} checked={pdfOptions.selectedOnly} onChange={e => setPdfOptions({ ...pdfOptions, selectedOnly: e.target.checked })}/> Selected scenes only</label>
          <span className="preview-status" aria-live="polite">{pdfPreviewLoading ? 'Updating preview…' : pdfPreviewError || `${pdfPreviewPages} page${pdfPreviewPages === 1 ? '' : 's'}`}</span>
        </div>
        <div className="pdf-viewer-shell">{pdfPreviewUrl && !pdfPreviewError ? <iframe key={`${pdfPreviewUrl}-${pdfPreviewScale}`} title="Generated PDF preview" src={`${pdfPreviewUrl}#page=1&zoom=${pdfPreviewScale}`}></iframe> : <div className="pdf-viewer-message">{pdfPreviewError || 'Generating complete PDF preview…'}</div>}</div>
      </section>
    </div>}
    {startupStep && <div className="modal-backdrop">
      <section className={`startup-modal ${startupStep === 'setup' ? 'setup-modal' : startupStep === 'manage' ? 'manage-modal' : ''}`} role="dialog" aria-modal="true" aria-labelledby="startup-title">
        {startupStep === 'choose' && <>
          <div className="modal-kicker">MIC PLOT</div>
          <h2 id="startup-title">Welcome</h2>
          <p>Create a new production or open a downloaded .micplot project.</p>
          <div className="startup-actions">
            <button className="primary" onClick={() => setStartupStep('new')}><Plus size={17}/> Create new show</button>
            <button className="secondary" onClick={() => { setLoadError(''); setStartupStep('load'); }}><Download size={17}/> Load show file</button>
          </div>
        </>}
        {startupStep === 'new' && <form onSubmit={e => { e.preventDefault(); createShow(); }}>
          <div className="modal-kicker">NEW SHOW</div>
          <h2 id="startup-title">Production details</h2>
          <p>Your show will be saved as <strong>{newShow.company.trim() || 'Company'} - {newShow.name.trim() || 'Show name'}</strong>.</p>
          <label>School or company<input autoFocus value={newShow.company} onChange={e => setNewShow({ ...newShow, company: e.target.value })} placeholder="e.g. Riverside Theatre"/></label>
          <label>Show name<input value={newShow.name} onChange={e => setNewShow({ ...newShow, name: e.target.value })} placeholder="e.g. The Tempest"/></label>
          <div className="modal-buttons"><button type="button" className="text-button" onClick={() => setStartupStep(plot.id ? 'manage' : 'choose')}>Back</button><button className="primary" disabled={!newShow.company.trim() || !newShow.name.trim()}>Create show</button></div>
        </form>}
        {startupStep === 'load' && <>
          <div className="modal-kicker">LOAD SHOW</div>
          <h2 id="startup-title">Open a mic plot</h2>
          <p>Select a previously downloaded <strong>.micplot</strong> project file.</p>
          <input ref={showFileRef} className="show-file-input" type="file" accept=".micplot,application/json" onChange={e => loadShowFile(e.target.files?.[0])}/>
          <button className="file-picker" onClick={() => showFileRef.current?.click()}><Download size={18}/><span><strong>Choose .micplot file</strong><small>Your file stays on this device.</small></span></button>
          {loadError && <div className="load-error">{loadError}</div>}
          <button className="text-button" onClick={() => setStartupStep(plot.id ? 'manage' : 'choose')}>Back</button>
        </>}
        {startupStep === 'setup' && <>
          <div className="setup-heading"><div><div className="modal-kicker">SHOW SETUP</div><h2 id="startup-title">Configure production</h2><div className="setup-checklist">{setupChecks.map(item => <button key={item.tab} className={item.done ? 'done' : ''} onClick={() => setSetupTab(item.tab)}><Check size={12}/>{item.label}</button>)}</div></div><button className="setup-close" onClick={() => setStartupStep(null)} aria-label="Close show setup"><X size={18}/></button></div>
          <div className="setup-tabs" role="tablist">{['show','characters','scenes'].map(tab => <button key={tab} role="tab" aria-selected={setupTab === tab} onClick={() => setSetupTab(tab)}>{tab}</button>)}</div>
          {setupTab === 'show' && <div className="setup-pane">
            <div className="setup-fields"><label>School or company<input value={plot.company} onChange={e => updateShowIdentity('company', e.target.value)}/></label><label>Show name<input value={plot.showName} onChange={e => updateShowIdentity('showName', e.target.value)}/></label></div>
            <div className="show-logo-settings">
              <div className="show-logo-setting"><div className="show-logo-preview">{plot.showLogo ? <img src={plot.showLogo} alt="Show logo 1"/> : <span>No image</span>}</div><div><strong>Show logo 1</strong><p>Stored with the show and available on either side of the PDF header.</p><input ref={showLogoInputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={e => uploadShowLogo(e.target.files?.[0], 'showLogo')}/><div className="show-logo-actions"><button className="secondary" onClick={() => showLogoInputRef.current?.click()}>{plot.showLogo ? 'Replace image' : 'Upload image'}</button>{plot.showLogo && <button className="text-button" onClick={() => { setPlot(p => ({ ...p, showLogo: '' })); setPdfOptions(options => ({ ...options, logoPosition: 'off' })); }}>Remove</button>}</div></div></div>
              <div className="show-logo-setting"><div className="show-logo-preview">{plot.showLogo2 ? <img src={plot.showLogo2} alt="Show logo 2"/> : <span>No image</span>}</div><div><strong>Show logo 2</strong><p>When both logos are shown, they are kept on opposite sides.</p><input ref={showLogo2InputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={e => uploadShowLogo(e.target.files?.[0], 'showLogo2')}/><div className="show-logo-actions"><button className="secondary" onClick={() => showLogo2InputRef.current?.click()}>{plot.showLogo2 ? 'Replace image' : 'Upload image'}</button>{plot.showLogo2 && <button className="text-button" onClick={() => { setPlot(p => ({ ...p, showLogo2: '' })); setPdfOptions(options => ({ ...options, logo2Position: 'off' })); }}>Remove</button>}</div></div></div>
            </div>
            {templateShows.length > 0 && <div className="template-row"><div><strong>Reuse state set</strong><span>Copy state names, colours, order, and shortcuts from another show.</span></div><select value={stateTemplateId} onChange={e => setStateTemplateId(e.target.value)}><option value="">Choose a show…</option>{templateShows.map(item => <option key={item.plot.id} value={item.plot.id}>{item.plot.title}</option>)}</select><button className="secondary" disabled={!stateTemplateId} onClick={copyStateTemplate}>Copy states</button></div>}
            <div className="setup-section-title"><div><strong>Cell states</strong><span>Drag to set their toolbar, cycle, and hotkey order.</span></div></div>
            <div className="state-editor">{plot.states.map((state, index) => <div className="state-editor-row" key={state.id} onDragOver={e => e.preventDefault()} onDrop={() => { if (setupDragging?.type === 'state') moveState(setupDragging.id, state.id); setSetupDragging(null); }}>
              <button type="button" className="state-drag" draggable onDragStart={event => { event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', state.id); setSetupDragging({ type: 'state', id: state.id }); }} onDragEnd={() => setSetupDragging(null)} aria-label={`Drag ${state.name} to reorder`}><GripVertical size={15}/></button>
              <span className="state-order-number">{index}</span>
              <input value={state.name} disabled={state.locked} aria-label="State name" onChange={e => updateState(state.id, 'name', e.target.value.slice(0, 40))}/>
              <input value={state.abbreviation} disabled={state.locked} aria-label="State abbreviation" maxLength="6" onChange={e => updateState(state.id, 'abbreviation', e.target.value.toUpperCase())}/>
              {state.id === 'off' ? <span className="locked-state">Fixed</span> : <div className="color-picker"><button type="button" className="color-swatch" aria-label={`Choose colour for ${state.name}`} style={{ background: state.color }} onClick={() => setColorPickerId(current => current === state.id ? null : state.id)}></button>{colorPickerId === state.id && <div className="color-popover">{STATE_COLORS.map(color => <button type="button" key={color} aria-label={color} className={color === state.color ? 'chosen' : ''} style={{ background: color }} onClick={() => { updateState(state.id, 'color', color); setColorPickerId(null); }}></button>)}</div>}</div>}
              {state.locked ? <span className="locked-state">Required</span> : <button className="setup-delete" aria-label={`Remove ${state.name}`} onClick={() => { if (confirmRemoveState(state)) removeState(state.id); }}><Trash2 size={14}/></button>}
            </div>)}</div>
            <div className="state-add-row"><input value={stateDraft.name} onChange={e => setStateDraft({ ...stateDraft, name: e.target.value })} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addState(); } }} placeholder="State name"/><input value={stateDraft.abbreviation} maxLength="6" onChange={e => setStateDraft({ ...stateDraft, abbreviation: e.target.value.toUpperCase() })} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addState(); } }} placeholder="Short name"/><div className="color-picker"><button type="button" className="color-swatch" aria-label="Choose new state colour" style={{ background: stateDraft.color }} onClick={() => setColorPickerId(current => current === 'new' ? null : 'new')}></button>{colorPickerId === 'new' && <div className="color-popover">{STATE_COLORS.map(color => <button type="button" key={color} aria-label={color} className={color === stateDraft.color ? 'chosen' : ''} style={{ background: color }} onClick={() => { setStateDraft({ ...stateDraft, color }); setColorPickerId(null); }}></button>)}</div>}</div><button className="primary" disabled={!stateDraft.name.trim() || !stateDraft.abbreviation.trim()} onClick={addState}><Plus size={14}/> Add state</button></div>
          </div>}
          {setupTab === 'characters' && <div className="setup-pane">
            <div className="setup-section-title"><div><strong>Characters</strong><span>Edit fields directly or drag rows to rearrange the main plot.</span></div></div>
            {templateShows.length > 0 && <div className="template-row"><div><strong>Reuse character groups</strong><span>Add group choices from another show without copying its characters.</span></div><select value={groupTemplateId} onChange={e => setGroupTemplateId(e.target.value)}><option value="">Choose a show…</option>{templateShows.map(item => <option key={item.plot.id} value={item.plot.id}>{item.plot.title}</option>)}</select><button className="secondary" disabled={!groupTemplateId} onClick={copyGroupTemplate}>Copy groups</button></div>}
            <div className="setup-add-row character"><input ref={setupCharacterNameRef} value={setupCharacter.name} onChange={e => setSetupCharacter({ ...setupCharacter, name: e.target.value })} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSetupCharacter(); } else if (e.key === 'Tab' && !e.shiftKey) { e.preventDefault(); setupCharacterActorRef.current?.focus(); } }} placeholder="Character name"/><SmartField ref={setupCharacterActorRef} value={setupCharacter.actor} onChange={value => setSetupCharacter(current => ({ ...current, actor: value }))} suggestions={castSuggestions} onAdvance={() => setupCharacterGroupRef.current?.focus()} onSubmit={addSetupCharacter} placeholder="Cast member"/><SmartField ref={setupCharacterGroupRef} value={setupCharacter.defaultGroup} onChange={value => setSetupCharacter(current => ({ ...current, defaultGroup: value }))} suggestions={groupSuggestions} onAdvance={() => setupCharacterNameRef.current?.focus()} onSubmit={addSetupCharacter} placeholder="Default group"/><button className="primary" disabled={!setupCharacter.name.trim()} onClick={addSetupCharacter}><Plus size={14}/> Add</button></div>
            <div className="setup-paste"><button className="text-button" onClick={() => setSetupPasteOpen(value => !value)}>{setupPasteOpen ? 'Hide bulk paste' : 'Bulk paste characters'}</button>{setupPasteOpen && <div className="setup-paste-panel"><p>Paste tab-separated columns: Character, Cast member, and optional Group. A header row is optional.</p><textarea value={pasteText} onChange={event => setPasteText(event.target.value)} placeholder={'Character\tCast member\tGroup\nHamlet\tAlex\tLeads'} /><button className="primary" disabled={!pasteText.trim()} onClick={() => { if (importPastedCharacters(pasteText)) setPasteText(''); }}>Import characters</button></div>}</div>
            <div className="setup-list">{plot.characters.map(character => <div className="setup-list-row character" key={character.id} draggable onDragStart={() => setSetupDragging({ type: 'character', id: character.id })} onDragOver={e => e.preventDefault()} onDrop={() => { if (setupDragging?.type === 'character') moveCharacter(setupDragging.id, character.id); setSetupDragging(null); }}><GripVertical size={15}/><input value={character.name} aria-label="Character name" onChange={e => updateCharacter(character.id, 'name', e.target.value)}/><SmartField value={character.actor} onChange={value => updateCharacter(character.id, 'actor', value)} suggestions={castSuggestions.filter(name => name !== character.actor)} placeholder="Cast member"/><SmartField value={character.defaultGroup || ''} onChange={value => updateCharacter(character.id, 'defaultGroup', value)} suggestions={groupSuggestions.filter(group => group !== character.defaultGroup)} placeholder="Default group"/><button className="setup-delete" aria-label={`Delete ${character.name}`} onClick={() => { if (confirmRemoveCharacter(character)) removeCharacter(character.id); }}><Trash2 size={14}/></button></div>)}</div>
          </div>}
          {setupTab === 'scenes' && <div className="setup-pane">
            <div className="setup-section-title"><div><strong>Scenes</strong><span>Add scenes in bulk, edit their names, or drag to rearrange the main plot.</span></div></div>
            <form className="setup-add-row scene" onSubmit={e => { e.preventDefault(); addSetupScene(); }}><textarea value={setupSceneName} onChange={e => setSetupSceneName(e.target.value)} placeholder={'Scene names\nOne per line'}/><button className="primary" disabled={!setupSceneName.trim()}><Plus size={14}/> Add scenes</button></form>
            <div className="setup-list">{plot.scenes.map(scene => <div className="setup-list-row scene" key={scene.id} draggable onDragStart={() => setSetupDragging({ type: 'scene', id: scene.id })} onDragOver={e => e.preventDefault()} onDrop={() => { if (setupDragging?.type === 'scene') moveScene(setupDragging.id, scene.id); setSetupDragging(null); }}><GripVertical size={15}/><input value={scene.name} aria-label="Scene name" onChange={e => updateScene(scene.id, e.target.value)}/><button className="secondary" onClick={() => duplicateScene(scene.id)}>Duplicate</button><button className="setup-delete" aria-label={`Delete ${scene.name}`} onClick={() => { if (confirmRemoveScene(scene)) removeScene(scene.id); }}><Trash2 size={14}/></button></div>)}</div>
          </div>}
          <div className="setup-footer"><span><strong>{setupChecks.filter(item => item.done).length}/3 ready</strong> · {plot.characters.length} characters · {plot.scenes.length} scenes · {plot.states.length} states</span><button className="primary" onClick={() => setStartupStep(null)}>{setupChecks.every(item => item.done) ? 'Finish setup' : 'Continue later'}</button></div>
        </>}
        {startupStep === 'manage' && <>
          <header className="manage-heading"><div><div className="modal-kicker">SHOW FILES</div><h2 id="startup-title">Save, load or export</h2><p>Shows save automatically to this browser. Download a project file for a portable backup.</p></div><button className="setup-close" onClick={() => { setEasterEgg(false); setStartupStep(null); }} aria-label="Close Save and Load"><X size={18}/></button></header>
          <div className="manage-grid">
            <div className="manage-primary">
              <section className="manage-section current-show-card"><div className="manage-section-heading"><span>CURRENT SHOW</span><strong>{plot.title}</strong><small>{plot.characters.length} characters · {plot.scenes.length} scenes · {activeCount} active cues</small></div><div className="project-actions"><button className="primary" onClick={downloadShow}><Download size={17}/><span><strong>Download show</strong><small>Editable .micplot backup</small></span></button><button className="secondary" onClick={() => { setLoadError(''); setStartupStep('load'); }}><Download size={17}/><span><strong>Open show file</strong><small>Import from this device</small></span></button></div></section>
              <section className="manage-section export-section"><div className="manage-section-heading"><span>EXPORT</span><strong>Create a shareable copy</strong><small>Preview the complete PDF before downloading, or export the raw table data.</small></div><div className="export-actions"><button className="primary-export" onClick={() => setPdfPreviewOpen(true)}><Download size={16}/><span><strong>Export PDF</strong><small>Preview all pages and configure</small></span></button><button onClick={exportCsv}><Download size={16}/><span><strong>Export CSV</strong><small>Spreadsheet data</small></span></button><button onClick={() => window.print()}><Download size={16}/><span><strong>Print</strong><small>Browser print dialog</small></span></button></div></section>
            </div>
            <section className="manage-section library-panel"><div className="library-heading"><div className="manage-section-heading"><span>ON THIS DEVICE</span><strong>Saved shows</strong><small>{storedShows.length} show{storedShows.length === 1 ? '' : 's'} available</small></div><button className="secondary" onClick={() => { setNewShow({ company: '', name: '' }); setStartupStep('new'); }}><Plus size={15}/> New show</button></div>
              <div className="local-library">
                {storedShows.map(item => <div className={`local-show ${item.plot.id === plot.id ? 'current' : ''}`} key={item.plot.id}><button onClick={() => { resetPlot(normalisePlot(item.plot)); setStartupStep(null); }}><strong>{item.plot.title}</strong><small>{item.plot.id === plot.id ? 'Current show · ' : ''}{new Date(item.updatedAt).toLocaleString()}</small></button><button title="Duplicate show" aria-label={`Duplicate saved ${item.plot.title}`} onClick={() => duplicateStoredShow(item)}><Plus size={13}/></button><button aria-label={`Delete saved ${item.plot.title}`} onClick={() => { if (item.plot.id === plot.id) return; if (confirm(`Delete saved show “${item.plot.title}”?`)) { deleteStoredPlot(item.plot.id); setLibraryRevision(value => value + 1); } }} disabled={item.plot.id === plot.id}><Trash2 size={13}/></button></div>)}
                {backups.length > 0 && <details className="recovery-list"><summary>Recovery snapshots ({backups.length})</summary>{backups.map(item => <button className="backup" key={item.savedAt} onClick={() => { if (confirm(`Restore backup from ${new Date(item.savedAt).toLocaleString()}?`)) { resetPlot(normalisePlot(item.plot)); setStartupStep(null); } }}><strong>{new Date(item.savedAt).toLocaleDateString()}</strong><span>{new Date(item.savedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></button>)}</details>}
              </div>
            </section>
          </div>
          <div className="modal-buttons menu-footer">
            <button className="text-button about-button" onClick={() => setEasterEgg(value => !value)}>About</button>
            {easterEgg && <span className="easter-egg">andy was here &lt;3</span>}
            <button className="text-button" onClick={() => { setEasterEgg(false); setStartupStep(null); }}>Close</button>
          </div>
        </>}
      </section>
    </div>}
  </div>
}

createRoot(document.getElementById('root')).render(<App/>);
