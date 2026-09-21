import React, { forwardRef, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Check, CircleHelp, Download, Plus, Search, Trash2, Users, X } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';
import './styles.css';
import './dark-theme.css';

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

const initial = {
  title: 'Untitled Production',
  scenes: scenesSeed.map((name, i) => ({ id: `s${i}`, name })),
  characters: characterSeed.map(([name, actor], i) => ({ id: `c${i}`, name, actor })),
  cells: Object.fromEntries(characterSeed.flatMap((_, r) => scenesSeed.map((__, c) => [`c${r}:s${c}`, pattern[r][c] === 'plus' ? 'bss' : pattern[r][c] === 'on' ? 'on' : 'off'])))
};

const stateOrder = ['off', 'on', 'ens', 'bss'];
const labels = { off: '', on: 'ON', ens: 'ENS', bss: 'BSS' };

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

function normalisePlot(plot) {
  return { ...plot, characters: (plot.characters || []).map(character => ({ ...character, defaultGroup: character.defaultGroup || '' })), cells: Object.fromEntries(Object.entries(plot.cells || {}).map(([key, value]) => [key, value === 'plus' ? 'bss' : ['on', 'ens', 'bss'].includes(value) ? value : 'off'])) };
}

function loadSession() {
  try {
    const legacy = JSON.parse(localStorage.getItem('mic-plot-v1'));
    if (legacy) {
      const plot = normalisePlot({ ...legacy, id: legacy.id || crypto.randomUUID(), company: legacy.company || '', showName: legacy.showName || legacy.title || 'Untitled Production' });
      return { plot, hasCurrent: true };
    }
    return { plot: { ...initial, id: null }, hasCurrent: false };
  } catch { return { plot: { ...initial, id: null }, hasCurrent: false }; }
}

