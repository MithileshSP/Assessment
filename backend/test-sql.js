const mysql = require("mysql2/promise");
require("dotenv").config();

async function testSQL() {
    const isProduction = process.env.NODE_ENV === "production";
    const dbConfig = {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME || process.env.DB_DATABASE || "fullstack_test_portal",
    };

    try {
        const connection = await mysql.createConnection(dbConfig);
        console.log("Connected to DB");

        const [availableFaculty] = await connection.query(`
      SELECT u.id, u.max_capacity,
        (SELECT COUNT(*) FROM submission_assignments sa WHERE sa.faculty_id = u.id AND sa.status = 'pending') as current_load
      FROM users u
      WHERE u.role = 'faculty' AND u.is_available = TRUE
      HAVING current_load < u.max_capacity
      ORDER BY current_load ASC
    `);

        console.log("Faculty Available:", availableFaculty);

        // Testing unassigned logic
        const [unassignedSubmissions] = await connection.query(`
      SELECT s.id 
      FROM submissions s
      LEFT JOIN submission_assignments sa ON s.id = sa.submission_id
      WHERE s.status IN ('pending', 'queued') AND sa.id IS NULL
      ORDER BY s.submitted_at ASC
    `);

        console.log("Unassigned Submissions:", unassignedSubmissions.length);
        connection.end();
    } catch (e) {
        console.error("Test Error:", e);
    }
}

testSQL();
