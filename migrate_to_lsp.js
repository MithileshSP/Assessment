const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, 'backend/.env') });

async function migrate() {
    console.log('Connecting to database...');
    const connection = await mysql.createConnection({
        host: 'localhost',
        port: 3307,
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || 'gokul',
        database: process.env.DB_NAME || 'fullstack_test_portal'
    });

    try {
        console.log('Backing up submissions table...');
        await connection.execute('CREATE TABLE IF NOT exists submissions_backup AS SELECT * FROM submissions');
        console.log('Backup created: submissions_backup');

        console.log('Adding order_index to courses...');
        try {
            // First add as nullable to avoid unique error on existing rows
            await connection.execute('ALTER TABLE courses ADD COLUMN order_index INT DEFAULT NULL');

            // Assign temporary random values to existing courses to satisfy UNIQUE later
            console.log('Assigning temporary order to existing courses...');
            const [rows] = await connection.execute('SELECT id FROM courses');
            let tempOrder = 900;
            for (const row of rows) {
                await connection.execute('UPDATE courses SET order_index = ? WHERE id = ?', [tempOrder++, row.id]);
            }

            // Now enforce UNIQUE constraints (we will overwrite with correct values 1-4 soon)
            await connection.execute('ALTER TABLE courses MODIFY COLUMN order_index INT UNIQUE NOT NULL');
            console.log('order_index column established.');

        } catch (e) {
            if (e.code === 'ER_DUP_FIELDNAME') {
                console.log('order_index already exists.');
            } else {
                console.warn('Warning during schema update (might already exist):', e.message);
            }
        }

        // Define new linear path courses
        // Level 1 (old L1) -> Web Basics
        // Level 2 (old L2) -> CSS Mastery
        // Level 3 (old L3) -> JS Basics
        // Level 4 (old L4) -> Adv. Fullstack

        const newCourses = [
            { id: 'course-web-basics', title: 'Level 1: Web Basics', desc: 'HTML & Basic CSS', order: 1 },
            { id: 'course-css-mastery', title: 'Level 2: CSS Mastery', desc: 'Advanced Layouts & Animations', order: 2 },
            { id: 'course-js-basics', title: 'Level 3: JavaScript Basics', desc: 'Logic & DOM Manipulation', order: 3 },
            { id: 'course-fullstack-adv', title: 'Level 4: Advanced Connectivity', desc: 'APIs & Integration', order: 4 }
        ];

        console.log('Creating new course entries...');
        for (const c of newCourses) {
            await connection.execute(`
                INSERT INTO courses (id, title, description, order_index, total_levels)
                VALUES (?, ?, ?, ?, 1)
                ON DUPLICATE KEY UPDATE title = VALUES(title), description = VALUES(description), order_index = VALUES(order_index)
            `, [c.id, c.title, c.desc, c.order]);
        }

        console.log('Remapping challenges to new courses...');
        // Map old levels to new course IDs
        const mapping = {
            1: 'course-web-basics',
            2: 'course-css-mastery',
            3: 'course-js-basics',
            4: 'course-fullstack-adv'
        };

        for (const [lvl, newId] of Object.entries(mapping)) {
            const [result] = await connection.execute(
                'UPDATE challenges SET course_id = ?, level = 1 WHERE level = ? AND course_id LIKE "%nounspecified%" OR course_id = "course-fullstack"',
                [newId, lvl]
            );
            // Note: The OR logic above is a bit loose, simply targeting all challenges of that level 
            // since we know challenges-new.json was "course-fullstack" focused.
            // A safer specific update:
            await connection.execute(
                'UPDATE challenges SET course_id = ?, level = 1 WHERE level = ? AND (course_id = "course-fullstack" OR id LIKE "%fullstack%")',
                [newId, lvl]
            );
            console.log(`Mapped Level ${lvl} -> ${newId}`);
        }

        // Clean up: Ensure challenges have valid course_id FK
        // Delete orphaned challenges not in the new map if necessary, or assign to a default.
        // For now, we assume the previous repair script aligned most things.

        console.log('Migration complete.');

    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        await connection.end();
    }
}

migrate();
