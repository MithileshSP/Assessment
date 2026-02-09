const jwt = require('jsonwebtoken');
const { query } = require('../database/connection');
require('dotenv').config();

const verifyToken = async (req, res, next) => {
    // 1. Try to get token from legacy Authorization header
    const authHeader = req.headers['authorization'];
    let tokenFromHeader = authHeader && (authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : authHeader);

    // 2. Try to get token from HttpOnly cookie
    const tokenFromCookie = req.cookies && req.cookies.authToken;

    // Use cookie token if available, fallback to header (migration support)
    const token = tokenFromCookie || tokenFromHeader;

    if (!token) {
        return res.status(401).json({ error: 'Access denied. No session token provided.' });
    }

    const jwtSecret = process.env.JWT_SECRET || 'fallback_secret';

    try {
        const decoded = jwt.verify(token, jwtSecret);
        req.user = decoded;

        // Trace session enforcement
        const [user] = await query('SELECT current_session_id FROM users WHERE id = ?', [decoded.id]);
        const dbSession = user ? user.current_session_id : 'USER_NOT_FOUND';

        console.log(`[TraceAuth] User: ${decoded.username || decoded.id}, TokenSession: ${decoded.sessionId}, DBSession: ${dbSession}`);

        // Single Session Enforcement
        // SKIP for admins to allow multiple people to manage the portal simultaneously using the same account
        if (decoded.role !== 'admin' && decoded.sessionId && dbSession && dbSession !== decoded.sessionId) {
            // CRITICAL FIX: Allow submission requests to pass even if session mismatch occurs
            // This prevents data loss when a student's session is auto-terminated/expired
            if (req.originalUrl.includes('/api/submissions') || req.path.includes('/submissions')) {
                console.warn(`[Auth] ALLOWING session mismatch for submission from user ${decoded.id}.`);
            } else {
                console.warn(`[Auth] Session mismatch for user ${decoded.id}. Token session: ${decoded.sessionId}, DB session: ${dbSession}`);
                return res.status(401).json({ error: 'Session expired. You have logged in from another location.' });
            }
        }

        next();
    } catch (err) {
        console.error(`[Auth] Token verification failed for ${req.path}:`, err.message);
        return res.status(403).json({ error: 'Invalid or expired token' });
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
