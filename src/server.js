const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const compression = require('compression');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');

const db = require('./models/database');
const SqliteSessionStore = require('./lib/session-store');

// Import routes
const authRoutes = require('./routes/auth');
const flightRoutes = require('./routes/flights');
const aircraftRoutes = require('./routes/aircraft');
const customFieldsRoutes = require('./routes/custom-fields');
const tagsRoutes = require('./routes/tags');
const preferencesRoutes = require('./routes/preferences');
const pdfExportRoutes = require('./routes/pdf-export');
const backupRoutes = require('./routes/backup');
const { requireAuth } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const SESSION_SECRET = process.env.SESSION_SECRET;
const isProduction = process.env.NODE_ENV === 'production';
const trustProxy = process.env.TRUST_PROXY === 'true';
const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// Require SESSION_SECRET in production
if (!SESSION_SECRET) {
  if (isProduction) {
    console.error('FATAL: SESSION_SECRET environment variable is required in production');
    process.exit(1);
  } else {
    console.warn('WARNING: Using default SESSION_SECRET. Set SESSION_SECRET env var for production.');
  }
}

// Trust reverse proxy (nginx, caddy, cloudflare tunnel)
if (trustProxy) {
  app.set('trust proxy', 1);
}
app.disable('x-powered-by');

// Liveness probe - no auth, no rate limit, no session
app.get('/healthz', (req, res) => {
  try {
    db.prepare('SELECT 1').get();
    res.json({ status: 'ok' });
  } catch (e) {
    res.status(500).json({ status: 'error' });
  }
});

// Security headers on everything (pages included). CSP allows Chart.js from jsDelivr.
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net'], // inline onclick handlers in the UI
      scriptSrcAttr: ["'unsafe-inline'"], // helmet defaults this to 'none', which would block onclick= attributes
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'blob:'],
      fontSrc: ["'self'"],
      connectSrc: ["'self'"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      upgradeInsecureRequests: null
    }
  },
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: false, // noisy console warning on plain-HTTP LAN access, no benefit here
  crossOriginResourcePolicy: false,
  hsts: isProduction && trustProxy
}));

app.use(compression());

// Session configuration (persisted in SQLite so logins survive restarts)
app.use(session({
  store: new SqliteSessionStore(db, { ttlMs: SESSION_TTL_MS }),
  secret: SESSION_SECRET || 'change-this-secret-in-development',
  name: 'logbook.sid',
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    secure: isProduction && trustProxy,
    httpOnly: true,
    maxAge: SESSION_TTL_MS,
    sameSite: 'lax'
  }
}));

const isAuthed = (req) => Boolean(req.session && req.session.userId);

// Page routing: every HTML page except login requires a session.
// (Static middleware would otherwise hand them out unauthenticated.)
app.use((req, res, next) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return next();
  const p = req.path;
  if (p === '/login.html') {
    return isAuthed(req) ? res.redirect('/') : next();
  }
  if (p === '/' || p === '/index.html') {
    return isAuthed(req)
      ? res.sendFile(path.join(__dirname, 'public', 'dashboard.html'))
      : res.redirect('/login.html');
  }
  if (p.endsWith('.html') && !isAuthed(req)) {
    return res.redirect('/login.html');
  }
  next();
});

// Static assets (css/js/html)
app.use(express.static(path.join(__dirname, 'public'), { index: false }));

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 600, // generous: a single page load issues several API calls
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' }
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // login attempts per window per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts, please try again later' },
  skipSuccessfulRequests: true
});

app.use('/api/', apiLimiter);
app.use('/api/auth/login', loginLimiter);

app.use(bodyParser.json({ limit: '1mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '1mb' }));

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/flights/export', pdfExportRoutes);  // Must come before /api/flights
app.use('/api/flights', flightRoutes);
app.use('/api/aircraft', aircraftRoutes);
app.use('/api/custom-fields', customFieldsRoutes);
app.use('/api/tags', tagsRoutes);
app.use('/api/preferences', preferencesRoutes);
app.use('/api/backup', backupRoutes);

// Unknown API route -> JSON 404 (not an HTML page)
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Anything else: send to dashboard (auth guard above handles redirect)
app.use(requireAuth, (req, res) => {
  res.redirect('/');
});

// Error handling
app.use((err, req, res, next) => {
  if (err && err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
const server = app.listen(PORT, HOST, () => {
  console.log(`Pilot's Logbook v${require('../package.json').version} listening on http://${HOST}:${PORT}`);
});

// Graceful shutdown: stop accepting connections, checkpoint + close SQLite
function shutdown(signal) {
  console.log(`${signal} received, shutting down`);
  server.close(() => {
    try {
      db.pragma('wal_checkpoint(TRUNCATE)');
      db.close();
    } catch (e) {
      console.error('Error closing database:', e);
    }
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
