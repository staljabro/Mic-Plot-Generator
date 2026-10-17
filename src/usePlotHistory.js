import { useCallback, useState } from 'react';

function describeChange(before, after) {
  if (before.characters.length !== after.characters.length) return before.characters.length < after.characters.length ? 'add character' : 'remove character';
  if (before.scenes.length !== after.scenes.length) return before.scenes.length < after.scenes.length ? 'add scene' : 'remove scene';
  if (before.states.length !== after.states.length) return before.states.length < after.states.length ? 'add state' : 'remove state';
  if (JSON.stringify(before.cells) !== JSON.stringify(after.cells)) return 'change cue assignments';
  if (JSON.stringify(before.characters) !== JSON.stringify(after.characters)) return 'edit characters';
  if (JSON.stringify(before.scenes) !== JSON.stringify(after.scenes)) return 'edit scenes';
  if (JSON.stringify(before.states) !== JSON.stringify(after.states)) return 'edit states';
  return 'edit show';
}

export function usePlotHistory(initialValue, limit = 60) {
  const [state, setState] = useState(() => ({ past: [], present: initialValue, future: [] }));
  const set = useCallback(update => setState(current => {
    const next = typeof update === 'function' ? update(current.present) : update;
    if (next === current.present || JSON.stringify(next) === JSON.stringify(current.present)) return current;
    return { past: [...current.past, { plot: current.present, label: describeChange(current.present, next) }].slice(-limit), present: next, future: [] };
  }), [limit]);
  const reset = useCallback(value => setState({ past: [], present: value, future: [] }), []);
  const undo = useCallback(() => setState(current => {
    if (!current.past.length) return current;
    const entry = current.past.at(-1);
    return { past: current.past.slice(0, -1), present: entry.plot, future: [{ plot: current.present, label: entry.label }, ...current.future] };
  }), []);
  const redo = useCallback(() => setState(current => {
    if (!current.future.length) return current;
    const entry = current.future[0];
    return { past: [...current.past, { plot: current.present, label: entry.label }].slice(-limit), present: entry.plot, future: current.future.slice(1) };
  }), [limit]);
  return {
    plot: state.present, setPlot: set, resetPlot: reset, undo, redo,
    canUndo: state.past.length > 0, canRedo: state.future.length > 0,
    undoLabel: state.past.at(-1)?.label || '', redoLabel: state.future[0]?.label || ''
  };
}
