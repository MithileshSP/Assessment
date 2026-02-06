/**
 * Course Model
 * Database operations for courses table with JSON fallback
 */

const { query, queryOne, isConnected } = require('../database/connection');
const fs = require('fs').promises;
const path = require('path');

const COURSES_FILE = path.join(__dirname, '../data/courses.json');

class CourseModel {
  // Load courses from JSON file
  static async loadFromJSON() {
    try {
      const data = await fs.readFile(COURSES_FILE, 'utf8');
      if (!data || data.trim() === '') return [];
      return JSON.parse(data);
    } catch (error) {
      console.error('Error reading courses.json:', error.message);
      // If corrupted, try to return empty to prevent crash
      return [];
    }
  }

  // Save courses to JSON file (Atomic write to prevent corruption)
  static async saveToJSON(courses) {
    const tempPath = `${COURSES_FILE}.tmp`;
    try {
      await fs.writeFile(tempPath, JSON.stringify(courses, null, 2));
      await fs.rename(tempPath, COURSES_FILE);
    } catch (error) {
      console.error('Error writing courses.json:', error.message);
      // Clean up temp file if it exists
      try { await fs.unlink(tempPath); } catch (e) { }
      throw error;
    }
  }

  // Get all courses
  static async findAll() {
    try {
      const courses = await query('SELECT * FROM courses ORDER BY order_index ASC');
      // Parse JSON fields (mysql2 may auto-parse JSON columns, handle both cases)
      return courses.map(course => ({
        ...course,
        orderIndex: course.order_index,
        tags: Array.isArray(course.tags) ? course.tags : JSON.parse(course.tags || '[]'),
        restrictions: Array.isArray(course.restrictions) || typeof course.restrictions === 'object'
          ? course.restrictions
          : JSON.parse(course.restrictions || '{}'),
        levelSettings: Array.isArray(course.level_settings) || typeof course.level_settings === 'object'
          ? course.level_settings
          : JSON.parse(course.level_settings || '{}'),
        passingThreshold: Array.isArray(course.passing_threshold) || typeof course.passing_threshold === 'object'
          ? course.passing_threshold
          : JSON.parse(course.passing_threshold || '{"structure": 80, "visual": 80, "overall": 75}'),
        isLocked: Boolean(course.is_locked),
        isHidden: Boolean(course.is_hidden),
        prerequisiteCourseId: course.prerequisite_course_id || null,
        totalLevels: course.total_levels || 1,
        estimatedTime: course.estimated_time
      }));
    } catch (error) {
      console.log('Database error, falling back to JSON:', error.message);
      return await this.loadFromJSON();
    }
  }

  // Get course by ID
  static async findById(id) {
    try {
      const course = await queryOne('SELECT * FROM courses WHERE id = ?', [id]);
      if (!course) return null;
      return {
        ...course,
        orderIndex: course.order_index,
        tags: Array.isArray(course.tags) ? course.tags : JSON.parse(course.tags || '[]'),
        restrictions: Array.isArray(course.restrictions) || typeof course.restrictions === 'object'
          ? course.restrictions
          : JSON.parse(course.restrictions || '{}'),
        levelSettings: Array.isArray(course.level_settings) || typeof course.level_settings === 'object'
          ? course.level_settings
          : JSON.parse(course.level_settings || '{}'),
        passingThreshold: Array.isArray(course.passing_threshold) || typeof course.passing_threshold === 'object'
          ? course.passing_threshold
          : JSON.parse(course.passing_threshold || '{"structure": 80, "visual": 80, " overall": 75}'),
        isLocked: Boolean(course.is_locked),
        isHidden: Boolean(course.is_hidden),
        prerequisiteCourseId: course.prerequisite_course_id || null,
        totalLevels: course.total_levels || 1,
        estimatedTime: course.estimated_time
      };
    } catch (error) {
      console.log('Database error, falling back to JSON:', error.message);
      const courses = await this.loadFromJSON();
      return courses.find(c => c.id === id) || null;
    }
  }

