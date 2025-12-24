
require('dotenv').config();
const mysql = require('mysql2/promise');
const fs = require('fs');

console.log("Checking DB Connection...");
console.log("Host:", process.env.DB_HOST);
console.log("User:", process.env.DB_USER);
console.log("Port:", process.env.DB_PORT);
console.log("Database:", process.env.DB_NAME); // Fixed: DB_NAME (schema name)
console.log("CA Cert defined:", !!process.env.DB_CA_CERT);
if (process.env.DB_CA_CERT) {
    console.log("CA Cert length:", process.env.DB_CA_CERT.length);
    console.log("CA Cert start:", process.env.DB_CA_CERT.substring(0, 50));
}

function loadCertificate(certValue) {
    if (!certValue) return undefined;
    const trimmed = certValue.trim();
    if (trimmed.includes("BEGIN CERTIFICATE")) {
        return trimmed.replace(/\\n/g, "\n");
    }
    return certValue;
}

const sslCertificate = loadCertificate(process.env.DB_CA_CERT);

const config = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || process.env.DB_DATABASE, // Match connection.js logic
    port: process.env.DB_PORT || 3306,
    ssl: sslCertificate ? { ca: sslCertificate, rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED === "true" } : undefined
};

async function test() {
    try {
        const conn = await mysql.createConnection(config);
        console.log("SUCCESS: Connected to database!");
        await conn.end();
    } catch (err) {
        console.error("FAILURE: Could not connect.");
        console.error(err);
    }
}

test();
