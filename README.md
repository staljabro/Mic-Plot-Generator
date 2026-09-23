# Mic Plot Generator

## Published Docker image

Every push to `main` builds the application and publishes an `amd64` image to:

```text
ghcr.io/staljabro/mic-plot-generator:latest
```

Version tags such as `v1.2.0` also publish `:v1.2.0`, and every published build
gets an immutable `:sha-...` tag. Pull requests build the image as a check but
do not publish it.

The first successful workflow run creates the package in GitHub Container
Registry. In the package settings, make the package public if the Unraid server
should pull it without GitHub credentials. If it remains private, configure
Unraid with a GitHub personal access token that has `read:packages` permission.

## Run on Unraid

The provided `compose.unraid.yaml` publishes the site on port `8080`. Change the
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
