const fs = require('fs');
try {
    const data = JSON.parse(fs.readFileSync('backend/data/challenges-new.json', 'utf8'));
    const stats = {};
    data.forEach(c => {
        const course = c.courseId || c.course_id || 'unknown';
        const level = c.level;
        const key = `${course}_L${level}`;
        stats[key] = (stats[key] || 0) + 1;
    });
    console.log(JSON.stringify(stats, null, 2));
} catch (e) {
    console.error(e);
}
