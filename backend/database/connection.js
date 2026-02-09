/**
 * MySQL Database Configuration
 * Connection pool for database operations
 * Falls back to JSON files if MySQL is not available
 */

const fs = require("fs");
const mysql = require("mysql2/promise");

// Check if we should use JSON files instead of MySQL
const isProduction = process.env.NODE_ENV === "production";
const USE_JSON = process.env.USE_JSON === "true" || (!process.env.DB_HOST && !isProduction);

// Helper: normalize inline certificates ("\n" -> newline) or load from file
function loadCertificate(certValue) {
  if (!certValue) return undefined;
  const trimmed = certValue.trim();

  if (trimmed.includes("BEGIN CERTIFICATE")) {
    return trimmed.replace(/\\n/g, "\n");
  }

  try {
    return fs.readFileSync(trimmed, "utf8");
  } catch (error) {
    console.warn(
      `⚠️ Unable to read DB_CA_CERT file at ${trimmed}: ${error.message}`
    );
    return undefined;
  }
}

// Database configuration
const sslCertificate = loadCertificate(process.env.DB_CA_CERT);
const sslConfig = sslCertificate
  ? {
    ca: sslCertificate,
    rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED === "true",
  }
  : undefined;

const dbConfig = {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database:
    process.env.DB_NAME || process.env.DB_DATABASE || "fullstack_test_portal",
  waitForConnections: true,
  connectionLimit: 50, // Increased from 10 for better concurrency (1000+ users)
  queueLimit: 0,
  maxIdle: 10, // Maximum idle connections
  idleTimeout: 60000, // Close idle connections after 60 seconds
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  connectTimeout: 10000, // 10 second connection timeout
  timezone: '+05:30',
  ...(sslConfig ? { ssl: sslConfig } : {}),
};
// console.log("Database configuration:", {
//   host: dbConfig.host,
//   port: dbConfig.port,
//   user: dbConfig.user,
//   database: dbConfig.database,
// });
// Create connection pool
const pool = mysql.createPool(dbConfig);

let isConnected = false;

// Test connection with retries (10 attempts, every 5s = 50s total window)
async function testConnection(retries = 10, delay = 5000) {
  for (let i = 0; i < retries; i++) {
    try {
      // Use a ping to truly test connectivity
      const connection = await pool.getConnection();
      await connection.ping();
      console.log("✅ MySQL Database connected successfully");
      isConnected = true;
      connection.release();
      return true;
    } catch (err) {
      console.error(`❌ MySQL connection attempt ${i + 1} failed:`, err.message);
      if (i === retries - 1) {
        if (isProduction) {
          console.error("FATAL: MySQL is required in production! Shutting down...");
          process.exit(1);
        }
        console.log("📁 Using JSON file storage as fallback");
        isConnected = false;
        return false;
      }
      console.log(`⏳ Retrying in ${delay / 1000}s...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

// Helper to wait for DB readiness
async function waitForDB(timeoutMs = 60000) {
  if (isConnected) return true;
  if (USE_JSON) return false;

  const start = Date.now();
  while (!isConnected && (Date.now() - start < timeoutMs)) {
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  return isConnected;
}

testConnection();

// Helper function to execute queries
async function query(sql, params) {
  if (USE_JSON) {
    throw new Error('Using JSON file storage (USE_JSON=true)');
  }
  try {
    const [rows] = await pool.query(sql, params);
    return rows;
  } catch (error) {
    // Suppress logs for common migration "already exists" errors
    const isDuplicate = error.code === 'ER_DUP_FIELDNAME' ||
      error.errno === 1060 ||
      error.code === 'ER_DUP_INDEX' ||
      error.code === 'ER_DUP_KEYNAME' ||
      error.errno === 1061 ||
      error.code === 'ER_CANT_DROP_FIELD_OR_KEY' ||
      error.errno === 1091;

    if (!isDuplicate) {
      console.error("Database query error:", error);
    }
    throw error;
  }
}

// Helper function to get a single row
async function queryOne(sql, params) {
  const rows = await query(sql, params);
  return rows[0] || null;
}

// Transaction helper
async function transaction(callback) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = {
  pool,
  query,
  queryOne,
  transaction,
  isConnected: () => isConnected,
  waitForDB,
  USE_JSON,
};
