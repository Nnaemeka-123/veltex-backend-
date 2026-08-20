const jwt = require('jsonwebtoken');

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Not signed in' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Session expired — sign in again' });
  }
}

function optionalAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (token) {
    try { req.user = jwt.verify(token, process.env.JWT_SECRET); }
    catch (err) { /* ignore — proceed unauthenticated */ }
  }
  next();
}

function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    const adminEmail = (process.env.ADMIN_EMAIL || '').toLowerCase();
    if (!adminEmail || req.user.email?.toLowerCase() !== adminEmail) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    next();
  });
}

module.exports = { requireAuth, optionalAuth, requireAdmin };
