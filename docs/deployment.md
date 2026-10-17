# Docker and Unraid deployment

## Image tags

Pushes to `main` publish the Linux AMD64 image to:

```text
ghcr.io/staljabro/mic-plot-generator
```

Published builds receive three useful tags:

- `latest` for the newest build from the default branch
- `v<version>` from `src/version.js`, such as `v0.2.0`
- `sha-<commit>` as an immutable build reference

Use `latest` for automatic updates or a version/SHA tag for reproducible
deployments. The image also records the application version in the
`org.opencontainers.image.version` OCI label.

## Docker Compose and Unraid

The included `compose.unraid.yaml` publishes container port 80 on host port
8087. Start or update it with:

```bash
docker compose -f compose.unraid.yaml pull
docker compose -f compose.unraid.yaml up -d
```

Docker's Restart action does not pull a newer image. In Unraid, use Check for
Updates / Update, configure Compose to pull on startup, or use an automatic
container-update mechanism.

If the GitHub Container Registry package is private, configure credentials with
a GitHub token that has `read:packages`. Public packages require no registry
credentials.

To pin a release, change the Compose image from `:latest` to a version such as
`:v0.2.0`.
