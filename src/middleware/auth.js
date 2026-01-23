function requireAuth(req, res, next) {
  if (req.session && req.session.userId) {
    return next();
  }

  // For API requests, return JSON error
  // Use originalUrl instead of path since path is relative to the router mount point
  if (req.originalUrl.startsWith('/api/')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // For page requests, redirect to login
  res.redirect('/login.html');
}

function redirectIfAuthenticated(req, res, next) {
  if (req.session && req.session.userId) {
    return res.redirect('/');
  }
  next();
}

module.exports = {
  requireAuth,
  redirectIfAuthenticated
};
