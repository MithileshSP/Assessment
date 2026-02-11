const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'data/challenges-new.json');

try {
    const data = fs.readFileSync(filePath, 'utf8');
    const challenges = JSON.parse(data);

    const courseId = 'course-fullstack';
    const matching = challenges.filter(c => c.courseId === courseId);

    console.log(`Total challenges: ${challenges.length}`);
    console.log(`Challenges for ${courseId}: ${matching.length}`);

    if (matching.length > 0) {
        console.log("IDs:", matching.map(c => c.id).join(', '));
    }

} catch (err) {
    console.error(err);
}
