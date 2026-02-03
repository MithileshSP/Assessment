const { query, queryOne } = require("./database/connection");

async function diagnose() {
    console.log("🛠️  Internal Diagnostics");
    try {
        const users = await query("SELECT id, username, full_name, is_blocked FROM users WHERE is_blocked = 0 AND role = 'student'");
        console.log(`Unblocked students: ${users.length}`);

        for (const user of users) {
            const attendance = await query(
                "SELECT * FROM test_attendance WHERE user_id = ? ORDER BY requested_at DESC",
                [user.id]
            );
            console.log(`User: ${user.full_name}, Attendance Records: ${attendance.length}`);
            for (const att of attendance) {
                console.log(` - ID: ${att.id}, Session: ${att.session_id}, Used: ${att.is_used}, Identifier: ${att.test_identifier}`);
            }
        }

        const schedules = await query("SELECT * FROM daily_schedules");
        console.log(`Daily Schedules: ${schedules.length}`);
        for (const s of schedules) {
            console.log(` - ID: ${s.id}, ${s.start_time} to ${s.end_time}, Active: ${s.is_active}`);
        }

    } catch (e) {
        console.error("DIAGNOSE FAILED:", e.message);
    }
    process.exit(0);
}

diagnose();
