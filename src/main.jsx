import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Check, Download, Plus, Search, Trash2, Users } from 'lucide-react';
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

const stateOrder = ['off', 'on', 'bss'];
const labels = { off: '', on: 'ON', bss: 'BSS' };

function normalisePlot(plot) {
  return { ...plot, cells: Object.fromEntries(Object.entries(plot.cells || {}).map(([key, value]) => [key, value === 'plus' ? 'bss' : value === 'on' || value === 'bss' ? value : 'off'])) };
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
  const nameRefs = useRef({});
  const sceneRefs = useRef({});
  const showFileRef = useRef(null);

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
      characters: [{ id: characterId, name: 'New character', actor: '' }],
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
  const activeCount = Object.values(plot.cells).filter(v => v === 'on' || v === 'bss').length;
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
      return values.includes('on') ? 'on' : values.includes('bss') ? 'bss' : 'off';
    };
    return [...groups.values()].flatMap(group => collateCast
      ? [{ id: group.characters.map(c => c.id).join(':'), groupId: group.key, actor: group.actor, character: `${group.characters[0].name}${group.characters.length > 1 ? ` +${group.characters.length - 1}` : ''}`, states: Object.fromEntries(plot.scenes.map(scene => [scene.id, cellState(group.characters, scene.id)])) }]
      : group.characters.map(character => ({ id: character.id, groupId: group.key, actor: group.actor, character: character.name, states: Object.fromEntries(plot.scenes.map(scene => [scene.id, cellState([character], scene.id)])) }))
    );
  }, [plot.characters, plot.scenes, plot.cells, collateCast]);

  useEffect(() => { localStorage.setItem('mic-plot-collate-cast', String(collateCast)); }, [collateCast]);

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
    const current = p.cells[key] === 'on' || p.cells[key] === 'bss' ? p.cells[key] : 'off';
    return { ...p, cells: { ...p.cells, [key]: stateOrder[(stateOrder.indexOf(current) + 1) % stateOrder.length] } };
  });

  const addCharacter = () => {
    const id = crypto.randomUUID();
    setQuery('');
    setPlot(p => ({ ...p, characters: [...p.characters, { id, name: 'New character', actor: '' }] }));
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
    const lines = [['Character','Cast member',...plot.scenes.map(s => s.name)], ...plot.characters.map(c => [c.name,c.actor,...plot.scenes.map(s => labels[plot.cells[`${c.id}:${s.id}`] || 'blank'])])];
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
        if (data.cell.raw === 'BSS') { data.cell.styles.fillColor = [231, 119, 61]; data.cell.styles.textColor = [255, 255, 255]; }
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
        doc.setFillColor(45, 114, 89); doc.circle(315, 13.5, 2, 'F'); doc.text('ON · Onstage', 319, 15);
        doc.setFillColor(231, 119, 61); doc.circle(351, 13.5, 2, 'F'); doc.text('BSS · Backstage singer', 355, 15);
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
        if (data.cell.raw === 'BSS') { data.cell.styles.fillColor = [231, 119, 61]; data.cell.styles.textColor = [255, 255, 255]; }
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
        doc.setFillColor(45, 114, 89); doc.circle(315, 13.5, 2, 'F'); doc.text('ON · Onstage', 319, 15);
        doc.setFillColor(231, 119, 61); doc.circle(351, 13.5, 2, 'F'); doc.text('BSS · Backstage singer', 355, 15);
      }
    });

    const filename = (plot.title || 'mic-plot').replace(/[<>:"/\\|?*]+/g, '-');
    doc.save(`${filename} - cast view${collateCast ? ' - collated' : ''}.pdf`);
  };

  return <div className="app">
    <main onKeyDown={e => {
      if (e.key === 'Enter' && e.target.matches('input, textarea')) {
        e.preventDefault();
        e.target.blur();
      }
    }}>
      <section className="title-row">
        <div>
          <div className="eyebrow">PRODUCTION WORKSPACE</div>
          <input className="title-input" value={plot.title} onChange={e => setPlot({ ...plot, title: e.target.value })}/>
          <p>Build your cast-to-scene microphone plan. Click any cell to change its status.</p>
        </div>
      </section>

      <section className="toolbar">
        <div className="toolbar-left">
          {reportOpen ? <div className="report-mode-label"><Users size={16}/><strong>Read-only cast view</strong><label className="toggle"><input type="checkbox" checked={collateCast} onChange={e => setCollateCast(e.target.checked)}/><span></span> Collate multiple roles</label></div> : <>
            <label className="search"><Search size={16}/><input placeholder="Find a character or cast member…" value={query} onChange={e => setQuery(e.target.value)}/></label>
            <div className="legend"><span><i className="dot live"></i>Onstage</span><span><i className="dot backstage"></i>Backstage singer</span><span><i className="empty-dot"></i>Off</span></div>
          </>}
        </div>
        <div className="button-group">
          <span className={`save-state ${saved ? '' : 'saving'}`}><Check size={14}/> {saved ? 'Saved locally' : 'Saving…'}</span>
          <button className="secondary" onClick={() => setReportOpen(value => !value)}><Users size={16}/> {reportOpen ? 'Plot view' : 'Cast view'}</button>
          {reportOpen && <button className="secondary" onClick={exportCastPdf}><Download size={16}/> Export cast PDF</button>}
          <button className="secondary" onClick={() => setStartupStep('manage')}><Download size={16}/> Save / Load</button>
          {!reportOpen && <><button className="secondary" onClick={addCharacter}><Plus size={16}/> Character</button><button className="primary" onClick={addScene}><Plus size={16}/> Scene</button></>}
        </div>
      </section>

      {!reportOpen && <section className="grid-shell">
        <div className="table-scroll">
          <table style={{ '--character-width': `${characterWidth}px`, '--actor-width': `${actorWidth}px`, '--actor-left': `${26 + characterWidth}px` }}>
            <thead><tr>
              <th className="num-col">#</th><th className="character-col">CHARACTER</th><th className="actor-col">CAST MEMBER</th>
              {plot.scenes.map((s, i) => <th className="scene-col" key={s.id}>
                <button className="col-delete" title="Delete scene" aria-label={`Delete ${s.name}`} onClick={() => { if (confirm(`Delete “${s.name}”?`)) removeScene(s.id); }}><Trash2 size={12}/></button>
                <textarea ref={el => { if (el) sceneRefs.current[s.id] = el; }} aria-label={`Scene ${i + 1} name`} value={s.name} onChange={e => updateScene(s.id, e.target.value)} />
              </th>)}
              <th className="add-col"><button title="Add scene" onClick={addScene}><Plus/></button></th>
            </tr></thead>
            <tbody>{visible.map(c => <tr key={c.id} className={draggingId === c.id ? 'dragging' : ''} onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }} onDrop={e => { e.preventDefault(); moveCharacter(draggingId || e.dataTransfer.getData('text/plain'), c.id); setDraggingId(null); }}>
              <td className="num-col drag-handle" draggable="true" title="Drag to reorder" onDragStart={e => { setDraggingId(c.id); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', c.id); }} onDragEnd={() => setDraggingId(null)}>{plot.characters.findIndex(item => item.id === c.id) + 1}</td>
              <td className="character-col"><input ref={el => { if (el) nameRefs.current[c.id] = el; }} value={c.name} onChange={e => updateCharacter(c.id, 'name', e.target.value)}/><button className="row-menu" onClick={() => removeCharacter(c.id)} title="Delete character"><Trash2 size={13}/></button></td>
              <td className={`actor-col actor-cell ${castMenu?.id === c.id ? 'menu-open' : ''}`}>
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
              </td>
              {plot.scenes.map(s => { const raw = plot.cells[`${c.id}:${s.id}`]; const st = raw === 'on' || raw === 'bss' ? raw : 'off'; return <td className="plot-cell" key={s.id}><button aria-label={`${c.name}, ${s.name}: ${st}`} className={`state ${st}`} onClick={() => updateCell(c.id, s.id)}>{labels[st]}</button></td> })}
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
