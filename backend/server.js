/**
 * Backend Server Entry Point
 * Express server with CORS, routes, and middleware setup
 */

// Load environment variables
require("dotenv").config();

const router = require("express").Router();
const cors = require("cors");
const bodyParser = require("body-parser");
const path = require("path");
const fs = require("fs");

// Import routes
const challengesRouter = require("./routes/challenges");
const submissionsRouter = require("./routes/submissions");
const evaluationRouter = require("./routes/evaluation");
const adminRouter = require("./routes/admin");
const coursesRouter = require("./routes/courses");
const usersRouter = require("./routes/users");
const levelCompletionRouter = require("./routes/levelCompletion");
const assetsRouter = require("./routes/assets");

const app = express();
const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || "0.0.0.0";

// CORS Configuration for production
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",")
      .map((origin) => origin.trim())
      .filter(Boolean)
  : ["http://localhost:3000", "http://localhost:5173", "http://localhost:80"];
const allowAllOrigins = allowedOrigins.includes("*");

// const corsOptions = {
//   origin: function (origin, callback) {
//     // Allow requests with no origin (mobile apps, Postman, etc.)
//     if (!origin) return callback(null, true);

//     const isLocalhostOrigin =
//       origin.startsWith("http://localhost") ||
//       origin.startsWith("https://localhost") ||
//       origin.startsWith("http://127.0.0.1") ||
//       origin.startsWith("https://127.0.0.1");

//     if (
//       allowAllOrigins ||
//       allowedOrigins.indexOf(origin) !== -1 ||
//       isLocalhostOrigin ||
//       process.env.NODE_ENV !== "production"
//     ) {
//       callback(null, true);
//     } else {
//       callback(new Error("Not allowed by CORS"));
//     }
//   },
//   credentials: true,
//   methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
//   allowedHeaders: ["Content-Type", "Authorization"],
// };
const corsOptions = {
  origin: true,       // allow any origin (phone hotspot IP, LAN IP, localhost)
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};
// Middleware
app.use(cors(corsOptions));
app.use(bodyParser.json({ limit: "50mb" }));
app.use(bodyParser.urlencoded({ extended: true, limit: "50mb" }));

// Create necessary directories
const screenshotsDir = path.join(__dirname, "screenshots");
const assetsDir = path.join(__dirname, "assets");
if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
}
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}

// Static file serving for screenshots and assets
app.use("/screenshots", express.static(screenshotsDir));
app.use("/assets", express.static(assetsDir));

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "OK", message: "Server is running" });
});

// API Routes
app.use("/api/courses", coursesRouter);
app.use("/api/challenges", challengesRouter);
app.use("/api/submissions", submissionsRouter);
app.use("/api/evaluate", evaluationRouter);
app.use("/api/auth", usersRouter);
app.use("/api/admin", adminRouter);
app.use("/api/level-completion", levelCompletionRouter);
app.use("/api/assets", assetsRouter);

// Serve frontend static files
// In Docker, frontend/dist is copied to the same directory as server.js
// In development, it's in ../frontend/dist
const frontendDistPath = fs.existsSync(path.join(__dirname, "frontend/dist"))
  ? path.join(__dirname, "frontend/dist")
  : path.resolve(__dirname, "../frontend/dist");

if (fs.existsSync(frontendDistPath)) {
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
    if(req.path === "/") {
      console.log("Serving index.html for root path");
    }
    res.sendFile(path.join(frontendDistPath, "index.html"));
  });
} else {
  console.warn(
    "⚠️ Frontend dist folder not found. API will run, but the frontend will not be served."
  );
  console.warn(
    "   To build the frontend, run `npm install && npm run build` in the `frontend` directory."
  );
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Error:", err);
  res.status(err.status || 500).json({
    error: err.message || "Internal Server Error",
    stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
  });
});

// 404 handler for API routes
app.use("/api/*", (req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// Start server
// app.listen(PORT, HOST, () => {
//   console.log(`🚀 Server running on http://${HOST}:${PORT}`);
//   console.log(`📊 Environment: ${process.env.NODE_ENV || "development"}`);
//   console.log(`\n📁 API Endpoints:`);
//   console.log(`   GET  /api/challenges`);
//   console.log(`   POST /api/submissions`);
//   console.log(`   POST /api/evaluate`);
//   console.log(`   POST /api/admin/login`);
// });
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});


module.exports = app;
