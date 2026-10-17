# User guide

## Create and configure a show

Create a show by entering its company and production name. New shows open in
Show Setup and begin with no characters or scenes.

Show Setup contains three tabs:

- **Show:** edit the company and show name, and configure cell states.
- **Characters:** add or bulk-paste characters, edit cast and group fields, and
  drag rows into plot order.
- **Scenes:** add one or more scene names, edit properties, duplicate or delete
  scenes, and drag rows into plot order.

Every show starts with required Off and On states. Their names and short names
are fixed, but On's colour can be changed. Custom states can be added, coloured,
removed, and drag-reordered. State order controls cell cycling, toolbar order,
and numeric shortcuts.

## Characters and scenes

The character entry row is keyboard-oriented. Tab moves through Character,
Cast, and Default Group fields and accepts the highlighted suggestion. Enter in
any field adds the character and returns focus to Character.

Click a character or cast name in the plot to open its inspector. Click a scene
heading to select it and open scene properties. Shift-click scene headings to
select more than one scene. Scene deletion is available through the inspector
and Show Setup.

## Edit modes

**Direct Edit** changes assignments immediately. Click a cell to cycle through
the configured states, or drag across cells to paint the same state. Select one
or more scene headings and use a group button to cycle that group's cells.

**Mass Edit** builds a cell selection without changing assignments. Click a cell
to add or remove it; drag across cells to add them. Selected cells have a bright
overlay above their state colour. Choose a state in the toolbar to apply it to
the complete selection.

Press Escape to clear cell and scene selections and close an open inspector.
Use Ctrl+Z to undo and Ctrl+Shift+Z or Ctrl+Y to redo.

## Saving, reports, and exports

Shows autosave in the current browser. The Save / Load window provides local
show switching, recovery snapshots, `.micplot` backups, CSV export, configurable
PDF export, and browser print preview.

Cast View groups the plot by performer. Collated mode combines multiple roles
for the same performer, preferring On and then the first matching custom state.

Browser storage should not be treated as the only backup. Download `.micplot`
files periodically, especially before clearing browser data or moving devices.
