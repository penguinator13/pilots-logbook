const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const compression = require('compression');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');

// Import routes
const authRoutes = require('./routes/auth');
const flightRoutes = require('./routes/flights');
const aircraftRoutes = require('./routes/aircraft');
const customFieldsRoutes = require('./routes/custom-fields');
const tagsRoutes = require('./routes/tags');
const preferencesRoutes = require('./routes/preferences');
const pdfExportRoutes = require('./routes/pdf-export');
const { requireAuth } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3000;
const SESSION_SECRET = process.env.SESSION_SECRET;
const isProduction = process.env.NODE_ENV === 'production';
const trustProxy = process.env.TRUST_PROXY === 'true';

// Require SESSION_SECRET in production
if (!SESSION_SECRET) {
  if (isProduction) {
    console.error('FATAL: SESSION_SECRET environment variable is required in production');
    process.exit(1);
  } else {
    console.warn('WARNING: Using default SESSION_SECRET. Set SESSION_SECRET env var for production.');
  }
}

// Trust reverse proxy (nginx, cloudflare tunnel)
if (trustProxy) {
  app.set('trust proxy', 1);
}

// Middleware
app.use(compression()); // Gzip compression for all responses

// Serve static files BEFORE helmet (no security headers needed for static assets)
app.use(express.static(path.join(__dirname, 'public')));

// Security headers (applied to API routes only, not static files)
// Only apply helmet to /api routes to avoid breaking static file serving
app.use('/api', helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:"],
      fontSrc: ["'self'"],
      connectSrc: ["'self'"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"]
    }
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: false
}));

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' }
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 login attempts per window per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts, please try again later' },
  skipSuccessfulRequests: true
});

app.use('/api/', apiLimiter);
app.use('/api/auth/login', loginLimiter);

app.use(bodyParser.json({ limit: '1mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '1mb' }));

// Session configuration
app.use(session({
  secret: SESSION_SECRET || 'change-this-secret-in-development',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: isProduction && trustProxy,
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: 'lax'
  }
}));

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/flights/export', pdfExportRoutes);  // Must come before /api/flights
app.use('/api/flights', flightRoutes);
app.use('/api/aircraft', aircraftRoutes);
app.use('/api/custom-fields', customFieldsRoutes);
app.use('/api/tags', tagsRoutes);
app.use('/api/preferences', preferencesRoutes);

// Protected routes - serve HTML files only if authenticated
app.get('/', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/add-flight.html', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'add-flight.html'));
});

app.get('/flights.html', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'flights.html'));
});

app.get('/edit-flight.html', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'edit-flight.html'));
});

app.get('/aircraft.html', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'aircraft.html'));
});

app.get('/settings.html', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'settings.html'));
});

// Public route for login page
app.get('/login.html', (req, res) => {
  if (req.session && req.session.userId) {
    return res.redirect('/');
  }
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Redirect root to login if not authenticated
app.get('/', (req, res) => {
  if (!req.session || !req.session.userId) {
    return res.redirect('/login.html');
  }
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Pilot's Logbook server running on port ${PORT}`);
  console.log(`Access at http://localhost:${PORT}`);
});
