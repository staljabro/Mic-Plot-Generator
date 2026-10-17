# Step-by-step user guide

## 1. Create a show

1. Choose **New show**.
2. Enter the company and show name.
3. Create the show. **Show Setup** opens automatically.

New shows intentionally contain no characters or scenes.

## 2. Configure the show

1. In the **Show** tab, confirm the company and show name.
2. Review the cell states. Off and On always exist; their names and short names
   cannot be changed or removed.
3. Change On's colour if required.
4. To add another state, enter its name and short name, choose one of the 15
   colours, and select **Add**.
5. Drag custom states into the desired order. This controls cell cycling,
   toolbar order, and numeric shortcuts.
6. Optionally upload Logo 1 and Logo 2. PNG, JPEG, and WebP are supported and
   stored with downloaded `.micplot` files.

To reuse settings, copy a complete state set from another locally saved show.
The app previews how many existing assignments would be reset first.

## 3. Add characters

1. Open the **Characters** tab.
2. Enter Character, Cast member, and optional Default group.
3. Press Tab to move to the next field or accept the highlighted suggestion.
4. Press Enter from any field to add the character and return focus to Character.
5. Repeat, or open **Bulk paste characters** and paste tab-separated Character,
   Cast member, and optional Group columns.
6. Edit values in the list and drag rows into plot order.

You can copy reusable group choices from another local show without copying its
characters or changing current assignments.

## 4. Add scenes

1. Open the **Scenes** tab.
2. Enter and add scene names.
3. Edit properties, duplicate, or remove scenes as needed.
4. Drag scenes into the order required in the plot and exports.
5. Close Show Setup. Return with **Show setup** at any time.

## 5. Assign microphones in Direct Edit

1. Leave **Direct Edit** selected, or press D outside a text field.
2. Click a cell to cycle to its next state.
3. Drag across cells to paint the same state.
4. Use arrow keys to move the active single-cell cursor.
5. Press a number key to assign the state in that toolbar position.
6. Select scene headings, then choose a group button to cycle that group's cells
   in those scenes.

Direct Edit does not create a multi-cell selection, so mass-edit counts and
hotkey hints stay hidden.

## 6. Update many cells in Mass Edit

1. Select **Mass Edit**, or press M outside a text field.
2. Click an unselected cell to add it; click a selected cell to remove it.
3. Drag across cells to add them to the selection.
4. Click scene headings to add or remove scenes from the scene selection.
5. With a scene selected, choose a group button to toggle that group's cells in
   the selected scenes.
6. Choose a state button or press its number key to update all selected cells.
7. Press Delete or Backspace to set selected cells to Off.
8. Press Escape to clear cell and scene selections.

## 7. Edit characters and scenes

1. Click a character or cast name to open its inspector.
2. Edit, duplicate, or delete the character there.
3. Click a scene heading to select it without opening the inspector.
4. Use the scene's edit icon to open its properties.
5. Delete scenes from the inspector or Show Setup.
6. Use Ctrl+Z to undo and Ctrl+Shift+Z or Ctrl+Y to redo.

## 8. Review Cast View

1. Choose **Cast view**.
2. Review roles grouped by performer.
3. Enable **Collate multiple roles** for one row per performer. Collation prefers
   On and then the first matching custom state.
4. Choose **Plot view** to return.

## 9. Save, switch, and recover

1. Watch the header for saving, saved, or failed status.
2. Open **Save / Load**.
3. Switch among local shows or create another.
4. Download the show as a `.micplot` backup.
5. Use **Open show file** to import one.
6. Expand recovery snapshots when an earlier autosaved state is needed.

## 10. Export a PDF

1. In **Save / Load**, choose **Export PDF**.
2. Choose Cast or Character layout. Cast is the default.
3. In Cast layout, leave blank Mic # enabled for manual allocation and
   optionally enable Character #.
4. Choose paper, orientation, text size, legend, and selected-scenes settings.
5. Set each logo to Off, Left, or Right. Logo 1 defaults left and Logo 2 right;
   two visible logos remain on opposite sides.
6. Use fit-page, fit-width, or percentage scale to inspect every page.
7. Select **Download PDF**. It is the exact document shown in the preview.

Cast channels follow performer order in the character list. Additional roles
leave Channel # blank and show a small grey continuation arrow in Cast member.
Compact number and scene headings render vertically. Repeated pages retain the
required identity columns, show header, scene row, logos, coloured legend, and
page count. Each page identifies the selected layout and paper size, followed
by the export date and time. Columns and scene-header height adapt to content.

## 11. Export other formats

1. Choose **Export CSV** for spreadsheet data.
2. Choose **Print** for the browser print dialog.
