const { query, transaction } = require('./backend/database/connection');
const fs = require('fs');

/**
 * RESTORE SCRIPT: Re-inserts recovered submissions into the database.
 * Usage: node scripts/restore_submissions.js <input_file.json> [new_challenge_id]
 */

const inputFile = process.argv[2];
const newChallengeId = process.argv[3]; // Optional: if the challenge ID changed

if (!inputFile) {
    console.error("❌ Usage: node scripts/restore_submissions.js <input_file.json> [new_challenge_id]");
    process.exit(1);
}

async function restore() {
    try {
        const data = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
        const submissions = Array.isArray(data) ? data : [data];
        
        console.log(`📡 Preparing to restore ${submissions.length} submissions...`);

        let restoredCount = 0;
        let skippedCount = 0;

        for (const sub of submissions) {
            try {
                // Determine challenge ID
                const targetChallengeId = newChallengeId || sub.challengeId || sub.challenge_id;
                
                if (!targetChallengeId) {
                    console.warn(`⚠️ Skipping submission ${sub.id || 'unknown'} - no challenge ID found.`);
                    skippedCount++;
                    continue;
                }

                // Check if already exists
                const [existing] = await query('SELECT id FROM submissions WHERE id = ?', [sub.id]);
                if (existing) {
                    console.log(`⏩ Skipping ${sub.id} - already exists in database.`);
                    skippedCount++;
                    continue;
                }

                // Re-insert
                // We use the raw properties if they came from Redis/JSON
                await query(
                    `INSERT INTO submissions 
                    (id, challenge_id, user_id, course_id, level, candidate_name, html_code, css_code, js_code, status, submitted_at, final_score, passed, evaluation_result, additional_files)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        sub.id || `sub-restored-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                        targetChallengeId,
                        sub.userId || sub.user_id || 'user-demo-student',
                        sub.courseId || sub.course_id || null,
                        sub.level || null,
                        sub.candidateName || sub.candidate_name || 'Restored User',
                        sub.code?.html || sub.html_code || '',
                        sub.code?.css || sub.css_code || '',
                        sub.code?.js || sub.js_code || '',
                        sub.status || 'passed',
                        sub.submittedAt || sub.submitted_at || new Date().toISOString().slice(0, 19).replace('T', ' '),
                        sub.total_score || sub.final_score || 0,
                        sub.passed || false,
                        typeof sub.result === 'object' ? JSON.stringify(sub.result) : (sub.evaluation_result || null),
                        typeof sub.code?.additionalFiles === 'object' ? JSON.stringify(sub.code.additionalFiles) : (sub.additional_files || '{}')
                    ]
                );
                
                restoredCount++;
                if (restoredCount % 10 === 0) console.log(`✅ Restored ${restoredCount} records...`);
            } catch (innerErr) {
                console.error(`❌ Failed to restore submission ${sub.id}:`, innerErr.message);
                skippedCount++;
            }
        }

        console.log(`\n🎉 Restore complete!`);
        console.log(`✅ Successfully restored: ${restoredCount}`);
        console.log(`⏩ Skipped/Failed: ${skippedCount}`);

    } catch (err) {
        console.error("❌ Restore failed:", err.message);
    } finally {
        process.exit(0);
    }
}

restore();
