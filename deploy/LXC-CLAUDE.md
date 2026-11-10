# LXC 180 — pilots-logbook

Kyran's self-hosted helicopter pilot logbook (Node.js + Express + SQLite). Source of truth for the code is his Nextcloud folder `Kyran/files/Nerd stuff/pilots-logbook` (GitHub: penguinator13/pilots-logbook); this LXC runs the v1.8.0 hardened build deployed 2026-11-10 by Alfred (Hermes).

## Layout
- App code: `/opt/pilots-logbook` (root-owned, read-only to the service)
- Data: `/var/lib/pilots-logbook/data/logbook.db` (SQLite, WAL mode) — owned by `logbook`
- Nightly snapshots: `/var/lib/pilots-logbook/backups/logbook-YYYY-MM-DD.db.gz` (30-day retention)
- Config/secrets: `/etc/pilots-logbook.env` (chmod 600; SESSION_SECRET lives here — never print it)
- Service: `pilots-logbook.service` (user `logbook`, port 3000, hardened unit)
- Backup timer: `pilots-logbook-backup.timer` → 02:30 daily → `/usr/local/bin/pilots-logbook-backup`
- Node 22 from NodeSource; `sqlite3` CLI installed for backups.

## Access
- LAN: http://192.168.4.111:3000 (DHCP lease; MAC in `pct config 180`)
- Login user: `kyran` (password hash seeded from the original project DB — his existing password). Change under Settings > Account.
- Not exposed publicly (no Caddy/Cloudflare entry) as of deployment.

## Common operations
```bash
systemctl status pilots-logbook
journalctl -u pilots-logbook -f
curl -s http://127.0.0.1:3000/healthz
systemctl start pilots-logbook-backup.service   # ad-hoc snapshot
sqlite3 /var/lib/pilots-logbook/data/logbook.db 'SELECT count(*) FROM flights;'
```

## Updating the app
1. Copy new source into `/opt/pilots-logbook` (exclude `node_modules`, `data`, `.env`).
2. `cd /opt/pilots-logbook && npm ci --omit=dev`
3. `npm test` (smoke suite on a temp DB, does not touch live data)
4. `systemctl restart pilots-logbook`

## Restore
Stop the service, replace `/var/lib/pilots-logbook/data/logbook.db` (remove `-wal`/`-shm` siblings), `chown logbook:logbook`, start. Or restore the whole LXC from PBS (VMID 180 is in the nightly vzdump job).
