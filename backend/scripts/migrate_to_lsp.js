const { query } = require('../database/connection');
require('dotenv').config({ path: '../.env' });

async function migrate() {
    console.log('Starting LSP Migration...');

    try {
        // 1. Ensure courses table has order_index
        // (Assuming schema is already updated via dbMigration.js, but let's be safe)
        // We skip DDL here and assume column exists.

        // 2. Create New Courses
        const courses = [
            {
                id: 'course-web-basics',
                title: 'Level 1: Web Basics',
                description: 'Master HTML structure and CSS styling fundamentals.',
                difficulty: 'Beginner',
                estimated_time: '2 Hours',
                total_levels: 1, // It is its own level
                order_index: 1,
                thumbnail: '/assets/thumbnails/web-basics.jpg'
            },
            {
                id: 'course-css-mastery',
                title: 'Level 2: CSS Mastery',
                description: 'Advanced layouts, Flexbox, Grid, and Animations.',
                difficulty: 'Intermediate',
                estimated_time: '3 Hours',
                total_levels: 1,
                order_index: 2,
                prerequisite_course_id: 'course-web-basics',
                thumbnail: '/assets/thumbnails/css-mastery.jpg'
            },
            {
                id: 'course-js-essentials',
                title: 'Level 3: JS Essentials',
                description: 'Core JavaScript logic, variables, loops, and functions.',
                difficulty: 'Intermediate',
                estimated_time: '4 Hours',
                total_levels: 1,
                order_index: 3,
                prerequisite_course_id: 'course-css-mastery',
                thumbnail: '/assets/thumbnails/js-essentials.jpg'
            },
            {
                id: 'course-dom-manipulation',
                title: 'Level 4: DOM Manipulation',
                description: 'Interactive web pages using DOM API.',
                difficulty: 'Advanced',
                estimated_time: '4 Hours',
                total_levels: 1,
                order_index: 4,
                prerequisite_course_id: 'course-js-essentials',
                thumbnail: '/assets/thumbnails/dom-manipulation.jpg'
            }
        ];

        for (const course of courses) {
            console.log(`Processing course: ${course.id}`);
            // Upsert course
            await query(`
        INSERT INTO courses (id, title, description, difficulty, estimated_time, total_levels, order_index, prerequisite_course_id, thumbnail)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE 
          title=VALUES(title),
          description=VALUES(description),
          order_index=VALUES(order_index),
          prerequisite_course_id=VALUES(prerequisite_course_id)
      `, [course.id, course.title, course.description, course.difficulty, course.estimated_time, course.total_levels, course.order_index, course.prerequisite_course_id, course.thumbnail]);
        }

        // 3. Migrate Challenges
        // Map existing 'course-fullstack' + level -> new course_id
        const levelMappings = {
            1: 'course-web-basics',
            2: 'course-css-mastery',
            3: 'course-js-essentials',
            4: 'course-dom-manipulation'
        };

        for (const [level, newCourseId] of Object.entries(levelMappings)) {
            console.log(`Migrating Level ${level} to ${newCourseId}...`);

            // Update challenges that match course-fullstack and level
            const result = await query(`
        UPDATE challenges 
        SET course_id = ? 
        WHERE (course_id = 'course-fullstack' OR course_id IS NULL) 
          AND level = ?
      `, [newCourseId, level]);

            console.log(`Updated ${result.affectedRows} challenges.`);
        }

        // 4. Update course-fullstack to be hidden or removed?
        // Let's hide it to avoid confusion in the UI, or delete it if safe.
        // For now, let's just make sure it doesn't clutter.
        // await query("DELETE FROM courses WHERE id = 'course-fullstack'");
        // Actually, maybe keep it but remove it from the frontend list by filter?
        // The frontend filters courses. 

        console.log('LSP Migration Completed!');
        process.exit(0);

    } catch (error) {
        console.error('Migration Failed:', error);
        process.exit(1);
    }
}

migrate();
