const express = require("express");
const router = express.Router();
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const UserModel = require("../models/User");
const { OAuth2Client } = require("google-auth-library");
const jwt = require("jsonwebtoken");
require("dotenv").config();


const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const usersPath = path.join(__dirname, "../data/users.json");
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

const saveJSON = (filePath, data) => {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error(`Error saving ${filePath}:`, error.message);
    return false;
  }
};

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
      user = await UserModel.findByUsername(username);
    } catch (dbLookupError) {
      console.warn(
        "DB lookup error, fallback to JSON file:",
        dbLookupError.message
      );
      const users = loadJSON(usersPath);
      // Find the MOST RECENT entry for this username (latest created_at)
      const userMatches = users.filter((u) => u.username === username);
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
        const userId = await UserModel.create(newUser);
        user = await UserModel.findById(userId);
      } catch (dbCreateError) {
        console.warn(
          "DB create error, persisting to JSON file:",
          dbCreateError.message
        );
        const users = loadJSON(usersPath);
        users.push({
          ...newUser,
          created_at:
            newUser.created_at instanceof Date
              ? newUser.created_at.toISOString()
              : newUser.created_at,
          last_login:
            newUser.last_login instanceof Date
              ? newUser.last_login.toISOString()
              : newUser.last_login,
        });
        saveJSON(usersPath, users);
        user = newUser;
      }
    } else {
      try {
        await UserModel.update(user.id, { last_login: new Date() });
        user = await UserModel.findById(user.id);
      } catch (dbUpdateError) {
        console.log(
          "DB update failed, updating JSON fallback:",
          dbUpdateError.message
        );
        const users = loadJSON(usersPath);
        const userIndex = users.findIndex((u) => u.id === user.id);
        if (userIndex !== -1) {
          users[userIndex].last_login = new Date().toISOString();
          saveJSON(usersPath, users);
        }
      }
    }

    const jwtSecret = process.env.JWT_SECRET;
    const payloadForToken = {
      id: user.id,
      username: user.username,
      role: user.role,
    };

    const appToken = jwtSecret
      ? jwt.sign(payloadForToken, jwtSecret, { expiresIn: "7d" })
      : generateToken();

    res.json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.fullName || user.full_name || name,
        role: user.role,
        picture: user.picture || picture,
      },
      token: appToken,
    });
  } catch (error) {
    console.error("Google Sign-In Error:", error);
    res.status(401).json({ error: "Invalid Google token" });
  }
});



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

    const hashedPassword = hashPassword(password);
    if (user.password !== hashedPassword) {
      return res.status(401).json({ error: "Invalid username or password" });
    }

    // Generate token
    const token = generateToken();

    // Update last login (try database, fallback to JSON)
    try {
      await UserModel.update(user.id, { last_login: new Date() });
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
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.fullName || user.full_name,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Login failed" });
  }
});


module.exports = router;