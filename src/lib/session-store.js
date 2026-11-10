/**
 * Minimal express-session store backed by the app's own SQLite database.
 * Keeps logins alive across restarts and avoids the default MemoryStore
 * (which leaks and is not meant for production). No extra dependency.
 */
const { Store } = require('express-session');

class SqliteSessionStore extends Store {
  constructor(db, options = {}) {
    super();
    this.db = db;
    this.ttlMs = options.ttlMs || 24 * 60 * 60 * 1000;

    this.stmts = {
      get: db.prepare('SELECT sess, expires FROM sessions WHERE sid = ?'),
      set: db.prepare('INSERT INTO sessions (sid, sess, expires) VALUES (?, ?, ?) ON CONFLICT(sid) DO UPDATE SET sess = excluded.sess, expires = excluded.expires'),
      touch: db.prepare('UPDATE sessions SET expires = ? WHERE sid = ?'),
      destroy: db.prepare('DELETE FROM sessions WHERE sid = ?'),
      clear: db.prepare('DELETE FROM sessions'),
      prune: db.prepare('DELETE FROM sessions WHERE expires < ?'),
      length: db.prepare('SELECT COUNT(*) AS n FROM sessions WHERE expires >= ?')
    };

    this.stmts.prune.run(Date.now());
    const interval = options.pruneIntervalMs || 15 * 60 * 1000;
    this.timer = setInterval(() => {
      try { this.stmts.prune.run(Date.now()); } catch (e) { /* ignore */ }
    }, interval);
    if (this.timer.unref) this.timer.unref();
  }

  _expiresFor(session) {
    const exp = session && session.cookie && session.cookie.expires;
    if (exp) {
      const t = new Date(exp).getTime();
      if (!isNaN(t)) return t;
    }
    return Date.now() + this.ttlMs;
  }

  get(sid, cb) {
    try {
      const row = this.stmts.get.get(sid);
      if (!row) return cb(null, null);
      if (row.expires < Date.now()) {
        this.stmts.destroy.run(sid);
        return cb(null, null);
      }
      cb(null, JSON.parse(row.sess));
    } catch (e) {
      cb(e);
    }
  }

  set(sid, session, cb) {
    try {
      this.stmts.set.run(sid, JSON.stringify(session), this._expiresFor(session));
      cb && cb(null);
    } catch (e) {
      cb && cb(e);
    }
  }

  touch(sid, session, cb) {
    try {
      this.stmts.touch.run(this._expiresFor(session), sid);
      cb && cb(null);
    } catch (e) {
      cb && cb(e);
    }
  }

  destroy(sid, cb) {
    try {
      this.stmts.destroy.run(sid);
      cb && cb(null);
    } catch (e) {
      cb && cb(e);
    }
  }

  clear(cb) {
    try {
      this.stmts.clear.run();
      cb && cb(null);
    } catch (e) {
      cb && cb(e);
    }
  }

  length(cb) {
    try {
      cb(null, this.stmts.length.get(Date.now()).n);
    } catch (e) {
      cb(e);
    }
  }
}

module.exports = SqliteSessionStore;
