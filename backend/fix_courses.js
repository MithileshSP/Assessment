const fs = require('fs');
const path = require('path');

const coursesPath = path.join(__dirname, 'data', 'courses.json');

try {
    const rawData = fs.readFileSync(coursesPath, 'utf8');
    const courses = JSON.parse(rawData);

    console.log(`Original count: ${courses.length}`);

    const uniqueCourses = {};

    courses.forEach(course => {
        if (!uniqueCourses[course.id]) {
            uniqueCourses[course.id] = course;
        } else {
            // Conflict! Choose the "better" one.
            const existing = uniqueCourses[course.id];

            // Criteria 1: Prefer one with prerequisites set
            const existingHasPrereq = existing.prerequisiteCourseId ? 1 : 0;
            const newHasPrereq = course.prerequisiteCourseId ? 1 : 0;

            if (newHasPrereq > existingHasPrereq) {
                console.log(`Replacing ${course.id} (no prereq) with version having prereq: ${course.prerequisiteCourseId}`);
                uniqueCourses[course.id] = course;
            } else if (newHasPrereq === existingHasPrereq) {
                // Criteria 2: Prefer newer created_at
                const existingDate = new Date(existing.createdAt || existing.created_at || 0);
                const newDate = new Date(course.createdAt || course.created_at || 0);

                if (newDate > existingDate) {
                    console.log(`Replacing ${course.id} with newer version (${newDate.toISOString()} vs ${existingDate.toISOString()})`);
                    uniqueCourses[course.id] = course;
                }
            }
        }
    });

    const cleanedCourses = Object.values(uniqueCourses);
    console.log(`Cleaned count: ${cleanedCourses.length}`);

    fs.writeFileSync(coursesPath, JSON.stringify(cleanedCourses, null, 2));
    console.log('Successfully saved cleaned courses.json');

} catch (err) {
    console.error('Error:', err);
}
