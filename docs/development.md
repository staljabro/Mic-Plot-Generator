# Development and releases

## Local development

Requirements: Node.js 22 or newer and npm.

```bash
npm ci
npm run dev
```

Run the automated model and persistence tests followed by a production build:

```bash
npm run check
```

## Version source of truth

The release version is exported from `src/version.js`:

```js
export const APP_VERSION = '0.2.0';
```

That value is displayed in the app, read by GitHub Actions, used for the Docker
image tag, and written to the image's OCI version label. Update `package.json`
and `package-lock.json` to the same value so npm metadata remains consistent.

## Release workflow

1. Update `APP_VERSION` in `src/version.js`.
2. Update the package and lock-file versions to match.
3. Update documentation or release notes as needed.
4. Run `npm run check`.
5. Commit and push the change to `main`.
6. Optionally create and push a matching Git tag, such as `v0.2.0`.

```bash
git add src/version.js package.json package-lock.json
git commit -m "Release v0.2.0"
git push origin main
git tag v0.2.0
git push origin v0.2.0
```

The Docker workflow rejects a Git tag that does not equal `v` plus the version
in `src/version.js`. This prevents source, app, and container versions from
silently diverging.

## Project structure

- `src/main.jsx` — application UI and interactions
- `src/model.js` — plot normalization and domain operations
- `src/storage.js` — browser-local library and recovery snapshots
- `src/usePlotHistory.js` — undo and redo history
- `src/version.js` — release version source of truth
- `docs/` — user, development, and deployment documentation
