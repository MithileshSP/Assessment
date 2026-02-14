const express = require("express");
const router = express.Router();
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const multer = require("multer");
const csv = require("csv-parser");
const { v4: uuidv4 } = require('uuid');
const UserModel = require("../models/User");
const { query } = require("../database/connection");
const { OAuth2Client } = require("google-auth-library");
const jwt = require("jsonwebtoken");
const { verifyAdmin, verifyToken } = require("../middleware/auth");
require("dotenv").config();

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Path to JSON users file
const usersPath = path.join(__dirname, "../data/users.json");

// Helper to load JSON files
const loadJSON = (filePath) => {
  try {
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, "utf8");
      return JSON.parse(data);
    }
    return [];
  } catch (error) {
    console.error(`Error loading ${filePath}:`, error.message);
    return [];
  }
};

// Helper to save JSON files
const saveJSON = (filePath, data) => {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error(`Error saving ${filePath}:`, error.message);
    return false;
  }
};

// Configure multer for CSV uploads
const upload = multer({ dest: "uploads/" });

function hashPassword(password) {
  return crypto.createHash("sha256").update(password).digest("hex");
}

function generateToken() {
  return crypto.randomBytes(32).toString("hex");
}

// Google OAuth login
router.post("/google", async (req, res) => {
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({ error: "Google token is required" });
  }

  try {
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const email = payload?.email;
    const name =
      payload?.name ||
      `${payload?.given_name || ""} ${payload?.family_name || ""}`.trim();
    const picture = payload?.picture;

    if (!email) {
      return res
        .status(400)
        .json({ error: "Google account email is required" });
    }

    const username = email.split("@")[0];

    let user;
    try {
      // 1. Primary lookup: by email (essential for CSV mapping)
      user = await UserModel.findByEmail(email);

      // 2. Secondary lookup: by username (fallback)
      if (!user) {
        user = await UserModel.findByUsername(username);
      }
    } catch (dbLookupError) {
      console.warn(
        "DB lookup error, fallback to JSON file:",
        dbLookupError.message
      );
      const users = loadJSON(usersPath);
      // Find the MOST RECENT entry for this username OR email
      const userMatches = users.filter((u) => u.email === email || u.username === username);
      if (userMatches.length > 0) {
        user = userMatches.reduce((latest, current) => {
          const latestTime = new Date(latest.created_at || 0).getTime();
          const currentTime = new Date(current.created_at || 0).getTime();
          return currentTime > latestTime ? current : latest;
        });
      }
    }

    if (!user) {
      const newUser = {
        id: `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        username,
        password: null,
        email,
        full_name: name || username,
        role: "student",
        created_at: new Date(),
        last_login: new Date(),
        picture,
      };

      try {
        const createdUser = await UserModel.create(newUser);
        user = createdUser || (await UserModel.findById(newUser.id));
      } catch (dbCreateError) {
        console.warn(
          "DB create error, persisting to JSON file:",
          dbCreateError.message
        );
        const users = loadJSON(usersPath);
        users.push({
          ...newUser,
          created_at: newUser.created_at.toISOString(),
          last_login: newUser.last_login.toISOString(),
        });
        saveJSON(usersPath, users);
        user = newUser;
      }
    } else {
      try {
        // Update user metadata from Google
        const updates = { last_login: new Date() };
        if (picture && !user.picture) updates.picture = picture;
        if (name && (!user.full_name || user.full_name === user.username)) updates.full_name = name;

        await UserModel.update(user.id, updates);

        // Refresh local user object
        user = await UserModel.findById(user.id);
      } catch (dbUpdateError) {
        console.log("DB update failed during Google login:", dbUpdateError.message);
      }
    }

    const jwtSecret = process.env.JWT_SECRET || 'fallback_secret';

    // Generate unique session ID for single-session enforcement
    const sessionId = uuidv4();
    try {
      // For admins, we want to allow multiple sessions, so we don't strictly enforce a single session ID 
      // in the DB (or rather, we update it but auth middleware skips the check). 
      // Actually, if we update it here, the auth middleware check (session === dbSession) would fail 
      // for the OLD session if we didn't skip it in auth.js. 
      // Since we skip it in auth.js, updating it here is fine, but let's be safe.
      await query('UPDATE users SET current_session_id = ? WHERE id = ?', [sessionId, user.id]);
    } catch (e) {
      console.warn('[Google Login] Failed to set session ID:', e.message);
    }

    const payloadForToken = {
      id: user.id,
      username: user.username,
      role: user.role,
      sessionId, // Include session ID in JWT
    };

    const appToken = jwt.sign(payloadForToken, jwtSecret, { expiresIn: '7d' });

    // Set HttpOnly cookie
    const isLocalhost = req.headers.host && req.headers.host.includes('localhost');
    res.cookie('authToken', appToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production' && !isLocalhost,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.json({
      message: "Google login successful",
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.fullName || user.full_name || name,
        rollNo: user.rollNo || user.roll_no,
        role: user.role,
        picture: user.picture || picture,
      },
      // Keep token in response for backward compatibility during migration, but frontend should prioritize cookie
      token: appToken,
    });
  } catch (error) {
    console.error("Google Sign-In Error:", error);
    res.status(401).json({ error: "Invalid Google token" });
  }
});

// verifyAdmin is imported from ../middleware/auth

// User Login
router.post("/login", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res
      .status(400)
      .json({ error: "Username and password are required" });
  }

  try {
    let user;

    // Try database first
    try {
      user = await UserModel.findByUsername(username);
    } catch (dbError) {
      console.log(
        "Database error, using JSON file for login:",
        dbError.message
      );
      // Fallback to JSON file
      const users = loadJSON(usersPath);
      user = users.find((u) => u.username === username);
    }

    if (!user) {
      return res.status(401).json({ error: "Invalid username or password" });
    }

    // Verify password using the improved model (handles sha256 vs bcrypt)
    const isPasswordValid = UserModel.verifyPassword(password, user.password, user.password_version);

    if (!isPasswordValid) {
      return res.status(401).json({ error: "Invalid username or password" });
    }

    // Lazy Migration: If password is sha256, upgrade it to bcrypt now
    if (user.password_version === 'sha256') {
      console.log(`[Auth] Upgrading password for user ${user.username} to bcrypt...`);
      try {
        await UserModel.update(user.id, {
          password: password // UserModel.update will handle salting
        });
      } catch (upgradeError) {
        console.warn(`[Auth] Failed to upgrade password for ${user.username}:`, upgradeError.message);
      }
    }

    // Generate unique session ID for single-session enforcement
    const sessionId = uuidv4();
    const jwtSecret = process.env.JWT_SECRET || 'fallback_secret';
    const payloadForToken = {
      id: user.id,
      username: user.username,
      role: user.role,
      sessionId, // Include session ID in JWT
    };

    const token = jwt.sign(payloadForToken, jwtSecret, { expiresIn: '7d' });

    // Set HttpOnly cookie
    const isLocalhost = req.headers.host && req.headers.host.includes('localhost');
    res.cookie('authToken', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production' && !isLocalhost,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    // Update session ID in DB
    try {
      await query('UPDATE users SET current_session_id = ? WHERE id = ?', [sessionId, user.id]);
    } catch (e) {
      console.warn('[Login] Failed to set session ID:', e.message);
    }

    // Update last login (try database, fallback to JSON)
    try {
      if (UserModel.updateLastLogin) {
        await UserModel.updateLastLogin(user.id);
      } else {
        await UserModel.update(user.id, { last_login: new Date() });
      }
    } catch (dbError) {
      console.log("Database error, updating JSON file:", dbError.message);
      const users = loadJSON(usersPath);
      const userIndex = users.findIndex((u) => u.id === user.id);
      if (userIndex !== -1) {
        users[userIndex].lastLogin = new Date().toISOString();
        saveJSON(usersPath, users);
      }
    }

    res.json({
      token, // Backward compatibility
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.fullName || user.full_name,
        rollNo: user.rollNo || user.roll_no,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    console.error(error.stack);
    res.status(500).json({ error: "Login failed", details: error.message });
  }
});

// User Logout
router.post("/logout", verifyToken, async (req, res) => {
  try {
    // Clear the current_session_id in DB to invalidate the session globally
    if (req.user && req.user.id) {
      await query('UPDATE users SET current_session_id = NULL WHERE id = ?', [req.user.id]);
    }

    // Clear the authToken cookie
    const isLocalhost = req.headers.host && req.headers.host.includes('localhost');
    res.clearCookie('authToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production' && !isLocalhost,
      sameSite: 'lax'
    });

    res.json({ message: "Logged out successfully" });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({ error: "Logout failed" });
  }
});

// Get all users (Admin only)
// Get all users (Admin only) - with Pagination
router.get("/", verifyAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const search = req.query.search || '';
    const role = req.query.role || 'all';
    const offset = (page - 1) * limit;

    let users = [];
    let total = 0;

    // Try database first
    try {
      users = await UserModel.findAll({ limit, offset, search, role });
      total = await UserModel.count({ search, role });
    } catch (dbError) {
      console.log(
        "Database error, using JSON file for users:",
        dbError.message
      );
      // Fallback to JSON file (simple client-side like filtering for fallback)
      const allUsers = loadJSON(usersPath);
      let filtered = allUsers;

      if (search) {
        const lowerSearch = search.toLowerCase();
        filtered = filtered.filter(u =>
          (u.username && u.username.toLowerCase().includes(lowerSearch)) ||
          (u.email && u.email.toLowerCase().includes(lowerSearch)) ||
          (u.full_name && u.full_name.toLowerCase().includes(lowerSearch))
        );
      }

      if (role && role !== 'all') {
        filtered = filtered.filter(u => u.role === role);
      }

      total = filtered.length;
      users = filtered.slice(offset, offset + limit);
    }

    // Don't send passwords and convert snake_case to camelCase for frontend
    const safeUsers = users.map(({ password, ...user }) => ({
      ...user,
      fullName: user.fullName || user.full_name,
      rollNo: user.rollNo || user.roll_no,
      isBlocked: user.isBlocked !== undefined ? user.isBlocked : (user.is_blocked !== undefined ? Boolean(user.is_blocked) : true),
      createdAt: user.createdAt || user.created_at,
      lastLogin: user.lastLogin || user.last_login,
    }));

    res.json({
      users: safeUsers,
      pagination: {
        total,
        page,
        totalPages: Math.ceil(total / limit),
        limit
      }
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

// Download sample CSV template (No auth required for sample data)
router.get("/sample-csv", (req, res) => {
  const sampleCsv = `email,fullName,rollNo,username,password,role
john@example.com,John Doe,7376242AD165,johndoe,,student
jane@example.com,Jane Smith,7376241CS452,,,student`;

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=users-sample.csv");
  res.send(sampleCsv);
});

// Get user progress data (Admin only)
router.get("/progress", verifyAdmin, async (req, res) => {
  try {
    const progressData = await query(`
      SELECT 
        up.user_id as userId,
        u.username,
        up.course_id as courseId,
        c.title as courseTitle,
        up.current_level as currentLevel,
        up.completed_levels as completedLevels,
        up.total_points as totalPoints,
        up.last_updated as lastUpdated
      FROM user_progress up
      JOIN users u ON up.user_id = u.id
      JOIN courses c ON up.course_id = c.id
      ORDER BY u.username, c.title
    `);

    // Parse JSON fields
    const formattedData = progressData.map((row) => ({
      ...row,
      completedLevels: JSON.parse(row.completedLevels || "[]"),
    }));

    res.json(formattedData);
  } catch (error) {
    console.error("Error fetching progress:", error);
    res.status(500).json({ error: "Failed to load progress data" });
  }
});

// Get single user
router.get("/:userId", async (req, res) => {
  try {
    const user = await UserModel.findById(req.params.userId);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const { password, ...safeUser } = user;
    // Convert snake_case to camelCase
    safeUser.fullName = safeUser.full_name;
    safeUser.rollNo = safeUser.roll_no;
    safeUser.isBlocked = Boolean(safeUser.is_blocked);
    safeUser.createdAt = safeUser.created_at;
    safeUser.lastLogin = safeUser.last_login;
    delete safeUser.full_name;
    delete safeUser.roll_no;
    delete safeUser.is_blocked;
    delete safeUser.created_at;
    delete safeUser.last_login;

    res.json(safeUser);
  } catch (error) {
    console.error("Error fetching user:", error);
    res.status(500).json({ error: "Failed to fetch user" });
  }
});

// Upload CSV (Admin only) - MUST come before generic POST /
router.post(
  "/upload-csv",
  verifyAdmin,
  (req, res, next) => {
    upload.single("file")(req, res, (err) => {
      if (err) {
        console.error('CSV upload multer error:', err.message);
        return res.status(500).json({ error: `File upload error: ${err.message}` });
      }
      next();
    });
  },
  async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const results = [];
    const errors = [];
    let added = 0;
    let skipped = 0;

    fs.createReadStream(req.file.path)
      .pipe(csv({
        mapHeaders: ({ header }) => header.trim().replace(/^\ufeff/, '')
      }))
      .on("data", (row) => {
        results.push(row);
      })
      .on("end", async () => {
        try {
          for (let index = 0; index < results.length; index++) {
            const row = results[index];
            const lineNum = index + 2; // +2 because CSV header is line 1

            // Derive username from email if missing
            const derivedUsername = row.username || (row.email ? row.email.split("@")[0] : null);

            if (!derivedUsername) {
              errors.push(`Line ${lineNum}: Missing username and no email to derive it from`);
              skipped++;
              continue;
            }

            // Check if email already exists
            if (row.email) {
              const existingByEmail = await UserModel.findByEmail(row.email);
              if (existingByEmail) {
                // If it exists, update it with new info (like rollNo) instead of skipping
                try {
                  await UserModel.update(existingByEmail.id, {
                    full_name: row.fullName || undefined,
                    roll_no: row.rollNo || undefined,
                    username: row.username || undefined
                  });
                  added++;
                  continue;
                } catch (updateError) {
                  errors.push(`Line ${lineNum}: Email "${row.email}" exists, but update failed`);
                  skipped++;
                  continue;
                }
              }
            }

            // Check if username exists
            const existingUser = await UserModel.findByUsername(derivedUsername);
            if (existingUser) {
              errors.push(
                `Line ${lineNum}: Username "${derivedUsername}" already exists`
              );
              skipped++;
              continue;
            }

            // Create user
            const newUser = {
              id: `user-${Date.now()}-${Math.random()
                .toString(36)
                .substr(2, 9)}`,
              username: derivedUsername,
              // Fix: Pass plaintext password, UserModel.create will handle hashing
              password: row.password || null,
              email: row.email || null,
              full_name: row.fullName || "",
              roll_no: row.rollNo || null,
              role: row.role || "student",
              is_blocked: (row.role || "student") === "student",
              created_at: new Date(),
              last_login: null,
            };

            try {
              await UserModel.create(newUser);
              added++;
            } catch (createError) {
              console.error(`Error creating user from CSV (Line ${lineNum}):`, createError.message);
              errors.push(`Line ${lineNum}: Failed to create user - ${createError.message}`);
              skipped++;
            }
          }

          // Clean up uploaded file
          fs.unlinkSync(req.file.path);

          console.log(`CSV processing complete: ${added} added, ${skipped} skipped`);
          res.json({
            added,
            skipped,
            total: results.length,
            errors: errors.length > 0 ? errors : undefined,
          });
        } catch (error) {
          // Clean up uploaded file
          if (fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
          }
          console.error("Error processing CSV:", error);
          res.status(500).json({ error: "Failed to process CSV file" });
        }
      })
      .on("error", (error) => {
        // Clean up uploaded file
        if (req.file && fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
        console.error("CSV parsing error:", error);
        res.status(500).json({ error: "Failed to parse CSV file" });
      });
  }
);

// Bulk unblock users by email (Admin only) - v3.6.0: Pre-Authorization Support
router.post("/bulk-unblock", verifyAdmin, async (req, res) => {
  const { emails, sessionId, immediate } = req.body;

  if (!emails || !Array.isArray(emails) || emails.length === 0) {
    return res.status(400).json({ error: "Invalid emails provided" });
  }

  try {
    let isSessionLive = false;
    let sessionData = null;

    if (sessionId) {
      if (sessionId.toString().startsWith('daily_')) {
        const dailyId = sessionId.split('_')[1];
        sessionData = await queryOne("SELECT * FROM daily_schedules WHERE id = ?", [dailyId]);
        if (sessionData) {
          const now = new Date();
          const today = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
          const startTime = new Date(`${today}T${sessionData.start_time}`);
          const endTime = new Date(`${today}T${sessionData.end_time}`);
          isSessionLive = (now >= startTime && now <= endTime);
        }
      } else {
        sessionData = await queryOne("SELECT * FROM global_test_sessions WHERE id = ?", [sessionId]);
        if (sessionData) {
          const startTime = new Date(sessionData.start_time);
          const endTime = new Date(startTime.getTime() + sessionData.duration_minutes * 60000);
          const now = new Date();
          isSessionLive = (now >= startTime && now <= endTime && sessionData.is_active);
        }
      }
    }

    const testIdentifier = (sessionData && sessionData.course_id && sessionData.level)
      ? `${sessionData.course_id}_${sessionData.level}`
      : 'global';

    const usersToProcess = await query("SELECT id, username FROM users WHERE email IN (?)", [emails]);
    const shouldActivateNow = isSessionLive || immediate || !sessionId;

    for (const user of usersToProcess) {
      if (shouldActivateNow) {
        // Activate immediately
        await UserModel.update(user.id, { is_blocked: false });
        console.log(`[BulkUnblock] Activating user immediately: ${user.username}`);
      } else {
        // Keep blocked, but pre-authorize
        await UserModel.update(user.id, { is_blocked: true });
        console.log(`[BulkUnblock] User scheduled for future session: ${user.username}`);
      }

      if (sessionId) {
        const existing = await queryOne(
          "SELECT id FROM test_attendance WHERE user_id = ? AND test_identifier = ?",
          [user.id, testIdentifier]
        );

        const statusLabel = shouldActivateNow ? 'activated' : 'scheduled';

        if (existing) {
          await query(
            "UPDATE test_attendance SET session_id = ?, status = 'approved', scheduled_status = ?, is_used = 0, locked = 0, locked_at = NULL, locked_reason = ? WHERE id = ?",
            [sessionId, statusLabel, `Admin:${statusLabel}`, existing.id]
          );
        } else {
          await query(
            "INSERT INTO test_attendance (user_id, test_identifier, session_id, status, scheduled_status, locked, violation_count) VALUES (?, ?, ?, 'approved', ?, 0, 0)",
            [user.id, testIdentifier, sessionId, statusLabel]
          );
        }
      }
    }

    res.json({
      success: true,
      message: shouldActivateNow
        ? `Successfully activated ${usersToProcess.length} students`
        : `Successfully scheduled ${usersToProcess.length} students for future session`,
      count: usersToProcess.length
    });
  } catch (error) {
    console.error("Bulk unblock error:", error);
    res.status(500).json({ error: "Failed to process bulk unblock" });
  }
});

// Update user (Admin only)
router.put("/:userId", verifyAdmin, async (req, res) => {
  const { username, password, email, fullName, rollNo, role, isBlocked } = req.body;

  try {
    const user = await UserModel.findById(req.params.userId);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const updates = {};

    // Update fields
    if (username && username !== user.username) {
      // Check if new username exists
      const existingUser = await UserModel.findByUsername(username);
      if (existingUser && existingUser.id !== req.params.userId) {
        return res.status(400).json({ error: "Username already exists" });
      }
      updates.username = username;
    }

    if (password) {
      // Fix: Pass plaintext password, UserModel.update will handle hashing
      updates.password = password;
    }

    if (email !== undefined) updates.email = email;
    if (fullName !== undefined) updates.full_name = fullName;
    if (rollNo !== undefined) updates.roll_no = rollNo;
    if (role !== undefined) updates.role = role;
    if (isBlocked !== undefined) updates.is_blocked = isBlocked;

    await UserModel.update(req.params.userId, updates);
    const updatedUser = await UserModel.findById(req.params.userId);

    const {
      password: _,
      full_name,
      roll_no,
      is_blocked,
      created_at,
      last_login,
      ...safeUser
    } = updatedUser;
    safeUser.fullName = full_name;
    safeUser.rollNo = roll_no;
    safeUser.isBlocked = Boolean(is_blocked);
    safeUser.createdAt = created_at;
    safeUser.lastLogin = last_login;

    res.json(safeUser);
  } catch (error) {
    console.error("Error updating user:", error);
    res.status(500).json({ error: "Failed to update user" });
  }
});

// Toggle user block status (Admin only) - v3.6.0: Pre-Authorization Support
router.patch("/:userId/toggle-block", verifyAdmin, async (req, res) => {
  try {
    const user = await UserModel.findById(req.params.userId);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const { sessionId, immediate } = req.body;
    const GlobalSession = require('../models/GlobalSession');

    // If blocking (currently unblocked -> blocked)
    if (!user.is_blocked) {
      console.log(`[ToggleBlock] Blocking user: ${user.username}`);
      await UserModel.update(req.params.userId, { is_blocked: true });

      // Mark any scheduled attendance as expired
      await query(
        "UPDATE test_attendance SET scheduled_status = 'expired' WHERE user_id = ? AND scheduled_status IN ('scheduled', 'activated')",
        [user.id]
      );

      return res.json({
        success: true,
        isBlocked: true,
        message: "User has been blocked"
      });
    }

    // If unblocking (currently blocked -> checking session status)
    console.log(`[ToggleBlock] Unblock request for: ${user.username}, SessionID: ${sessionId}, Immediate: ${immediate}`);

    if (!sessionId) {
      // No session specified - immediate unblock (emergency/bypass)
      await UserModel.update(req.params.userId, { is_blocked: false });
      return res.json({
        success: true,
        isBlocked: false,
        message: "User has been unblocked (no session specified)"
      });
    }

    // Check if session is currently LIVE
    let isSessionLive = false;
    let sessionData = null;

    if (sessionId.toString().startsWith('daily_')) {
      const dailyId = sessionId.split('_')[1];
      sessionData = await queryOne("SELECT * FROM daily_schedules WHERE id = ?", [dailyId]);

      if (sessionData) {
        const now = new Date();
        const today = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
        const startTime = new Date(`${today}T${sessionData.start_time}`);
        const endTime = new Date(`${today}T${sessionData.end_time}`);
        isSessionLive = (now >= startTime && now <= endTime);
      }
    } else {
      sessionData = await queryOne("SELECT * FROM global_test_sessions WHERE id = ?", [sessionId]);

      if (sessionData) {
        const startTime = new Date(sessionData.start_time);
        const endTime = new Date(startTime.getTime() + sessionData.duration_minutes * 60000);
        const now = new Date();
        isSessionLive = (now >= startTime && now <= endTime && sessionData.is_active);
      }
    }

    const testIdentifier = 'global'; // Universal session support

    // Check for existing attendance record (by user_id + test_identifier, which is the unique key)
    const existing = await queryOne(
      "SELECT id, session_id FROM test_attendance WHERE user_id = ? AND test_identifier = ?",
      [user.id, testIdentifier]
    );

    if (isSessionLive || immediate) {
      // Session is LIVE or immediate flag set - activate now
      console.log(`[ToggleBlock] Session is LIVE or immediate - activating ${user.username}`);
      await UserModel.update(req.params.userId, { is_blocked: false });

      if (existing) {
        await query(
          "UPDATE test_attendance SET session_id = ?, scheduled_status = 'activated', status = 'approved', locked = 0, locked_reason = 'Admin:unblock', is_used = 0 WHERE id = ?",
          [sessionId, existing.id]
        );
      } else {
        await query(
          "INSERT INTO test_attendance (user_id, test_identifier, session_id, status, scheduled_status, locked, violation_count) VALUES (?, ?, ?, 'approved', 'activated', 0, 0)",
          [user.id, testIdentifier, sessionId]
        );
      }

      return res.json({
        success: true,
        isBlocked: false,
        scheduled: false,
        message: "User has been unblocked and activated"
      });
    } else {
      // Session is NOT yet live - schedule for later
      console.log(`[ToggleBlock] Session not live - scheduling ${user.username} for session ${sessionId}`);

      // Keep user blocked, but create/update scheduled attendance record
      if (existing) {
        await query(
          "UPDATE test_attendance SET session_id = ?, scheduled_status = 'scheduled', status = 'approved', locked = 0, locked_reason = 'Admin:scheduled', is_used = 0 WHERE id = ?",
          [sessionId, existing.id]
        );
      } else {
        await query(
          "INSERT INTO test_attendance (user_id, test_identifier, session_id, status, scheduled_status, locked, violation_count) VALUES (?, ?, ?, 'approved', 'scheduled', 0, 0)",
          [user.id, testIdentifier, sessionId]
        );
      }

      return res.json({
        success: true,
        isBlocked: true, // Still blocked until session starts
        scheduled: true,
        message: "User has been scheduled for this session (will be unblocked when session starts)"
      });
    }
  } catch (error) {
    console.error("Error toggling user block status:", error);
    res.status(500).json({ error: "Failed to toggle block status" });
  }
});

// Delete user (Admin only)
router.delete("/:userId", verifyAdmin, async (req, res) => {
  try {
    const user = await UserModel.findById(req.params.userId);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    await UserModel.delete(req.params.userId);
    res.json({ message: "User deleted successfully" });
  } catch (error) {
    console.error("Error deleting user:", error);
    res.status(500).json({ error: "Failed to delete user" });
  }
});

// Mark level as complete
router.post("/complete-level", async (req, res) => {
  try {
    const { userId, courseId, level } = req.body;

    if (!userId || !courseId || !level) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Verify user progress data in DB
    const progressCheck = await query(
      "SELECT * FROM user_progress WHERE user_id = ? AND course_id = ?",
      [userId, courseId]
    );

    let currentCompleted = [];
    let currentLevel = 1;

    if (progressCheck.length > 0) {
      const row = progressCheck[0];
      try {
        currentCompleted = typeof row.completed_levels === 'string'
          ? JSON.parse(row.completed_levels)
          : row.completed_levels || [];
      } catch (e) {
        currentCompleted = [];
      }
      currentLevel = row.current_level || 1;
    } else {
      // Create initial if not exists
      await query(
        "INSERT INTO user_progress (user_id, course_id, current_level, completed_levels, total_points, last_updated) VALUES (?, ?, ?, '[]', 0, NOW())",
        [userId, courseId, 1]
      );
    }

    // Add level if not present
    if (!currentCompleted.includes(level)) {
      currentCompleted.push(level);
      // Sort numeric
      currentCompleted.sort((a, b) => a - b);
    }

    // Next level is current completed + 1, or at least max completed + 1
    const maxCompleted = currentCompleted.length > 0 ? Math.max(...currentCompleted) : 0;
    const nextLevel = Math.max(currentLevel, maxCompleted + 1);

    // Update DB
    await query(
      "UPDATE user_progress SET completed_levels = ?, current_level = ?, last_updated = NOW() WHERE user_id = ? AND course_id = ?",
      [JSON.stringify(currentCompleted), nextLevel, userId, courseId]
    );

    // Also maintain legacy JSON files for backup/backward compatibility 
    // (Existing JSON logic kept below for safety, can be removed accurately if confirmed unused)
    const progressPath = path.join(__dirname, "../data/user-progress.json");
    let progressData = [];
    try {
      if (fs.existsSync(progressPath)) {
        const data = fs.readFileSync(progressPath, "utf8");
        progressData = JSON.parse(data);
      }
    } catch (error) {
      progressData = [];
    }

    // Find or create user progress in JSON
    let userProgress = progressData.find((p) => p.userId === userId);
    if (!userProgress) {
      userProgress = {
        userId,
        courses: [],
      };
      progressData.push(userProgress);
    }

    // Find or create course progress
    let courseProgress = userProgress.courses.find(
      (c) => c.courseId === courseId
    );
    if (!courseProgress) {
      courseProgress = {
        courseId,
        completedLevels: [],
        lastAccessedLevel: level,
      };
      userProgress.courses.push(courseProgress);
    }

    // Add completed level if not already present
    if (!courseProgress.completedLevels.includes(level)) {
      courseProgress.completedLevels.push(level);
      courseProgress.completedLevels.sort((a, b) => a - b);
    }

    // Update last accessed level
    courseProgress.lastAccessedLevel = Math.max(
      courseProgress.lastAccessedLevel || 0,
      level
    );

    // Save progress
    fs.writeFileSync(progressPath, JSON.stringify(progressData, null, 2));

    // Also update user assignments
    const assignmentsPath = path.join(
      __dirname,
      "../data/user-assignments.json"
    );
    let assignments = [];
    try {
      const data = fs.readFileSync(assignmentsPath, "utf8");
      assignments = JSON.parse(data);
    } catch (error) {
      assignments = [];
    }

    const assignmentKey = `${userId}-${courseId}-${level}`;
    const assignment = assignments.find((a) => a.key === assignmentKey);
    if (assignment) {
      assignment.isLevelComplete = true;
      assignment.completedAt = new Date().toISOString();
      fs.writeFileSync(assignmentsPath, JSON.stringify(assignments, null, 2));
    }

    res.json({
      success: true,
      message: "Level marked as complete",
      nextLevel: level + 1,
    });
  } catch (error) {
    console.error("Error completing level:", error);
    res.status(500).json({ error: "Failed to mark level as complete" });
  }
});

// Create new user (Admin only)
router.post("/", verifyAdmin, async (req, res) => {
  const { username, password, email, fullName, rollNo, role = "student" } = req.body;

  if (!username || !password) {
    return res
      .status(400)
      .json({ error: "Username and password are required" });
  }

  try {
    // Check if username exists
    const existingUser = await UserModel.findByUsername(username);
    if (existingUser) {
      return res.status(400).json({ error: "Username already exists" });
    }

    const newUser = {
      id: `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      username,
      // Fix: Pass plaintext password, UserModel.create will handle hashing
      password: password,
      email: email || "",
      full_name: fullName || "",
      roll_no: rollNo || null,
      role: role || "student",
      created_at: new Date(),
      last_login: null,
    };

    const createdUser = await UserModel.create(newUser);

    if (!createdUser) {
      throw new Error("User creation failed in database");
    }

    const {
      password: _,
      full_name,
      roll_no,
      created_at,
      last_login,
      ...safeUser
    } = createdUser;

    safeUser.fullName = full_name;
    safeUser.rollNo = roll_no;
    safeUser.createdAt = created_at;
    safeUser.lastLogin = last_login;

    res.status(201).json(safeUser);
  } catch (error) {
    console.error("Error creating user:", error);
    res.status(500).json({ error: "Failed to create user: " + error.message });
  }
});

