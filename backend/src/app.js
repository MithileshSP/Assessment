const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const path = require("path");
const fs = require("fs");

// Import API routes
const challengesRouter = require("./routes/challenges");
const submissionsRouter = require("./routes/submissions");
const evaluationRouter = require("./routes/evaluation");
const adminRouter = require("./routes/admin");
const coursesRouter = require("./routes/courses");
const usersRouter = require("./routes/users");
const levelCompletionRouter = require("./routes/levelCompletion");
const assetsRouter = require("./routes/assets");

const app = express();

// ===== Middleware =====
app.use(morgan("dev")); // Request logging
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Ensure asset folders exist
["screenshots", "assets"].forEach((folder) => {
  const folderPath = path.join(__dirname, folder);
  if (!fs.existsSync(folderPath)) {
    fs.mkdirSync(folderPath, { recursive: true });
  }
});

// Serve uploaded files
app.use("/screenshots", express.static(path.join(__dirname, "screenshots")));
app.use("/assets", express.static(path.join(__dirname, "assets")));

// Health Route
app.get("/health", (_, res) => {
  res.json({ status: "OK", message: "Backend running" });
});

// ===== API Routes =====
app.use("/api/courses", coursesRouter);
app.use("/api/challenges", challengesRouter);
app.use("/api/submissions", submissionsRouter);
app.use("/api/evaluate", evaluationRouter);
app.use("/api/auth", usersRouter);
app.use("/api/admin", adminRouter);
app.use("/api/level-completion", levelCompletionRouter);
app.use("/api/assets", assetsRouter);

// Error Handler
app.use((err, req, res, next) => {
  console.error("🔥 Error:", err);
  res.status(err.status || 500).json({
    error: err.message || "Internal Server Error",
  });
});

// 404 handler for any unregistered API endpoint
app.use("/api/*", (_, res) => {
  res.status(404).json({ error: "API Route not found" });
});

module.exports = app;
