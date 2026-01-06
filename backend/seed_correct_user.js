const fs = require('fs');
const path = require('path');

const progressPath = path.join(__dirname, 'data/user-progress.json');
const targetUserId = 'user-1763624344870-riq16a0rp'; // ID from the screenshot URL

try {
    console.log(`Seeding progress for target user: ${targetUserId}`);

    let progress = [];
    if (fs.existsSync(progressPath)) {
        progress = JSON.parse(fs.readFileSync(progressPath, 'utf8'));
    }

    let userProg = progress.find(p => p.userId === targetUserId);
    if (!userProg) {
        userProg = {
            userId: targetUserId,
            courses: [],
            totalPoints: 0,
            achievements: []
        };
        progress.push(userProg);
        console.log('Created new progress entry for user.');
    } else {
        console.log('Found existing progress entry.');
    }

    let courseProg = userProg.courses.find(c => c.courseId === 'course-fullstack');
    if (!courseProg) {
        courseProg = {
            courseId: 'course-fullstack',
            completedLevels: [],
            currentLevel: 1,
            totalPoints: 0
        };
        userProg.courses.push(courseProg);
        console.log('Created course progress.');
    }

    // Mark Level 1 as completed
    if (!courseProg.completedLevels.includes(1)) {
        courseProg.completedLevels.push(1);
        courseProg.completedLevels.sort((a, b) => a - b);
        console.log('Marked Level 1 as completed.');
    } else {
        console.log('Level 1 already completed.');
    }

    // Ensure strictly saved
    fs.writeFileSync(progressPath, JSON.stringify(progress, null, 2));
    console.log('Progress saved successfully.');

} catch (err) {
    console.error('Error seeding progress:', err);
}
