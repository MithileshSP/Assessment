require('dotenv').config();
const db = require('./database/connection');

async function testSmart() {
    try {
        const unassignedSubmissions = await db.query(`
      SELECT s.id 
      FROM submissions s
      LEFT JOIN submission_assignments sa ON s.id = sa.submission_id
      WHERE s.status IN ('pending', 'queued') AND sa.id IS NULL
      ORDER BY s.submitted_at ASC
    `);
        console.log("Unassigned:", unassignedSubmissions.length);

        const availableFaculty = await db.query(`
      SELECT u.id, u.max_capacity,
        (SELECT COUNT(*) FROM submission_assignments sa WHERE sa.faculty_id = u.id AND sa.status = 'pending') as current_load
      FROM users u
      WHERE u.role = 'faculty' AND u.is_available = TRUE
      HAVING current_load < u.max_capacity
      ORDER BY current_load ASC
    `);
        console.log("Available Faculty:", availableFaculty.length);

        // 3. Smart distribution: always assign to least-loaded faculty
        let assignedCount = 0;
        const loadTracker = {};
        availableFaculty.forEach(f => { loadTracker[f.id] = f.current_load; });

        console.log("Testing transaction:");
        await db.transaction(async (conn) => {
            console.log("Inside transaction, conn exists:", !!conn);
            for (const sub of unassignedSubmissions) {
                let bestFaculty = null;
                let minLoad = Infinity;
                for (const f of availableFaculty) {
                    const load = loadTracker[f.id] || 0;
                    if (load < f.max_capacity && load < minLoad) {
                        minLoad = load;
                        bestFaculty = f;
                    }
                }

                if (!bestFaculty) break;

                console.log(`Assigning sub ${sub.id} to faculty ${bestFaculty.id}`);

                await conn.execute(
                    `INSERT INTO submission_assignments (submission_id, faculty_id, assigned_at, status) 
                 VALUES (?, ?, NOW(), 'pending')
                 ON DUPLICATE KEY UPDATE faculty_id = VALUES(faculty_id), assigned_at = NOW()`,
                    [sub.id, bestFaculty.id]
                );

                // Mock logAssignment
                const sql = `INSERT INTO assignment_logs (submission_id, action_type, from_faculty_id, to_faculty_id, admin_id, notes) VALUES (?, ?, ?, ?, ?, ?)`;
                const params = [sub.id, 'auto_assign', null, bestFaculty.id, 1, 'Bulk smart auto-assign'];
                if (conn && conn.execute) {
                    await conn.execute(sql, params);
                } else {
                    console.log("conn.execute NOT FOUND in logAssignment");
                }

                loadTracker[bestFaculty.id] = (loadTracker[bestFaculty.id] || 0) + 1;
                assignedCount++;
            }
        });

        console.log("Transaction finished successfully, assigned:", assignedCount);
        process.exit(0);
    } catch (e) {
        console.error("Test Error:", e);
        process.exit(1);
    }
}

// Wait for DB to be connected since connection.js is async
setTimeout(testSmart, 2000);
