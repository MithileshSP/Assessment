const { query } = require('../database/connection');
require('dotenv').config({ path: '../.env' });

async function revert_lsp() {
    console.log('Starting LSP Revert...');

    try {
        // 1. Move challenges back to 'course-fullstack'
        // Map ID -> Level is implicit because 'level' column was preserved.
        // We just need to grab anything that was migrated.

        const lspCourses = [
            'course-web-basics',
            'course-css-mastery',
            'course-js-essentials',
            'course-dom-manipulation'
        ];

        const placeholders = lspCourses.map(() => '?').join(',');

        // Safety check: Ensure we don't overwrite valid new data if any? 
        // User wants ALL new courses removed.

        const result = await query(`
      UPDATE challenges 
      SET course_id = 'course-fullstack' 
      WHERE course_id IN (${placeholders})
    `, lspCourses);

        console.log(`Reverted ${result.affectedRows} challenges to 'course-fullstack'.`);

        // 2. Delete the LSP courses
        const delResult = await query(`
      DELETE FROM courses 
      WHERE id IN (${placeholders})
    `, lspCourses);

        console.log(`Deleted ${delResult.affectedRows} LSP courses.`);

        // 3. Ensure course-fullstack is visible
        // It might differ, strictly update it if needed?
        // User requested "same as before".

        // Also check course-javascript? 
        // It wasn't touched by LSP migration (Level 1 match only updated course-fullstack ones).

        console.log('LSP Revert Completed!');
        process.exit(0);

    } catch (error) {
        console.error('Revert Failed:', error);
        process.exit(1);
    }
}

revert_lsp();
