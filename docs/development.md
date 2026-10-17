# Development and releases

## 1. Set up a local checkout

Install Node.js 22 or newer and npm, then run:

```bash
npm ci
npm run dev
```

Open the local URL printed by Vite.

## 2. Validate a change

```bash
npm run check
```

This runs model, persistence, and version tests before a production build.

## 3. Know the project structure

- `src/main.jsx` — interface, keyboard behavior, and exports
- `src/model.js` — plot normalization and domain operations
- `src/storage.js` — local library and recovery snapshots
- `src/usePlotHistory.js` — undo and redo history
- `src/version.js` — release version source of truth
- `docs/` — user, development, and deployment guides

## 4. Update the release version

The source of truth is:

```js
export const APP_VERSION = '1.0.1';
```

1. Change `APP_VERSION` in `src/version.js`.
2. Match it in `package.json` and both root entries in `package-lock.json`.
3. Update version examples and user-facing documentation.
4. Run `npm run check`; the version test rejects mismatched metadata.

GitHub Actions uses this value for the app, `v<version>` Docker tag, and OCI
version label.

## 5. Publish a release

1. Stage and commit the code, documentation, and version metadata.
2. Push to `main`.
3. Create a tag exactly matching `v` plus `APP_VERSION`.
4. Push the tag.

For version 1.0.1:

```bash
git add src/version.js package.json package-lock.json README.md docs
git commit -m "Release v1.0.1"
git push origin main
git tag v1.0.1
git push origin v1.0.1
```

The Docker workflow rejects a release tag that differs from `src/version.js`.
