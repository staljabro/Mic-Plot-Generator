import test from 'node:test';
import assert from 'node:assert/strict';
import { deleteStoredPlot, listStoredPlots, readLibrary, savePlotToLibrary } from './storage.js';

const values = new Map();
global.localStorage = {
  getItem: key => values.get(key) ?? null,
  setItem: (key, value) => values.set(key, value),
  removeItem: key => values.delete(key)
};

test('local library saves, lists and deletes independent shows', () => {
  values.clear();
  savePlotToLibrary({ id: 'one', title: 'One' });
  savePlotToLibrary({ id: 'two', title: 'Two' });
  assert.equal(listStoredPlots().length, 2);
  deleteStoredPlot('one');
  assert.deepEqual(Object.keys(readLibrary().shows), ['two']);
});

test('local library keeps bounded recovery snapshots', () => {
  values.clear();
  savePlotToLibrary({ id: 'one', title: 'Before' });
  savePlotToLibrary({ id: 'one', title: 'After' }, { backup: true });
  assert.equal(readLibrary().backups.one[0].plot.title, 'Before');
});
