const fs = require('fs');
const path = require('path');

const coursesPath = path.join(__dirname, 'data', 'courses.json');

const syncCourses = async () => {
    try {
        // 1. Load cleaned JSON
        const rawData = fs.readFileSync(coursesPath, 'utf8');
        const fileCourses = JSON.parse(rawData);

        console.log(`[Sync] Loaded ${fileCourses.length} unique courses from cleaned JSON.`);

        // 2. Check DB Status
        // Override DB config for local script execution if needed
        // CRITICAL: Set env vars BEFORE requiring connection module
        if (!process.env.DB_HOST) {
            process.env.DB_HOST = '127.0.0.1';
            process.env.DB_PORT = '3307'; // Docker mapped port
            process.env.DB_USER = 'root';
            process.env.DB_PASSWORD = 'gokul';
            process.env.DB_NAME = 'fullstack_test_portal';
            process.env.USE_JSON = 'false';
        }

        const { query, isConnected } = require('./database/connection');

        try {
            await query("SELECT 1");
            console.log('[Sync] Database connection verify: SUCCESS');
        } catch (e) {
            console.error('[Sync] Database connection verify: FAILED', e.message);
            process.exit(1);
        }

        // 3. Clear existing courses and prepare for insert
        try {
            await query("SET FOREIGN_KEY_CHECKS = 0");
            await query("DELETE FROM courses");
            console.log('[Sync] Cleared existing courses table.');
        } catch (e) {
            console.log('[Sync] Could not clear courses:', e.message);
        }

        // 4. Insert Checked Courses
        let insertedCount = 0;
        for (const c of fileCourses) {
            try {
                // Ensure required fields
                const id = c.id;
                const title = c.title || 'Untitled';
                const description = c.description || '';
                const totalLevels = c.totalLevels || c.total_levels || 1;
                const createdAtRaw = c.createdAt || c.created_at || new Date();
                const createdAt = new Date(createdAtRaw).toISOString().slice(0, 19).replace('T', ' ');

                await query(
                    `INSERT INTO courses 
                    (id, title, description, thumbnail, icon, color, total_levels, estimated_time, difficulty, tags, is_locked, is_hidden, prerequisite_course_id, restrictions, level_settings, passing_threshold, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        id,
                        title,
                        description,
                        c.thumbnail || null,
                        c.icon || '📚',
                        c.color || '#3B82F6',
                        totalLevels,
                        c.estimatedTime || c.estimated_time || '1 hour',
                        c.difficulty || 'Beginner',
                        JSON.stringify(c.tags || []),
                        c.isLocked || c.is_locked || false,
                        c.isHidden || c.is_hidden || false,
                        c.prerequisiteCourseId || c.prerequisite_course_id || null,
                        JSON.stringify(c.restrictions || {}),
                        JSON.stringify(c.levelSettings || c.level_settings || {}),
                        JSON.stringify(c.passingThreshold || c.passing_threshold || { structure: 80, visual: 80, overall: 75 }),
                        createdAt
                    ]
                );
                console.log(`[Sync] Inserted: ${title} (${id})`);
            } catch (err) {
                console.log(`[Sync] ERROR inserting ${c.id}: ${err.message}`);
                console.log('Values:', JSON.stringify([
                    id,
                    title,
                    description,
                    c.thumbnail || null,
                    c.icon || '📚',
                    c.color || '#3B82F6',
                    totalLevels,
                    c.estimatedTime || c.estimated_time || '1 hour',
                    c.difficulty || 'Beginner',
                    JSON.stringify(c.tags || []),
                    c.isLocked || c.is_locked || false,
                    c.isHidden || c.is_hidden || false,
                    c.prerequisiteCourseId || c.prerequisite_course_id || null,
                    JSON.stringify(c.restrictions || {}),
                    JSON.stringify(c.levelSettings || c.level_settings || {}),
                    JSON.stringify(c.passingThreshold || c.passing_threshold || { structure: 80, visual: 80, overall: 75 }),
                    createdAt
                ], null, 2));
            }
        }

        console.log(`[Sync] Completed. ${insertedCount}/${fileCourses.length} synced to Database.`);
        await query("SET FOREIGN_KEY_CHECKS = 1");
        process.exit(0);

    } catch (err) {
        console.error('[Sync] Critical Error:', err);
        process.exit(1);
    }
};

// Wait for connection pool initialization
setTimeout(syncCourses, 1000);
