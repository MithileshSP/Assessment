/**
 * Challenge Model
 * Database operations for challenges table
 */

const { query, queryOne } = require('../database/connection');

class ChallengeModel {
  // Get all challenges
  static async findAll() {
    try {
      const challenges = await query(`
        SELECT c.*, u.full_name as creator_name 
        FROM challenges c 
        LEFT JOIN users u ON c.created_by = u.id 
        ORDER BY c.created_at DESC
      `);
      return challenges.map(c => ChallengeModel._formatChallenge(c));
    } catch (error) {
      console.error('Error in findAll:', error.message);
      throw error;
    }
  }

  // Get challenge by ID
  static async findById(id) {
    const challenge = await queryOne(`
      SELECT c.*, u.full_name as creator_name 
      FROM challenges c 
      LEFT JOIN users u ON c.created_by = u.id 
      WHERE c.id = ?
    `, [id]);
    return challenge ? ChallengeModel._formatChallenge(challenge) : null;
  }

  // Get challenges by course
  static async findByCourse(courseId) {
    // We now ignore the explicit 'level' column for retrieval logic, assuming 1 course = 1 level
    // But we still filter by level=1 to match the migrated data schema
    const challenges = await query(`
            SELECT c.*, u.full_name as creator_name 
            FROM challenges c 
            LEFT JOIN users u ON c.created_by = u.id 
            WHERE c.course_id = ?
            ORDER BY c.id ASC
        `, [courseId]);

    return challenges.map(row => this._formatChallenge(row));
  }

  // Deprecated: Shim for backward compatibility or strict level access
  static async findByCourseLevel(courseId, level) {
    return this.findByCourse(courseId);
  }

