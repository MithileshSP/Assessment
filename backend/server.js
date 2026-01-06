/**
 * Backend Server Entry Point
 * Express server with CORS, routes, and middleware setup
 */

// Load environment variables
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const helmet = require("helmet");
const compression = require("compression");
const rateLimit = require("express-rate-limit");
const morgan = require("morgan");

// Import routes
const challengesRouter = require("./routes/challenges");
const submissionsRouter = require("./routes/submissions");
const evaluationRouter = require("./routes/evaluation");
const adminRouter = require("./routes/admin");
const coursesRouter = require("./routes/courses");
const usersRouter = require("./routes/users");
const levelCompletionRouter = require("./routes/levelCompletion");
const assetsRouter = require("./routes/assets");
const testSessionsRouter = require("./routes/testSessions");
const { scheduleFallbackSync } = require("./services/submissionSync");

const app = express();
const PORT = process.env.PORT || 5000;

// Create necessary directories for static files
const screenshotsDir = path.join(__dirname, "screenshots");
const assetsDir = path.join(__dirname, "assets");

// Static file serving BEFORE security middleware (to set custom CORS headers)
app.use("/screenshots", express.static(screenshotsDir, {
  setHeaders: function (res, path, stat) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  }
}));

app.use("/assets", (req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  next();
}, express.static(assetsDir));

// Security: Helmet for security headers (after static files)
app.use((req, res, next) => {
  // Skip Helmet for static file routes to allow custom CORS
  if (req.path.startsWith('/screenshots') || req.path.startsWith('/assets')) {
    return next();
  }
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: false,
    crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
  })(req, res, next);
});

// Compression for better performance
app.use(compression());

// Logging
if (process.env.NODE_ENV === "production") {
  app.use(morgan("combined")); // Apache-style logs
} else {
  app.use(morgan("dev")); // Colored dev logs
}

// Rate limiting to prevent abuse
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Increased limit for admin bulk operations
  message: "Too many requests from this IP, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiter to all API routes
app.use("/api/", limiter);

// Stricter rate limit for authentication endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5, // 5 requests per 15 minutes
  message: "Too many login attempts, please try again later.",
});

app.use("/api/auth/google", authLimiter);
app.use("/api/auth/login", authLimiter);

// CORS Configuration for production
const defaultOrigins = [
  "*",
  "http://localhost:3000",
  "http://localhost:5173",
  "http://localhost:80",
  "http://localhost:100",
  "http://192.168.10.5:100",
  "http://192.168.10.5:7000",
];
const allowedOrigins = (
  process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(",")
    : defaultOrigins
).map((origin) => origin.trim().replace(/\/$/, "")); // normalize to compare consistently

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);

    const isLocalhostOrigin =
      origin.startsWith("http://localhost") ||
      origin.startsWith("https://localhost") ||
      origin.startsWith("http://127.0.0.1") ||
      origin.startsWith("https://127.0.0.1") ||
      origin.startsWith("http://192.168");

    const normalizedOrigin = origin.replace(/\/$/, "");

    if (
      allowedOrigins.indexOf(normalizedOrigin) !== -1 ||
      isLocalhostOrigin ||
      process.env.NODE_ENV !== "production"
    ) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json({ limit: "50mb" })); // Increased to 50mb
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Trust proxy (important for rate limiting behind reverse proxy)
app.set("trust proxy", 1);

// Health check endpoint with database status
app.get("/health", async (req, res) => {
  const db = require("./database/connection");
  const health = {
    status: "OK",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || "development",
    database: "disconnected",
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + "MB",
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + "MB",
    },
  };

  try {
    if (db.isConnected()) {
      await db.query("SELECT 1");
      health.database = "connected";
    }
  } catch (error) {
    health.database = "error: " + error.message;
    health.status = "DEGRADED";
  }

  // Always return 200 for Docker health check - app is running even if DB is slow to connect
  res.status(200).json(health);
});

// API Routes
app.use("/api/courses", coursesRouter);
app.use("/api/challenges", challengesRouter);
app.use("/api/submissions", submissionsRouter);
app.use("/api/evaluate", evaluationRouter);
app.use("/api/auth", usersRouter);
app.use("/api/users", usersRouter);
app.use("/api/admin", adminRouter);
app.use("/api/level-completion", levelCompletionRouter);
app.use("/api/assets", assetsRouter);
app.use("/api/test-sessions", testSessionsRouter);
const levelAccessRouter = require("./routes/levelAccess");
app.use("/api/level-access", levelAccessRouter);

// Serve frontend static files (optional fallback if frontend container is unavailable)
// In production with separate frontend container, this warning can be safely ignored
const frontendDistPath = [
  path.join(__dirname, "public"),
  path.join(__dirname, "frontend/dist"),
  path.resolve(__dirname, "../frontend/dist")
].find(p => fs.existsSync(p));

console.log("📂 Checking for frontend files...");
[
  path.join(__dirname, "public"),
  path.join(__dirname, "frontend/dist"),
  path.resolve(__dirname, "../frontend/dist")
].forEach(p => console.log(`   - checking ${p}: ${fs.existsSync(p) ? "FOUND" : "MISSING"}`));

console.log("📂 frontendDistPath value:", frontendDistPath);
console.log("📂 frontendDistPath exists?:", fs.existsSync(frontendDistPath));

if (frontendDistPath && fs.existsSync(frontendDistPath)) {
  console.log("✅ Serving frontend from:", frontendDistPath);
  app.use(express.static(frontendDistPath));

  // Handle client-side routing - serve index.html for non-API routes
  app.get("*", (req, res, next) => {
    // Skip API routes, screenshots, assets, and health check
    if (
      req.path.startsWith("/api") ||
      req.path.startsWith("/screenshots") ||
      req.path.startsWith("/assets") ||
      req.path === "/health"
    ) {
      return next();
    }
    res.sendFile(path.join(frontendDistPath, "index.html"));
  });
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Error:", err.message);

  // Don't leak sensitive error details in production
  const isDev = process.env.NODE_ENV === "development";

  res.status(err.status || 500).json({
    error: isDev ? err.message : "Internal Server Error",
    ...(isDev && { stack: err.stack }),
    ...(err.code && { code: err.code }),
  });
});

// 404 handler for API routes
app.use("/api/*", (req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV}`);
  console.log(`\n📁 API Endpoints:`);
  console.log(`   GET  /api/challenges`);
  console.log(`   POST /api/submissions`);
  console.log(`   POST /api/evaluate`);
  console.log(`   POST /api/auth/login`);
  // Background sync to ensure JSON fallback submissions are persisted to MySQL when available
  // DISABLED FOR PRODUCTION - Comment out to enable demo data syncing
  // scheduleFallbackSync();
});

module.exports = app;
// Forced restart with fix for undefined params
