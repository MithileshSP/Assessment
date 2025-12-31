const mysql = require('mysql2/promise');

async function migrateToDocker() {
  // Connect to local MySQL (with data)
  // Use machine IP to access host MySQL from Docker container
  const localConn = await mysql.createConnection({
    host: '10.25.155.220',
    port: 3307,
    user: 'root',
    password: 'gokul',
    database: 'fullstack_test_portal'
  });

  // Connect to Docker MySQL (empty) - use container hostname
  const dockerConn = await mysql.createConnection({
    host: 'portal_mysql',
    port: 3306,
    user: 'root',
    password: 'gokul',
    database: 'fullstack_test_portal'
  });

  try {
    console.log('📡 Migrating data from local MySQL to Docker MySQL...\n');

    // Copy users
    const [users] = await localConn.query('SELECT * FROM users');
    console.log(`Found ${users.length} users in local MySQL`);
    if (users.length > 0) {
      for (const user of users) {
        await dockerConn.query(
          `INSERT IGNORE INTO users (id, username, password, email, full_name, role, created_at, last_login)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [user.id, user.username, user.password, user.email, user.full_name, user.role, user.created_at, user.last_login]
        );
      }
      console.log(`✅ Inserted ${users.length} users\n`);
    }

    // Copy courses
    const [courses] = await localConn.query('SELECT * FROM courses');
    console.log(`Found ${courses.length} courses in local MySQL`);
    if (courses.length > 0) {
      for (const course of courses) {
        await dockerConn.query(
          `INSERT IGNORE INTO courses (id, title, description, thumbnail, icon, color, total_levels, estimated_time, difficulty, tags, is_locked, is_hidden, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [course.id, course.title, course.description, course.thumbnail, course.icon, course.color, course.total_levels, course.estimated_time, course.difficulty, course.tags, course.is_locked, course.is_hidden, course.created_at]
        );
      }
      console.log(`✅ Inserted ${courses.length} courses\n`);
    }

    // Copy challenges
    const [challenges] = await localConn.query('SELECT * FROM challenges');
    console.log(`Found ${challenges.length} challenges in local MySQL`);
    if (challenges.length > 0) {
      for (const challenge of challenges) {
        await dockerConn.query(
          `INSERT IGNORE INTO challenges (id, title, description, difficulty, instructions, tags, time_limit, passing_threshold, expected_html, expected_css, expected_js, course_id, level, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [challenge.id, challenge.title, challenge.description, challenge.difficulty, challenge.instructions, challenge.tags, challenge.time_limit, challenge.passing_threshold, challenge.expected_html, challenge.expected_css, challenge.expected_js, challenge.course_id, challenge.level, challenge.created_at, challenge.updated_at]
        );
      }
      console.log(`✅ Inserted ${challenges.length} challenges\n`);
    }

    // Copy submissions
    const [submissions] = await localConn.query('SELECT * FROM submissions');
    console.log(`Found ${submissions.length} submissions in local MySQL`);
    if (submissions.length > 0) {
      for (const submission of submissions) {
        await dockerConn.query(
          `INSERT IGNORE INTO submissions (id, user_id, challenge_id, html_code, css_code, js_code, submitted_at, result_json, test_passed, evaluation_result)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [submission.id, submission.user_id, submission.challenge_id, submission.html_code, submission.css_code, submission.js_code, submission.submitted_at, submission.result_json, submission.test_passed, submission.evaluation_result]
        );
      }
      console.log(`✅ Inserted ${submissions.length} submissions\n`);
    }

    console.log('🎉 Migration completed successfully!');
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await localConn.end();
    await dockerConn.end();
  }
}

migrateToDocker();
