# Cockpit theme (optional)

The original `src/public/css/styles.css` is unchanged. Cockpit is an additive,
scoped stylesheet selected by `src/public/js/appearance.js`.

- Use **Theme → Original** in the navigation (or login page) to revert instantly.
- Choice is local to each browser/device (`logbook-appearance` in localStorage).
- Both themes follow the device's light/dark preference.
- Database and backend are unchanged.

## Full deployment rollback

Before deployment, the original frontend was archived inside LXC 180 at
`/root/ui-before-cockpit.tgz`. To restore all original frontend files:

```sh
# From the Proxmox host
pct exec 180 -- sh /opt/pilots-logbook/deploy/rollback-cockpit.sh
```

Refresh the browser afterwards. No service restart or DB restore is required.
The optional CSS/JS files may remain on disk but are no longer linked.

## Source-control rollback

Baseline tag: `ui-before-cockpit` (commit `7172237`).
Theme work is isolated on branch `ui/cockpit-theme`.

## Verified

Smoke tests pass. Chromium rendering checked at 1280px and 390px, in light
and dark preferences, on Dashboard, Add Flight, Flights and Settings. No
horizontal page overflow, runtime errors or failed requests. Theme selector
was exercised, persisted through reload, and the Original body's background
was verified unchanged with/without the Cockpit stylesheet enabled. All
test records were created in a separate preview DB, not the live logbook.