  // Create new challenge
  static async create(challengeData) {
    const id = challengeData.id || `challenge - ${Date.now()}`;
    console.log(`[ChallengeModel] Creating challenge ${id}, createdBy: ${challengeData.createdBy}`);
    await query(
      `INSERT INTO challenges(id, title, description, instructions, tags, passing_threshold, html, css, js, additional_files, expected_html, expected_css, expected_js, expected_screenshot_url, course_id, level, points, hints, assets, created_at, created_by, challenge_type, expected_output)
       VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        challengeData.title,
        challengeData.description,
        challengeData.instructions,
        JSON.stringify(challengeData.tags || []),
        JSON.stringify(challengeData.passingThreshold || { structure: 80, visual: 80, overall: 75 }),
        challengeData.html || '',
        challengeData.css || '',
        challengeData.js || '',
        JSON.stringify(challengeData.additionalFiles || {}),
        challengeData.expectedHtml || challengeData.expectedSolution?.html || '',
        challengeData.expectedCss || challengeData.expectedSolution?.css || '',
        challengeData.expectedJs || challengeData.expectedSolution?.js || '',
        challengeData.expectedScreenshotUrl || null,
        challengeData.courseId || null,
        challengeData.level || 1,
        challengeData.points || 100,
        JSON.stringify(challengeData.hints || []),
        JSON.stringify(challengeData.assets || { images: [], reference: '' }),
        challengeData.createdAt ? new Date(challengeData.createdAt) : new Date(),
        challengeData.createdBy || null,
        challengeData.challengeType || 'web',
        challengeData.expectedOutput || ''
      ]
    );
    return await this.findById(id);
  }

  // Update challenge
  static async update(id, challengeData) {
    await query(
      `UPDATE challenges SET
       title = COALESCE(?, title),
      description = COALESCE(?, description),
      instructions = COALESCE(?, instructions),
      tags = COALESCE(?, tags),
      passing_threshold = COALESCE(?, passing_threshold),
       html = COALESCE(?, html),
       css = COALESCE(?, css),
       js = COALESCE(?, js),
       additional_files = COALESCE(?, additional_files),
      expected_html = COALESCE(?, expected_html),
      expected_css = COALESCE(?, expected_css),
      expected_js = COALESCE(?, expected_js),
      expected_screenshot_url = COALESCE(?, expected_screenshot_url),
      course_id = COALESCE(?, course_id),
      level = COALESCE(?, level),
      points = COALESCE(?, points),
      hints = COALESCE(?, hints),
      assets = COALESCE(?, assets),
      challenge_type = COALESCE(?, challenge_type),
      expected_output = COALESCE(?, expected_output),
      updated_at = NOW()
       WHERE id = ? `,
      [
        challengeData.title !== undefined ? challengeData.title : null,
        challengeData.description !== undefined ? challengeData.description : null,
        challengeData.instructions !== undefined ? challengeData.instructions : null,
        challengeData.tags ? JSON.stringify(challengeData.tags) : null,
        challengeData.passingThreshold ? JSON.stringify(challengeData.passingThreshold) : null,
        challengeData.html !== undefined ? challengeData.html : null,
        challengeData.css !== undefined ? challengeData.css : null,
        challengeData.js !== undefined ? challengeData.js : null,
        challengeData.additionalFiles ? JSON.stringify(challengeData.additionalFiles) : null,
        challengeData.expectedHtml !== undefined ? challengeData.expectedHtml : (challengeData.expectedSolution?.html !== undefined ? challengeData.expectedSolution.html : null),
        challengeData.expectedCss !== undefined ? challengeData.expectedCss : (challengeData.expectedSolution?.css !== undefined ? challengeData.expectedSolution.css : null),
        challengeData.expectedJs !== undefined ? challengeData.expectedJs : (challengeData.expectedSolution?.js !== undefined ? challengeData.expectedSolution.js : null),
        challengeData.expectedScreenshotUrl !== undefined ? challengeData.expectedScreenshotUrl : null,
        challengeData.courseId !== undefined ? challengeData.courseId : null,
        challengeData.level !== undefined ? challengeData.level : null,
        challengeData.points !== undefined ? challengeData.points : null,
        challengeData.hints ? JSON.stringify(challengeData.hints) : null,
        challengeData.assets ? JSON.stringify(challengeData.assets) : null,
        challengeData.challengeType !== undefined ? challengeData.challengeType : null,
        challengeData.expectedOutput !== undefined ? challengeData.expectedOutput : null,
        id
      ]
    );
    return await this.findById(id);
  }
  // Delete challenge
  static async delete(id) {
    await query('DELETE FROM challenges WHERE id = ?', [id]);
  }

  // Get challenge count
  static async count() {
    const result = await queryOne('SELECT COUNT(*) as count FROM challenges');
    return result.count;
  }

  // Helper to safely parse JSON or return default
  static _safeParse(data, defaultValue) {
    if (!data) return defaultValue;
    if (typeof data === 'object') return data;
    try {
      const parsed = JSON.parse(data);
      return parsed;
    } catch (e) {
      // If it's a string but not valid JSON, it might be a simple string or pipe-separated
      if (typeof data === 'string' && data.includes('|')) {
        return data.split('|').map(t => t.trim()).filter(t => t);
      }
      return typeof data === 'string' && data.length > 0 ? [data] : defaultValue;
    }
  }

  // Format challenge for response
  static _formatChallenge(challenge) {
    const tags = ChallengeModel._safeParse(challenge.tags, []);
    const hints = ChallengeModel._safeParse(challenge.hints, []);
    const assets = ChallengeModel._safeParse(challenge.assets, { images: [], reference: '' });
    const passingThreshold = ChallengeModel._safeParse(challenge.passing_threshold, { structure: 80, visual: 80, overall: 75 });

    return {
      id: challenge.id,
      title: challenge.title,
      description: challenge.description,
      instructions: challenge.instructions,
      tags: Array.isArray(tags) ? tags : (typeof tags === 'string' ? [tags] : []),
      passingThreshold,
      hints: Array.isArray(hints) ? hints : (typeof hints === 'string' ? [hints] : []),
      points: challenge.points || 100,
      html: challenge.html || '',
      css: challenge.css || '',
      js: challenge.js || '',
      additionalFiles: ChallengeModel._safeParse(challenge.additional_files, {}),
      expectedSolution: {
        html: challenge.expected_html,
        css: challenge.expected_css,
        js: challenge.expected_js
      },
      expectedHtml: challenge.expected_html,
      expectedCss: challenge.expected_css,
      expectedJs: challenge.expected_js,
      expectedScreenshotUrl: challenge.expected_screenshot_url,
      courseId: challenge.course_id,
      level: challenge.level,
      challengeType: challenge.challenge_type || 'web',
      expectedOutput: challenge.expected_output || '',
      assets,
      createdBy: challenge.created_by,
      creatorName: challenge.creator_name || 'System',
      createdAt: challenge.created_at,
      updatedAt: challenge.updated_at
    };
  }
}

module.exports = ChallengeModel;
