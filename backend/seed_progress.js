const fs = require('fs');
const path = require('path');

const progressPath = path.join(__dirname, 'data/user-progress.json');
const usersPath = path.join(__dirname, 'data/users.json');

try {
    const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
    const targetUser = users.find(u => u.email === 'gokulvm.ad24@bitsathy.ac.in');

    if (!targetUser) {
        console.log('User not found');
        process.exit(1);
    }

    let progress = [];
    if (fs.existsSync(progressPath)) {
        progress = JSON.parse(fs.readFileSync(progressPath, 'utf8'));
    }

    let userProg = progress.find(p => p.userId === targetUser.id);
    if (!userProg) {
        userProg = {
            userId: targetUser.id,
            courses: [],
            totalPoints: 0,
            achievements: []
        };
        progress.push(userProg);
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
    }

    // Mark Level 1 as completed
    if (!courseProg.completedLevels.includes(1)) {
        courseProg.completedLevels.push(1);
        courseProg.completedLevels.sort((a, b) => a - b);
        console.log('Marked Level 1 as completed for user', targetUser.id);
    } else {
        console.log('Level 1 already completed');
    }

    fs.writeFileSync(progressPath, JSON.stringify(progress, null, 2));
    console.log('Progress saved.');

} catch (err) {
    console.error(err);
}