function App() {
  const [session] = useState(loadSession);
  const [plot, setPlot] = useState(session.plot);
  const [startupStep, setStartupStep] = useState(session.hasCurrent ? null : 'choose');
  const [newShow, setNewShow] = useState({ company: '', name: '' });
  const [loadError, setLoadError] = useState('');
  const [query, setQuery] = useState('');
  const [saved, setSaved] = useState(true);
  const [pendingFocus, setPendingFocus] = useState(null);
  const [pendingSceneFocus, setPendingSceneFocus] = useState(null);
  const [draggingId, setDraggingId] = useState(null);
  const [castMenu, setCastMenu] = useState(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [collateCast, setCollateCast] = useState(() => localStorage.getItem('mic-plot-collate-cast') === 'true');
  const [easterEgg, setEasterEgg] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [advancedMode, setAdvancedMode] = useState(() => localStorage.getItem('mic-plot-advanced') === 'true');
  const [drawer, setDrawer] = useState(null);
  const [selectedCharacterId, setSelectedCharacterId] = useState(null);
  const [selectedCastName, setSelectedCastName] = useState('');
  const [selectedSceneIds, setSelectedSceneIds] = useState([]);
  const [bulkDraft, setBulkDraft] = useState({ name: '', actor: '', defaultGroup: '' });
  const nameRefs = useRef({});
  const sceneRefs = useRef({});
  const showFileRef = useRef(null);
  const bulkNameRef = useRef(null);
  const bulkActorRef = useRef(null);
  const bulkGroupRef = useRef(null);

  useEffect(() => {
    if (!plot.id) return;
    setSaved(false);
    const id = setTimeout(() => {
      localStorage.setItem('mic-plot-v1', JSON.stringify(plot));
      setSaved(true);
    }, 350);
    return () => clearTimeout(id);
  }, [plot]);

  const createShow = () => {
    const company = newShow.company.trim();
    const showName = newShow.name.trim();
    if (!company || !showName) return;
    const id = crypto.randomUUID();
    const characterId = crypto.randomUUID();
    const sceneId = crypto.randomUUID();
    const created = {
      id,
      company,
      showName,
      title: `${company} - ${showName}`,
      scenes: [{ id: sceneId, name: 'New scene' }],
      characters: [{ id: characterId, name: 'New character', actor: '', defaultGroup: '' }],
      cells: { [`${characterId}:${sceneId}`]: 'off' }
    };
    setPlot(created);
    setStartupStep(null);
    setPendingFocus(characterId);
  };

  const loadShowFile = async file => {
    if (!file) return;
    setLoadError('');
    try {
      const parsed = JSON.parse(await file.text());
      const imported = parsed.format === 'micplot' ? parsed.plot : parsed;
      if (!imported || !Array.isArray(imported.characters) || !Array.isArray(imported.scenes) || typeof imported.cells !== 'object') throw new Error('Invalid project');
      setPlot(normalisePlot({ ...imported, id: imported.id || crypto.randomUUID() }));
      setStartupStep(null);
    } catch {
      setLoadError('This file is not a valid mic plot project.');
    } finally {
      if (showFileRef.current) showFileRef.current.value = '';
    }
  };

  const visible = useMemo(() => plot.characters.filter(c => `${c.name} ${c.actor}`.toLowerCase().includes(query.toLowerCase())), [plot.characters, query]);
  const castSuggestions = useMemo(() => [...new Set(plot.characters.map(c => c.actor.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b)), [plot.characters]);
  const groupSuggestions = useMemo(() => [...new Set(plot.characters.map(c => (c.defaultGroup || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b)), [plot.characters]);
  const activeCount = Object.values(plot.cells).filter(v => ['on', 'ens', 'bss'].includes(v)).length;
  const characterWidth = Math.max(50, Math.ceil(Math.max('CHARACTER'.length, ...plot.characters.map(c => c.name.length)) * 6.2 + 24));
  const actorWidth = Math.max(50, Math.ceil(Math.max('CAST MEMBER'.length, ...plot.characters.map(c => c.actor.length)) * 6.2 + 24));
  const castReportRows = useMemo(() => {
    const groups = new Map();
    plot.characters.forEach(character => {
      const actor = character.actor.trim();
      const key = actor ? actor.toLocaleLowerCase() : `unassigned:${character.id}`;
      if (!groups.has(key)) groups.set(key, { key, actor: actor || 'Uncast', characters: [] });
      groups.get(key).characters.push(character);
    });
    const cellState = (characters, sceneId) => {
      const values = characters.map(character => plot.cells[`${character.id}:${sceneId}`]);
      return values.includes('on') ? 'on' : values.includes('ens') ? 'ens' : values.includes('bss') ? 'bss' : 'off';
    };
    return [...groups.values()].flatMap(group => collateCast
      ? [{ id: group.characters.map(c => c.id).join(':'), groupId: group.key, actor: group.actor, character: `${group.characters[0].name}${group.characters.length > 1 ? ` +${group.characters.length - 1}` : ''}`, states: Object.fromEntries(plot.scenes.map(scene => [scene.id, cellState(group.characters, scene.id)])) }]
      : group.characters.map(character => ({ id: character.id, groupId: group.key, actor: group.actor, character: character.name, states: Object.fromEntries(plot.scenes.map(scene => [scene.id, cellState([character], scene.id)])) }))
    );
  }, [plot.characters, plot.scenes, plot.cells, collateCast]);

  useEffect(() => { localStorage.setItem('mic-plot-collate-cast', String(collateCast)); }, [collateCast]);
  useEffect(() => { localStorage.setItem('mic-plot-advanced', String(advancedMode)); }, [advancedMode]);

  useEffect(() => {
    if (!pendingFocus) return;
    requestAnimationFrame(() => {
      const input = nameRefs.current[pendingFocus];
      input?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      input?.focus();
      input?.select();
      setPendingFocus(null);
    });
  }, [pendingFocus, visible.length]);

  useEffect(() => {
    if (!pendingSceneFocus) return;
    requestAnimationFrame(() => {
      const input = sceneRefs.current[pendingSceneFocus];
      input?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      input?.focus();
      input?.select();
      setPendingSceneFocus(null);
    });
  }, [pendingSceneFocus, plot.scenes.length]);

  const updateCell = (cid, sid) => setPlot(p => {
    const key = `${cid}:${sid}`;
    const current = ['on', 'ens', 'bss'].includes(p.cells[key]) ? p.cells[key] : 'off';
    return { ...p, cells: { ...p.cells, [key]: stateOrder[(stateOrder.indexOf(current) + 1) % stateOrder.length] } };
  });

  const addCharacter = () => {
    const id = crypto.randomUUID();
    setQuery('');
    setPlot(p => ({ ...p, characters: [...p.characters, { id, name: 'New character', actor: '', defaultGroup: '' }] }));
    setPendingFocus(id);
  };
  const addScene = () => {
    const id = crypto.randomUUID();
    setPlot(p => ({ ...p, scenes: [...p.scenes, { id, name: 'New scene' }] }));
    setPendingSceneFocus(id);
  };
  const updateCharacter = (id, field, value) => setPlot(p => ({ ...p, characters: p.characters.map(c => c.id === id ? { ...c, [field]: value } : c) }));
  const updateScene = (id, value) => setPlot(p => ({ ...p, scenes: p.scenes.map(s => s.id === id ? { ...s, name: value } : s) }));
  const removeCharacter = id => setPlot(p => ({ ...p, characters: p.characters.filter(c => c.id !== id) }));
  const removeScene = id => setPlot(p => ({ ...p, scenes: p.scenes.filter(s => s.id !== id) }));
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
  const selectScene = id => setSelectedSceneIds(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]);
  const toggleGroupForScenes = group => {
    if (!selectedSceneIds.length) return;
    const members = plot.characters.filter(character => character.defaultGroup === group);
    if (!members.length) return;
    setPlot(p => {
      const cells = { ...p.cells };
      const values = selectedSceneIds.flatMap(sceneId => members.map(character => cells[`${character.id}:${sceneId}`] || 'off'));
      const sharedState = values.every(value => value === values[0]) ? values[0] : 'off';
      const nextState = stateOrder[(stateOrder.indexOf(sharedState) + 1) % stateOrder.length];
      selectedSceneIds.forEach(sceneId => members.forEach(character => { cells[`${character.id}:${sceneId}`] = nextState; }));
      return { ...p, cells };
    });
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

  const exportCsv = () => {
    const q = v => `"${String(v).replaceAll('"', '""')}"`;
    const lines = [['Character','Cast member',...plot.scenes.map(s => s.name)], ...plot.characters.map(c => [c.name,c.actor,...plot.scenes.map(s => labels[plot.cells[`${c.id}:${s.id}`] || 'off'])])];
    const blob = new Blob([lines.map(r => r.map(q).join(',')).join('\n')], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${plot.title || 'mic-plot'}.csv`; a.click(); URL.revokeObjectURL(a.href);
  };

  const downloadShow = () => {
    const project = JSON.stringify({ format: 'micplot', version: 1, plot }, null, 2);
    const blob = new Blob([project], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${(plot.title || 'mic-plot').replace(/[<>:"/\\|?*]+/g, '-')}.micplot`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const exportPdf = () => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a3' });
    const head = [['#', 'Character', 'Cast member', ...plot.scenes.map(s => s.name)]];
    const body = plot.characters.map((character, index) => [
      String(index + 1),
      character.name,
      character.actor,
      ...plot.scenes.map(scene => labels[plot.cells[`${character.id}:${scene.id}`] || 'off'])
    ]);

    autoTable(doc, {
      head,
      body,
      startY: 25,
      margin: { top: 25, right: 10, bottom: 12, left: 10 },
      theme: 'grid',
      styles: { font: 'helvetica', fontSize: 6.5, cellPadding: 1.5, lineColor: [207, 217, 211], lineWidth: 0.2, textColor: [42, 62, 55], valign: 'middle' },
      headStyles: { fillColor: [237, 242, 239], textColor: [42, 62, 55], fontStyle: 'bold', fontSize: 5.5, minCellHeight: 18, halign: 'center', valign: 'bottom' },
      columnStyles: { 0: { cellWidth: 8, halign: 'center' }, 1: { cellWidth: 42 }, 2: { cellWidth: 36 } },
      horizontalPageBreak: true,
      horizontalPageBreakRepeat: [0, 1, 2],
      horizontalPageBreakBehaviour: 'immediately',
      didParseCell: data => {
        if (data.section === 'head' && data.column.index >= 3) {
          data.cell.text = [];
          data.cell.styles.cellWidth = 11;
          data.cell.styles.minCellHeight = 34;
          return;
        }
        if (data.section !== 'body' || data.column.index < 3) return;
        data.cell.styles.halign = 'center';
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.cellWidth = 11;
        if (data.cell.raw === 'ON') { data.cell.styles.fillColor = [45, 114, 89]; data.cell.styles.textColor = [255, 255, 255]; }
        if (data.cell.raw === 'ENS') { data.cell.styles.fillColor = [231, 119, 61]; data.cell.styles.textColor = [255, 255, 255]; }
        if (data.cell.raw === 'BSS') { data.cell.styles.fillColor = [110, 117, 216]; data.cell.styles.textColor = [255, 255, 255]; }
      },
      didDrawCell: data => {
        if (data.section !== 'head' || data.column.index < 3) return;
        const name = String(data.cell.raw || '');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(5.5);
        doc.setTextColor(42, 62, 55);
        doc.text(name, data.cell.x + data.cell.width / 2 + 1.4, data.cell.y + data.cell.height - 2.5, { angle: 90 });
      },
      didDrawPage: () => {
        doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.setTextColor(23, 63, 52); doc.text(plot.title || 'Mic Plot', 10, 12);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(100, 115, 108); doc.text('A3 MIC PLOT', 10, 18);
        doc.setFillColor(45, 114, 89); doc.circle(292, 13.5, 2, 'F'); doc.text('ON · Onstage', 296, 15);
        doc.setFillColor(231, 119, 61); doc.circle(330, 13.5, 2, 'F'); doc.text('ENS · Ensemble', 334, 15);
        doc.setFillColor(110, 117, 216); doc.circle(369, 13.5, 2, 'F'); doc.text('BSS · Backstage singer', 373, 15);
      }
    });

    const filename = (plot.title || 'mic-plot').replace(/[<>:"/\\|?*]+/g, '-');
    doc.save(`${filename}.pdf`);
  };

  const exportCastPdf = () => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a3' });
    const head = [['Cast member', 'Character', ...plot.scenes.map(scene => scene.name)]];
    const body = castReportRows.map((row, index) => [
      !collateCast && index > 0 && castReportRows[index - 1].groupId === row.groupId ? '' : row.actor,
      row.character,
      ...plot.scenes.map(scene => labels[row.states[scene.id]])
    ]);

    autoTable(doc, {
      head,
      body,
      startY: 25,
      margin: { top: 25, right: 10, bottom: 12, left: 10 },
      theme: 'grid',
      styles: { font: 'helvetica', fontSize: 6.5, cellPadding: 1.5, lineColor: [207, 217, 211], lineWidth: 0.2, textColor: [42, 62, 55], valign: 'middle' },
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
        if (data.cell.raw === 'ON') { data.cell.styles.fillColor = [45, 114, 89]; data.cell.styles.textColor = [255, 255, 255]; }
        if (data.cell.raw === 'ENS') { data.cell.styles.fillColor = [231, 119, 61]; data.cell.styles.textColor = [255, 255, 255]; }
        if (data.cell.raw === 'BSS') { data.cell.styles.fillColor = [110, 117, 216]; data.cell.styles.textColor = [255, 255, 255]; }
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
        doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(100, 115, 108); doc.text(`A3 CAST VIEW · ${collateCast ? 'COLLATED ROLES' : 'EXPANDED ROLES'}`, 10, 18);
        doc.setFillColor(45, 114, 89); doc.circle(292, 13.5, 2, 'F'); doc.text('ON · Onstage', 296, 15);
        doc.setFillColor(231, 119, 61); doc.circle(330, 13.5, 2, 'F'); doc.text('ENS · Ensemble', 334, 15);
        doc.setFillColor(110, 117, 216); doc.circle(369, 13.5, 2, 'F'); doc.text('BSS · Backstage singer', 373, 15);
      }
    });

    const filename = (plot.title || 'mic-plot').replace(/[<>:"/\\|?*]+/g, '-');
    doc.save(`${filename} - cast view${collateCast ? ' - collated' : ''}.pdf`);
  };

  const selectedCharacter = plot.characters.find(character => character.id === selectedCharacterId);
  const selectedCastCharacters = plot.characters.filter(character => (character.actor || '').trim().toLocaleLowerCase() === selectedCastName.trim().toLocaleLowerCase());
  const renameSelectedCast = value => {
    const oldName = selectedCastName;
    setPlot(p => ({ ...p, characters: p.characters.map(character => (character.actor || '').trim().toLocaleLowerCase() === oldName.trim().toLocaleLowerCase() ? { ...character, actor: value } : character) }));
    setSelectedCastName(value);
  };

  return <div className={`app ${advancedMode ? 'advanced' : ''}`}>
    <main onKeyDown={e => {
      if (e.key === 'Enter' && e.target.matches('input, textarea')) {
        e.preventDefault();
        e.target.blur();
      }
    }}>
      <section className="title-row">
        <div>
          <div className="eyebrow">DEVELOPMENT VERSION</div>
          <input className="title-input" value={plot.title} onChange={e => setPlot({ ...plot, title: e.target.value })}/>
          <p>Build your cast-to-scene microphone plan. Click any cell to change its status.</p>
        </div>
      </section>

      <section className="toolbar">
        <div className="toolbar-left">
          {reportOpen ? <div className="report-mode-label"><Users size={16}/><strong>Read-only cast view</strong><label className="toggle"><input type="checkbox" checked={collateCast} onChange={e => setCollateCast(e.target.checked)}/><span></span> Collate multiple roles</label></div> : <>
            <label className="search"><Search size={16}/><input placeholder="Find a character or cast member…" value={query} onChange={e => setQuery(e.target.value)}/></label>
            <div className="legend"><span><i className="dot live"></i>Onstage</span><span><i className="dot ensemble"></i>Ensemble</span><span><i className="dot backstage"></i>Backstage singer</span><span><i className="empty-dot"></i>Off</span></div>
          </>}
        </div>
        <div className="button-group">
          <span className={`save-state ${saved ? '' : 'saving'}`}><Check size={14}/> {saved ? 'Saved locally' : 'Saving…'}</span>
          <button className="secondary" data-tooltip={reportOpen ? 'Return to the editable microphone plot' : 'View assignments grouped by cast member'} onClick={() => setReportOpen(value => !value)}><Users size={16}/> {reportOpen ? 'Plot view' : 'Cast view'}</button>
          {reportOpen && <button className="secondary" data-tooltip="Export the current cast view and collation setting as A3 PDF" onClick={exportCastPdf}><Download size={16}/> Export cast PDF</button>}
          <button className="secondary" data-tooltip="Open, download, export, or start a new show" onClick={() => setStartupStep('manage')}><Download size={16}/> Save / Load</button>
          <button className="icon-help" data-tooltip="Open the Mic Plot user guide" onClick={() => setHelpOpen(true)} aria-label="Help"><CircleHelp size={18}/></button>
          <label className="advanced-toggle" title="Enable bulk entry, groups, and scene selection"><input type="checkbox" checked={advancedMode} onChange={e => { setAdvancedMode(e.target.checked); if (!e.target.checked) { setDrawer(null); setSelectedCharacterId(null); setSelectedSceneIds([]); } }}/><span></span> Advanced</label>
          {!reportOpen && <><button className="secondary" data-tooltip="Add one character and edit its name immediately" onClick={addCharacter}><Plus size={16}/> Character</button><button className="primary" data-tooltip="Add one scene and edit its name immediately" onClick={addScene}><Plus size={16}/> Scene</button></>}
        </div>
      </section>

      {advancedMode && !reportOpen && <section className="advanced-bar">
        <button className="bulk-add-button" data-tooltip="Open the keyboard-first bulk character entry drawer" onClick={() => { setDrawer('bulk'); setSelectedCharacterId(null); requestAnimationFrame(() => bulkNameRef.current?.focus()); }}><Plus size={15}/> Add characters</button>
        <div className="group-actions"><span>GROUPS</span>{groupSuggestions.length ? groupSuggestions.map(group => <button key={group} title={selectedSceneIds.length ? `Cycle ${group} through ON, ENS, BSS and Off in selected scenes` : 'Select one or more scenes first'} disabled={!selectedSceneIds.length} onClick={() => toggleGroupForScenes(group)}>{group}</button>) : <em>Add default groups to characters to see them here.</em>}</div>
        <button className="clear-selection" title="Deselect every selected scene" disabled={!selectedSceneIds.length} onClick={() => setSelectedSceneIds([])}>Clear selection</button>
      </section>}

      {!reportOpen && <section className="grid-shell">
        <div className="table-scroll">
          <table style={{ '--character-width': `${characterWidth}px`, '--actor-width': `${actorWidth}px`, '--actor-left': `${26 + characterWidth}px` }}>
            <thead><tr>
              <th className="num-col">#</th><th className="character-col">CHARACTER</th><th className="actor-col">CAST MEMBER</th>
              {plot.scenes.map((s, i) => <th className={`scene-col ${selectedSceneIds.includes(s.id) ? 'scene-selected' : ''}`} key={s.id}>
                <button className="col-delete" title="Delete scene" aria-label={`Delete ${s.name}`} onClick={() => { if (confirm(`Delete “${s.name}”?`)) removeScene(s.id); }}><Trash2 size={12}/></button>
                {advancedMode && <button className="scene-selector" aria-label={`Select ${s.name}`} onClick={() => selectScene(s.id)}><input type="checkbox" tabIndex="-1" readOnly checked={selectedSceneIds.includes(s.id)}/></button>}
                <textarea ref={el => { if (el) sceneRefs.current[s.id] = el; }} aria-label={`Scene ${i + 1} name`} value={s.name} onChange={e => updateScene(s.id, e.target.value)} />
              </th>)}
              <th className="add-col"><button title="Add scene" onClick={addScene}><Plus/></button></th>
            </tr></thead>
            <tbody>{visible.map(c => <tr key={c.id} className={draggingId === c.id ? 'dragging' : ''} onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }} onDrop={e => { e.preventDefault(); moveCharacter(draggingId || e.dataTransfer.getData('text/plain'), c.id); setDraggingId(null); }}>
              <td className={`num-col drag-handle ${selectedCharacterId === c.id ? 'character-selected' : ''}`} draggable={!advancedMode} title={advancedMode ? 'Select character' : 'Drag to reorder'} onClick={() => { if (advancedMode) { setSelectedCharacterId(c.id); setDrawer('character'); } }} onDragStart={e => { if (advancedMode) { e.preventDefault(); return; } setDraggingId(c.id); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', c.id); }} onDragEnd={() => setDraggingId(null)}>{plot.characters.findIndex(item => item.id === c.id) + 1}</td>
              <td className="character-col">{advancedMode ? <button className="row-value" onClick={() => { setSelectedCharacterId(c.id); setDrawer('character'); }}>{c.name}</button> : <><input ref={el => { if (el) nameRefs.current[c.id] = el; }} value={c.name} onChange={e => updateCharacter(c.id, 'name', e.target.value)}/><button className="row-menu" onClick={() => removeCharacter(c.id)} title="Delete character"><Trash2 size={13}/></button></>}</td>
              <td className={`actor-col actor-cell ${castMenu?.id === c.id ? 'menu-open' : ''}`}>{advancedMode ? <button className="row-value cast-value" onClick={() => { setSelectedCastName(c.actor || ''); setSelectedCharacterId(null); setDrawer('cast'); }}>{c.actor || 'Uncast'}</button> : <>
                <input
                  value={c.actor}
                  onChange={e => { updateCharacter(c.id, 'actor', e.target.value); setCastMenu({ id: c.id, highlighted: 0 }); }}
                  onFocus={() => setCastMenu({ id: c.id, highlighted: 0 })}
                  onBlur={() => setTimeout(() => setCastMenu(current => current?.id === c.id ? null : current), 120)}
                  onKeyDown={e => {
                    const options = matchingCast(c.actor);
                    if (e.key === 'ArrowDown' && options.length) { e.preventDefault(); setCastMenu({ id: c.id, highlighted: Math.min((castMenu?.highlighted ?? -1) + 1, options.length - 1) }); }
                    if (e.key === 'ArrowUp' && options.length) { e.preventDefault(); setCastMenu({ id: c.id, highlighted: Math.max((castMenu?.highlighted ?? 1) - 1, 0) }); }
                    if (e.key === 'Enter' && castMenu?.id === c.id && options[castMenu.highlighted]) { e.preventDefault(); chooseCast(c.id, options[castMenu.highlighted]); }
                    if (e.key === 'Escape') setCastMenu(null);
                  }}
                  placeholder="Uncast"
                  autoComplete="off"
                  role="combobox"
                  aria-expanded={castMenu?.id === c.id}
                />
                {castMenu?.id === c.id && matchingCast(c.actor).length > 0 && <div className="cast-suggestions" role="listbox">
                  {matchingCast(c.actor).map((name, index) => <button type="button" role="option" aria-selected={castMenu.highlighted === index} className={castMenu.highlighted === index ? 'highlighted' : ''} key={name} onMouseDown={e => { e.preventDefault(); chooseCast(c.id, name); }}>{name}</button>)}
                </div>}
                </>}
              </td>
              {plot.scenes.map(s => { const raw = plot.cells[`${c.id}:${s.id}`]; const st = ['on', 'ens', 'bss'].includes(raw) ? raw : 'off'; return <td className="plot-cell" key={s.id}><button title={`${c.name} · ${s.name}: ${labels[st] || 'Off'}. Click for ${labels[stateOrder[(stateOrder.indexOf(st) + 1) % stateOrder.length]] || 'Off'}.`} aria-label={`${c.name}, ${s.name}: ${st}`} className={`state ${st}`} onClick={() => updateCell(c.id, s.id)}>{labels[st]}</button></td> })}
              <td className="add-col"></td>
            </tr>)}
              <tr className="add-character-row"><td colSpan={plot.scenes.length + 4}><button onClick={addCharacter}><Plus size={14}/> Add character</button></td></tr>
            </tbody>
          </table>
          {!visible.length && <div className="empty">No characters match “{query}”.</div>}
        </div>
      </section>}
      {reportOpen && <section className="cast-workspace">
        <div className="report-scroll">
          <table className="report-table">
            <thead><tr><th className="report-actor">CAST MEMBER</th><th className="report-character">CHARACTER</th>{plot.scenes.map(scene => <th className="report-scene" key={scene.id}><span>{scene.name}</span></th>)}</tr></thead>
            <tbody>{castReportRows.map((row, index) => <tr key={row.id} className={!collateCast && index > 0 && castReportRows[index - 1].groupId === row.groupId ? 'same-actor' : ''}>
              <td className="report-actor">{!collateCast && index > 0 && castReportRows[index - 1].groupId === row.groupId ? '' : row.actor}</td><td className="report-character">{row.character}</td>
              {plot.scenes.map(scene => <td className={`report-state ${row.states[scene.id]}`} key={scene.id}>{labels[row.states[scene.id]]}</td>)}
            </tr>)}</tbody>
          </table>
        </div>
      </section>}
    </main>
    {advancedMode && drawer && !reportOpen && <aside className="advanced-drawer">
      <div className="drawer-heading"><div><span>ADVANCED MODE</span><h3>{drawer === 'bulk' ? 'Quick add characters' : drawer === 'cast' ? 'Cast details' : 'Character details'}</h3></div><button onClick={() => setDrawer(null)} aria-label="Close drawer">×</button></div>
      {drawer === 'bulk' ? <>
        <p>Use Tab to move through the fields. Tab from Default group adds the character and starts the next one.</p>
        <div className="drawer-fields">
          <label>Character name<input ref={bulkNameRef} value={bulkDraft.name} onChange={e => setBulkDraft({ ...bulkDraft, name: e.target.value })} onKeyDown={e => { if (e.key === 'Tab' && !e.shiftKey) { e.preventDefault(); bulkActorRef.current?.focus(); } if (e.key === 'Enter') { e.preventDefault(); addBulkCharacter(); } }} placeholder="Character name"/></label>
          <label>Cast name<SmartField ref={bulkActorRef} value={bulkDraft.actor} onChange={value => setBulkDraft(current => ({ ...current, actor: value }))} suggestions={castSuggestions} onAdvance={() => bulkGroupRef.current?.focus()} onSubmit={() => addBulkCharacter()} placeholder="Cast member"/></label>
          <label>Default group<SmartField ref={bulkGroupRef} value={bulkDraft.defaultGroup} onChange={value => setBulkDraft(current => ({ ...current, defaultGroup: value }))} suggestions={groupSuggestions} onAdvance={addBulkCharacter} onSubmit={value => addBulkCharacter(value)} placeholder="Optional group"/></label>
        </div>
        <button className="primary drawer-add" disabled={!bulkDraft.name.trim()} onClick={() => addBulkCharacter()}><Plus size={15}/> Add character</button>
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
        <button className="drawer-delete" tabIndex="-1" onClick={() => { if (confirm(`Delete ${selectedCharacter.name}?`)) { removeCharacter(selectedCharacter.id); setSelectedCharacterId(null); setDrawer(null); } }}><Trash2 size={14}/> Delete character</button>
      </> : null}
    </aside>}
    {helpOpen && <div className="help-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setHelpOpen(false); }}>
      <section className="help-panel" role="dialog" aria-modal="true" aria-labelledby="help-title">
        <div className="help-heading"><div><span>MIC PLOT GUIDE</span><h2 id="help-title">How to use the app</h2></div><button onClick={() => setHelpOpen(false)} aria-label="Close help"><X size={18}/></button></div>
        <div className="help-grid">
          <article><strong>1</strong><div><h3>Build the plot</h3><p>Add characters and scenes from the toolbar. Names are edited directly in Standard Mode. Click a plot cell to cycle <b>Off → ON → ENS → BSS</b>.</p></div></article>
          <article><strong>2</strong><div><h3>Understand the states</h3><p><i className="help-swatch on"></i>ON is onstage, <i className="help-swatch ens"></i>ENS is ensemble, and <i className="help-swatch bss"></i>BSS is backstage singer. An empty cell is Off.</p></div></article>
          <article><strong>3</strong><div><h3>Work quickly</h3><p>Drag row numbers to reorder characters. Cast fields suggest existing names. Press Enter to accept text and leave a field.</p></div></article>
          <article><strong>4</strong><div><h3>Advanced Mode</h3><p>Use Add Characters for keyboard-first bulk entry. Tab accepts the best suggestion; Enter preserves exactly what you typed and creates the character.</p></div></article>
          <article><strong>5</strong><div><h3>Groups and scenes</h3><p>Give characters a Default Group, select scene checkboxes, then press a group button to cycle that group through ON, ENS, BSS, and Off.</p></div></article>
          <article><strong>6</strong><div><h3>Cast View</h3><p>View the plot grouped by performer. Collate multiple roles to combine them; the strongest assignment wins: ON, then ENS, then BSS.</p></div></article>
          <article><strong>7</strong><div><h3>Save and export</h3><p>Your current show autosaves in this browser. Download a <b>.micplot</b> file for an editable backup, or export CSV and A3 PDFs.</p></div></article>
        </div>
        <div className="help-support"><h3>Issues and feature requests</h3><p>If you have any issues or features that you want added, please submit a feature request on the public GitHub repository.</p><a href="https://github.com/staljabro/Mic-Plot-Generator/" target="_blank" rel="noopener noreferrer">Open Mic Plot Generator on GitHub ↗</a></div>
        <div className="help-footer"><span><b>Created by Joshua Braithwaite</b><br/>Tip: hover over controls for a quick explanation.</span><button className="primary" onClick={() => setHelpOpen(false)}>Got it</button></div>
      </section>
    </div>}
    {startupStep && <div className="modal-backdrop">
      <section className="startup-modal" role="dialog" aria-modal="true" aria-labelledby="startup-title">
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
        {startupStep === 'manage' && <>
          <div className="modal-kicker">SHOW FILES</div>
          <h2 id="startup-title">Save, load or export</h2>
          <p>Your current show is automatically cached in this browser. Download a project file for backup or transfer.</p>
          <div className="file-actions">
            <button onClick={downloadShow}><Download size={18}/><span><strong>Download show</strong><small>Editable .micplot project</small></span></button>
            <button onClick={() => { setLoadError(''); setStartupStep('load'); }}><Download size={18}/><span><strong>Open show</strong><small>Load a .micplot project</small></span></button>
            <button onClick={exportCsv}><Download size={18}/><span><strong>Export CSV</strong><small>Spreadsheet format</small></span></button>
            <button onClick={exportPdf}><Download size={18}/><span><strong>Export PDF</strong><small>A3 landscape document</small></span></button>
          </div>
          <div className="new-show-panel"><div><strong>Create a new show</strong><span>Replace the current workspace with a blank production.</span></div><button className="secondary" onClick={() => { if (confirm('Create a new show? Your current show will remain available only in any .micplot file you have downloaded.')) { setNewShow({ company: '', name: '' }); setStartupStep('new'); } }}><Plus size={16}/> New show</button></div>
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
