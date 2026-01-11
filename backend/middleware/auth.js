const jwt = require('jsonwebtoken');
require('dotenv').config();

const verifyToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    // Allow "Bearer [token]" or just "[token]"
    const token = authHeader && authHeader.split(' ')[1] || authHeader;

    if (!token) {
        return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    const jwtSecret = process.env.JWT_SECRET || 'fallback_secret';

    if (token) {
        try {
            const decoded = jwt.verify(token, jwtSecret);
            req.user = decoded;
            next();
        } catch (err) {
            console.error('[Auth Middleware] Token verification failed:', err.message);
            // Even if verification fails, if it's a validly structured JWT we might be able to decode it
            // but for security we should expect valid signatures.
            res.status(403).json({ error: 'Invalid token' });
        }
    } else {
        res.status(401).json({ error: 'Access denied. No token provided.' });
    }
};

const verifyAdmin = (req, res, next) => {
    verifyToken(req, res, () => {
        if (req.user && req.user.role === 'admin') {
            next();
        } else {
            res.status(403).json({ error: 'Access denied. Admin only.' });
        }
    });
};

const verifyFaculty = (req, res, next) => {
    verifyToken(req, res, () => {
        if (req.user && (req.user.role === 'faculty' || req.user.role === 'admin')) {
            next();
        } else {
            res.status(403).json({ error: 'Access denied. Faculty only.' });
        }
    });
};

module.exports = { verifyToken, verifyAdmin, verifyFaculty };
