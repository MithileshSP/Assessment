const fs = require('fs');
const path = require('path');

const progressPath = path.join(__dirname, 'data/user-progress.json');
const targetId = 'user-1766467676645-4fgk8gken';

try {
    if (fs.existsSync(progressPath)) {
        const progress = JSON.parse(fs.readFileSync(progressPath, 'utf8'));
        const userProg = progress.find(p => p.userId === targetId);

        if (userProg) {
            console.log('DISK CONTENT:');
            console.log(JSON.stringify(userProg, null, 2));
        } else {
            console.log('User not found in progress file on disk.');
        }
    } else {
        console.log('Progress file not found.');
    }
} catch (err) {
    console.error('Error:', err);
}
