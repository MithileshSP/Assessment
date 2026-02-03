const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Force local connection parameters for host-side script
process.env.DB_HOST = '127.0.0.1';
process.env.DB_PORT = '3307';
process.env.DB_PASSWORD = 'gokul';

const { query, queryOne } = require('../database/connection');

async function traceGuardian() {
    console.log('🛡️  Tracing SessionGuardian Logic...');
    try {
        const now = new Date();
        const today = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
        console.log(`Current Time (UTC): ${now.toISOString()}`);
        console.log(`Current Time (Local): ${now.toString()}`);
        console.log(`Today (IST/Kolkata): ${today}`);

        const allUsers = await query("SELECT id, username, full_name, role, is_blocked FROM users");
        console.log(`Total users in DB: ${allUsers.length}`);
        console.table(allUsers);

        const unblockedStudents = allUsers.filter(u => u.is_blocked === 0 && u.role === 'student');
        console.log(`Found ${unblockedStudents.length} unblocked students.`);

        for (const student of unblockedStudents) {
            console.log(`\nChecking student: ${student.full_name} (${student.id}) | Blocked: ${student.is_blocked}`);

            const attendance = await query(
                `SELECT * FROM test_attendance 
                 WHERE user_id = ?
                 ORDER BY requested_at DESC`,
                [student.id]
            );

            if (attendance.length === 0) {
                console.log(' - No attendance records found.');
                continue;
            }

            for (const record of attendance) {
                console.log(` - ID: ${record.id}, Session ID: ${record.session_id}, is_used: ${record.is_used}, Status: ${record.status}`);
            }

            const record = attendance[0];
            console.log(` - Analyzing LATEST record: ID ${record.id}`);

            if (!record.session_id) {
                console.log(' - No session_id linked to record.');
                continue;
            }

            let isExpired = false;
            let endTime = null;

            if (record.session_id.toString().startsWith('daily_')) {
                const dailyId = record.session_id.split('_')[1];
                const daily = await queryOne("SELECT * FROM daily_schedules WHERE id = ?", [dailyId]);

                if (daily) {
                    // Critical: How is this date constructed?
                    endTime = new Date(`${today}T${daily.end_time}`);
                    console.log(` - Daily Schedule found. End Time (Raw): ${daily.end_time}, Constructed: ${endTime.toISOString()}`);
                    if (now > endTime) isExpired = true;
                } else {
                    console.log(` - Daily Schedule ID ${dailyId} NOT FOUND in database.`);
                }
            } else {
                const gs = await queryOne("SELECT * FROM global_test_sessions WHERE id = ?", [record.session_id]);
                if (gs) {
                    const startTime = new Date(gs.start_time);
                    endTime = new Date(startTime.getTime() + gs.duration_minutes * 60000);
                    console.log(` - Manual Session found. Start: ${gs.start_time}, Duration: ${gs.duration_minutes}m, End: ${endTime.toISOString()}`);
                    if (now > endTime) isExpired = true;
                } else {
                    console.log(` - Manual Global Session ID ${record.session_id} NOT FOUND in database.`);
                }
            }

            console.log(` - Result: isExpired = ${isExpired}`);
            if (isExpired) {
                console.log(' - SHOULD BE BLOCKED.');
            } else {
                console.log(' - STILL VALID.');
            }
        }
    } catch (e) {
        console.error('Trace failed:', e.message);
    } finally {
        process.exit(0);
    }
}

traceGuardian();
