# Docker and Unraid deployment

## 1. Choose an image tag

The image is published at:

```text
ghcr.io/staljabro/mic-plot-generator
```

- `latest` follows the newest default-branch build.
- `v1.0.1` selects this release.
- `sha-<commit>` selects an immutable build.

The image is Linux AMD64 and includes its version in the OCI metadata.

## 2. Prepare registry access

1. Continue without credentials if the GHCR package is public.
2. For a private package, create a GitHub token with `read:packages`.
3. Configure that credential in Docker or Unraid.

## 3. Deploy with Compose

1. Review `compose.unraid.yaml`; it maps host port 8087 to container port 80.
2. Change the host port or image tag if needed.
3. Pull and start:

   ```bash
   docker compose -f compose.unraid.yaml pull
   docker compose -f compose.unraid.yaml up -d
   ```

4. Open `http://<server-address>:8087` and confirm v1.0.1 in Help.

## 4. Deploy from the Unraid Docker tab

1. Use `ghcr.io/staljabro/mic-plot-generator:latest` or a pinned tag.
2. Map a host port to container port 80.
3. Start the container and open the mapped URL.
4. Use **Check for Updates / Update** for new images.

## 5. Update a deployment

1. Pull the selected tag.
2. Recreate the container:

   ```bash
   docker compose -f compose.unraid.yaml pull
   docker compose -f compose.unraid.yaml up -d
   ```

3. Reload the app and confirm the version in Help.

Docker Restart does not pull a newer image. Configure an update mechanism for
unattended updates. Pin `:v1.0.1` or `:sha-...` instead of `:latest` when the
deployment must remain reproducible.
