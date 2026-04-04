const fs = require('fs');
const path = require('path');

/**
 * RECOVERY SCRIPT: Extracts submission data from JSON fallback files.
 * Run this inside the backend directory on the server.
 * 
 * Usage: node scripts/recover_from_json.js [output_file.json]
 */

const dataDir = path.join(__dirname, '../data');
const outputFile = process.argv[2] || 'recovered_submissions_json.json';

async function recover() {
    console.log(`🔍 Scanning directory ${dataDir} for JSON files...`);
    
    try {
        const files = fs.readdirSync(dataDir);
        const submissionFiles = files.filter(f => f.startsWith('submissions_') && f.endsWith('.json'));
        
        console.log(`📡 Found ${submissionFiles.length} submission fallback files.`);

        const recoveredData = [];
        const seenSubmissionIds = new Set();

        for (const file of submissionFiles) {
            const filePath = path.join(dataDir, file);
            console.log(`Reading ${file}...`);
            
            try {
                const content = fs.readFileSync(filePath, 'utf8');
                const data = JSON.parse(content);
                
                // If it's a single submission or an array of submissions
                const submissions = Array.isArray(data) ? data : [data];

                for (const sub of submissions) {
                    if (sub && sub.id && !seenSubmissionIds.has(sub.id)) {
                        // Filter for the affected dates (March 23-26, 2026)
                        const submittedAt = new Date(sub.submitted_at || Date.now());
                        if (submittedAt.getMonth() === 2 && submittedAt.getDate() >= 20) { // March is 2
                            recoveredData.push(sub);
                            seenSubmissionIds.add(sub.id);
                        }
                    }
                }
            } catch (e) {
                console.error(`❌ Failed to parse ${file}: ${e.message}`);
            }
        }

        console.log(`✅ Recovery complete! Found ${recoveredData.length} unique submissions from the target period.`);
        
        if (recoveredData.length > 0) {
            fs.writeFileSync(outputFile, JSON.stringify(recoveredData, null, 2));
            console.log(`💾 Saved recovered data to ${outputFile}`);
        } else {
            console.log("ℹ️ No submissions found in the JSON fallback files for the target period.");
        }

    } catch (err) {
        console.error("❌ Recovery failed:", err.message);
    } finally {
        process.exit(0);
    }
}

recover();
