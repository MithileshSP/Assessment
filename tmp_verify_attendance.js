
const { query, queryOne } = require('./backend/database/connection');
const UserModel = require('./backend/models/User');

async function testFixes() {
    console.log("--- Verifying Bulk Unblock Logic ---");
    
    // Test 1: Fuzzy Matching
    const allCourses = await query("SELECT id, title FROM courses");
    console.log("Available courses:", allCourses.map(c => c.title));
    
    const testCourseName = "Java Script";
    const normalizedQuery = testCourseName.toLowerCase().replace(/[^a-z0-9]/g, '');
    const matched = allCourses.find(c => {
        const normalizedTitle = c.title.toLowerCase().replace(/[^a-z0-9]/g, '');
        return normalizedTitle.includes(normalizedQuery) || normalizedQuery.includes(normalizedTitle);
    });
    console.log(`Matched "${testCourseName}" to:`, matched ? matched.title : "NONE");

    // Test 2: Prerequisite Resolution
    if (matched) {
        const course = await queryOne("SELECT prerequisite_course_id FROM courses WHERE id = ?", [matched.id]);
        console.log(`Prerequisite for ${matched.title}:`, course?.prerequisite_course_id || "None");
    }

    console.log("--- Verification Complete ---");
    process.exit(0);
}

testFixes().catch(err => {
    console.error(err);
    process.exit(1);
});
