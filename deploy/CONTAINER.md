# Container publishing

GitHub Actions (`.github/workflows/container.yml`) runs the API smoke tests
inside the Docker test stage before publishing the runtime image to:

```
ghcr.io/penguinator13/pilots-logbook:latest
ghcr.io/penguinator13/pilots-logbook:1.8.1
```

The build publishes linux/amd64 and linux/arm64 variants, plus an immutable
`sha-<full commit>` tag. The approved Cockpit theme is included; the Original
switch remains available. Pull requests run tests without publishing.

The workflow uses GitHub's short-lived `GITHUB_TOKEN`, not a saved PAT.
For an existing GHCR package, its Settings > Manage Actions access must grant
this repository Write access. `packages: write` in the workflow alone does
not override an existing package's access controls.

After updating, verify the image label `org.opencontainers.image.revision`
against the source commit, and check `/healthz` and the theme assets in an
isolated container before replacing any live deployment.

The homelab's native systemd deployment is independent of this image. Image
publishing does not restart or modify the live logbook or its database.
