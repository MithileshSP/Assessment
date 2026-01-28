const { query } = require('./backend/database/connection');
require('dotenv').config();

async function seedNodeJSChallenge() {
    console.log('🌱 Seeding sample Node.js challenge...');

    const challenge = {
        id: 'nodejs-test-1',
        title: 'Cumulative Even Product',
        description: 'Calculate the product of even numbers between start and end.',
        instructions: '1. Read input from input.txt\n2. Multiply even numbers in range\n3. Print result with specific message',
        challenge_type: 'nodejs',
        course_id: 'course-fullstack',
        level: 2,
        points: 100,
        expected_js: `const fs = require("fs");
const data = fs.readFileSync("input.txt", "utf8").trim();

function cumulativeEvenProduct(start, end) {
  let product = 1;
  let found = false;
  for (let i = start; i <= end; i++) {
    if (i % 2 === 0) {
      product *= i;
      found = true;
    }
  }
  if (!found) {
    console.log("No even numbers found");
  } else {
    console.log("Product of even numbers:", product);
  }
}

const lines = data.split("\\n");
lines.forEach((line, index) => {
  const [start, end] = line.trim().split(/\\s+/).map(Number);
  console.log(\`\\nTest Case \${index + 1}\`);
  cumulativeEvenProduct(start, end);
});`,
        expected_output: `
Test Case 1
Product of even numbers: 3840

Test Case 2
Product of even numbers: 24

Test Case 3
No even numbers found

Test Case 4
Product of even numbers: 384

Test Case 5
No even numbers found`,
        tags: JSON.stringify(['nodejs', 'fs', 'algorithms']),
        passing_threshold: JSON.stringify({ overall: 70 }),
        assets: JSON.stringify({
            files: {
                'input.txt': '1 10\n3 7\n5 5\n2 8\n9 11'
            }
        })
    };

    try {
        await query(`
      INSERT INTO challenges (id, title, description, instructions, challenge_type, course_id, level, points, expected_js, expected_output, tags, passing_threshold, assets, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
      ON DUPLICATE KEY UPDATE 
      title = VALUES(title),
      description = VALUES(description),
      instructions = VALUES(instructions),
      challenge_type = VALUES(challenge_type),
      expected_js = VALUES(expected_js),
      expected_output = VALUES(expected_output),
      assets = VALUES(assets)
    `, [
            challenge.id, challenge.title, challenge.description, challenge.instructions,
            challenge.challenge_type, challenge.course_id, challenge.level, challenge.points,
            challenge.expected_js, challenge.expected_output, challenge.tags,
            challenge.passing_threshold, challenge.assets
        ]);
        console.log('✅ Sample challenge seeded: nodejs-test-1');
    } catch (err) {
        console.error('❌ Failed to seed challenge:', err.message);
    } finally {
        process.exit(0);
    }
}

seedNodeJSChallenge();
