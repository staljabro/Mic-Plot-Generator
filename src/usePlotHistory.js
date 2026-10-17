import { useCallback, useState } from 'react';

export function usePlotHistory(initialValue, limit = 60) {
  const [state, setState] = useState(() => ({ past: [], present: initialValue, future: [] }));
  const set = useCallback(update => setState(current => {
    const next = typeof update === 'function' ? update(current.present) : update;
    if (next === current.present || JSON.stringify(next) === JSON.stringify(current.present)) return current;
    return { past: [...current.past, current.present].slice(-limit), present: next, future: [] };
  }), [limit]);
  const reset = useCallback(value => setState({ past: [], present: value, future: [] }), []);
  const undo = useCallback(() => setState(current => current.past.length ? { past: current.past.slice(0, -1), present: current.past.at(-1), future: [current.present, ...current.future] } : current), []);
  const redo = useCallback(() => setState(current => current.future.length ? { past: [...current.past, current.present].slice(-limit), present: current.future[0], future: current.future.slice(1) } : current), [limit]);
  return { plot: state.present, setPlot: set, resetPlot: reset, undo, redo, canUndo: state.past.length > 0, canRedo: state.future.length > 0 };
}
