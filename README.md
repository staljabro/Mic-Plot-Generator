# Mic Plot Generator

A local-first React tool for creating cast-to-scene microphone plots. Each show
can define its own colour-coded cell states from a coordinated palette. It also
includes undo/redo, multiple on-device shows and recovery snapshots, bulk setup
for characters and scenes, spreadsheet paste, cast collation, configurable
PDF/CSV export, print preview, and responsive keyboard-accessible editing.

## Documentation

- [User guide](docs/user-guide.md)
- [Development and releases](docs/development.md)
- [Docker and Unraid deployment](docs/deployment.md)

The current release number is maintained in [`src/version.js`](src/version.js).

## Development

```bash
npm ci
npm run dev
npm run check
```

`npm run check` runs the data-model and persistence tests, followed by a
production build. Show data remains in the browser unless a `.micplot` file is
downloaded by the user.

## Published Docker image

Every push to `main` builds the application and publishes an `amd64` image to:

```text
ghcr.io/staljabro/mic-plot-generator:latest
```

Every published build also receives the version tag declared in
`src/version.js` and an immutable `:sha-...` tag. A pushed Git tag must match
that version exactly—for example, `v0.2.0`—or the workflow fails. Pull requests
build the image as a check but do not publish it.

The first successful workflow run creates the package in GitHub Container
Registry. In the package settings, make the package public if the Unraid server
should pull it without GitHub credentials. If it remains private, configure
Unraid with a GitHub personal access token that has `read:packages` permission.

## Run on Unraid

The provided `compose.unraid.yaml` publishes the site on port `8087`. Change the
left-hand port if needed, then deploy it with Unraid Compose Manager (or another
Compose integration):

```bash
docker compose -f compose.unraid.yaml up -d
```

`pull_policy: always` makes each `docker compose up` check GHCR and recreate the
container when the image changed. Configure the Compose stack to autostart if it
should check for a new image when the Unraid server starts.

To update it manually without copying repository files:

```bash
docker compose -f compose.unraid.yaml pull
docker compose -f compose.unraid.yaml up -d
```

Docker's plain **Restart** operation does not pull images; it only restarts the
existing container. If using Unraid's standard Docker tab instead of Compose,
set the Repository field to `ghcr.io/staljabro/mic-plot-generator:latest`, map a
host port to container port `80`, and use **Check for Updates / Update**. For
unattended deployments, enable Unraid's container auto-update feature or the
widely used CA Auto Update Applications plugin for this container.

See [the deployment guide](docs/deployment.md) for version-pinned images and
release details.
