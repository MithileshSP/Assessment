require('dotenv').config();
const db = require('./database/connection');
const fs = require('fs');

async function exportPrompts() {
    try {
        const query = `
            SELECT 
                s.id as submission_id,
                s.html_code,
                s.css_code,
                s.js_code,
                s.final_score as faculty_score,
                s.course_id,
                c.title as challenge_title,
                c.description as challenge_description,
                c.instructions as challenge_instructions,
                c.expected_html,
                c.expected_css,
                c.expected_js
            FROM submissions s
            JOIN challenges c ON s.challenge_id = c.id
            WHERE s.status IN ('passed', 'failed')
            ORDER BY s.evaluated_at DESC
            LIMIT 30
        `;

        const submissions = await db.query(query);
        console.log(`Found ${submissions.length} evaluated submissions.`);

        const csvRows = [['prompt', 'faculty_score']];

        for (const submission of submissions) {
            // Replicate worker.js prompt logic
            const isHtmlCssCourse = submission.course_id === 'course-html-css' ||
                (submission.challenge_title && submission.challenge_title.toLowerCase().includes('html'));

            const rubric = `
SCORING RUBRIC (TOTAL = 100)
1. Code Quality (0-40)
Generously reward structure, semantic HTML, and overall code cleanliness. (35-40 for genuine attempts).
2. Key Requirements (0-25)
Check if they followed basic instructions and specific challenge goals. (20-25 if they tried).
3. Output & Styling (0-35)
Evaluate if the result looks/works as intended. Be forgiving of minor visual differences. (25-35 for mostly correct output).
`;

            const hasJS = (submission.js_code || "").trim().length > 0;
            const hasUI = ((submission.html_code || "").trim().length > 0) ||
                ((submission.css_code || "").trim().length > 0);

            let focusArea = "General Web Development";
            if (hasJS && !hasUI) focusArea = "Algorithm & Logic (JavaScript)";
            else if (hasUI && !hasJS) focusArea = "UI/UX & Styling (HTML/CSS)";
            else focusArea = "Full Stack Frontend (HTML/CSS/JS)";

            const prompt = `
You are a friendly and encouraging faculty evaluator. Your goal is to provide a "faculty-like" evaluation for a beginner student: 
- **Be forgiving**: Students are beginners. Do not penalize for minor syntax errors, spelling, or small visual differences.
- **Reward effort**: If a student has made a genuine attempt with many lines of code, they should easily pass (Score 80+).
- **Correct but helpful**: Point out major logical flaws, but do it constructively. 
- **Not over-strict**: If the page "looks and works" mostly as expected, give high marks.

Focus Area: ${focusArea}
Course Context: ${isHtmlCssCourse ? "Focus primarily on the balance between HTML structure and CSS styling." : "General programming evaluation."}

**GRADING PRINCIPLES:**
1. Genuine effort/Mostly complete: Score **85-100**.
2. Partially complete/Good progress: Score **80-84**.
3. Only fail (Score < 80) if clearly blank or completely unrelated boilerplate.
4. Value understanding and effort over pixel-perfection.

---

CHALLENGE
Title: ${submission.challenge_title}
Description: ${submission.challenge_description}
Instructions: ${submission.challenge_instructions}

---

STUDENT CODE
HTML: ${submission.html_code || 'No HTML provided'}
CSS: ${submission.css_code || 'No CSS provided'}
JavaScript: ${submission.js_code || 'No JS provided'}

---

EXPECTED LOGIC
HTML: ${submission.expected_html || 'N/A'}
CSS: ${submission.expected_css || 'N/A'}
JS: ${submission.expected_js || 'N/A'}

---

${rubric}

Passing Score: **80**

---

RESPONSE FORMAT
Return ONLY a valid JSON object. You MUST include ALL fields listed below even if the value is 0 or an empty array:
{
"code_quality": number, // Max 40
"key_requirements": number, // Max 25
"output": number, // Max 35
"output_correctness": 0, // Mandatory: use 0
"best_practices": 0, // Mandatory: use 0
"final_score": number, // Sum of (code_quality + key_requirements + output)
"major_issues": ["issue1","issue2"], // Use [] if none
"feedback": "Encouraging faculty feedback (max 2 sentences). Start with something positive."
}

Rules:
* final_score = code_quality + key_requirements + output
`.trim();

            // Escape quotes for CSV and handle newlines inside cells
            const escapedPrompt = `"${prompt.replace(/"/g, '""')}"`;
            const integerScore = Math.round(submission.faculty_score || 0);
            csvRows.push([escapedPrompt, integerScore]);
        }

        const csvContent = csvRows.map(row => row.join(',')).join('\n');
        fs.writeFileSync('evaluations_export.csv', csvContent);
        console.log('Successfully exported to evaluations_export.csv');

    } catch (error) {
        console.error('Export failed:', error);
    } finally {
        process.exit();
    }
}

exportPrompts();
