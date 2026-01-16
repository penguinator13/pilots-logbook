const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');

// Import routes
const authRoutes = require('./routes/auth');
const flightRoutes = require('./routes/flights');
const aircraftRoutes = require('./routes/aircraft');
const customFieldsRoutes = require('./routes/custom-fields');
const tagsRoutes = require('./routes/tags');
const { requireAuth } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3000;
const SESSION_SECRET = process.env.SESSION_SECRET || 'change-this-secret-in-production';

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Session configuration
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // Set to true if using HTTPS
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/flights', flightRoutes);
app.use('/api/aircraft', aircraftRoutes);
app.use('/api/custom-fields', customFieldsRoutes);
app.use('/api/tags', tagsRoutes);

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

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