  // Create new course
  static async create(courseData) {
    const id = courseData.id || `course-${Date.now()}`;

    if (!isConnected()) {
      const courses = await this.loadFromJSON();
      const newCourse = {
        id,
        title: courseData.title,
        description: courseData.description,
        thumbnail: courseData.thumbnail || null,
        icon: courseData.icon || '📚',
        color: courseData.color || '#3B82F6',
        totalLevels: courseData.totalLevels || 1,
        estimatedTime: courseData.estimatedTime || '1 hour',
        difficulty: courseData.difficulty || 'Beginner',
        tags: courseData.tags || [],
        isLocked: courseData.isLocked || false,
        isHidden: courseData.isHidden || false,
        prerequisiteCourseId: courseData.prerequisiteCourseId || null,
        restrictions: courseData.restrictions || {},
        levelSettings: courseData.levelSettings || {},
        passingThreshold: courseData.passingThreshold || { structure: 80, visual: 80, overall: 75 },
        createdAt: new Date().toISOString()
      };
      courses.push(newCourse);
      await this.saveToJSON(courses);
      return newCourse;
    }

    try {
      // Calculate next order index if not provided
      let orderIndex = courseData.orderIndex;
      if (orderIndex === undefined || orderIndex === null) {
        const maxOrderResult = await queryOne('SELECT MAX(order_index) as maxOrder FROM courses');
        const maxOrder = maxOrderResult?.maxOrder || 0;
        orderIndex = Math.floor(maxOrder / 10) * 10 + 10; // Round to next 10s for padding
      }

      await query(
        `INSERT INTO courses (id, title, description, thumbnail, icon, color, total_levels, estimated_time, difficulty, tags, is_locked, is_hidden, prerequisite_course_id, restrictions, level_settings, passing_threshold, order_index, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          courseData.title,
          courseData.description,
          courseData.thumbnail || null,
          courseData.icon || '📚',
          courseData.color || '#3B82F6',
          1, // total_levels always 1
          courseData.estimatedTime || '1 hour',
          courseData.difficulty || 'Beginner',
          JSON.stringify(courseData.tags || []),
          courseData.isLocked || false,
          courseData.isHidden || false,
          courseData.prerequisiteCourseId || null,
          JSON.stringify(courseData.restrictions || {}),
          JSON.stringify(courseData.levelSettings || {}),
          JSON.stringify(courseData.passingThreshold || { structure: 80, visual: 80, overall: 75 }),
          orderIndex,
          courseData.createdAt || new Date()
        ]
      );
    } catch (error) {
      // Re-throw duplicate key errors - don't silently fall back
      if (error.code === 'ER_DUP_ENTRY' || error.errno === 1062) {
        console.error('Duplicate course ID:', id);
        throw new Error(`Course with ID "${id}" already exists.`);
      }

      console.warn('Database create failed, falling back to JSON:', error.message);
      const courses = await this.loadFromJSON();
      const newCourse = {
        id,
        title: courseData.title,
        description: courseData.description,
        thumbnail: courseData.thumbnail || null,
        icon: courseData.icon || '📚',
        color: courseData.color || '#3B82F6',
        totalLevels: courseData.totalLevels || 1,
        estimatedTime: courseData.estimatedTime || '1 hour',
        difficulty: courseData.difficulty || 'Beginner',
        tags: courseData.tags || [],
        isLocked: courseData.isLocked || false,
        isHidden: courseData.isHidden || false,
        prerequisiteCourseId: courseData.prerequisiteCourseId || null,
        restrictions: courseData.restrictions || {},
        levelSettings: courseData.levelSettings || {},
        passingThreshold: courseData.passingThreshold || { structure: 80, visual: 80, overall: 75 },
        createdAt: new Date().toISOString()
      };
      courses.push(newCourse);
      await this.saveToJSON(courses);
      return newCourse;
    }
    return await this.findById(id);
  }

  // Update course
  // Update course
  static async update(id, courseData) {
    console.log('[DEBUG] CourseModel.update input:', { id, isHidden: courseData.isHidden });

    if (!isConnected()) {
      // JSON fallback
      const courses = await this.loadFromJSON();
      const index = courses.findIndex(c => c.id === id);
      if (index === -1) return null;

      courses[index] = {
        ...courses[index],
        ...courseData,
        id,
        updatedAt: new Date().toISOString()
      };
      await this.saveToJSON(courses);
      return courses[index];
    }

    try {
      // 1. Fetch current status
      const existing = await this.findById(id);
      if (!existing) return null;

      // 2. Prepare new values (use existing if undefined)
      const title = courseData.title !== undefined ? courseData.title : existing.title;
      const description = courseData.description !== undefined ? courseData.description : existing.description;
      const thumbnail = courseData.thumbnail !== undefined ? courseData.thumbnail : existing.thumbnail;
      const icon = courseData.icon !== undefined ? courseData.icon : existing.icon;
      const color = courseData.color !== undefined ? courseData.color : existing.color;
      const totalLevels = courseData.totalLevels !== undefined ? courseData.totalLevels : existing.totalLevels;
      const estimatedTime = courseData.estimatedTime !== undefined ? courseData.estimatedTime : existing.estimatedTime;
      const difficulty = courseData.difficulty !== undefined ? courseData.difficulty : existing.difficulty;
      const tags = courseData.tags !== undefined ? JSON.stringify(courseData.tags) : JSON.stringify(existing.tags);
      const isLocked = courseData.isLocked !== undefined ? courseData.isLocked : existing.isLocked;
      const isHidden = courseData.isHidden !== undefined ? courseData.isHidden : existing.isHidden;
      const prerequisiteCourseId = courseData.prerequisiteCourseId !== undefined ? courseData.prerequisiteCourseId : existing.prerequisiteCourseId;
      const restrictions = courseData.restrictions !== undefined ? JSON.stringify(courseData.restrictions) : JSON.stringify(existing.restrictions);
      const levelSettings = courseData.levelSettings !== undefined ? JSON.stringify(courseData.levelSettings) : JSON.stringify(existing.levelSettings);
      const passingThreshold = courseData.passingThreshold !== undefined ? JSON.stringify(courseData.passingThreshold) : JSON.stringify(existing.passingThreshold);

      console.log('[DEBUG] CourseModel.update executing SQL with isHidden:', isHidden);

      const orderIndex = courseData.orderIndex !== undefined ? courseData.orderIndex : (existing.order_index || 0);

      // 3. Update with explicit values
      await query(
        `UPDATE courses SET
         title = ?,
         description = ?,
         thumbnail = ?,
         icon = ?,
         color = ?,
         total_levels = 1,
         estimated_time = ?,
         difficulty = ?,
         tags = ?,
         is_locked = ?,
         is_hidden = ?,
         prerequisite_course_id = ?,
         restrictions = ?,
         level_settings = ?,
         passing_threshold = ?,
         order_index = ?,
         updated_at = NOW()
         WHERE id = ?`,
        [
          title, description, thumbnail, icon, color,
          estimatedTime, difficulty, tags,
          isLocked, isHidden, prerequisiteCourseId, restrictions, levelSettings, passingThreshold, orderIndex, id
        ]
      );

      return await this.findById(id);

    } catch (error) {
      console.warn('Database update failed, falling back to JSON:', error.message);
      // Fallback logic
      const courses = await this.loadFromJSON();
      const index = courses.findIndex(c => c.id === id);
      if (index === -1) return null;

      courses[index] = {
        ...courses[index],
        ...courseData,
        id,
        updatedAt: new Date().toISOString()
      };
      await this.saveToJSON(courses);
      return courses[index];
    }
  }

  // Delete course
  static async delete(id) {
    if (!isConnected()) {
      const courses = await this.loadFromJSON();
      const filtered = courses.filter(c => c.id !== id);
      await this.saveToJSON(filtered);
      return;
    }

    try {
      await query('DELETE FROM courses WHERE id = ?', [id]);
    } catch (error) {
      console.warn('Database delete failed, falling back to JSON:', error.message);
      const courses = await this.loadFromJSON();
      const filtered = courses.filter(c => c.id !== id);
      await this.saveToJSON(filtered);
    }
  }

  // Get course count
  static async count() {
    if (!isConnected()) {
      const courses = await this.loadFromJSON();
      return courses.length;
    }

    const result = await queryOne('SELECT COUNT(*) as count FROM courses');
    return result.count;
  }
}

module.exports = CourseModel;

