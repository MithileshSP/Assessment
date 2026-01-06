const fs = require('fs');
const path = require('path');

// Replicate the path logic from levelAccess.js
const progressPath = path.join(__dirname, 'data/user-progress.json');

const userId = 'user-1763624344870-riq16a0rp';
const courseId = 'course-fullstack';
const level = 1;

console.log('Testing reset logic...');
console.log('Path:', progressPath);

try {
    if (!fs.existsSync(progressPath)) {
        console.error('ERROR: File not found at', progressPath);
        process.exit(1);
    }

    const data = fs.readFileSync(progressPath, 'utf8');
    const allProgress = JSON.parse(data);

    const userProgress = allProgress.find(p => p.userId === userId);
    if (!userProgress) {
        console.error('ERROR: User progress not found');
        process.exit(1);
    }

    const courseProgress = userProgress.courses.find(c => c.courseId === courseId);
    if (!courseProgress) {
        console.error('ERROR: Course progress not found');
        process.exit(1);
    }

    console.log('Before reset:', courseProgress.completedLevels);

    // Simulate reset
    if (courseProgress.completedLevels && courseProgress.completedLevels.includes(level)) {
        courseProgress.completedLevels = courseProgress.completedLevels.filter(l => l !== level);

        // Try writing back
        // fs.writeFileSync(progressPath, JSON.stringify(allProgress, null, 2));
        console.log('Write would succeed. New levels:', courseProgress.completedLevels);
    } else {
        console.log('Level not in completed list.');
    }

} catch (err) {
    console.error('EXCEPTION:', err);
}
