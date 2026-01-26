const jwt = require('jsonwebtoken');
const { query } = require('../database/connection');
require('dotenv').config();

const verifyToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
        return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    const token = authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : authHeader;

    if (!token) {
        return res.status(401).json({ error: 'Access denied. Invalid token format.' });
    }

    const jwtSecret = process.env.JWT_SECRET || 'fallback_secret';

    try {
        const decoded = jwt.verify(token, jwtSecret);
        req.user = decoded;

        // Single Session Enforcement: Verify session_id matches DB
        if (decoded.sessionId) {
            try {
                const [user] = await query('SELECT current_session_id FROM users WHERE id = ?', [decoded.id]);
                if (user && user.current_session_id && user.current_session_id !== decoded.sessionId) {
                    console.warn(`[Auth] Session mismatch for user ${decoded.id}. Token session: ${decoded.sessionId}, DB session: ${user.current_session_id}`);
                    return res.status(401).json({ error: 'Session expired. You have logged in from another location.' });
                }
            } catch (dbErr) {
                // If DB check fails, allow request (graceful degradation)
                console.warn('[Auth] Session check DB error:', dbErr.message);
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
