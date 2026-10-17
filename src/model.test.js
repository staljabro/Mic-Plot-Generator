import test from 'node:test';
import assert from 'node:assert/strict';
import { collateCastRows, createBlankPlot, cycleState, DEFAULT_STATES, normalisePlot, parseTabular, removeCharacterFromPlot, removeSceneFromPlot } from './model.js';

test('cell states cycle in the documented order', () => {
  const states = [...DEFAULT_STATES, { id: 'standby' }];
  assert.equal(cycleState(states, 'off'), 'on');
  assert.equal(cycleState(states, 'on'), 'standby');
  assert.equal(cycleState(states, 'standby'), 'off');
});

test('deleting rows and scenes removes orphaned cells', () => {
  const plot = { characters: [{ id: 'c1' }, { id: 'c2' }], scenes: [{ id: 's1' }, { id: 's2' }], cells: { 'c1:s1': 'on', 'c1:s2': 'ens', 'c2:s1': 'bss' } };
  assert.deepEqual(removeCharacterFromPlot(plot, 'c1').cells, { 'c2:s1': 'bss' });
  assert.deepEqual(removeSceneFromPlot(plot, 's1').cells, { 'c1:s2': 'ens' });
});

test('cast collation applies ON then ENS then BSS precedence', () => {
  const plot = { states: [...DEFAULT_STATES, { id: 'ens' }, { id: 'bss' }], characters: [{ id: 'c1', name: 'A', actor: 'Sam' }, { id: 'c2', name: 'B', actor: 'Sam' }], scenes: [{ id: 's1' }], cells: { 'c1:s1': 'bss', 'c2:s1': 'ens' } };
  assert.equal(collateCastRows(plot, true)[0].states.s1, 'ens');
});

test('new-format state settings migrate legacy assignments without adding them to new shows', () => {
  const migrated = normalisePlot({ title: 'Legacy', characters: [{ id: 'c1', name: 'A' }], scenes: [{ id: 's1', name: 'One' }], cells: { 'c1:s1': 'ens' } });
  assert.deepEqual(migrated.states.map(state => state.id), ['off', 'on', 'ens']);
});

test('new shows start with only required Off and On states', () => {
  const plot = createBlankPlot('Company', 'Show');
  assert.deepEqual(plot.states.map(state => state.id), ['off', 'on']);
  assert.deepEqual(plot.characters, []);
  assert.deepEqual(plot.scenes, []);
  assert.deepEqual(plot.groups, []);
  assert.equal(plot.showLogo, '');
  assert.equal(plot.showLogo2, '');
});

test('normalisation preserves custom state order and locks required labels', () => {
  const plot = normalisePlot({ characters: [], scenes: [], cells: {}, states: [{ id: 'on', name: 'Wrong', abbreviation: 'X', color: '#112233' }, { id: 'off' }] });
  assert.deepEqual(plot.states.map(state => state.id), ['on', 'off']);
  assert.equal(plot.states[0].name, 'On');
  assert.equal(plot.states[0].abbreviation, 'ON');
});

test('tabular paste accepts an optional header', () => {
  assert.deepEqual(parseTabular('Character\tCast member\tGroup\nHamlet\tAlex\tLeads'), [{ name: 'Hamlet', actor: 'Alex', defaultGroup: 'Leads' }]);
});

test('normalisation preserves reusable character groups without duplicates', () => {
  const plot = normalisePlot({ characters: [], scenes: [], cells: {}, groups: [' Leads ', 'Leads', '', 'Chorus'] });
  assert.deepEqual(plot.groups, ['Leads', 'Chorus']);
});

test('normalisation only preserves supported embedded show logos', () => {
  const png = 'data:image/png;base64,AAAA';
  assert.equal(normalisePlot({ characters: [], scenes: [], cells: {}, showLogo: png }).showLogo, png);
  assert.equal(normalisePlot({ characters: [], scenes: [], cells: {}, showLogo: 'https://example.com/logo.png' }).showLogo, '');
  assert.equal(normalisePlot({ characters: [], scenes: [], cells: {}, showLogo2: png }).showLogo2, png);
});
