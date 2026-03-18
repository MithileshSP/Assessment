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
  connectionLimit: 10, // Optimized for multi-replica deployments (3 Nodes * 10 = 30)
  queueLimit: 0,
  maxIdle: 5,
  idleTimeout: 30000,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  connectTimeout: 10000,
  timezone: '+05:30',
  ...(sslConfig ? { ssl: sslConfig } : {}),
};

const pool = mysql.createPool(dbConfig);
let isConnected = false;

// Test connection with exponential backoff (Max 20 attempts)
async function testConnection(retries = 20, delay = 2000) {
  for (let i = 0; i < retries; i++) {
    try {
      const connection = await pool.getConnection();
      await connection.ping();
      console.log("✅ MySQL Database connected successfully");
      isConnected = true;
      connection.release();
      return true;
    } catch (err) {
      console.error(`❌ MySQL connection attempt ${i + 1} failed: ${err.message}`);
      
      if (i === retries - 1) {
        console.error("⛔ Max DB connection retries reached. System running in DEGRADED mode.");
        isConnected = false;
        return false;
      }

      // Exponential backoff capped at 30s
      const nextDelay = Math.min(delay * Math.pow(1.5, i), 30000);
      console.log(`⏳ Retrying in ${Math.round(nextDelay / 1000)}s...`);
      await new Promise(resolve => setTimeout(resolve, nextDelay));
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

// Circuit Breaker State
const CB_STATE = {
  CLOSED: 'CLOSED',
  OPEN: 'OPEN',
  HALF_OPEN: 'HALF_OPEN'
};

let circuitState = CB_STATE.CLOSED;
let failureCount = 0;
const FAILURE_THRESHOLD = 5;
const COOLDOWN_MS = 30000; // 30 seconds

function tripCircuit() {
  if (circuitState === CB_STATE.OPEN) return;
  console.error("📛 [CircuitBreaker] DB Failure threshold reached. TRIPPING CIRCUIT OPEN.");
  circuitState = CB_STATE.OPEN;
  setTimeout(() => {
    console.log("🟡 [CircuitBreaker] Cooldown finished. Testing circuit (HALF_OPEN).");
    circuitState = CB_STATE.HALF_OPEN;
  }, COOLDOWN_MS);
}

// Helper function to execute queries with Circuit Breaker
async function query(sql, params) {
  if (USE_JSON) {
    throw new Error('Using JSON file storage (USE_JSON=true)');
  }

  if (circuitState === CB_STATE.OPEN) {
    throw new Error('⚡ Circuit Breaker: Database is currently overloaded. Please try again in 30 seconds.');
  }

  try {
    const [rows] = await pool.query(sql, params);
    
    // Reset on success
    if (circuitState === CB_STATE.HALF_OPEN) {
        console.log("✅ [CircuitBreaker] Success in HALF_OPEN. CLOSING CIRCUIT.");
        circuitState = CB_STATE.CLOSED;
        failureCount = 0;
    }
    
    return rows;
  } catch (error) {
    const isDuplicate = error.code === 'ER_DUP_FIELDNAME' ||
      error.errno === 1060 ||
      error.code === 'ER_DUP_INDEX' ||
      error.code === 'ER_DUP_KEYNAME' ||
      error.errno === 1061 ||
      error.code === 'ER_CANT_DROP_FIELD_OR_KEY' ||
      error.errno === 1091;

    if (!isDuplicate) {
      console.error("Database query error:", error);
      failureCount++;
      if (failureCount >= FAILURE_THRESHOLD || circuitState === CB_STATE.HALF_OPEN) {
        tripCircuit();
      }
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
  if (circuitState === CB_STATE.OPEN) {
    throw new Error('⚡ Circuit Breaker: Database overloaded. Transaction aborted.');
  }
  
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
  isCircuitOpen: () => circuitState === CB_STATE.OPEN,
  waitForDB,
  USE_JSON,
};
