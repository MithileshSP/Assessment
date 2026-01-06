const fs = require('fs');
const path = require('path');

const usersPath = path.join(__dirname, 'data/users.json');
const progressPath = path.join(__dirname, 'data/user-progress.json');

try {
    const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
    const targetUser = users.find(u => u.email === 'gokulvm.ad24@bitsathy.ac.in');

    if (targetUser) {
        console.log('Found User:', targetUser.id, targetUser.email);
        fs.writeFileSync('user_id.txt', targetUser.id);

        if (fs.existsSync(progressPath)) {
            const progress = JSON.parse(fs.readFileSync(progressPath, 'utf8'));
            const userProg = progress.find(p => p.userId === targetUser.id);
            if (userProg) {
                console.log('User Progress found.');
            }
        }
    } else {
        console.log('User not found.');
    }

} catch (err) {
    console.error('Error:', err);
}