// Bulk complete levels for students by email or roll number (Admin only)
router.post("/bulk-complete", verifyAdmin, async (req, res) => {
  const { identifiers, courseId, level, type } = req.body;

  if (!identifiers || !Array.isArray(identifiers) || identifiers.length === 0) {
    return res.status(400).json({ error: "Invalid identifiers provided" });
  }

  if (!courseId || !level) {
    return res.status(400).json({ error: "courseId and level are required" });
  }

  const results = {
    success: [],
    failed: [],
    skipped: []
  };

  try {
    for (const identifier of identifiers) {
      if (!identifier) continue;
      const cleanIdentifier = identifier.trim();

      try {
        let user = null;
        const lowerId = cleanIdentifier.toLowerCase();

        // 1. Primary DB lookup with high flexibility
        if (type === 'rollNo') {
          user = await queryOne(
            "SELECT id, username, email, full_name, roll_no, role FROM users WHERE roll_no = ? OR username = ? OR email = ?",
            [cleanIdentifier, cleanIdentifier, cleanIdentifier]
          );
        } else {
          user = await queryOne(
            "SELECT id, username, email, full_name, roll_no, role FROM users WHERE email = ? OR username = ? OR roll_no = ?",
            [cleanIdentifier, cleanIdentifier, cleanIdentifier]
          );

          // Deep search if direct match fails (case-insensitive fallback)
          if (!user) {
            user = await queryOne(
              "SELECT id, username, email, full_name, roll_no, role FROM users WHERE LOWER(email) = ? OR LOWER(username) = ?",
              [lowerId, lowerId]
            );
          }
        }

        // 2. Fallback to JSON with sync
        if (!user) {
          const allUsers = loadJSON(usersPath);
          const jsonUser = allUsers.find(u =>
            (u.email && u.email.toLowerCase() === lowerId) ||
            (u.username && u.username.toLowerCase() === lowerId) ||
            (u.roll_no === cleanIdentifier || u.rollNo === cleanIdentifier)
          );

          if (jsonUser) {
            console.log(`[Bulk Sync] User ${cleanIdentifier} found in JSON. Syncing to DB...`);
            try {
              // Ensure we don't have a partial conflict in DB
              const existingByAny = await queryOne(
                "SELECT id FROM users WHERE username = ? OR email = ?",
                [jsonUser.username, jsonUser.email]
              );

              if (existingByAny) {
                user = await UserModel.findById(existingByAny.id);
              } else {
                user = await UserModel.create({
                  ...jsonUser,
                  fullName: jsonUser.fullName || jsonUser.full_name,
                  rollNo: jsonUser.rollNo || jsonUser.roll_no,
                  isBlocked: false
                });
              }
            } catch (syncErr) {
              console.error(`[Bulk Sync] Failed to sync ${cleanIdentifier}:`, syncErr.message);
              results.failed.push({ identifier: cleanIdentifier, reason: `DB Sync failed: ${syncErr.message}` });
              continue;
            }
          }
        }

        if (!user) {
          results.failed.push({ identifier: cleanIdentifier, reason: "User signature not found in system (DB/JSON check failed)" });
          continue;
        }

        // 1. Update user_progress in Database
        const progressCheck = await query(
          "SELECT completed_levels, current_level FROM user_progress WHERE user_id = ? AND course_id = ?",
          [user.id, courseId]
        );

        let currentCompleted = [];
        let currentLevel = 1;

        if (progressCheck.length > 0) {
          const row = progressCheck[0];
          try {
            currentCompleted = typeof row.completed_levels === 'string'
              ? JSON.parse(row.completed_levels)
              : row.completed_levels || [];
          } catch (e) {
            currentCompleted = [];
          }
          currentLevel = row.current_level || 1;
        } else {
          // Create initial if not exists
          await query(
            "INSERT INTO user_progress (user_id, course_id, current_level, completed_levels, total_points, last_updated) VALUES (?, ?, ?, '[]', 0, NOW())",
            [user.id, courseId, 1]
          );
        }

        const levelInt = parseInt(level);
        if (!currentCompleted.includes(levelInt)) {
          currentCompleted.push(levelInt);
          currentCompleted.sort((a, b) => a - b);
        }

        const nextLevel = Math.max(currentLevel, levelInt + 1);

        await query(
          "UPDATE user_progress SET completed_levels = ?, current_level = ?, last_updated = NOW() WHERE user_id = ? AND course_id = ?",
          [JSON.stringify(currentCompleted), nextLevel, user.id, courseId]
        );

        // 2. Insert into level_completions
        await query(
          "INSERT INTO level_completions (user_id, course_id, level, total_score, passed, feedback, completed_at) VALUES (?, ?, ?, 100, 1, 'Bulk cleared by admin', NOW())",
          [user.id, courseId, levelInt]
        );

        // 3. Unlock Level Access - non-blocking for success manifest 
        try {
          await query(
            `INSERT INTO level_access (user_id, course_id, level, is_locked, unlocked_at) 
             VALUES (?, ?, ?, 0, NOW()) 
             ON DUPLICATE KEY UPDATE is_locked = 0, unlocked_at = NOW()`,
            [user.id, courseId, nextLevel]
          );
        } catch (accessErr) {
          console.warn(`[Bulk Access] Warning: Could not update level_access for ${user.username}:`, accessErr.message);
        }

        // 4. Update Legacy JSON backup
        const progressPath = path.join(__dirname, "../data/user-progress.json");
        let progressData = loadJSON(progressPath);

        let userProgress = progressData.find((p) => p.userId === user.id);
        if (!userProgress) {
          userProgress = { userId: user.id, courses: [] };
          progressData.push(userProgress);
        }

        let courseProgress = userProgress.courses.find((c) => c.courseId === courseId);
        if (!courseProgress) {
          courseProgress = { courseId, completedLevels: [], lastAccessedLevel: levelInt };
          userProgress.courses.push(courseProgress);
        }

        if (!courseProgress.completedLevels.includes(levelInt)) {
          courseProgress.completedLevels.push(levelInt);
        }
        courseProgress.currentLevel = nextLevel;

        saveJSON(progressPath, progressData);

        results.success.push({ identifier: cleanIdentifier, username: user.username });
      } catch (innerError) {
        console.error(`Error processing bulk completion for ${cleanIdentifier}:`, innerError);
        results.failed.push({ identifier: cleanIdentifier, reason: innerError.message });
      }
    }

    res.json({
      message: "Bulk processing complete",
      results
    });
  } catch (error) {
    console.error("Bulk completion error:", error);
    res.status(500).json({ error: "Failed to process bulk level completion" });
  }
});

// Helper for single row queries
async function queryOne(sql, params) {
  const rows = await query(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

module.exports = router;
module.exports.verifyAdmin = verifyAdmin; // Still export from auth.js reference
