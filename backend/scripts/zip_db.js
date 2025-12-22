const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const sourceDir = path.join(__dirname, '..', 'data');
const outputZip = path.join(__dirname, '..', 'frontend_portal_db_backup.zip');

console.log('📦 Zipping database files...');

// Simple zip using PowerShell on Windows (since user is on Windows)
const command = `powershell -Command "Compress-Archive -Path '${sourceDir}\\*' -DestinationPath '${outputZip}' -Force"`;

exec(command, (error, stdout, stderr) => {
    if (error) {
        console.error(`❌ Error creating zip: ${error.message}`);
        // Fallback: Just list the files
        console.log('Could not zip files automatically. Please manually zip the "backend/data" folder.');
        return;
    }

    if (stderr) {
        // PowerShell might query progress to stderr
    }

    console.log(`✅ Database backup created successfully!`);
    console.log(`📁 File: ${outputZip}`);
    console.log(`\nTo share your database, send this ZIP file to your teammate.`);
    console.log(`They should extract it and overwrite their 'backend/data' folder.`);
});
