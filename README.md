# Mic Plot Generator

Mic Plot Generator is a local-first React app for building character-to-scene
microphone plots. Version 1.0.0 supports configurable cue states, two editing
modes, reusable groups, cast-based review, multiple locally saved shows,
recovery snapshots, portable `.micplot` files, CSV output, and full-document
PDF preview and export.

## Use the app

1. Create a show with its company and production name.
2. Complete **Show Setup**:
   - configure the required Off and On states and add custom coloured states;
   - upload up to two show logos;
   - add or bulk-paste characters, cast members, and optional groups;
   - add scenes; and
   - drag states, characters, and scenes into their required order.
3. Build the plot in **Direct Edit**, or use **Mass Edit** to select and update
   many cells together.
4. Select scene headings when applying character-group controls, and use the
   scene edit icon when scene properties need changing.
5. Open **Cast View** to review assignments grouped by performer.
6. Open **Save / Load** to manage shows, backups, recovery snapshots, and
   exports.
7. Choose **Export PDF** to configure and preview every page before download.
   Cast layout, a blank Mic # column, Logo 1 on the left, and Logo 2 on the
   right are the defaults when those logos exist.

Data autosaves in the current browser. Download `.micplot` backups regularly;
browser storage should not be the only copy of an important show.

## Current capabilities

- Per-show cell states with fixed Off/On labels, custom short names, a
  coordinated 15-colour palette, and drag ordering.
- Empty new shows with keyboard-friendly character entry and bulk paste.
- Draggable character and scene ordering shared by the plot and exports.
- Direct editing with cell cycling, drag painting, arrow-key navigation, and
  numeric state shortcuts.
- Mass editing with click/drag selection, additive scene selection, group-cell
  selection, visible overlays, and Escape-to-clear.
- Character and scene inspectors, undo/redo, autosave status, and destructive
  change confirmations.
- Cast View with optional multi-role collation.
- A local show library, bounded recovery snapshots, and portable `.micplot`
  import/export.
- Character or cast PDF layouts, optional Character # and Mic # columns,
  repeated headers across pages, auto-sized columns, coloured legends, page
  counts, dual logos, and exact multi-page preview.
- CSV export and browser printing.

## Documentation

1. Start with the [step-by-step user guide](docs/user-guide.md).
2. For local development and releases, follow
   [Development and releases](docs/development.md).
3. For Docker or Unraid, follow the [deployment guide](docs/deployment.md).

The release source of truth is [`src/version.js`](src/version.js). For version
1.0.0, npm metadata, the app display, GitHub Actions, Docker tags, and OCI image
labels all use the same value.

## Run locally

Requirements: Node.js 22 or newer and npm.

```bash
npm ci
npm run dev
```

Before committing a change, run:

```bash
npm run check
```

This runs the automated tests and production build.

## Run the published image

1. Make the GHCR package public, or configure a token with `read:packages`.
2. Start the included Compose definition:

   ```bash
   docker compose -f compose.unraid.yaml up -d
   ```

3. Open port `8087` on the Docker host.
4. To update, pull and recreate the container:

   ```bash
   docker compose -f compose.unraid.yaml pull
   docker compose -f compose.unraid.yaml up -d
   ```

The default image is `ghcr.io/staljabro/mic-plot-generator:latest`. Pin
`:v1.0.0` or an immutable `:sha-...` tag when reproducibility matters. Docker's
plain Restart action does not pull a newer image.
