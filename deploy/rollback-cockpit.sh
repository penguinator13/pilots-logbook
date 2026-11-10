#!/bin/sh
# Run as root INSIDE the deployment LXC. Restores frontend only; no DB writes.
set -eu
ARCHIVE=/root/ui-before-cockpit.tgz
APP=/opt/pilots-logbook
[ -f "$ARCHIVE" ] || { printf '%s\n' "Missing backup: $ARCHIVE" >&2; exit 1; }
tar xzf "$ARCHIVE" -C "$APP"
printf '%s\n' 'Original frontend restored. Refresh the browser. Logbook data was not touched.'
