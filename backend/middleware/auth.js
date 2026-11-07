const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  const token = auth.slice(7);
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};

const requireAdmin = (req, res, next) => {
  verifyToken(req, res, () => {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    next();
  });
};

const requireStudent = (req, res, next) => {
  verifyToken(req, res, () => {
    if (req.user?.role !== 'student') {
      return res.status(403).json({ error: 'Student login required' });
    }
    next();
  });
};

const requireAuth = (req, res, next) => {
  verifyToken(req, res, next);
};

module.exports = { verifyToken, requireAdmin, requireStudent, requireAuth };
