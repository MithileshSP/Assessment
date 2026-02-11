const { query } = require('../database/connection');

class ChallengeAssignment {

    // Create table if not exists (Auto-migration)
    static async createTable() {
        const sql = `
            CREATE TABLE IF NOT EXISTS challenge_assignments (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id VARCHAR(100) NOT NULL,
                course_id VARCHAR(100) NOT NULL,
                level INT DEFAULT 1,
                challenge_id VARCHAR(100) NOT NULL,
                assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                status ENUM('active', 'completed', 'abandoned') DEFAULT 'active',
                INDEX idx_user_course (user_id, course_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `;
        try {
            await query(sql);
            console.log("[ChallengeAssignment] Table verified.");
        } catch (error) {
            console.error("[ChallengeAssignment] Table creation failed:", error);
        }
    }

    // Find active assignment
    static async findCurrent(userId, courseId, level) {
        // Find the most recent ACTIVE assignment
        const rows = await query(
            `SELECT * FROM challenge_assignments 
             WHERE user_id = ? AND course_id = ? AND level = ? AND status = 'active'
             ORDER BY assigned_at DESC LIMIT 1`,
            [userId, courseId, level]
        );
        return rows[0] || null;
    }

    // Assign a new question (Deactivates old ones)
    static async assign(userId, courseId, level, challengeId) {
        // 1. Deactivate previous active assignments for this level
        await query(
            `UPDATE challenge_assignments SET status = 'abandoned' 
             WHERE user_id = ? AND course_id = ? AND level = ? AND status = 'active'`,
            [userId, courseId, level]
        );

        // 2. Create new assignment
        const result = await query(
            `INSERT INTO challenge_assignments (user_id, course_id, level, challenge_id, status)
             VALUES (?, ?, ?, ?, 'active')`,
            [userId, courseId, level, challengeId]
        );

        return result.insertId;
    }

    // Clear active assignment (e.g. force re-randomize)
    static async clear(userId, courseId, level) {
        await query(
            `UPDATE challenge_assignments SET status = 'abandoned' 
             WHERE user_id = ? AND course_id = ? AND level = ? AND status = 'active'`,
            [userId, courseId, level]
        );
    }
}

// Initialize table on load
ChallengeAssignment.createTable();

module.exports = ChallengeAssignment;
